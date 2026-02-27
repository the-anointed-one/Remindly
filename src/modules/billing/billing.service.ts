import { Injectable, Logger } from '@nestjs/common';

@Injectable()
export class BillingService {
    private readonly logger = new Logger(BillingService.name);

    async findAll(tenantId: string) {
        this.logger.log(`Listing billing for tenant ${tenantId}`);
        return { message: 'Billing module — not yet implemented', tenantId };
    }
}
