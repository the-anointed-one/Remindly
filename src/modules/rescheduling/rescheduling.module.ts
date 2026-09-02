import { Module, forwardRef } from '@nestjs/common';
import { ReschedulingService } from './rescheduling.service';
import { ReminderModule } from '../reminder/reminder.module';
import { TwilioProvider } from '../messaging/twilio.provider';
import { MockSendService } from '../messaging/mock-send.service';
import { AppointmentModule } from '../appointment/appointment.module';

@Module({
  // forwardRef: AppointmentModule → MessagingModule → ReschedulingModule.
  // Needed so a reply-driven reschedule fires the same lifecycle hooks
  // (appointment_rescheduled trigger, contact activity) as a dashboard one.
  imports: [ReminderModule, forwardRef(() => AppointmentModule)],
  providers: [ReschedulingService, TwilioProvider, MockSendService],
  exports: [ReschedulingService],
})
export class ReschedulingModule { }
