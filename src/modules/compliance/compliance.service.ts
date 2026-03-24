import { Injectable, Logger } from '@nestjs/common';
import { ChannelType } from '@prisma/client';
import { PrismaService } from '../../prisma/prisma.service';
import { AuditService } from '../audit/audit.service';
import { ReminderSchedulerService } from '../reminder/reminder-scheduler.service';

/**
 * Opt-out keyword sets (case-insensitive, matched after .trim().toUpperCase()).
 *
 * STOP / UNSUBSCRIBE / OPTOUT / END / QUIT   → opt-out
 * START / UNSTOP / SUBSCRIBE                 → opt-in
 *
 * Note: CANCEL is intentionally excluded — it's used for appointment cancellation,
 * not SMS opt-out. Mixing the two would violate user expectations.
 */
export const OPT_OUT_KEYWORDS = new Set([
  'STOP',
  'UNSUBSCRIBE',
  'OPTOUT',
  'OPT-OUT',
  'END',
  'QUIT',
]);

export const OPT_IN_KEYWORDS = new Set(['START', 'UNSTOP', 'SUBSCRIBE']);

/** TCPA-compliant opt-out acknowledgement (must be sent without marketing content). */
export const OPT_OUT_REPLY =
  'You have been unsubscribed and will receive no further messages. ' +
  'Reply START to re-subscribe at any time.';

export const OPT_IN_REPLY =
  'You have been re-subscribed and will receive appointment reminders again. ' +
  'Reply STOP at any time to unsubscribe.';

@Injectable()
export class ComplianceService {
  private readonly logger = new Logger(ComplianceService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly auditService: AuditService,
    private readonly reminderScheduler: ReminderSchedulerService,
  ) {}

  // ── Keyword detection ─────────────────────

  isOptOutKeyword(body: string): boolean {
    return OPT_OUT_KEYWORDS.has(body.trim().toUpperCase());
  }

  isOptInKeyword(body: string): boolean {
    return OPT_IN_KEYWORDS.has(body.trim().toUpperCase());
  }

  // ── Opt-out ───────────────────────────────

  /**
   * Mark a phone number as opted-out within a tenant.
   *
   * - Sets Customer.unsubscribed = true (blocks future reminder sends)
   * - Sets Contact.unsubscribed = true (shows badge in contacts UI)
   * - Cancels all PENDING reminders for the customer's upcoming appointments
   * - Logs audit event
   */
  async optOut(
    phone: string,
    tenantId: string,
    channel: ChannelType,
  ): Promise<void> {
    this.logger.log(
      `Opt-out received from ${phone} via ${channel} (tenant ${tenantId})`,
    );

    const now = new Date();

    // Mark Customer unsubscribed (used by worker + scheduler)
    const customer = await this.prisma.customer.findFirst({
      where: { tenantId, phone },
    });

    if (customer && !customer.unsubscribed) {
      await this.prisma.customer.update({
        where: { id: customer.id },
        data: { unsubscribed: true, unsubscribedAt: now },
      });

      // Cancel all pending reminders for this customer's upcoming appointments
      const upcomingAppointments = await this.prisma.appointment.findMany({
        where: {
          customerId: customer.id,
          status: { in: ['SCHEDULED', 'CONFIRMED'] },
          scheduledAt: { gte: now },
        },
        select: { id: true },
      });

      let cancelledCount = 0;
      for (const appt of upcomingAppointments) {
        cancelledCount += await this.reminderScheduler.cancelForAppointment(
          appt.id,
        );
      }

      if (cancelledCount > 0) {
        this.logger.log(
          `Cancelled ${cancelledCount} pending reminders for opted-out customer ${customer.id}`,
        );
      }

      await this.auditService.log({
        tenantId,
        action: 'UPDATE',
        entity: 'Customer',
        entityId: customer.id,
        newValues: { unsubscribed: true, via: channel, phone },
      });
    }

    // Also mark Contact record unsubscribed (syncs contacts UI)
    const contact = await this.prisma.contact.findFirst({
      where: { tenantId, phone },
    });

    if (contact && !contact.unsubscribed) {
      await this.prisma.contact.update({
        where: { id: contact.id },
        data: { unsubscribed: true },
      });
    }

    this.logger.log(`Opt-out complete for phone ${phone} (tenant ${tenantId})`);
  }

  // ── Opt-in ────────────────────────────────

  /**
   * Re-subscribe a phone number that previously opted out.
   * Clears unsubscribed flag on Customer and Contact.
   */
  async optIn(
    phone: string,
    tenantId: string,
    channel: ChannelType,
  ): Promise<void> {
    this.logger.log(
      `Opt-in received from ${phone} via ${channel} (tenant ${tenantId})`,
    );

    const customer = await this.prisma.customer.findFirst({
      where: { tenantId, phone },
    });

    if (customer?.unsubscribed) {
      await this.prisma.customer.update({
        where: { id: customer.id },
        data: { unsubscribed: false, unsubscribedAt: null },
      });

      await this.auditService.log({
        tenantId,
        action: 'UPDATE',
        entity: 'Customer',
        entityId: customer.id,
        newValues: { unsubscribed: false, via: channel, phone },
      });
    }

    const contact = await this.prisma.contact.findFirst({
      where: { tenantId, phone },
    });

    if (contact?.unsubscribed) {
      await this.prisma.contact.update({
        where: { id: contact.id },
        data: { unsubscribed: false },
      });
    }

    this.logger.log(`Opt-in complete for phone ${phone} (tenant ${tenantId})`);
  }

  // ── Status check ──────────────────────────

  async isOptedOut(phone: string, tenantId: string): Promise<boolean> {
    const customer = await this.prisma.customer.findFirst({
      where: { tenantId, phone },
      select: { unsubscribed: true },
    });
    return customer?.unsubscribed ?? false;
  }
}
