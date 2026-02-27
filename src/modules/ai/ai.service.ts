import { Injectable, Logger } from '@nestjs/common';

@Injectable()
export class AIService {
    private readonly logger = new Logger(AIService.name);

    async findAll(tenantId: string) {
        this.logger.log(`Listing AI resources for tenant ${tenantId}`);
        return { message: 'AI module — not yet implemented', tenantId };
    }
}
