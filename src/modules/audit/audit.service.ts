import { Injectable, Logger } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';

export interface AuditLogEntry {
    tenantId: string;
    userId?: string;
    action: 'CREATE' | 'UPDATE' | 'DELETE';
    entity: string;
    entityId: string;
    oldValues?: Record<string, any>;
    newValues?: Record<string, any>;
    ipAddress?: string;
}

@Injectable()
export class AuditService {
    private readonly logger = new Logger(AuditService.name);

    constructor(private readonly prisma: PrismaService) { }

    async log(entry: AuditLogEntry) {
        try {
            await this.prisma.auditLog.create({
                data: {
                    tenantId: entry.tenantId,
                    userId: entry.userId,
                    action: entry.action,
                    entity: entry.entity,
                    entityId: entry.entityId,
                    oldValues: entry.oldValues ?? undefined,
                    newValues: entry.newValues ?? undefined,
                    ipAddress: entry.ipAddress,
                },
            });

            this.logger.debug(
                `Audit: ${entry.action} ${entry.entity}#${entry.entityId} by user ${entry.userId ?? 'system'}`,
            );
        } catch (error) {
            // Audit logging should never break the main flow
            this.logger.error(`Failed to write audit log: ${error}`);
        }
    }
}
