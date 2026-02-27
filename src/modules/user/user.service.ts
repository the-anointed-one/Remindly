import { Injectable, Logger } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';

@Injectable()
export class UserService {
    private readonly logger = new Logger(UserService.name);

    constructor(private readonly prisma: PrismaService) { }

    async findAll(tenantId: string) {
        this.logger.log(`Listing users for tenant ${tenantId}`);
        return { message: 'User module — not yet implemented', tenantId };
    }
}
