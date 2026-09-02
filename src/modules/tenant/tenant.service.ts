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

  // ── Sender Identity ────────────────────────

  async getSenderIdentity(tenantId: string) {
    const settings = await this.getSettings(tenantId);
    return {
      senderName:  (settings.senderName  as string) ?? null,
      senderEmail: (settings.senderEmail as string) ?? null,
      senderPhone: (settings.senderPhone as string) ?? null,
    };
  }

  async updateSenderIdentity(
    tenantId: string,
    dto: { senderName?: string; senderEmail?: string; senderPhone?: string },
  ) {
    const patch: Record<string, unknown> = {};
    if (dto.senderName  !== undefined) patch.senderName  = dto.senderName.trim();
    if (dto.senderEmail !== undefined) patch.senderEmail = dto.senderEmail.trim();
    if (dto.senderPhone !== undefined) patch.senderPhone = dto.senderPhone.trim();
    await this.updateSettings(tenantId, patch);
    this.logger.log(`Sender identity updated for tenant ${tenantId}`);
    return this.getSenderIdentity(tenantId);
  }

  // ── Business Timezone ──────────────────────
  // Stored in settings.timezone (same JSON blob as sender identity), defaulting
  // to UTC when unset. Drives timezone-aware "today"/calendar date boundaries.

  async getTimezone(tenantId: string) {
    const settings = await this.getSettings(tenantId);
    const tz = settings.timezone;
    return { timezone: typeof tz === 'string' && tz.trim() ? tz : 'UTC' };
  }

  async updateTimezone(tenantId: string, timezone: string) {
    await this.updateSettings(tenantId, { timezone: timezone.trim() });
    this.logger.log(`Timezone updated to ${timezone} for tenant ${tenantId}`);
    return this.getTimezone(tenantId);
  }
}
