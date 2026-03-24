import { Injectable, Logger, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import { AuditService } from '../audit/audit.service';
import { CreateTemplateDto, UpdateTemplateDto } from './dto/template.dto';

@Injectable()
export class TemplateService {
  private readonly logger = new Logger(TemplateService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly auditService: AuditService,
  ) {}

  async create(tenantId: string, userId: string, dto: CreateTemplateDto) {
    const template = await this.prisma.template.create({
      data: {
        tenantId,
        name: dto.name,
        channel: dto.channel ?? 'SMS',
        subject: dto.subject,
        body: dto.body,
        variables: dto.variables ?? [],
      },
    });

    await this.auditService.log({
      tenantId,
      userId,
      action: 'CREATE',
      entity: 'Template',
      entityId: template.id,
      newValues: dto as any,
    });

    this.logger.log(`Template "${template.name}" created`);
    return template;
  }

  async findAll(tenantId: string) {
    return this.prisma.template.findMany({
      where: { tenantId },
      orderBy: { createdAt: 'desc' },
    });
  }

  async findOne(tenantId: string, id: string) {
    const template = await this.prisma.template.findFirst({
      where: { id, tenantId },
      include: { reminderRules: true },
    });

    if (!template) {
      throw new NotFoundException('Template not found');
    }

    return template;
  }

  async update(
    tenantId: string,
    userId: string,
    id: string,
    dto: UpdateTemplateDto,
  ) {
    const existing = await this.findOne(tenantId, id);

    const template = await this.prisma.template.update({
      where: { id },
      data: {
        name: dto.name,
        channel: dto.channel,
        subject: dto.subject,
        body: dto.body,
        variables: dto.variables,
        isActive: dto.isActive,
      },
    });

    await this.auditService.log({
      tenantId,
      userId,
      action: 'UPDATE',
      entity: 'Template',
      entityId: id,
      oldValues: {
        name: existing.name,
        channel: existing.channel,
        body: existing.body,
        isActive: existing.isActive,
      },
      newValues: dto as any,
    });

    return template;
  }

  async remove(tenantId: string, userId: string, id: string) {
    await this.findOne(tenantId, id);

    await this.prisma.template.delete({ where: { id } });

    await this.auditService.log({
      tenantId,
      userId,
      action: 'DELETE',
      entity: 'Template',
      entityId: id,
    });

    return { deleted: true };
  }
}
