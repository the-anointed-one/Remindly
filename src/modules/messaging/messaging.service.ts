import { Injectable, Logger } from '@nestjs/common';

@Injectable()
export class MessagingService {
    private readonly logger = new Logger(MessagingService.name);

    async findAll(tenantId: string) {
        this.logger.log(`Listing messages for tenant ${tenantId}`);
        return { message: 'Messaging module — not yet implemented', tenantId };
    }
}
