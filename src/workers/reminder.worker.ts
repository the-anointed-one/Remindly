import { Worker, Queue, Job } from 'bullmq';
import { PrismaClient, ChannelType, ActivityType } from '@prisma/client';
import * as twilio from 'twilio';
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
import { MockSendService } from '../modules/messaging/mock-send.service';
import { AuditService } from '../modules/audit/audit.service';
import { MessagingService } from '../modules/messaging/messaging.service';

const configService = new ConfigService();
const auditService = new AuditService(prisma as any);
const messagingService = new MessagingService(
  prisma as any,
  configService,
  new TwilioProvider(configService),
  new MockSendService(),
  auditService,
  new EmailProvider(configService),
);

const useTwilio = !!(
  process.env.TWILIO_ACCOUNT_SID && process.env.TWILIO_AUTH_TOKEN
);
const twilioClient = useTwilio
  ? twilio.default(
      process.env.TWILIO_ACCOUNT_SID,
      process.env.TWILIO_AUTH_TOKEN,
    )
  : null;

const dlq = new Queue<ReminderJobData>(REMINDER_DLQ, { connection });
const unreadCheckQueue = new Queue<UnreadCheckJobData>(UNREAD_CHECK_QUEUE, {
  connection,
});

logger.log(
  `🔧 Starting Meetora reminder worker (Twilio: ${useTwilio ? 'ENABLED' : 'DISABLED'})...`,
);

// ── Send Logic ──────────────────────────────

async function sendViaTwilio(
  channel: string,
  to: string,
  content: string,
  job: Job<ReminderJobData>,
): Promise<{ success: boolean; providerMessageId?: string; error?: string }> {
  if (!twilioClient) return { success: false, error: 'Twilio not configured' };

  try {
    if (channel === 'SMS') {
      const webhookUrl = process.env.TWILIO_WEBHOOK_URL;
      const useWebhook = webhookUrl && !webhookUrl.includes('localhost');

      const message = await twilioClient.messages.create({
        to,
        from: process.env.TWILIO_PHONE_NUMBER,
        body: content,
        ...(useWebhook ? { statusCallback: `${webhookUrl}/status` } : {}),
      });
      return { success: true, providerMessageId: message.sid };
    } else if (channel === 'WHATSAPP') {
      const message = await twilioClient.messages.create({
        to: `whatsapp:${to}`,
        from: `whatsapp:${process.env.TWILIO_WHATSAPP_NUMBER}`,
        body: content,
      });
      return { success: true, providerMessageId: message.sid };
    } else if (channel === 'VOICE') {
      const appointment = await prisma.appointment.findFirst({
        where: { id: job.data.appointmentId, tenantId: job.data.tenantId },
        include: { customer: true },
      });

      if (!appointment || !appointment.customer?.phone) {
        logger.warn(
          `Voice skipped — no phone for appointmentId ${job.data.appointmentId}`,
        );
        return {
          success: false,
          error: 'No phone number available for voice call',
        };
      }

      const gatherCallbackUrl = `${process.env.API_BASE_URL}/twilio-webhook/voice-gather`;

      return await messagingService.send(
        job.data.tenantId,
        'VOICE',
        appointment.customer.phone,
        job.data.messageContent ?? '',
        job.data.reminderId,
        {
          title: appointment.title,
          customerName: appointment.customer.firstName ?? 'there',
          time: appointment.scheduledAt.toISOString(),
        },
        undefined,
        appointment.customerId ?? undefined,
      );
    }
    return { success: false, error: `Unsupported channel: ${channel}` };
  } catch (error: any) {
    logger.error(`Twilio ${channel} error: ${error.message}`);
    return { success: false, error: error.message };
  }
}

async function performSend(
  channel: string,
  to: string,
  content: string,
  job: Job<ReminderJobData>,
): Promise<{ success: boolean; providerMessageId?: string; error?: string }> {
  if (
    useTwilio &&
    (channel === 'SMS' || channel === 'WHATSAPP' || channel === 'VOICE')
  ) {
    return sendViaTwilio(channel, to, content, job);
  }

  if (channel === 'EMAIL') {
    const appointment = await prisma.appointment.findFirst({
      where: { id: job.data.appointmentId, tenantId: job.data.tenantId },
      include: { customer: true },
    });

    const recipientEmail = appointment?.customer?.email ?? to;

    if (!recipientEmail) {
      logger.warn(
        `Email skipped — no email address for appointmentId ${job.data.appointmentId}`,
      );
      return { success: false, error: 'No email address available' };
    }

    return messagingService.send(
      job.data.tenantId,
      'EMAIL',
      recipientEmail,
      job.data.messageContent ?? '',
      job.data.reminderId,
      appointment
        ? {
            title: appointment.title,
            customerName: appointment.customer?.firstName ?? 'there',
            time: appointment.scheduledAt.toISOString(),
          }
        : undefined,
      undefined,
      appointment?.customerId ?? undefined,
    );
  }

  logger.warn(
    `Unhandled channel: ${channel} for reminder ${job.data.reminderId}`,
  );
  return { success: false, error: `Unhandled channel: ${channel}` };
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
      if (
        automationSettings &&
        !(automationSettings as any).remindNonResponders
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

      for (const p of reminder.event.participants) {
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

    for (const recipientObj of recipients) {
      const recipientStr = recipientObj.phone || recipientObj.email;
      if (!recipientStr) continue;

      const result = await performSend(
        channel,
        recipientStr,
        messageContent || '',
        job,
      );

      if (!result.success) {
        logger.log(`❌ Send failed to ${recipientStr}: ${result.error}`);
        lastError = result.error || 'Unknown error';
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
          .catch(() => {});
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
        'SEND_FAILED',
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
  logger.log(`✓ Job ${job.id} completed`);
});

worker.on(
  'failed',
  async (job: Job<ReminderJobData> | undefined, err: Error) => {
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

// ── Graceful shutdown ────────────────────────

async function shutdown() {
  logger.log('\n🛑 Shutting down worker...');
  await worker.close();
  await unreadCheckWorker.close();
  await dlq.close();
  await unreadCheckQueue.close();
  await prisma.$disconnect();
  process.exit(0);
}

process.on('SIGTERM', shutdown);
process.on('SIGINT', shutdown);

logger.log('✅ Reminder worker started — listening for jobs');
logger.log(`   Queue:        ${REMINDER_QUEUE}`);
logger.log(`   DLQ:          ${REMINDER_DLQ}`);
logger.log(`   Unread-check: ${UNREAD_CHECK_QUEUE}`);
logger.log(`   Concurrency:  5`);
logger.log(`   Retries:      5 (exponential backoff, 30s base)`);
