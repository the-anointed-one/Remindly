import {
    Injectable,
    Logger,
} from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import { TwilioProvider } from './twilio.provider';
import { MockSendService } from './mock-send.service';
import { ConfigService } from '@nestjs/config';
import { AuditService } from '../audit/audit.service';

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
    ) {
        this.useTwilio = !!this.configService.get('TWILIO_ACCOUNT_SID');
    }

    /**
     * Send a message via the appropriate provider.
     * Falls back to mock if Twilio is not configured.
     */
    async send(
        tenantId: string,
        channel: 'SMS' | 'VOICE' | 'EMAIL',
        to: string,
        content: string,
        reminderId?: string,
        appointmentData?: { title: string; customerName: string; time: string },
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
            const result = await this.mockSendService.sendEmail(to, 'Reminder', content);
            success = result.success;
            providerMessageId = result.providerMessageId;
            error = result.error;
        }

        // Log the message
        if (success) {
            await this.prisma.messageLog.create({
                data: {
                    tenantId,
                    reminderId,
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

        return { success, providerMessageId, error };
    }
}
