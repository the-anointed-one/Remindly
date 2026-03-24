import { Module } from '@nestjs/common';
import { ReschedulingService } from './rescheduling.service';
import { ReminderModule } from '../reminder/reminder.module';
import { TwilioProvider } from '../messaging/twilio.provider';
import { MockSendService } from '../messaging/mock-send.service';

@Module({
  imports: [ReminderModule],
  providers: [ReschedulingService, TwilioProvider, MockSendService],
  exports: [ReschedulingService],
})
export class ReschedulingModule {}
