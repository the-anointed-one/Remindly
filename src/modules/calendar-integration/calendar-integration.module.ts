import { Module } from '@nestjs/common';
import { CalendarIntegrationController } from './calendar-integration.controller';
import { CalendarIntegrationService } from './calendar-integration.service';
import { GoogleCalendarProvider } from './providers/google-calendar.provider';
import { OutlookCalendarProvider } from './providers/outlook-calendar.provider';
import { ReminderModule } from '../reminder/reminder.module';
import { AutomationModule } from '../automation/automation.module';

@Module({
  imports: [ReminderModule, AutomationModule],
  controllers: [CalendarIntegrationController],
  providers: [
    CalendarIntegrationService,
    GoogleCalendarProvider,
    OutlookCalendarProvider,
  ],
  exports: [CalendarIntegrationService],
})
export class CalendarIntegrationModule {}
