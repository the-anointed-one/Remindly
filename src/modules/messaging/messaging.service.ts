import { Injectable, Logger } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import { TwilioProvider } from './twilio.provider';
import { MockSendService } from './mock-send.service';
import { ConfigService } from '@nestjs/config';
import { AuditService } from '../audit/audit.service';
import { ActivityType } from '@prisma/client';
import { EmailProvider } from '../email/email.provider';

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
  ) {
    let providerMessageId: string | undefined;
    let success = false;
    let error: string | undefined;

    if (channel === 'SMS') {
      if (this.useTwilio) {
        const result = await this.twilioProvider.sendSms(to, content);
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
          html: `<p>${content}</p>`,
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
          .catch(() => {});
      }
    }

    return { success, providerMessageId, error };
  }
}
