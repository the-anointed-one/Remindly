import { Injectable, Logger } from '@nestjs/common';

@Injectable()
export class ReminderService {
    private readonly logger = new Logger(ReminderService.name);

    async findAll(tenantId: string) {
        this.logger.log(`Listing reminders for tenant ${tenantId}`);
        return { message: 'Reminder module — not yet implemented', tenantId };
    }
}
