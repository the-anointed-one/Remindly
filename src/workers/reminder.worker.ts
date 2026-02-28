/**
 * Remindly — Reminder Worker Process
 *
 * Runs as a SEPARATE process from the main NestJS app.
 * Start with: npx ts-node src/workers/reminder.worker.ts
 *
 * Responsibilities:
 *   1. Pick up delayed reminder jobs from BullMQ
 *   2. Validate plan eligibility + usage limits before sending
 *   3. Increment usage counters
 *   4. Send via mock (or real) provider
 *   5. Apply exponential retry on failure
 *   6. Move permanently failed jobs to dead-letter queue
 *   7. Log failures to FailedReminder table
 *   8. Idempotency — checks reminder status before processing
 */

import { Worker, Queue, Job } from 'bullmq';
import { PrismaClient } from '@prisma/client';
import {
    REMINDER_QUEUE,
    REMINDER_DLQ,
    getRedisConnection,
    ReminderJobData,
} from '../queue/queue.config';

// ── Bootstrap ────────────────────────────────

// Load env from .env (same as NestJS)
import * as dotenv from 'dotenv';
dotenv.config();

const prisma = new PrismaClient();
const connection = getRedisConnection();

// Dead-letter queue for permanently failed jobs
const dlq = new Queue<ReminderJobData>(REMINDER_DLQ, { connection });

console.log('🔧 Starting Remindly reminder worker...');

// ── Mock send (same logic as MockSendService) ─

async function mockSend(
    channel: string,
    content: string,
): Promise<{ success: boolean; providerMessageId?: string; error?: string }> {
    // Simulate 100–500ms latency
    await new Promise((r) => setTimeout(r, 100 + Math.random() * 400));

    // 5% simulated failure
    if (Math.random() < 0.05) {
        return { success: false, error: `Simulated ${channel} delivery failure` };
    }

    return {
        success: true,
        providerMessageId: `mock_${channel.toLowerCase()}_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`,
    };
}

// ── Plan validation ──────────────────────────

async function validatePlanEligibility(
    tenantId: string,
    channel: string,
): Promise<{ allowed: boolean; reason?: string }> {
    const tenant = await prisma.tenant.findUnique({
        where: { id: tenantId },
    });

    if (!tenant) {
        return { allowed: false, reason: 'Tenant not found' };
    }

    const now = new Date();

    // Trial active?
    if (tenant.trialActive) {
        // Trial expired?
        if (tenant.trialEndDate && now > tenant.trialEndDate) {
            if (tenant.subscriptionStatus !== 'ACTIVE') {
                return {
                    allowed: false,
                    reason: 'Trial expired with no active subscription',
                };
            }
        }

        // Voice disabled during trial
        if (channel === 'VOICE') {
            return {
                allowed: false,
                reason: 'Voice disabled during trial',
            };
        }

        // Trial SMS limit
        if (channel === 'SMS' && tenant.smsUsageCount >= tenant.smsTrialLimit) {
            return {
                allowed: false,
                reason: `Trial SMS limit reached (${tenant.smsTrialLimit})`,
            };
        }

        // Trial AI limit
        if (channel === 'AI' && tenant.aiUsageCount >= tenant.aiTrialLimit) {
            return {
                allowed: false,
                reason: `Trial AI limit reached (${tenant.aiTrialLimit})`,
            };
        }
    } else {
        // Not on trial — must have active subscription
        if (tenant.subscriptionStatus !== 'ACTIVE') {
            return {
                allowed: false,
                reason: 'No active subscription',
            };
        }

        // Plan-level feature check
        if (channel === 'VOICE' && tenant.planType === 'SMS') {
            return {
                allowed: false,
                reason: 'Voice requires SMS_VOICE or SMS_VOICE_AI plan',
            };
        }
    }

    return { allowed: true };
}

// ── Usage increment ──────────────────────────

async function incrementUsage(tenantId: string, channel: string) {
    const field =
        channel === 'SMS'
            ? 'smsUsageCount'
            : channel === 'VOICE'
                ? 'voiceUsageCount'
                : 'aiUsageCount';

    await prisma.tenant.update({
        where: { id: tenantId },
        data: { [field]: { increment: 1 } },
    });
}

// ── Failed reminder logging ─────────────────

async function logFailedReminder(
    tenantId: string,
    reminderId: string,
    errorCode: string,
    errorMessage: string,
    retryCount: number,
) {
    await prisma.failedReminder.upsert({
        where: { reminderId },
        create: {
            tenantId,
            reminderId,
            errorCode,
            errorMessage,
            retryCount,
        },
        update: {
            errorCode,
            errorMessage,
            retryCount,
            lastRetryAt: new Date(),
        },
    });
}

// ── Worker processor ─────────────────────────

const worker = new Worker<ReminderJobData>(
    REMINDER_QUEUE,
    async (job: Job<ReminderJobData>) => {
        const { reminderId, tenantId, channel, messageContent } = job.data;
        const attemptNum = job.attemptsMade + 1;

        console.log(
            `⏳ Processing reminder ${reminderId} (attempt ${attemptNum}/${job.opts.attempts ?? 5})`,
        );

        // ── 1. Idempotency check ──
        const reminder = await prisma.reminder.findUnique({
            where: { id: reminderId },
            include: {
                appointment: { include: { customer: true } },
            },
        });

        if (!reminder) {
            console.log(`⚠️  Reminder ${reminderId} not found — skipping`);
            return; // don't retry
        }

        if (reminder.status !== 'PENDING') {
            console.log(
                `⚠️  Reminder ${reminderId} already ${reminder.status} — skipping`,
            );
            return; // idempotent — already processed
        }

        // ── 2. Plan eligibility check ──
        const planCheck = await validatePlanEligibility(tenantId, channel);
        if (!planCheck.allowed) {
            console.log(`🚫 Plan check failed for ${reminderId}: ${planCheck.reason}`);

            // Mark reminder as failed (don't retry — plan issue, not transient)
            await prisma.reminder.update({
                where: { id: reminderId },
                data: { status: 'FAILED' },
            });

            await logFailedReminder(
                tenantId,
                reminderId,
                'PLAN_INELIGIBLE',
                planCheck.reason!,
                attemptNum,
            );

            // Don't throw — this is a permanent failure, no retry
            return;
        }

        // ── 3. Send ──
        const recipient =
            reminder.appointment.customer.phone ||
            reminder.appointment.customer.email ||
            'unknown';

        const result = await mockSend(channel, messageContent || '');

        if (!result.success) {
            console.log(`❌ Send failed for ${reminderId}: ${result.error}`);

            await logFailedReminder(
                tenantId,
                reminderId,
                'SEND_FAILED',
                result.error || 'Unknown error',
                attemptNum,
            );

            // Throw to trigger BullMQ retry with exponential backoff
            throw new Error(result.error || 'Send failed');
        }

        // ── 4. Success: increment usage + update status ──
        await incrementUsage(tenantId, channel);

        await prisma.reminder.update({
            where: { id: reminderId },
            data: {
                status: 'SENT',
                sentAt: new Date(),
            },
        });

        // Create message log
        await prisma.messageLog.create({
            data: {
                tenantId,
                reminderId,
                channel: channel as any, // ChannelType enum
                direction: 'OUTBOUND',
                recipient,
                content: messageContent,
                providerMessageId: result.providerMessageId,
                providerStatus: 'sent',
                sentAt: new Date(),
            },
        });

        console.log(
            `✅ Reminder ${reminderId} sent successfully → ${result.providerMessageId}`,
        );
    },
    {
        connection,
        concurrency: 5,
        limiter: {
            max: 10,
            duration: 1000, // 10 jobs per second max
        },
    },
);

// ── Event handlers ───────────────────────────

worker.on('completed', (job: Job<ReminderJobData>) => {
    console.log(`✓ Job ${job.id} completed`);
});

worker.on('failed', async (job: Job<ReminderJobData> | undefined, err: Error) => {
    if (!job) return;

    const attemptsMade = job.attemptsMade;
    const maxAttempts = job.opts.attempts ?? 5;

    console.log(
        `✗ Job ${job.id} failed (attempt ${attemptsMade}/${maxAttempts}): ${err.message}`,
    );

    // If all retries exhausted → move to DLQ
    if (attemptsMade >= maxAttempts) {
        console.log(`💀 Job ${job.id} exhausted all retries → moving to DLQ`);

        const { reminderId, tenantId } = job.data;

        // Mark reminder as permanently failed
        await prisma.reminder.update({
            where: { id: reminderId },
            data: { status: 'FAILED' },
        });

        // Add to dead-letter queue for manual inspection
        await dlq.add('dead-reminder', job.data, {
            removeOnComplete: false,
        });

        await logFailedReminder(
            tenantId,
            reminderId,
            'MAX_RETRIES_EXHAUSTED',
            `Failed after ${maxAttempts} attempts: ${err.message}`,
            attemptsMade,
        );
    }
});

worker.on('error', (err: Error) => {
    console.error('Worker error:', err.message);
});

// ── Graceful shutdown ────────────────────────

async function shutdown() {
    console.log('\n🛑 Shutting down worker...');
    await worker.close();
    await dlq.close();
    await prisma.$disconnect();
    process.exit(0);
}

process.on('SIGTERM', shutdown);
process.on('SIGINT', shutdown);

console.log('✅ Reminder worker started — listening for jobs');
console.log(`   Queue: ${REMINDER_QUEUE}`);
console.log(`   DLQ:   ${REMINDER_DLQ}`);
console.log(`   Concurrency: 5`);
console.log(`   Retries: 5 (exponential backoff, 30s base)`);
