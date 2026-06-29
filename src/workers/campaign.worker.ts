/**
 * Meetora — Campaign Worker Process
 *
 * Runs as a SEPARATE process from the main NestJS app.
 * Start with: npx ts-node src/workers/campaign.worker.ts
 */

import { Worker, Queue, Job } from 'bullmq';
import { PrismaClient, ChannelType } from '@prisma/client';
import { Logger } from '@nestjs/common';
import {
  CAMPAIGN_QUEUE,
  CAMPAIGN_DLQ,
  getRedisConnection,
  CampaignJobData,
} from '../queue/queue.config';

import * as dotenv from 'dotenv';
dotenv.config();

const prisma = new PrismaClient();
const connection = getRedisConnection();
const dlq = new Queue<CampaignJobData>(CAMPAIGN_DLQ, { connection });

// ── Dependency Setup for Messaging ────────────

import { ConfigService } from '@nestjs/config';
import { TwilioProvider } from '../modules/messaging/twilio.provider';
import { MockSendService } from '../modules/messaging/mock-send.service';
import { AuditService } from '../modules/audit/audit.service';
import { MessagingService } from '../modules/messaging/messaging.service';
import { EmailProvider } from '../modules/email/email.provider';

const configService = new ConfigService();
const twilioProvider = new TwilioProvider(configService);
const mockSendService = new MockSendService();
const auditService = new AuditService(prisma as any);
const messagingService = new MessagingService(
  prisma as any,
  configService,
  twilioProvider,
  mockSendService,
  auditService,
  new EmailProvider(configService),
);

// ── Template interpolation ───────────────────

function renderTemplate(
  template: string,
  vars: Record<string, string>,
): string {
  return template.replace(/\{\{(\w+)\}\}/g, (match, key) => vars[key] ?? match);
}

function buildTemplateVars(data: CampaignJobData): Record<string, string> {
  const nameParts = (data.contactName ?? '').trim().split(/\s+/);
  return {
    first_name: nameParts[0] ?? '',
    last_name: nameParts.slice(1).join(' ') || '',
    phone: data.recipient ?? '',
    email: '',
    appointment_date: '',
    appointment_time: '',
    business_name: '',
    location: data.locationName ?? '',
    customer_name: data.contactName ?? '',
    contact_name: data.contactName ?? '',
  };
}

// ── Mock send ────────────────────────────────

// ── Plan eligibility check ───────────────────

async function checkEligibility(
  tenantId: string,
  channel: string,
): Promise<{ allowed: boolean; reason?: string }> {
  const tenant = await prisma.tenant.findUnique({ where: { id: tenantId } });
  if (!tenant) return { allowed: false, reason: 'Tenant not found' };

  if (!tenant.trialActive && tenant.subscriptionStatus !== 'ACTIVE') {
    return { allowed: false, reason: 'No active subscription' };
  }

  if (channel === 'VOICE' && tenant.planType === 'SMS') {
    return {
      allowed: false,
      reason: 'Voice requires SMS_VOICE or SMS_VOICE_AI plan',
    };
  }

  if (
    tenant.trialActive &&
    channel === 'SMS' &&
    tenant.smsUsageCount >= tenant.smsTrialLimit
  ) {
    return {
      allowed: false,
      reason: `Trial SMS limit reached (${tenant.smsTrialLimit})`,
    };
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

// ── Worker Class ─────────────────────────────

class CampaignWorker {
  private readonly logger = new Logger(CampaignWorker.name);
  private worker: Worker<CampaignJobData>;

  constructor() {
    this.logger.log('Campaign worker started — listening for jobs');
    this.logger.log(`Queue: ${CAMPAIGN_QUEUE}`);
    this.logger.log(`DLQ: ${CAMPAIGN_DLQ}`);
    this.logger.log('Concurrency: 10');
    this.logger.log(
      `Rate limit: ${process.env.CAMPAIGN_RATE_LIMIT_MAX ?? '50'} sends/${process.env.CAMPAIGN_RATE_LIMIT_DURATION ?? '1000'}ms`,
    );
    this.setupWorker();
  }

  private setupWorker() {
    this.worker = new Worker<CampaignJobData>(
      CAMPAIGN_QUEUE,
      async (job: Job<CampaignJobData>) => {
        const {
          tenantId,
          campaignId,
          contactId,
          recipient,
          channel,
          messageTemplate,
        } = job.data;
        const campaignRecipientId = (job.data as any).campaignRecipientId as
          | string
          | undefined;
        const attemptNum = job.attemptsMade + 1;

        this.logger.log(
          `🎯 Campaign ${campaignId} → contact ${contactId} (attempt ${attemptNum})`,
        );

        if (!recipient) {
          this.logger.log(
            `⚠️  No recipient for contact ${contactId} — skipping`,
          );
          return;
        }

        if (contactId) {
          const contact = await prisma.contact.findUnique({
            where: { id: contactId },
            select: { unsubscribed: true, tenantId: true },
          });
          if (!contact || contact.tenantId !== tenantId) {
            this.logger.log(
              `🚫 Contact ${contactId} not found or belongs to different tenant — skipping`,
            );
            return;
          }
          if (contact.unsubscribed) {
            this.logger.log(`🚫 Contact ${contactId} has opted out — skipping`);
            return;
          }
        }

        const eligible = await checkEligibility(tenantId, channel);
        if (!eligible.allowed) {
          this.logger.log(`🚫 Plan check failed: ${eligible.reason}`);
          if (campaignRecipientId) {
            await prisma.campaignRecipient.update({
              where: { id: campaignRecipientId, campaign: { tenantId } },
              data: { status: 'failed', errorMessage: eligible.reason },
            });
          }
          return;
        }

        const vars = buildTemplateVars(job.data);
        const content = renderTemplate(messageTemplate, vars);

        let result: {
          success: boolean;
          providerMessageId?: string;
          error?: string;
        };

        if (job.data.channel === 'VOICE') {
          const gatherCallbackUrl = `${process.env.API_BASE_URL}/twilio-webhook/voice-gather`;
          result = await messagingService.send(
            job.data.tenantId,
            'VOICE',
            job.data.recipient,
            job.data.messageTemplate,
            undefined,
            {
              title: job.data.messageTemplate,
              customerName: job.data.contactName ?? 'there',
              time: job.data.scheduledFor,
            },
            undefined,
            job.data.contactId,
          );
        } else {
          result = await messagingService.send(
            job.data.tenantId,
            job.data.channel as 'SMS' | 'WHATSAPP' | 'EMAIL',
            job.data.recipient,
            job.data.messageTemplate,
            undefined,
            undefined,
            undefined,
            job.data.contactId,
          );
        }

        if (!result.success) {
          if (
            result.error?.toLowerCase().includes('rate limit') ||
            result.error?.toLowerCase().includes('too many requests')
          ) {
            this.logger.warn(
              `Rate limit hit for job ${job.id} — BullMQ will retry automatically (attempt ${attemptNum})`,
            );
            throw new Error(result.error);
          }

          this.logger.error(
            `❌ Campaign send failed for contact ${contactId}: ${result.error}`,
          );
          if (campaignRecipientId) {
            await prisma.campaignRecipient.update({
              where: { id: campaignRecipientId, campaign: { tenantId } },
              data: { status: 'failed', errorMessage: result.error },
            });
          }
          throw new Error(result.error || 'Send failed');
        }

        await incrementUsage(tenantId, channel);

        await prisma.messageLog.create({
          data: {
            tenantId,
            channel: channel as ChannelType,
            direction: 'OUTBOUND',
            recipient,
            content,
            providerMessageId: result.providerMessageId,
            providerStatus: 'sent',
            sentAt: new Date(),
          },
        });

        if (campaignRecipientId) {
          await prisma.campaignRecipient.update({
            where: { id: campaignRecipientId, campaign: { tenantId } },
            data: { status: 'sent', sentAt: new Date() },
          });
        }

        this.logger.log(
          `✅ Campaign ${campaignId} → ${recipient} sent (${result.providerMessageId})`,
        );
      },
      {
        connection,
        concurrency: 10,
        limiter: {
          max: parseInt(process.env.CAMPAIGN_RATE_LIMIT_MAX ?? '50', 10),
          duration: parseInt(
            process.env.CAMPAIGN_RATE_LIMIT_DURATION ?? '1000',
            10,
          ),
        },
      },
    );

    this.worker.on('completed', (job) => {
      this.logger.log(`✓ Campaign job ${job.id} completed`);
    });

    this.worker.on('failed', async (job, err) => {
      if (!job) return;
      const attemptsMade = job.attemptsMade;
      const maxAttempts = job.opts.attempts ?? 3;

      this.logger.error(
        `✗ Campaign job ${job.id} failed (${attemptsMade}/${maxAttempts}) tenant=${job.data.tenantId}: ${err.message}`,
        err.stack,
      );

      if (attemptsMade >= maxAttempts) {
        this.logger.error(
          `💀 Campaign job ${job.id} exhausted retries → moving to DLQ`,
        );
        await dlq.add('dead-campaign-send', job.data, {
          removeOnComplete: false,
        });
      }
    });

    this.worker.on('error', (err) => {
      this.logger.error(`Campaign worker error: ${err.message}`);
    });
  }

  async shutdown() {
    this.logger.log('\n🛑 Shutting down campaign worker...');
    await this.worker.close();
    await dlq.close();
    await prisma.$disconnect();
    process.exit(0);
  }
}

const campaignWorker = new CampaignWorker();

process.on('SIGTERM', () => campaignWorker.shutdown());
process.on('SIGINT', () => campaignWorker.shutdown());

setInterval(() => { }, 60000);
