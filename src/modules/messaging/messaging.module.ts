import { Module } from '@nestjs/common';
import { MessagingController } from './messaging.controller';
import { MessagingService } from './messaging.service';
import { MockSendService } from './mock-send.service';
import { TwilioProvider } from './twilio.provider';
import { TwilioWebhookController } from './twilio-webhook.controller';
import { ReminderModule } from '../reminder/reminder.module';

@Module({
    imports: [ReminderModule],
    controllers: [MessagingController, TwilioWebhookController],
    providers: [MessagingService, MockSendService, TwilioProvider],
    exports: [MessagingService, MockSendService, TwilioProvider],
})
export class MessagingModule { }
