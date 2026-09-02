import { Worker, Queue, Job } from 'bullmq';
import { PrismaClient, ChannelType, ActivityType } from '@prisma/client';
import { Logger } from '@nestjs/common';
import {
  getRedisConnection,
  REMINDER_QUEUE,
  REMINDER_DLQ,
  UNREAD_CHECK_QUEUE,
  UNREAD_CHECK_JOB_OPTIONS,
  ReminderJobData,
  UnreadCheckJobData,
} from '../queue/queue.config';
import { EmailProvider } from '../modules/email/email.provider';

// ── Bootstrap ────────────────────────────────

import * as dotenv from 'dotenv';
dotenv.config();

const logger = new Logger('ReminderWorker');
const prisma = new PrismaClient();
const connection = getRedisConnection();

// ── Dependency Setup for Messaging ────────────

import { ConfigService } from '@nestjs/config';
import { TwilioProvider } from '../modules/messaging/twilio.provider';
import { TermiiProvider } from '../modules/messaging/termii.provider';
import { MockSendService } from '../modules/messaging/mock-send.service';
import { AuditService } from '../modules/audit/audit.service';
import { MessagingService } from '../modules/messaging/messaging.service';
import { appendRsvpFooter } from '../common/utils/rsvp-footer.util';
import { normalizePhoneForSend } from '../common/utils/normalize-phone.util';
import { PLAN_LIMITS } from '../modules/plan/plan-limits';
import { startWorkerHealthServer } from './worker-health';
import { initSentry, captureException } from '../common/sentry';

// Error tracking — no-op unless SENTRY_DSN is set.
initSentry('reminder-worker');

const configService = new ConfigService();
const auditService = new AuditService(prisma as any);
const messagingService = new MessagingService(
  prisma as any,
  configService,
  new TwilioProvider(configService),
  new MockSendService(),
  auditService,
  new EmailProvider(configService),
  new TermiiProvider(configService),
);

const dlq = new Queue<ReminderJobData>(REMINDER_DLQ, { connection });
const unreadCheckQueue = new Queue<UnreadCheckJobData>(UNREAD_CHECK_QUEUE, {
  connection,
});
// Queue handle for the reminder queue itself — used only by the health endpoint
// (Redis PING + waiting-job count).
const reminderQueue = new Queue<ReminderJobData>(REMINDER_QUEUE, { connection });

// Updated whenever a job completes or fails; the health endpoint flags the
// worker unhealthy if this goes stale while jobs are still waiting in the queue.
let lastJobProcessedAt = Date.now();

logger.log(
  '🔧 Starting Meetora reminder worker (provider routing via MessagingService)...',
);

// ── Send Logic ──────────────────────────────

async function performSend(
  channel: string,
  to: string,
  content: string,
  job: Job<ReminderJobData>,
): Promise<{
  success: boolean;
  providerMessageId?: string;
  error?: string;
  errorCode?: string;
}> {
  // Normalize phone recipients to E.164 at send time so existing rows with
  // loose local formats (e.g. Nigerian "08137999425") are routable: carriers
  // reject non-E.164 numbers, and the Termii/Twilio split below keys off the
  // dialing prefix. Fail loudly if unparseable.
  if (channel === 'SMS' || channel === 'WHATSAPP' || channel === 'VOICE') {
    const normalized = normalizePhoneForSend(to);
    if (!normalized) {
      logger.warn(
        `📵 Invalid phone format for reminder ${job.data.reminderId} (${channel}): "${to}"`,
      );
      return {
        success: false,
        error: `Invalid phone number format: "${to}" — could not normalize to E.164`,
        errorCode: 'INVALID_PHONE_FORMAT',
      };
    }
    to = normalized;
  }

  if (
    channel !== 'SMS' &&
    channel !== 'WHATSAPP' &&
    channel !== 'VOICE' &&
    channel !== 'EMAIL'
  ) {
    logger.warn(
      `Unhandled channel: ${channel} for reminder ${job.data.reminderId}`,
    );
    return { success: false, error: `Unhandled channel: ${channel}` };
  }

  // Every channel goes through MessagingService — it owns provider selection
  // (African numbers → Termii, everything else → Twilio, EMAIL → Resend,
  // VOICE → Twilio TwiML). Never call a provider directly from this worker;
  // doing so silently bypasses the Termii route for African recipients.

  // VOICE needs appointmentData to build the TwiML script, and EMAIL needs the
  // customer's address; SMS/WHATSAPP need neither, so skip the extra query.
  const appointment =
    channel === 'VOICE' || channel === 'EMAIL'
      ? await prisma.appointment.findFirst({
        where: { id: job.data.appointmentId, tenantId: job.data.tenantId },
        include: { customer: true },
      })
      : null;

  const appointmentData = appointment
    ? {
      title: appointment.title,
      customerName: appointment.customer?.firstName ?? 'there',
      time: appointment.scheduledAt.toISOString(),
    }
    : undefined;

  if (channel === 'EMAIL') {
    const recipientEmail = appointment?.customer?.email ?? to;
    if (!recipientEmail) {
      logger.warn(
        `Email skipped — no email address for appointmentId ${job.data.appointmentId}`,
      );
      return { success: false, error: 'No email address available' };
    }
    to = recipientEmail;
  }

  // Without appointmentData MessagingService falls through to the mock sender
  // for VOICE, which would look like a success but place no call.
  if (channel === 'VOICE' && !appointmentData) {
    logger.warn(
      `Voice skipped — no appointment found for appointmentId ${job.data.appointmentId}`,
    );
    return { success: false, error: 'No appointment found for voice reminder' };
  }

  // suppressLog: every performSend call site writes its own MessageLog row and
  // uses the returned id downstream (scheduleUnreadCheck). providerMessageId is
  // UNIQUE, so letting MessagingService log too makes the worker's insert throw.
  return messagingService.send(
    job.data.tenantId,
    channel,
    to,
    content,
    job.data.reminderId,
    appointmentData,
    undefined,
    appointment?.customerId ?? undefined,
    true,
  );
}

// ── Plan validation ──────────────────────────

async function validatePlanEligibility(
  tenantId: string,
  channel: string,
): Promise<{ allowed: boolean; reason?: string }> {
  const tenant = await prisma.tenant.findUnique({ where: { id: tenantId } });

  if (!tenant) return { allowed: false, reason: 'Tenant not found' };

  const now = new Date();

  if (tenant.trialActive) {
    if (tenant.trialEndDate && now > tenant.trialEndDate) {
      if (tenant.subscriptionStatus !== 'ACTIVE') {
        return {
          allowed: false,
          reason: 'Trial expired with no active subscription',
        };
      }
    }

    if (channel === 'VOICE') {
      return { allowed: false, reason: 'Voice disabled during trial' };
    }

    if (channel === 'SMS' && tenant.smsUsageCount >= tenant.smsTrialLimit) {
      return {
        allowed: false,
        reason: `Trial SMS limit reached (${tenant.smsTrialLimit})`,
      };
    }

    if (channel === 'AI' && tenant.aiUsageCount >= tenant.aiTrialLimit) {
      return {
        allowed: false,
        reason: `Trial AI limit reached (${tenant.aiTrialLimit})`,
      };
    }
  } else {
    if (tenant.subscriptionStatus !== 'ACTIVE') {
      return { allowed: false, reason: 'No active subscription' };
    }

    if (channel === 'VOICE' && tenant.planType === 'SMS') {
      return {
        allowed: false,
        reason: 'Voice requires SMS_VOICE or SMS_VOICE_AI plan',
      };
    }

    // Monthly SMS cap for active subscriptions. There is no per-tenant column
    // for this (unlike whatsapp/ai monthly limits), so the cap comes from
    // PLAN_LIMITS keyed by the tenant's plan. A missing/zero limit is treated
    // as "don't block" so a config gap never blocks a paying customer.
    if (channel === 'SMS') {
      const smsMonthlyLimit = PLAN_LIMITS[tenant.planType]?.smsMonthlyLimit ?? 0;
      if (smsMonthlyLimit > 0 && tenant.smsUsageCount >= smsMonthlyLimit) {
        return {
          allowed: false,
          reason: `Monthly SMS limit reached (${smsMonthlyLimit})`,
        };
      }
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
        : channel === 'WHATSAPP'
          ? 'whatsappUsageCount'
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
    create: { tenantId, reminderId, errorCode, errorMessage, retryCount },
    update: { errorCode, errorMessage, retryCount, lastRetryAt: new Date() },
  });
}

// ── Strategy resolution ──────────────────────

interface StrategyConfig {
  id: string;
  chain: string[];
  fallbackOnFailed: boolean;
  fallbackOnUndelivered: boolean;
  fallbackOnUnread: boolean;
  unreadWindowMinutes: number;
}

async function resolveStrategy(
  tenantId: string,
  channelStrategyId?: string,
): Promise<StrategyConfig | null> {
  if (channelStrategyId) {
    const strategy = await prisma.channelStrategy.findUnique({
      where: { id: channelStrategyId },
      select: {
        id: true,
        chain: true,
        fallbackOnFailed: true,
        fallbackOnUndelivered: true,
        fallbackOnUnread: true,
        unreadWindowMinutes: true,
      },
    });
    if (strategy) return { ...strategy, chain: strategy.chain as string[] };
  }

  // Fall back to tenant's default strategy
  const defaultStrategy = await prisma.channelStrategy.findFirst({
    where: { tenantId, isDefault: true, isActive: true },
    select: {
      id: true,
      chain: true,
      fallbackOnFailed: true,
      fallbackOnUndelivered: true,
      fallbackOnUnread: true,
      unreadWindowMinutes: true,
    },
  });

  if (defaultStrategy)
    return { ...defaultStrategy, chain: defaultStrategy.chain as string[] };

  return null;
}

// ── Failover (strategy-aware) ────────────────

async function triggerFailover(
  reminderId: string,
  tenantId: string,
  failedChannel: string,
  channelStrategyId?: string,
) {
  const tenant = await prisma.tenant.findUnique({ where: { id: tenantId } });
  if (!tenant) return;

  const strategy = await resolveStrategy(tenantId, channelStrategyId);

  let chain: string[];
  if (strategy) {
    if (!strategy.fallbackOnFailed) return;
    chain = strategy.chain;
  } else {
    const settings = (tenant.settings as Record<string, unknown>) ?? {};
    if (settings.failoverEnabled === false) return;
    chain = (settings.failoverChain as string[] | undefined) ?? [
      'SMS',
      'WHATSAPP',
      'VOICE',
    ];
  }

  const currentIndex = chain.indexOf(failedChannel);
  if (currentIndex === -1 || currentIndex >= chain.length - 1) return;

  const nextChannel = chain[currentIndex + 1];

  if (nextChannel === 'VOICE' && tenant.planType === 'SMS') {
    await prisma.failoverLog.create({
      data: {
        tenantId,
        reminderId,
        fromChannel: failedChannel as ChannelType,
        toChannel: nextChannel as ChannelType,
        reason: 'Plan does not include VOICE',
        success: false,
      },
    });
    return;
  }

  const reminder = await prisma.reminder.findUnique({
    where: { id: reminderId },
    include: { appointment: { include: { customer: true } } },
  });
  if (!reminder) return;

  const recipient =
    reminder.appointment?.customer?.phone ||
    reminder.appointment?.customer?.email ||
    'unknown';

  const result = await performSend(
    nextChannel,
    recipient,
    reminder.messageContent ?? '',
    {
      data: {
        ...reminder,
        reminderId,
        appointmentId: reminder.appointmentId || '',
      },
    } as any,
  );

  await prisma.failoverLog.create({
    data: {
      tenantId,
      reminderId,
      fromChannel: failedChannel as ChannelType,
      toChannel: nextChannel as ChannelType,
      reason: `Primary channel ${failedChannel} exhausted all retries`,
      success: result.success,
    },
  });

  if (result.success) {
    await prisma.messageLog.create({
      data: {
        tenantId,
        reminderId,
        channel: nextChannel as ChannelType,
        direction: 'OUTBOUND',
        recipient,
        content: reminder.messageContent,
        providerMessageId: result.providerMessageId,
        providerStatus: 'sent',
        sentAt: new Date(),
      },
    });
    logger.log(
      `🔀 Failover ${failedChannel} → ${nextChannel} succeeded for reminder ${reminderId}`,
    );
  } else {
    logger.warn(
      `🔀 Failover ${failedChannel} → ${nextChannel} also failed for reminder ${reminderId}`,
    );
  }
}

// ── Schedule unread-check job ─────────────────

async function scheduleUnreadCheck(
  jobData: ReminderJobData,
  messageLogId: string,
  strategy: StrategyConfig,
  recipient: string,
) {
  const chainIndex = strategy.chain.indexOf(jobData.channel);
  if (chainIndex === -1 || chainIndex >= strategy.chain.length - 1) return;

  const delayMs = strategy.unreadWindowMinutes * 60 * 1000;
  const jobId = `unread-check-${jobData.reminderId}`;

  const unreadJobData: UnreadCheckJobData = {
    reminderId: jobData.reminderId,
    tenantId: jobData.tenantId,
    strategyId: strategy.id,
    strategyChain: strategy.chain,
    currentChannelIndex: chainIndex,
    recipient,
    messageContent: jobData.messageContent ?? '',
  };

  await unreadCheckQueue.add('check-unread', unreadJobData, {
    ...UNREAD_CHECK_JOB_OPTIONS,
    delay: delayMs,
    jobId,
  });

  logger.log(
    `⏰ Scheduled unread-check for reminder ${jobData.reminderId} in ${strategy.unreadWindowMinutes}m`,
  );
}

// ── Worker processor ─────────────────────────

const worker = new Worker<ReminderJobData>(
  REMINDER_QUEUE,
  async (job: Job<ReminderJobData>) => {
    const { reminderId, tenantId, channel, messageContent, channelStrategyId } =
      job.data;
    const attemptNum = job.attemptsMade + 1;

    logger.log(
      `⏳ Processing reminder ${reminderId} (attempt ${attemptNum}/${job.opts.attempts ?? 5})`,
    );

    const reminder = await prisma.reminder.findUnique({
      where: { id: reminderId },
      include: {
        appointment: { include: { customer: true } },
        event: { include: { participants: { include: { contact: true } } } },
      },
    });

    if (!reminder) {
      logger.log(`⚠️  Reminder ${reminderId} not found — skipping`);
      return;
    }

    if (reminder.status !== 'PENDING') {
      logger.log(
        `⚠️  Reminder ${reminderId} already ${reminder.status} — skipping`,
      );
      return;
    }

    // ── Plan / usage eligibility gate ──────────
    // The guard existed but was never wired in. Enforce trial status,
    // subscription status, and per-channel plan/usage access at *actual send
    // time* so a lapsed, unsubscribed, or over-limit tenant can't rack up
    // Twilio charges. A block here is a policy decision, not a transient send
    // error: mark the reminder CANCELLED (not FAILED), record a distinct reason
    // where it's visible (the contact Reminders tab surfaces FailedReminder),
    // and return early WITHOUT throwing so BullMQ doesn't retry.
    const eligibility = await validatePlanEligibility(tenantId, channel);
    if (!eligibility.allowed) {
      logger.warn(
        `🚫 Reminder ${reminderId} blocked by plan/usage policy (${channel}): ${eligibility.reason}`,
      );
      await prisma.reminder.update({
        where: { id: reminderId },
        data: { status: 'CANCELLED' },
      });
      await logFailedReminder(
        tenantId,
        reminderId,
        'PLAN_NOT_ELIGIBLE',
        eligibility.reason ?? 'Blocked by plan or usage policy',
        attemptNum,
      ).catch(() => {});
      return;
    }

    const recipients: {
      id: string;
      phone: string | null;
      email: string | null;
    }[] = [];

    let automationSettings = null;
    if (reminder.eventId) {
      automationSettings = await (prisma as any).eventAutomation.findUnique({
        where: { eventId: reminder.eventId },
      });
    }

    if (reminder.appointment?.customer) {
      const c = reminder.appointment.customer;
      if (!c.unsubscribed) {
        recipients.push({ id: c.id, phone: c.phone, email: c.email });
      }
    } else if (reminder.event?.participants) {
      // Reminder.contactId names the single participant this row is for — the
      // scheduler already writes one reminder per participant. Ignoring it and
      // looping over every participant meant each of N reminders sent to all N
      // contacts (N² messages per rule), and it would have made a per-contact
      // send_location broadcast the venue to the whole invite list. Fall back to
      // the old fan-out only for rows that name no contact.
      const targets = reminder.contactId
        ? reminder.event.participants.filter(
            (p) => p.contactId === reminder.contactId,
          )
        : reminder.event.participants;

      // "Remind non-responders" governs chasing people who haven't replied, so
      // it must only gate recipients who are actually still non-responders —
      // otherwise it cancels confirm-time messages (e.g. send_location) for any
      // tenant that turned the flag off.
      const chasingNonResponders = targets.some(
        (p) => p.status !== 'confirmed' && p.status !== 'cancelled',
      );

      if (
        automationSettings &&
        !(automationSettings as any).remindNonResponders &&
        chasingNonResponders
      ) {
        logger.log(
          `🚫 Reminders for non-responders disabled for event ${reminder.eventId} — skipping`,
        );
        await prisma.reminder.update({
          where: { id: reminderId },
          data: { status: 'CANCELLED' },
        });
        return;
      }

      for (const p of targets) {
        if (p.status !== 'cancelled' && p.contact && !p.contact.unsubscribed) {
          recipients.push({
            id: p.contact.id,
            phone: p.contact.phone,
            email: p.contact.email,
          });
        }
      }
    }

    if (recipients.length === 0) {
      logger.log(
        `🚫 No eligible recipients found — cancelling reminder ${reminderId}`,
      );
      await prisma.reminder.update({
        where: { id: reminderId },
        data: { status: 'CANCELLED' },
      });
      return;
    }

    let someSuccess = false;
    let lastError = '';
    let lastErrorCode = 'SEND_FAILED';

    for (const recipientObj of recipients) {
      const recipientStr = recipientObj.phone || recipientObj.email;
      if (!recipientStr) continue;

      // Append RSVP footer to event reminders so recipients always know how to respond
      const finalContent = reminder.eventId
        ? appendRsvpFooter(messageContent || '', channel)
        : (messageContent || '');

      const result = await performSend(
        channel,
        recipientStr,
        finalContent,
        job,
      );

      if (!result.success) {
        logger.log(`❌ Send failed to ${recipientStr}: ${result.error}`);
        lastError = result.error || 'Unknown error';
        lastErrorCode = result.errorCode || 'SEND_FAILED';
        continue;
      }

      someSuccess = true;
      await incrementUsage(tenantId, channel);

      const messageLog = await prisma.messageLog.create({
        data: {
          tenantId,
          reminderId,
          channel: channel as ChannelType,
          direction: 'OUTBOUND',
          recipient: recipientStr,
          content: messageContent,
          providerMessageId: result.providerMessageId,
          providerStatus: 'sent',
          sentAt: new Date(),
        },
      });

      logger.log(
        `✅ Reminder ${reminderId} sent successfully to ${recipientStr} → ${result.providerMessageId}`,
      );

      const phone = recipientObj.phone;
      const email = recipientObj.email;
      const contact = await prisma.contact.findFirst({
        where: { tenantId, ...(phone ? { phone } : { email }) },
        select: { id: true },
      });
      if (contact) {
        await prisma.contactActivity
          .create({
            data: {
              tenantId,
              contactId: contact.id,
              activityType: ActivityType.reminder_sent,
              referenceId: reminderId,
              metadata: { channel, recipient: recipientStr },
            },
          })
          .catch(() => { });
      }

      if (channel === 'WHATSAPP') {
        const strategy = await resolveStrategy(tenantId, channelStrategyId);
        if (strategy?.fallbackOnUnread) {
          await scheduleUnreadCheck(
            job.data,
            messageLog.id,
            strategy,
            recipientStr,
          );
        }
      }
    }

    if (!someSuccess) {
      await prisma.reminder.update({
        where: { id: reminderId },
        data: { status: 'FAILED' },
      });
      await logFailedReminder(
        tenantId,
        reminderId,
        lastErrorCode,
        lastError || 'All attempts failed',
        attemptNum,
      );
      throw new Error(lastError || 'All bulk send attempts failed');
    }

    await prisma.reminder.update({
      where: { id: reminderId },
      data: { status: 'SENT', sentAt: new Date() },
    });
  },
  {
    connection,
    concurrency: 5,
    limiter: { max: 10, duration: 1000 },
  },
);

// ── Unread-check worker ──────────────────────

const unreadCheckWorker = new Worker<UnreadCheckJobData>(
  UNREAD_CHECK_QUEUE,
  async (job: Job<UnreadCheckJobData>) => {
    const {
      reminderId,
      tenantId,
      strategyId,
      strategyChain,
      currentChannelIndex,
      recipient,
      messageContent,
    } = job.data;

    logger.log(`🔍 Checking unread status for reminder ${reminderId}`);

    const whatsappChannel = strategyChain[currentChannelIndex];
    const messageLog = await prisma.messageLog.findFirst({
      where: {
        reminderId,
        channel: whatsappChannel as ChannelType,
        direction: 'OUTBOUND',
      },
      orderBy: { createdAt: 'desc' },
    });

    if (!messageLog) {
      logger.log(
        `⚠️  No message log for reminder ${reminderId} — skipping unread check`,
      );
      return;
    }

    if (messageLog.providerStatus === 'read') {
      logger.log(`✅ Reminder ${reminderId} was read — no escalation needed`);
      return;
    }

    if (currentChannelIndex >= strategyChain.length - 1) {
      logger.log(
        `ℹ️  No next channel after ${whatsappChannel} in strategy — giving up`,
      );
      return;
    }

    const nextChannel = strategyChain[currentChannelIndex + 1];

    const tenant = await prisma.tenant.findUnique({ where: { id: tenantId } });
    if (nextChannel === 'VOICE' && tenant?.planType === 'SMS') {
      await prisma.failoverLog.create({
        data: {
          tenantId,
          reminderId,
          fromChannel: whatsappChannel as ChannelType,
          toChannel: nextChannel as ChannelType,
          reason: 'Plan does not include VOICE',
          success: false,
        },
      });
      return;
    }

    const result = await performSend(nextChannel, recipient, messageContent, {
      data: job.data,
    } as any);

    await prisma.failoverLog.create({
      data: {
        tenantId,
        reminderId,
        fromChannel: whatsappChannel as ChannelType,
        toChannel: nextChannel as ChannelType,
        reason: `${whatsappChannel} message unread after ${job.data.strategyChain.length}m window`,
        success: result.success,
      },
    });

    if (result.success) {
      await prisma.messageLog.create({
        data: {
          tenantId,
          reminderId,
          channel: nextChannel as ChannelType,
          direction: 'OUTBOUND',
          recipient,
          content: messageContent,
          providerMessageId: result.providerMessageId,
          providerStatus: 'sent',
          sentAt: new Date(),
        },
      });
      logger.log(
        `🔀 Unread escalation ${whatsappChannel} → ${nextChannel} succeeded for reminder ${reminderId}`,
      );
    } else {
      logger.warn(
        `🔀 Unread escalation ${whatsappChannel} → ${nextChannel} also failed for reminder ${reminderId}`,
      );
    }
  },
  { connection, concurrency: 3 },
);

// ── Event handlers ───────────────────────────

worker.on('completed', (job: Job<ReminderJobData>) => {
  lastJobProcessedAt = Date.now();
  logger.log(`✓ Job ${job.id} completed`);
});

worker.on(
  'failed',
  async (job: Job<ReminderJobData> | undefined, err: Error) => {
    // A failed attempt still means the worker is processing (making progress),
    // so it counts toward liveness even though the send didn't succeed.
    lastJobProcessedAt = Date.now();
    if (!job) return;

    const attemptsMade = job.attemptsMade;
    const maxAttempts = job.opts.attempts ?? 5;

    logger.log(
      `✗ Job ${job.id} failed (attempt ${attemptsMade}/${maxAttempts}): ${err.message}`,
    );

    if (attemptsMade >= maxAttempts) {
      logger.log(`💀 Job ${job.id} exhausted all retries → moving to DLQ`);

      const { reminderId, tenantId, channel, channelStrategyId } = job.data;

      await prisma.reminder.update({
        where: { id: reminderId },
        data: { status: 'FAILED' },
      });
      await dlq.add('dead-reminder', job.data, { removeOnComplete: false });
      await logFailedReminder(
        tenantId,
        reminderId,
        'MAX_RETRIES_EXHAUSTED',
        `Failed after ${maxAttempts} attempts: ${err.message}`,
        attemptsMade,
      );

      await triggerFailover(reminderId, tenantId, channel, channelStrategyId);
    }
  },
);

worker.on('error', (err: Error) => {
  logger.error('Worker error: ' + err.message);
});

unreadCheckWorker.on(
  'failed',
  (_job: Job<UnreadCheckJobData> | undefined, err: Error) => {
    logger.error('Unread-check worker error: ' + err.message);
  },
);

// ── Health endpoint ──────────────────────────
// Internal-only HTTP liveness probe for docker-compose's healthcheck (deeper
// than the old `ps aux | grep`). Not published via docker-compose ports.
const healthServer = startWorkerHealthServer({
  name: 'reminder-worker',
  port: Number(process.env.WORKER_HEALTH_PORT) || 3001,
  queue: reminderQueue,
  getLastProcessedAt: () => lastJobProcessedAt,
  maxIdleMs: Number(process.env.WORKER_HEALTH_MAX_IDLE_MS) || undefined,
  logger,
});

// ── Graceful shutdown ────────────────────────

async function shutdown() {
  logger.log('\n🛑 Shutting down worker...');
  healthServer.close();
  await worker.close();
  await unreadCheckWorker.close();
  await dlq.close();
  await unreadCheckQueue.close();
  await reminderQueue.close();
  await prisma.$disconnect();
  process.exit(0);
}

process.on('SIGTERM', shutdown);
process.on('SIGINT', shutdown);

// ── Process-level safety net ─────────────────
// BullMQ catches errors thrown/rejected inside the job processor itself and
// routes them through the normal 'failed' → retry → DLQ path above. But an
// unhandled rejection or sync throw ANYWHERE else in this process (a stray
// un-awaited promise, a bug in an event handler, a library issue) is not
// caught by BullMQ at all — by default Node kills the whole process for
// those. Docker's `restart: unless-stopped` brings it back, but that's a
// silent crash-and-recover cycle with no record of why, and every
// currently-processing job gets abandoned mid-flight until BullMQ's
// stalled-job recovery picks it back up on the next start. Log it loudly
// instead of dying silently, so a real bug here is visible and diagnosable
// rather than showing up only as "reminders were late for a minute."
process.on('unhandledRejection', (reason: unknown) => {
  logger.error(
    `🚨 Unhandled promise rejection in reminder worker: ${reason instanceof Error ? reason.stack : String(reason)}`,
  );
  captureException(reason);
});

process.on('uncaughtException', (err: Error) => {
  logger.error(`🚨 Uncaught exception in reminder worker: ${err.stack}`);
  captureException(err);
});

logger.log('✅ Reminder worker started — listening for jobs');
logger.log(`   Queue:        ${REMINDER_QUEUE}`);
logger.log(`   DLQ:          ${REMINDER_DLQ}`);
logger.log(`   Unread-check: ${UNREAD_CHECK_QUEUE}`);
logger.log(`   Concurrency:  5`);
logger.log(`   Retries:      5 (exponential backoff, 30s base)`);
