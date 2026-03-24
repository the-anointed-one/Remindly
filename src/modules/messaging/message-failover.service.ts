import { Injectable, Logger } from '@nestjs/common';
import { ChannelType } from '@prisma/client';
import { PrismaService } from '../../prisma/prisma.service';
import { MessagingService } from './messaging.service';

/**
 * Fallback trigger reasons — determines which ChannelStrategy gates to check.
 *   'failed'      → message permanently failed (provider error)
 *   'undelivered' → message sent but not delivered to device
 *   'unread'      → message delivered but not read within window
 */
export type FallbackTrigger = 'failed' | 'undelivered' | 'unread';

/**
 * Tenant failover settings stored in tenant.settings JSON field (legacy fallback):
 *   failoverEnabled             boolean  (default: true)
 *   failoverChain               string[] (default: ['SMS', 'WHATSAPP', 'VOICE'])
 *   failoverUnreadWindowMinutes number   (default: 60)
 */

const DEFAULT_CHAIN: ChannelType[] = [
  ChannelType.SMS,
  ChannelType.WHATSAPP,
  ChannelType.VOICE,
];

@Injectable()
export class MessageFailoverService {
  private readonly logger = new Logger(MessageFailoverService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly messagingService: MessagingService,
  ) {}

  /**
   * Detect whether a message (identified by providerMessageId / Twilio SID) has
   * a terminal delivery failure status.
   */
  async detectDeliveryFailure(messageSid: string): Promise<{
    failed: boolean;
    messageLog?: {
      id: string;
      tenantId: string;
      reminderId: string | null;
      channel: ChannelType;
    };
  }> {
    const messageLog = await this.prisma.messageLog.findFirst({
      where: { providerMessageId: messageSid },
      select: {
        id: true,
        tenantId: true,
        reminderId: true,
        channel: true,
        providerStatus: true,
      },
    });

    if (!messageLog) return { failed: false };

    const failedStatuses = ['undelivered', 'failed'];
    return {
      failed: failedStatuses.includes(messageLog.providerStatus ?? ''),
      messageLog: {
        id: messageLog.id,
        tenantId: messageLog.tenantId,
        reminderId: messageLog.reminderId,
        channel: messageLog.channel,
      },
    };
  }

  /**
   * Attempt to deliver the same message via the next channel in the configured
   * fallback chain.
   *
   * Priority for chain resolution:
   *   1. ReminderRule's ChannelStrategy (if reminder has a rule with a strategy)
   *   2. Tenant default ChannelStrategy
   *   3. tenant.settings.failoverChain (legacy JSON config)
   *
   * Called from:
   *   - TwilioWebhookController.handleSmsStatus on undelivered/failed
   *   - reminder.worker on MAX_RETRIES_EXHAUSTED
   */
  async triggerFallbackChannel(
    reminderId: string,
    tenantId: string,
    failedChannel: ChannelType,
    trigger: FallbackTrigger = 'failed',
  ): Promise<{ triggered: boolean; channel?: ChannelType }> {
    const tenant = await this.prisma.tenant.findUnique({
      where: { id: tenantId },
    });
    if (!tenant) return { triggered: false };

    // ── Resolve strategy chain ──
    const strategyChain = await this.resolveChain(
      tenantId,
      reminderId,
      trigger,
      tenant.settings,
    );
    if (!strategyChain) {
      this.logger.debug(`Failover disabled for tenant ${tenantId}`);
      return { triggered: false };
    }

    const { chain, blocked } = strategyChain;
    if (blocked) {
      this.logger.debug(
        `Fallback blocked by strategy config (trigger: ${trigger}) for tenant ${tenantId}`,
      );
      return { triggered: false };
    }

    const currentIndex = chain.indexOf(failedChannel);
    if (currentIndex === -1 || currentIndex >= chain.length - 1) {
      this.logger.log(
        `No fallback available after ${failedChannel} for tenant ${tenantId}`,
      );
      return { triggered: false };
    }

    const nextChannel = chain[currentIndex + 1];

    // Fetch reminder + customer details
    const reminder = await this.prisma.reminder.findUnique({
      where: { id: reminderId },
      include: { appointment: { include: { customer: true } } },
    });

    if (!reminder) return { triggered: false };

    // Plan eligibility: VOICE requires SMS_VOICE or SMS_VOICE_AI
    if (nextChannel === ChannelType.VOICE && tenant.planType === 'SMS') {
      this.logger.warn(
        `Failover to VOICE blocked — plan SMS only for tenant ${tenantId}`,
      );
      await this.logFallbackEvent(
        tenantId,
        reminderId,
        failedChannel,
        nextChannel,
        'Plan does not include VOICE',
        false,
      );
      return { triggered: false };
    }

    const recipient =
      reminder.appointment?.customer?.phone ||
      reminder.appointment?.customer?.email ||
      'unknown';

    const content = reminder.messageContent ?? '';

    const { success } = await this.messagingService.send(
      tenantId,
      nextChannel,
      recipient,
      content,
      reminderId,
    );

    await this.logFallbackEvent(
      tenantId,
      reminderId,
      failedChannel,
      nextChannel,
      `${failedChannel} ${trigger} — escalating to ${nextChannel}`,
      success,
    );

    if (success) {
      this.logger.log(
        `Failover: ${failedChannel} → ${nextChannel} succeeded for reminder ${reminderId}`,
      );
    } else {
      this.logger.warn(
        `Failover: ${failedChannel} → ${nextChannel} also failed for reminder ${reminderId}`,
      );
    }

    return { triggered: true, channel: nextChannel };
  }

  /**
   * Resolve the fallback chain and whether this trigger is permitted.
   * Returns null when failover is globally disabled.
   */
  private async resolveChain(
    tenantId: string,
    reminderId: string,
    trigger: FallbackTrigger,
    tenantSettings: unknown,
  ): Promise<{ chain: ChannelType[]; blocked: boolean } | null> {
    // 1. Check ReminderRule's ChannelStrategy
    const reminder = await this.prisma.reminder.findUnique({
      where: { id: reminderId },
      select: {
        reminderRule: {
          select: {
            channelStrategy: {
              select: {
                chain: true,
                fallbackOnFailed: true,
                fallbackOnUndelivered: true,
                fallbackOnUnread: true,
                isActive: true,
              },
            },
          },
        },
      },
    });

    const ruleStrategy = reminder?.reminderRule?.channelStrategy;
    if (ruleStrategy?.isActive) {
      return {
        chain: ruleStrategy.chain,
        blocked: !this.triggerAllowed(ruleStrategy, trigger),
      };
    }

    // 2. Check tenant's default ChannelStrategy
    const defaultStrategy = await this.prisma.channelStrategy.findFirst({
      where: { tenantId, isDefault: true, isActive: true },
      select: {
        chain: true,
        fallbackOnFailed: true,
        fallbackOnUndelivered: true,
        fallbackOnUnread: true,
      },
    });

    if (defaultStrategy) {
      return {
        chain: defaultStrategy.chain,
        blocked: !this.triggerAllowed(defaultStrategy, trigger),
      };
    }

    // 3. Legacy: tenant.settings JSON config
    const settings = (tenantSettings as Record<string, unknown>) ?? {};
    const enabled = settings.failoverEnabled !== false;
    if (!enabled) return null;

    const chain: ChannelType[] =
      (settings.failoverChain as ChannelType[] | undefined) ?? DEFAULT_CHAIN;
    return { chain, blocked: false };
  }

  private triggerAllowed(
    strategy: {
      fallbackOnFailed: boolean;
      fallbackOnUndelivered: boolean;
      fallbackOnUnread: boolean;
    },
    trigger: FallbackTrigger,
  ): boolean {
    if (trigger === 'failed') return strategy.fallbackOnFailed;
    if (trigger === 'undelivered') return strategy.fallbackOnUndelivered;
    if (trigger === 'unread') return strategy.fallbackOnUnread;
    return true;
  }

  /**
   * Persist a record of the failover attempt.
   */
  async logFallbackEvent(
    tenantId: string,
    reminderId: string | null,
    fromChannel: ChannelType,
    toChannel: ChannelType,
    reason: string,
    success: boolean,
  ): Promise<void> {
    await this.prisma.failoverLog.create({
      data: {
        tenantId,
        reminderId: reminderId ?? undefined,
        fromChannel,
        toChannel,
        reason,
        success,
      },
    });
  }
}
