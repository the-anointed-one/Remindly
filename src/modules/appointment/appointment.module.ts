import { Module } from '@nestjs/common';
import { AppointmentController } from './appointment.controller';
import { AppointmentService } from './appointment.service';
import { EventLifecycleService } from './event-lifecycle.service';
import { ReminderModule } from '../reminder/reminder.module';
import { AutomationModule } from '../automation/automation.module';
import { ReputationModule } from '../reputation/reputation.module';
import { MessagingModule } from '../messaging/messaging.module';

@Module({
  imports: [
    ReminderModule,
    AutomationModule,
    ReputationModule,
    MessagingModule,
  ],
  controllers: [AppointmentController],
  providers: [AppointmentService, EventLifecycleService],
  exports: [AppointmentService, EventLifecycleService],
})
export class AppointmentModule {}
