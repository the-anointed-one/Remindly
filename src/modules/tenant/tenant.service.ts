import { Injectable, Logger } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';

@Injectable()
export class TenantService {
    private readonly logger = new Logger(TenantService.name);

    constructor(private readonly prisma: PrismaService) { }

    async findAll(tenantId: string) {
        this.logger.log(`Listing tenants for tenant ${tenantId}`);
        return { message: 'Tenant module — not yet implemented', tenantId };
    }
}
