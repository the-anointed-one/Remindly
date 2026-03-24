import { Injectable, Logger } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';

@Injectable()
export class TenantService {
  private readonly logger = new Logger(TenantService.name);

  constructor(private readonly prisma: PrismaService) {}

  async findAll(tenantId: string) {
    this.logger.log(`Listing tenants for tenant ${tenantId}`);
    return { message: 'Tenant module — not yet implemented', tenantId };
  }

  async getSettings(tenantId: string) {
    const tenant = await this.prisma.tenant.findUnique({
      where: { id: tenantId },
      select: { settings: true },
    });
    return (tenant?.settings as Record<string, unknown>) ?? {};
  }

  async updateSettings(tenantId: string, patch: Record<string, unknown>) {
    const tenant = await this.prisma.tenant.findUnique({
      where: { id: tenantId },
      select: { settings: true },
    });
    const current = (tenant?.settings as Record<string, unknown>) ?? {};
    const merged = { ...current, ...patch };

    return this.prisma.tenant.update({
      where: { id: tenantId },
      data: { settings: merged as any },
      select: { settings: true },
    });
  }
}
