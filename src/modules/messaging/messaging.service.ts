import { Injectable, Logger } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import { TwilioProvider } from './twilio.provider';
import { MockSendService } from './mock-send.service';
import { ConfigService } from '@nestjs/config';
import { AuditService } from '../audit/audit.service';
import { ActivityType } from '@prisma/client';
import { EmailProvider } from '../email/email.provider';
import { normalizePhoneForSend } from '../../common/utils/normalize-phone.util';
import { TermiiProvider } from './termii.provider';
import { isAfricanNumber, getRegion } from './region.helper';

@Injectable()
export class MessagingService {
  private readonly logger = new Logger(MessagingService.name);
  private readonly useTwilio: boolean;

  constructor(
    private readonly prisma: PrismaService,
    private readonly configService: ConfigService,
    private readonly twilioProvider: TwilioProvider,
    private readonly mockSendService: MockSendService,
    private readonly auditService: AuditService,
    private readonly emailProvider: EmailProvider,
    private readonly termiiProvider: TermiiProvider,
  ) {
    this.useTwilio = !!this.configService.get('TWILIO_ACCOUNT_SID');
  }

  /**
   * Send a message via the appropriate provider.
   * Falls back to mock if Twilio is not configured.
   */
  async send(
    tenantId: string,
    channel: 'SMS' | 'VOICE' | 'EMAIL' | 'WHATSAPP',
    to: string,
    content: string,
    reminderId?: string,
    appointmentData?: { title: string; customerName: string; time: string },
    eventId?: string,
    contactId?: string,
    // Callers that write their own MessageLog row (the reminder worker) pass
    // true. providerMessageId is UNIQUE, so a second row for the same send
    // fails the insert outright — this is not merely a cosmetic duplicate.
    suppressLog = false,
  ) {
    let providerMessageId: string | undefined;
    let success = false;
    let error: string | undefined;

    // ── Normalize phone recipients to E.164 ─────
    // Twilio rejects non-E.164 numbers; existing rows may hold loose local
    // formats. Normalize here so campaign/manual sends work on legacy data, and
    // fail loudly (INVALID_PHONE_FORMAT) rather than shipping garbage.
    if (channel === 'SMS' || channel === 'VOICE' || channel === 'WHATSAPP') {
      const normalized = normalizePhoneForSend(to);
      if (!normalized) {
        this.logger.warn(
          `Invalid phone format for ${channel} send (tenant ${tenantId}): "${to}"`,
        );
        if (reminderId) {
          await this.prisma.failedReminder
            .upsert({
              where: { reminderId },
              create: {
                tenantId,
                reminderId,
                errorCode: 'INVALID_PHONE_FORMAT',
                errorMessage: `Invalid phone number format: "${to}" — could not normalize to E.164`,
              },
              update: {
                errorCode: 'INVALID_PHONE_FORMAT',
                errorMessage: `Invalid phone number format: "${to}" — could not normalize to E.164`,
                lastRetryAt: new Date(),
              },
            })
            .catch(() => {});
        }
        return {
          success: false,
          error: `Invalid phone number format: "${to}"`,
          errorCode: 'INVALID_PHONE_FORMAT',
        };
      }
      to = normalized;
    }

    // ── Tenant sender identity ──────────────────
    const tenantSettings = await this.prisma.tenant
      .findUnique({ where: { id: tenantId }, select: { settings: true } })
      .then((t) => (t?.settings as Record<string, unknown>) ?? {});
    const senderPhone = (tenantSettings.senderPhone as string) || undefined;
    const senderEmail = (tenantSettings.senderEmail as string) || undefined;
    const senderName  = (tenantSettings.senderName  as string) || undefined;

    // ── Provider routing ────────────────────────
    // Termii is the primary carrier for African numbers (better deliverability
    // and pricing on those routes); everything else stays on Twilio. `to` is
    // already E.164 here, so the prefix test is reliable.
    const useTermii =
      this.termiiProvider.isConfigured() &&
      (channel === 'SMS' || channel === 'WHATSAPP' || channel === 'VOICE') &&
      isAfricanNumber(to);

    if (useTermii) {
      this.logger.log(
        `Routing ${channel} to ${to} (${getRegion(to)}) via Termii`,
      );

      let result: { success: boolean; messageId?: string; error?: string };
      if (channel === 'SMS') {
        result = await this.termiiProvider.sendSms(to, content);
      } else if (channel === 'WHATSAPP') {
        result = await this.termiiProvider.sendWhatsApp(to, content);
      } else {
        result = await this.termiiProvider.sendVoice(to, content);
      }

      success = result.success;
      providerMessageId = result.messageId;
      error = result.error;
    } else if (channel === 'SMS') {
      if (this.useTwilio) {
        const result = await this.twilioProvider.sendSms(to, content, senderPhone);
        success = result.success;
        providerMessageId = result.providerMessageId;
        error = result.error;
      } else {
        const result = await this.mockSendService.sendSms(to, content);
        success = result.success;
        providerMessageId = result.providerMessageId;
        error = result.error;
      }
    } else if (channel === 'VOICE') {
      if (this.useTwilio && appointmentData) {
        const twiml = TwilioProvider.generateReminderTwiml(
          appointmentData.title,
          appointmentData.customerName,
          appointmentData.time,
          `${this.configService.get('TWILIO_WEBHOOK_URL')}/voice-gather`,
        );
        const result = await this.twilioProvider.sendVoice(to, twiml);
        success = result.success;
        providerMessageId = result.providerCallId;
        error = result.error;
      } else {
        const result = await this.mockSendService.sendVoice(to, content);
        success = result.success;
        providerMessageId = result.providerMessageId;
        error = result.error;
      }
    } else if (channel === 'EMAIL') {
      try {
        await this.emailProvider.send({
          to,
          subject: appointmentData?.title
            ? `Reminder: ${appointmentData.title}`
            : 'You have a reminder from Meetora',
          text: content,
          html: `<p>${content.replace(/\n/g, '<br>')}</p>`,
          fromName: senderName,
          fromEmail: senderEmail,
        });
        success = true;
        providerMessageId = `email_${Date.now()}`;
      } catch (err: any) {
        success = false;
        error = err.message;
      }
    } else if (channel === 'WHATSAPP') {
      if (this.useTwilio) {
        const result = await this.twilioProvider.sendWhatsApp(to, content);
        success = result.success;
        providerMessageId = result.providerMessageId;
        error = result.error;
      } else {
        const result = await this.mockSendService.sendWhatsApp(to, content);
        success = result.success;
        providerMessageId = result.providerMessageId;
        error = result.error;
      }
    }

    // Log the message
    if (success) {
      if (!suppressLog) {
        await this.prisma.messageLog.create({
          data: {
            tenantId,
            reminderId,
            eventId,
            contactId,
            channel,
            direction: 'OUTBOUND',
            recipient: to,
            content,
            providerMessageId,
            providerStatus: 'sent',
            sentAt: new Date(),
          },
        });
      }

      // Log message_sent activity for quick-send (not for reminder/campaign paths which log their own types)
      if (!reminderId) {
        this.prisma.contact
          .findFirst({ where: { tenantId, phone: to }, select: { id: true } })
          .then((c) => {
            if (c) {
              return this.prisma.contactActivity.create({
                data: {
                  tenantId,
                  contactId: c.id,
                  activityType: ActivityType.message_sent,
                  metadata: { channel, to },
                },
              });
            }
          })
          .catch(() => { });
      }
    }

    return { success, providerMessageId, error };
  }
}
