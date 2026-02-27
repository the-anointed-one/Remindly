import {
    Injectable,
    Logger,
    NotFoundException,
} from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import { AuditService } from '../audit/audit.service';
import { CreateAppointmentDto, UpdateAppointmentDto } from './dto/appointment.dto';

@Injectable()
export class AppointmentService {
    private readonly logger = new Logger(AppointmentService.name);

    constructor(
        private readonly prisma: PrismaService,
        private readonly auditService: AuditService,
    ) { }

    async create(tenantId: string, userId: string, dto: CreateAppointmentDto) {
        const appointment = await this.prisma.appointment.create({
            data: {
                tenantId,
                customerId: dto.customerId,
                title: dto.title,
                scheduledAt: new Date(dto.scheduledAt),
                durationMinutes: dto.durationMinutes ?? 30,
                notes: dto.notes,
            },
            include: { customer: true },
        });

        await this.auditService.log({
            tenantId,
            userId,
            action: 'CREATE',
            entity: 'Appointment',
            entityId: appointment.id,
            newValues: dto as any,
        });

        this.logger.log(`Appointment "${appointment.title}" created`);
        return appointment;
    }

    async findAll(tenantId: string, page = 1, limit = 20) {
        const skip = (page - 1) * limit;

        const [data, total] = await Promise.all([
            this.prisma.appointment.findMany({
                where: { tenantId },
                include: { customer: true },
                orderBy: { scheduledAt: 'asc' },
                skip,
                take: limit,
            }),
            this.prisma.appointment.count({ where: { tenantId } }),
        ]);

        return { data, total, page, limit };
    }

    async findOne(tenantId: string, id: string) {
        const appointment = await this.prisma.appointment.findFirst({
            where: { id, tenantId },
            include: { customer: true, reminders: true },
        });

        if (!appointment) {
            throw new NotFoundException('Appointment not found');
        }

        return appointment;
    }

    async update(
        tenantId: string,
        userId: string,
        id: string,
        dto: UpdateAppointmentDto,
    ) {
        const existing = await this.findOne(tenantId, id);

        const appointment = await this.prisma.appointment.update({
            where: { id },
            data: {
                title: dto.title,
                scheduledAt: dto.scheduledAt ? new Date(dto.scheduledAt) : undefined,
                durationMinutes: dto.durationMinutes,
                status: dto.status,
                notes: dto.notes,
            },
            include: { customer: true },
        });

        await this.auditService.log({
            tenantId,
            userId,
            action: 'UPDATE',
            entity: 'Appointment',
            entityId: id,
            oldValues: {
                title: existing.title,
                scheduledAt: existing.scheduledAt,
                durationMinutes: existing.durationMinutes,
                status: existing.status,
                notes: existing.notes,
            },
            newValues: dto as any,
        });

        return appointment;
    }

    async remove(tenantId: string, userId: string, id: string) {
        await this.findOne(tenantId, id); // ensure it exists + belongs to tenant

        await this.prisma.appointment.delete({ where: { id } });

        await this.auditService.log({
            tenantId,
            userId,
            action: 'DELETE',
            entity: 'Appointment',
            entityId: id,
        });

        return { deleted: true };
    }
}
