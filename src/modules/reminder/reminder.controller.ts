import { Controller, Get } from '@nestjs/common';
import { ReminderService } from './reminder.service';
import { CurrentUser } from '../../common/decorators';

@Controller('reminders')
export class ReminderController {
    constructor(private readonly reminderService: ReminderService) { }

    @Get()
    findAll(@CurrentUser('tenantId') tenantId: string) {
        return this.reminderService.findAll(tenantId);
    }
}
