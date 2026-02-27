import {
    Injectable,
    Logger,
    NotFoundException,
} from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import { AuditService } from '../audit/audit.service';
import {
    CreateReminderRuleDto,
    UpdateReminderRuleDto,
} from './dto/reminder-rule.dto';

@Injectable()
export class ReminderService {
    private readonly logger = new Logger(ReminderService.name);

    constructor(
        private readonly prisma: PrismaService,
        private readonly auditService: AuditService,
    ) { }

    // ── ReminderRule CRUD ──────────────────────

    async createRule(
        tenantId: string,
        userId: string,
        dto: CreateReminderRuleDto,
    ) {
        const rule = await this.prisma.reminderRule.create({
            data: {
                tenantId,
                name: dto.name,
                channel: dto.channel ?? 'SMS',
                templateId: dto.templateId,
                offsetMinutes: dto.offsetMinutes,
            },
            include: { template: true },
        });

        await this.auditService.log({
            tenantId,
            userId,
            action: 'CREATE',
            entity: 'ReminderRule',
            entityId: rule.id,
            newValues: dto as any,
        });

        this.logger.log(`ReminderRule "${rule.name}" created`);
        return rule;
    }

    async findAllRules(tenantId: string) {
        return this.prisma.reminderRule.findMany({
            where: { tenantId },
            include: { template: true },
            orderBy: { offsetMinutes: 'asc' },
        });
    }

    async findOneRule(tenantId: string, id: string) {
        const rule = await this.prisma.reminderRule.findFirst({
            where: { id, tenantId },
            include: { template: true, reminders: { take: 10, orderBy: { createdAt: 'desc' } } },
        });

        if (!rule) {
            throw new NotFoundException('Reminder rule not found');
        }

        return rule;
    }

    async updateRule(
        tenantId: string,
        userId: string,
        id: string,
        dto: UpdateReminderRuleDto,
    ) {
        const existing = await this.findOneRule(tenantId, id);

        const rule = await this.prisma.reminderRule.update({
            where: { id },
            data: {
                name: dto.name,
                channel: dto.channel,
                templateId: dto.templateId,
                offsetMinutes: dto.offsetMinutes,
                isActive: dto.isActive,
            },
            include: { template: true },
        });

        await this.auditService.log({
            tenantId,
            userId,
            action: 'UPDATE',
            entity: 'ReminderRule',
            entityId: id,
            oldValues: {
                name: existing.name,
                channel: existing.channel,
                offsetMinutes: existing.offsetMinutes,
                isActive: existing.isActive,
            },
            newValues: dto as any,
        });

        return rule;
    }

    async removeRule(tenantId: string, userId: string, id: string) {
        await this.findOneRule(tenantId, id);

        await this.prisma.reminderRule.delete({ where: { id } });

        await this.auditService.log({
            tenantId,
            userId,
            action: 'DELETE',
            entity: 'ReminderRule',
            entityId: id,
        });

        return { deleted: true };
    }
}
