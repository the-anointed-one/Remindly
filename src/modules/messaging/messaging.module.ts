import { Module, forwardRef } from '@nestjs/common';
import { MessagingController } from './messaging.controller';
import { MessagesController } from './messages.controller';
import { MessagingService } from './messaging.service';
import { MockSendService } from './mock-send.service';
import { TwilioProvider } from './twilio.provider';
import { TwilioWebhookController } from './twilio-webhook.controller';
import { TermiiProvider } from './termii.provider';
import { TermiiWebhookController } from './termii-webhook.controller';
import { MessageFailoverService } from './message-failover.service';
import { TemplateRendererService } from './template-renderer.service';
import { BroadcastService } from './broadcast.service';
import { ReminderModule } from '../reminder/reminder.module';
import { ReschedulingModule } from '../rescheduling/rescheduling.module';
import { ComplianceModule } from '../compliance/compliance.module';
import { ReputationModule } from '../reputation/reputation.module';
import { RsvpModule } from '../rsvp/rsvp.module';
import { AppointmentModule } from '../appointment/appointment.module';

@Module({
  imports: [
    ReminderModule,
    ReschedulingModule,
    ComplianceModule,
    forwardRef(() => RsvpModule),
    forwardRef(() => ReputationModule),
    // forwardRef: AppointmentModule imports MessagingModule, so this is circular.
    // Needed so the inbound-reply webhook can run the same lifecycle hooks
    // (automation triggers, contact activity) that a dashboard status change does.
    forwardRef(() => AppointmentModule),
  ],
  controllers: [
    MessagingController,
    MessagesController,
    TwilioWebhookController,
    TermiiWebhookController,
  ],
  providers: [
    MessagingService,
    MockSendService,
    TwilioProvider,
    TermiiProvider,
    MessageFailoverService,
    TemplateRendererService,
    BroadcastService,
  ],
  exports: [
    MessagingService,
    MockSendService,
    TwilioProvider,
    TermiiProvider,
    MessageFailoverService,
    TemplateRendererService,
  ],
})
export class MessagingModule { }
