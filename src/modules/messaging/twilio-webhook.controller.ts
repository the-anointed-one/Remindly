import {
    Controller,
    Post,
    Body,
    Headers,
    Logger,
    Req,
    HttpCode,
    HttpStatus,
    ForbiddenException,
} from '@nestjs/common';
import { Public } from '../../common/decorators';
import { PrismaService } from '../../prisma/prisma.service';
import { TwilioProvider } from './twilio.provider';
import { ReminderSchedulerService } from '../reminder/reminder-scheduler.service';
import { AuditService } from '../audit/audit.service';

/**
 * Twilio webhook controller.
 * All endpoints are @Public() — Twilio can't authenticate with JWT.
 * Security is enforced via Twilio signature validation.
 */
@Controller('webhooks/twilio')
export class TwilioWebhookController {
    private readonly logger = new Logger(TwilioWebhookController.name);

    constructor(
        private readonly prisma: PrismaService,
        private readonly twilioProvider: TwilioProvider,
        private readonly reminderScheduler: ReminderSchedulerService,
        private readonly auditService: AuditService,
    ) { }

    // ── SMS Status Callback ────────────────────

    @Public()
    @Post('status')
    @HttpCode(HttpStatus.OK)
    async handleSmsStatus(
        @Body() params: any,
        @Headers('x-twilio-signature') signature: string,
        @Req() req: any,
    ) {
        // Validate Twilio signature
        const fullUrl = `${req.protocol}://${req.get('host')}${req.originalUrl}`;
        const validation = this.twilioProvider.validateWebhook(
            signature || '',
            fullUrl,
            params || {},
        );

        if (!validation.valid) {
            this.logger.warn('Invalid Twilio signature on SMS status webhook');
            throw new ForbiddenException('Invalid signature');
        }

        const messageSid = params?.MessageSid;
        const messageStatus = params?.MessageStatus;

        this.logger.log(`SMS status update: ${messageSid} → ${messageStatus}`);

        // Update message log
        if (messageSid) {
            await this.prisma.messageLog.updateMany({
                where: { providerMessageId: messageSid },
                data: {
                    providerStatus: messageStatus,
                    deliveredAt: messageStatus === 'delivered' ? new Date() : undefined,
                },
            });

            // If delivered, update reminder status
            if (messageStatus === 'delivered') {
                const messageLog = await this.prisma.messageLog.findFirst({
                    where: { providerMessageId: messageSid },
                });
                if (messageLog?.reminderId) {
                    await this.prisma.reminder.update({
                        where: { id: messageLog.reminderId },
                        data: { status: 'DELIVERED' },
                    });
                }
            }
        }

        return '<Response></Response>';
    }

    // ── Inbound SMS (YES/NO replies) ───────────

    @Public()
    @Post('inbound')
    @HttpCode(HttpStatus.OK)
    async handleInboundSms(
        @Body() params: any,
        @Headers('x-twilio-signature') signature: string,
        @Req() req: any,
    ) {
        const fullUrl = `${req.protocol}://${req.get('host')}${req.originalUrl}`;
        const validation = this.twilioProvider.validateWebhook(
            signature || '',
            fullUrl,
            params || {},
        );

        if (!validation.valid) {
            this.logger.warn('Invalid Twilio signature on inbound SMS webhook');
            throw new ForbiddenException('Invalid signature');
        }

        const from = params?.From;
        const body = (params?.Body || '').trim().toUpperCase();
        const messageSid = params?.MessageSid;

        this.logger.log(`Inbound SMS from ${from}: "${body}"`);

        // Log inbound message
        const tenantId = await this.resolveTenantFromPhone(from);
        await this.prisma.messageLog.create({
            data: {
                tenantId,
                channel: 'SMS',
                direction: 'INBOUND',
                recipient: from,
                content: body,
                providerMessageId: messageSid,
                providerStatus: 'received',
                sentAt: new Date(),
            },
        });

        // Process YES/NO/CONFIRM/CANCEL replies
        let responseText = '';

        if (['YES', 'CONFIRM', 'Y', '1'].includes(body)) {
            responseText = 'Thank you! Your appointment has been confirmed.';
            await this.processConfirmation(from);
        } else if (['NO', 'CANCEL', 'N', '2'].includes(body)) {
            responseText =
                'Your appointment has been cancelled. Contact us to reschedule.';
            await this.processCancellation(from);
        } else {
            responseText = 'Reply YES to confirm or NO to cancel your appointment.';
        }

        return `<Response><Message>${responseText}</Message></Response>`;
    }

    // ── Voice IVR Gather Callback ──────────────

    @Public()
    @Post('voice-gather')
    @HttpCode(HttpStatus.OK)
    async handleVoiceGather(
        @Body() params: any,
        @Headers('x-twilio-signature') signature: string,
        @Req() req: any,
    ) {
        const fullUrl = `${req.protocol}://${req.get('host')}${req.originalUrl}`;
        const validation = this.twilioProvider.validateWebhook(
            signature || '',
            fullUrl,
            params || {},
        );

        if (!validation.valid) {
            throw new ForbiddenException('Invalid signature');
        }

        const digit = params?.Digits;
        const callSid = params?.CallSid;
        const from = params?.From;

        this.logger.log(`Voice IVR input: digit=${digit}, callSid=${callSid}`);

        if (digit === '1') {
            await this.processConfirmation(from);
        } else if (digit === '2') {
            await this.processCancellation(from);
        }

        return TwilioProvider.generateGatherResponse(digit);
    }

    // ── Voice Status Callback ──────────────────

    @Public()
    @Post('voice-status')
    @HttpCode(HttpStatus.OK)
    async handleVoiceStatus(@Body() params: any) {
        const callSid = params?.CallSid;
        const callStatus = params?.CallStatus;

        this.logger.log(`Voice status update: ${callSid} → ${callStatus}`);

        return '<Response></Response>';
    }

    // ── Helpers ────────────────────────────────

    private async resolveTenantFromPhone(phone: string): Promise<string> {
        const lastMessage = await this.prisma.messageLog.findFirst({
            where: {
                recipient: phone,
                direction: 'OUTBOUND',
            },
            orderBy: { createdAt: 'desc' },
            select: { tenantId: true },
        });

        return lastMessage?.tenantId || 'unknown';
    }

    private async processConfirmation(phone: string) {
        const customer = await this.prisma.customer.findFirst({
            where: { phone },
        });

        if (!customer) return;

        const appointment = await this.prisma.appointment.findFirst({
            where: {
                customerId: customer.id,
                status: 'SCHEDULED',
                scheduledAt: { gte: new Date() },
            },
            orderBy: { scheduledAt: 'asc' },
        });

        if (appointment) {
            await this.prisma.appointment.update({
                where: { id: appointment.id },
                data: { status: 'CONFIRMED' },
            });

            await this.auditService.log({
                tenantId: customer.tenantId,
                action: 'UPDATE',
                entity: 'Appointment',
                entityId: appointment.id,
                newValues: { status: 'CONFIRMED', via: 'sms_reply' },
            });

            this.logger.log(`Appointment ${appointment.id} confirmed via reply`);
        }
    }

    private async processCancellation(phone: string) {
        const customer = await this.prisma.customer.findFirst({
            where: { phone },
        });

        if (!customer) return;

        const appointment = await this.prisma.appointment.findFirst({
            where: {
                customerId: customer.id,
                status: { in: ['SCHEDULED', 'CONFIRMED'] },
                scheduledAt: { gte: new Date() },
            },
            orderBy: { scheduledAt: 'asc' },
        });

        if (appointment) {
            await this.prisma.appointment.update({
                where: { id: appointment.id },
                data: { status: 'CANCELLED' },
            });

            // Cancel pending reminders
            await this.reminderScheduler.cancelForAppointment(appointment.id);

            await this.auditService.log({
                tenantId: customer.tenantId,
                action: 'UPDATE',
                entity: 'Appointment',
                entityId: appointment.id,
                newValues: { status: 'CANCELLED', via: 'sms_reply' },
            });

            this.logger.log(
                `Appointment ${appointment.id} cancelled via reply + reminders cleared`,
            );
        }
    }
}
