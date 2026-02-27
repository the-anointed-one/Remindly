import { Injectable, Logger } from '@nestjs/common';

@Injectable()
export class AnalyticsService {
    private readonly logger = new Logger(AnalyticsService.name);

    async findAll(tenantId: string) {
        this.logger.log(`Listing analytics for tenant ${tenantId}`);
        return { message: 'Analytics module — not yet implemented', tenantId };
    }
}
