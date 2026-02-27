import { Injectable, Logger } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';

@Injectable()
export class AppointmentService {
    private readonly logger = new Logger(AppointmentService.name);

    constructor(private readonly prisma: PrismaService) { }

    async findAll(tenantId: string) {
        this.logger.log(`Listing appointments for tenant ${tenantId}`);
        return { message: 'Appointment module — not yet implemented', tenantId };
    }
}
