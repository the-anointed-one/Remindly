import { Injectable, Logger, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import { AuditService } from '../audit/audit.service';
import { CreateLocationDto, UpdateLocationDto } from './dto/location.dto';

@Injectable()
export class LocationsService {
  private readonly logger = new Logger(LocationsService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly auditService: AuditService,
  ) {}

  async create(tenantId: string, userId: string, dto: CreateLocationDto) {
    const location = await this.prisma.location.create({
      data: {
        tenantId,
        name: dto.name,
        address: dto.address,
        timezone: dto.timezone ?? 'UTC',
        phone: dto.phone,
      },
    });

    await this.auditService.log({
      tenantId,
      userId,
      action: 'CREATE',
      entity: 'Location',
      entityId: location.id,
      newValues: dto as any,
    });

    this.logger.log(
      `Location "${location.name}" created for tenant ${tenantId}`,
    );
    return location;
  }

  async findAll(tenantId: string) {
    const locations = await this.prisma.location.findMany({
      where: { tenantId },
      orderBy: { name: 'asc' },
      include: {
        _count: { select: { appointments: true } },
      },
    });

    return locations.map((l) => ({
      ...l,
      appointmentCount: l._count.appointments,
      _count: undefined,
    }));
  }

  async findOne(tenantId: string, id: string) {
    const location = await this.prisma.location.findFirst({
      where: { id, tenantId },
      include: {
        _count: { select: { appointments: true } },
        appointments: {
          where: {
            status: { in: ['SCHEDULED', 'CONFIRMED'] },
            scheduledAt: { gte: new Date() },
          },
          orderBy: { scheduledAt: 'asc' },
          take: 10,
          include: { customer: true },
        },
      },
    });

    if (!location) throw new NotFoundException('Location not found');

    return {
      ...location,
      appointmentCount: location._count.appointments,
      _count: undefined,
    };
  }

  async update(
    tenantId: string,
    userId: string,
    id: string,
    dto: UpdateLocationDto,
  ) {
    const existing = await this.findOne(tenantId, id);

    const location = await this.prisma.location.update({
      where: { id },
      data: {
        name: dto.name,
        address: dto.address,
        timezone: dto.timezone,
        phone: dto.phone,
        isActive: dto.isActive,
      },
    });

    await this.auditService.log({
      tenantId,
      userId,
      action: 'UPDATE',
      entity: 'Location',
      entityId: id,
      oldValues: {
        name: existing.name,
        address: existing.address,
        isActive: existing.isActive,
      },
      newValues: dto as any,
    });

    return location;
  }

  async remove(tenantId: string, userId: string, id: string) {
    await this.findOne(tenantId, id);

    // Null-out the location_id on associated appointments (FK is SET NULL)
    await this.prisma.appointment.updateMany({
      where: { tenantId, locationId: id },
      data: { locationId: null },
    });

    await this.prisma.location.delete({ where: { id } });

    await this.auditService.log({
      tenantId,
      userId,
      action: 'DELETE',
      entity: 'Location',
      entityId: id,
    });

    return { deleted: true };
  }

  /** Lightweight list for dropdowns — only id + name + timezone */
  async findAllSlim(tenantId: string) {
    return this.prisma.location.findMany({
      where: { tenantId, isActive: true },
      select: { id: true, name: true, timezone: true, phone: true },
      orderBy: { name: 'asc' },
    });
  }
}
