import { Module, forwardRef } from '@nestjs/common';
import { MessagingController } from './messaging.controller';
import { MessagesController } from './messages.controller';
import { MessagingService } from './messaging.service';
import { MockSendService } from './mock-send.service';
import { TwilioProvider } from './twilio.provider';
import { TwilioWebhookController } from './twilio-webhook.controller';
import { MessageFailoverService } from './message-failover.service';
import { TemplateRendererService } from './template-renderer.service';
import { BroadcastService } from './broadcast.service';
import { ReminderModule } from '../reminder/reminder.module';
import { ReschedulingModule } from '../rescheduling/rescheduling.module';
import { ComplianceModule } from '../compliance/compliance.module';
import { ReputationModule } from '../reputation/reputation.module';
import { RsvpModule } from '../rsvp/rsvp.module';

@Module({
  imports: [
    ReminderModule,
    ReschedulingModule,
    ComplianceModule,
    forwardRef(() => RsvpModule),
    forwardRef(() => ReputationModule),
  ],
  controllers: [
    MessagingController,
    MessagesController,
    TwilioWebhookController,
  ],
  providers: [
    MessagingService,
    MockSendService,
    TwilioProvider,
    MessageFailoverService,
    TemplateRendererService,
    BroadcastService,
  ],
  exports: [
    MessagingService,
    MockSendService,
    TwilioProvider,
    MessageFailoverService,
    TemplateRendererService,
  ],
})
export class MessagingModule {}
