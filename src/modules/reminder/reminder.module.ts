import { Module } from '@nestjs/common';
import { ReminderController } from './reminder.controller';
import { ReminderService } from './reminder.service';
import { ReminderSchedulerService } from './reminder-scheduler.service';

@Module({
    controllers: [ReminderController],
    providers: [ReminderService, ReminderSchedulerService],
    exports: [ReminderService, ReminderSchedulerService],
})
export class ReminderModule { }
