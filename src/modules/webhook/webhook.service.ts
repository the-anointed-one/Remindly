import { Injectable, Logger } from '@nestjs/common';

@Injectable()
export class WebhookService {
    private readonly logger = new Logger(WebhookService.name);

    async findAll(tenantId: string) {
        this.logger.log(`Listing webhooks for tenant ${tenantId}`);
        return { message: 'Webhook module — not yet implemented', tenantId };
    }
}
