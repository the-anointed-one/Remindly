import {
    Controller,
    Post,
    Get,
    Body,
} from '@nestjs/common';
import { MessagingService } from './messaging.service';
import { CurrentUser } from '../../common/decorators';
import { PlanFeature } from '../plan/plan-feature.decorator';
import { UsageValidationService } from '../plan/usage-validation.service';

@Controller('messaging')
export class MessagingController {
    constructor(
        private readonly messagingService: MessagingService,
        private readonly usageValidation: UsageValidationService,
    ) { }

    @PlanFeature('SMS')
    @Post('send-sms')
    async sendSms(
        @CurrentUser('tenantId') tenantId: string,
        @Body() body: { to: string; message: string; reminderId?: string },
    ) {
        return this.messagingService.send(
            tenantId,
            'SMS',
            body.to,
            body.message,
            body.reminderId,
        );
    }

    @PlanFeature('VOICE')
    @Post('send-voice')
    async sendVoice(
        @CurrentUser('tenantId') tenantId: string,
        @Body()
        body: {
            to: string;
            appointmentTitle: string;
            customerName: string;
            appointmentTime: string;
            reminderId?: string;
        },
    ) {
        return this.messagingService.send(
            tenantId,
            'VOICE',
            body.to,
            '', // content not used for voice
            body.reminderId,
            {
                title: body.appointmentTitle,
                customerName: body.customerName,
                time: body.appointmentTime,
            },
        );
    }

    @Get('check')
    async checkUsage(@CurrentUser('tenantId') tenantId: string) {
        const [sms, voice, ai] = await Promise.all([
            this.usageValidation.validate(tenantId, 'SMS'),
            this.usageValidation.validate(tenantId, 'VOICE'),
            this.usageValidation.validate(tenantId, 'AI'),
        ]);
        return { sms, voice, ai };
    }
}
