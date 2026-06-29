import { Injectable, Logger } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import { AnalyticsFilterService } from './analytics-filter.service';

@Injectable()
export class AnalyticsService {
  private readonly logger = new Logger(AnalyticsService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly analyticsFilterService: AnalyticsFilterService,
  ) {}

  // ── Helpers ────────────────────────────────

  /** Returns [start, end) for the ISO week containing a given date (Mon–Sun). */
  private getWeekBounds(date: Date): { start: Date; end: Date } {
    const d = new Date(date);
    const day = d.getDay(); // 0 = Sun, 1 = Mon …
    const diff = day === 0 ? -6 : 1 - day; // shift so week starts Monday
    const start = new Date(d);
    start.setDate(d.getDate() + diff);
    start.setHours(0, 0, 0, 0);
    const end = new Date(start);
    end.setDate(start.getDate() + 7);
    return { start, end };
  }

  /** Trend direction and label. Returns null if previous is 0 (no prior data). */
  private trend(
    current: number,
    previous: number,
  ): { direction: 'up' | 'down' | 'flat'; pct: number } {
    if (previous === 0) return { direction: 'flat', pct: 0 };
    const pct = Math.round(((current - previous) / previous) * 100);
    return {
      direction: pct > 0 ? 'up' : pct < 0 ? 'down' : 'flat',
      pct: Math.abs(pct),
    };
  }

  // ── Dashboard metrics ──────────────────────

  /**
   * Returns the four hero metrics for the dashboard overview:
   *   - appointmentsThisWeek
   *   - confirmedAppointments
   *   - noShowsPrevented
   *   - estimatedRevenueSaved
   *
   * Each metric includes a week-over-week trend comparison.
   */
  async getDashboardMetrics(tenantId: string, excludeDemo = true) {
    const now = new Date();
    const thisWeek = this.getWeekBounds(now);
    const lastWeekStart = new Date(thisWeek.start);
    lastWeekStart.setDate(thisWeek.start.getDate() - 7);
    const lastWeek = { start: lastWeekStart, end: thisWeek.start };

    // ── This week ────────────────────────────

    const [
      apptThisWeek,
      confirmedThisWeek,
      apptLastWeek,
      confirmedLastWeek,
      recentDelivered,
    ] = await this.prisma.$transaction([
      // All appointments scheduled this week
      this.prisma.appointment.count({
        where: this.analyticsFilterService.applyTenantFilter(
          { scheduledAt: { gte: thisWeek.start, lt: thisWeek.end } },
          tenantId,
          excludeDemo,
        ),
      }),

      // Confirmed / completed this week
      this.prisma.appointment.count({
        where: this.analyticsFilterService.applyTenantFilter(
          {
            scheduledAt: { gte: thisWeek.start, lt: thisWeek.end },
            status: { in: ['CONFIRMED', 'COMPLETED'] },
          },
          tenantId,
          excludeDemo,
        ),
      }),

      // Previous week total
      this.prisma.appointment.count({
        where: this.analyticsFilterService.applyTenantFilter(
          { scheduledAt: { gte: lastWeek.start, lt: lastWeek.end } },
          tenantId,
          excludeDemo,
        ),
      }),

      // Previous week confirmed
      this.prisma.appointment.count({
        where: this.analyticsFilterService.applyTenantFilter(
          {
            scheduledAt: { gte: lastWeek.start, lt: lastWeek.end },
            status: { in: ['CONFIRMED', 'COMPLETED'] },
          },
          tenantId,
          excludeDemo,
        ),
      }),

      // Reminders delivered this week
      this.prisma.reminder.count({
        where: this.analyticsFilterService.applyTenantFilter(
          {
            scheduledSendTime: { gte: thisWeek.start, lt: thisWeek.end },
            status: { in: ['DELIVERED', 'SENT'] },
          },
          tenantId,
          excludeDemo,
        ),
      }),
    ]);

    // No-shows prevented: confirmed/completed appointments that had a reminder delivered.
    // We query appointments in this week that are confirmed/completed AND have at least
    // one reminder with a DELIVERED/SENT status.
    const noShowsPrevented = await this.prisma.appointment.count({
      where: this.analyticsFilterService.applyTenantFilter(
        {
          scheduledAt: { gte: thisWeek.start, lt: thisWeek.end },
          status: { in: ['CONFIRMED', 'COMPLETED'] },
          reminders: {
            some: { status: { in: ['DELIVERED', 'SENT'] } },
          },
        },
        tenantId,
        excludeDemo,
      ),
    });

    const noShowsLastWeek = await this.prisma.appointment.count({
      where: this.analyticsFilterService.applyTenantFilter(
        {
          scheduledAt: { gte: lastWeek.start, lt: lastWeek.end },
          status: { in: ['CONFIRMED', 'COMPLETED'] },
          reminders: {
            some: { status: { in: ['DELIVERED', 'SENT'] } },
          },
        },
        tenantId,
        excludeDemo,
      ),
    });

    // Revenue saved: tenant can configure averageAppointmentValue in settings JSON.
    // Falls back to $150 if not set.
    const tenant = await this.prisma.tenant.findUnique({
      where: { id: tenantId },
      select: { settings: true },
    });

    const avgValue: number =
      (tenant?.settings as any)?.averageAppointmentValue ?? 150;

    const revenueSaved = noShowsPrevented * avgValue;
    const revenueLastWeek = noShowsLastWeek * avgValue;

    // ── All-time summary ─────────────────────

    const [totalAppointments, totalConfirmed, totalReminders] =
      await this.prisma.$transaction([
        this.prisma.appointment.count({
          where: this.analyticsFilterService.applyTenantFilter(
            {},
            tenantId,
            excludeDemo,
          ),
        }),
        this.prisma.appointment.count({
          where: this.analyticsFilterService.applyTenantFilter(
            { status: { in: ['CONFIRMED', 'COMPLETED'] } },
            tenantId,
            excludeDemo,
          ),
        }),
        this.prisma.reminder.count({
          where: this.analyticsFilterService.applyTenantFilter(
            { status: { in: ['DELIVERED', 'SENT'] } },
            tenantId,
            excludeDemo,
          ),
        }),
      ]);

    return {
      week: {
        appointments: {
          value: apptThisWeek,
          trend: this.trend(apptThisWeek, apptLastWeek),
        },
        confirmed: {
          value: confirmedThisWeek,
          rate:
            apptThisWeek > 0
              ? Math.round((confirmedThisWeek / apptThisWeek) * 100)
              : 0,
          trend: this.trend(confirmedThisWeek, confirmedLastWeek),
        },
        noShowsPrevented: {
          value: noShowsPrevented,
          trend: this.trend(noShowsPrevented, noShowsLastWeek),
        },
        revenueSaved: {
          value: revenueSaved,
          formatted: `$${revenueSaved.toLocaleString('en-US', { minimumFractionDigits: 0 })}`,
          avgPerAppointment: avgValue,
          trend: this.trend(revenueSaved, revenueLastWeek),
        },
        remindersDelivered: recentDelivered,
      },
      allTime: {
        totalAppointments,
        totalConfirmed,
        totalRemindersDelivered: totalReminders,
        confirmationRate:
          totalAppointments > 0
            ? Math.round((totalConfirmed / totalAppointments) * 100)
            : 0,
      },
      generatedAt: now.toISOString(),
    };
  }

  /**
   * Returns real-time metrics for the analytics dashboard.
   * Replaces static mock data with actual Prisma counts.
   */
  async getDashboard(
    tenantId: string,
    from?: string,
    to?: string,
    excludeDemo = true,
  ) {
    const where: any = {};

    if (from || to) {
      where.createdAt = {};
      if (from) where.createdAt.gte = new Date(from);
      if (to) where.createdAt.lte = new Date(to);
    }

    const [
      totalContacts,
      totalEvents,
      confirmedRsvps,
      messagesSent,
      activeCampaigns,
    ] = await Promise.all([
      this.prisma.contact.count({
        where: this.analyticsFilterService.applyTenantFilter(
          where,
          tenantId,
          excludeDemo,
        ),
      }),
      this.prisma.event.count({
        where: this.analyticsFilterService.applyTenantFilter(
          where,
          tenantId,
          excludeDemo,
        ),
      }),
      this.prisma.appointment.count({
        where: this.analyticsFilterService.applyTenantFilter(
          { ...where, status: 'CONFIRMED' },
          tenantId,
          excludeDemo,
        ),
      }),
      this.prisma.messageLog.count({
        where: this.analyticsFilterService.applyTenantFilter(
          { ...where, direction: 'OUTBOUND' },
          tenantId,
          excludeDemo,
        ),
      }),
      this.prisma.campaign.count({
        where: this.analyticsFilterService.applyTenantFilter(
          { ...where, status: 'ACTIVE' },
          tenantId,
          excludeDemo,
        ),
      }),
    ]);

    return {
      total_contacts: totalContacts,
      total_events: totalEvents,
      confirmed_rsvps: confirmedRsvps,
      messages_sent: messagesSent,
      active_campaigns: activeCampaigns,
      generatedAt: new Date().toISOString(),
    };
  }

  async getAttendanceOverview(tenantId: string, excludeDemo = true) {
    const now = new Date();
    const thisWeek = this.getWeekBounds(now);

    const [eventsThisWeek, messagesSent, confirmedAttendees, pendingResponses] =
      await Promise.all([
        // Events starting this week
        this.prisma.event.count({
          where: this.analyticsFilterService.applyTenantFilter(
            {
              startTime: { gte: thisWeek.start, lt: thisWeek.end },
              status: { not: 'CANCELLED' },
            },
            tenantId,
            excludeDemo,
          ),
        }),

        // Total outbound messages
        this.prisma.messageLog.count({
          where: this.analyticsFilterService.applyTenantFilter(
            { direction: 'OUTBOUND' },
            tenantId,
            excludeDemo,
          ),
        }),

        // Total confirmed participants
        this.prisma.eventParticipant.count({
          where: this.analyticsFilterService.applyTenantFilter(
            { status: 'confirmed' },
            tenantId,
            excludeDemo,
          ),
        }),

        // Total pending participants
        this.prisma.eventParticipant.count({
          where: this.analyticsFilterService.applyTenantFilter(
            { status: 'pending' },
            tenantId,
            excludeDemo,
          ),
        }),
      ]);

    return {
      events_this_week: eventsThisWeek,
      messages_sent: messagesSent,
      confirmed_attendees: confirmedAttendees,
      pending_responses: pendingResponses,
    };
  }

  // ── Confirmation rate over time ────────────

  /**
   * Daily confirmation rate for the past `days` days.
   * Returns `rate: null` for days with no appointments.
   */
  async getConfirmationRateOverTime(
    tenantId: string,
    days: number = 30,
    excludeDemo = true,
  ) {
    const now = new Date();
    const rangeStart = new Date(now);
    rangeStart.setDate(now.getDate() - days);
    rangeStart.setHours(0, 0, 0, 0);

    const appointments = await this.prisma.appointment.findMany({
      where: this.analyticsFilterService.applyTenantFilter(
        { scheduledAt: { gte: rangeStart, lt: now } },
        tenantId,
        excludeDemo,
      ),
      select: { scheduledAt: true, status: true },
    });

    // Build day-keyed map initialised to 0
    const byDate = new Map<string, { total: number; confirmed: number }>();
    for (let i = 0; i < days; i++) {
      const d = new Date(rangeStart);
      d.setDate(rangeStart.getDate() + i);
      byDate.set(d.toISOString().slice(0, 10), { total: 0, confirmed: 0 });
    }

    for (const appt of appointments) {
      const key = appt.scheduledAt.toISOString().slice(0, 10);
      const entry = byDate.get(key) ?? { total: 0, confirmed: 0 };
      entry.total++;
      if (['CONFIRMED', 'COMPLETED'].includes(appt.status)) entry.confirmed++;
      byDate.set(key, entry);
    }

    return Array.from(byDate.entries())
      .sort(([a], [b]) => a.localeCompare(b))
      .map(([date, { total, confirmed }]) => ({
        date,
        total,
        confirmed,
        rate: total > 0 ? Math.round((confirmed / total) * 100) : null,
      }));
  }

  // ── No-show reduction ──────────────────────

  /**
   * Week-by-week breakdown for the past `weeks` weeks.
   * Each entry: total, noShows, prevented (confirmed/completed), rates.
   */
  async getNoShowReduction(
    tenantId: string,
    weeks: number = 8,
    excludeDemo = true,
  ) {
    const now = new Date();
    const rangeStart = new Date(now);
    rangeStart.setDate(now.getDate() - weeks * 7);
    rangeStart.setHours(0, 0, 0, 0);

    const appointments = await this.prisma.appointment.findMany({
      where: this.analyticsFilterService.applyTenantFilter(
        { scheduledAt: { gte: rangeStart } },
        tenantId,
        excludeDemo,
      ),
      select: { scheduledAt: true, status: true },
    });

    const getWeekStart = (date: Date): string => {
      const d = new Date(date);
      const day = d.getDay();
      d.setDate(d.getDate() + (day === 0 ? -6 : 1 - day));
      d.setHours(0, 0, 0, 0);
      return d.toISOString().slice(0, 10);
    };

    // Initialise all weeks
    const byWeek = new Map<
      string,
      { total: number; noShows: number; prevented: number }
    >();
    for (let i = 0; i < weeks; i++) {
      const d = new Date(rangeStart);
      d.setDate(rangeStart.getDate() + i * 7);
      const key = getWeekStart(d);
      if (!byWeek.has(key))
        byWeek.set(key, { total: 0, noShows: 0, prevented: 0 });
    }

    for (const appt of appointments) {
      const key = getWeekStart(appt.scheduledAt);
      const entry = byWeek.get(key) ?? { total: 0, noShows: 0, prevented: 0 };
      entry.total++;
      if (appt.status === 'NO_SHOW') entry.noShows++;
      if (['CONFIRMED', 'COMPLETED'].includes(appt.status)) entry.prevented++;
      byWeek.set(key, entry);
    }

    return Array.from(byWeek.entries())
      .sort(([a], [b]) => a.localeCompare(b))
      .slice(-weeks)
      .map(([weekStart, data]) => ({
        weekStart,
        weekLabel: new Date(weekStart + 'T12:00:00').toLocaleDateString(
          'en-GB',
          {
            day: 'numeric',
            month: 'short',
          },
        ),
        ...data,
        noShowRate:
          data.total > 0 ? Math.round((data.noShows / data.total) * 100) : 0,
        preventionRate:
          data.total > 0 ? Math.round((data.prevented / data.total) * 100) : 0,
      }));
  }

  // ── Channel performance ────────────────────

  /**
   * Aggregated delivery stats per channel from MessageLog.
   */
  async getChannelPerformance(tenantId: string, excludeDemo = true) {
    const logs = await this.prisma.messageLog.findMany({
      where: this.analyticsFilterService.applyTenantFilter(
        { direction: 'OUTBOUND' },
        tenantId,
        excludeDemo,
      ),
      select: { channel: true, providerStatus: true },
    });

    const channels = new Map<
      string,
      { sent: number; delivered: number; failed: number }
    >();

    for (const log of logs) {
      const ch = String(log.channel);
      const entry = channels.get(ch) ?? { sent: 0, delivered: 0, failed: 0 };
      entry.sent++;
      if (log.providerStatus === 'delivered') entry.delivered++;
      if (['failed', 'undelivered'].includes(log.providerStatus ?? ''))
        entry.failed++;
      channels.set(ch, entry);
    }

    return Array.from(channels.entries()).map(([channel, data]) => ({
      channel,
      ...data,
      deliveryRate:
        data.sent > 0 ? Math.round((data.delivered / data.sent) * 100) : 0,
    }));
  }

  async getRecentActivity(tenantId: string, limit: number = 20) {
    return this.prisma.contactActivity.findMany({
      where: { tenantId },
      include: {
        contact: {
          select: {
            id: true,
            name: true,
            email: true,
            phone: true,
          },
        },
      },
      orderBy: { createdAt: 'desc' },
      take: limit,
    });
  }

  // ── Onboarding progress ────────────────────

  async getOnboardingProgress(tenantId: string) {
    const [contactCount, eventCount, workflowCount, tenant] = await Promise.all([
      this.prisma.contact.count({ where: { tenantId } }),
      this.prisma.event.count({ where: { tenantId } }),
      this.prisma.workflow.count({ where: { tenantId } }),
      this.prisma.tenant.findUnique({
        where: { id: tenantId },
        select: { subscriptionStatus: true, planType: true },
      }),
    ]);

    return {
      steps: [
        { id: 'contacts', label: 'Add your first contact', done: contactCount > 0, count: contactCount },
        { id: 'events', label: 'Create your first event', done: eventCount > 0, count: eventCount },
        { id: 'automations', label: 'Set up an automation', done: workflowCount > 0, count: workflowCount },
        { id: 'billing', label: 'Subscribe to a plan', done: tenant?.subscriptionStatus === 'ACTIVE', count: 0 },
      ],
      completedSteps: [contactCount > 0, eventCount > 0, workflowCount > 0, tenant?.subscriptionStatus === 'ACTIVE'].filter(Boolean).length,
      totalSteps: 4,
    };
  }

  // ── Legacy stub (kept for backward compat) ─

  async findAll(tenantId: string) {
    this.logger.log(`Listing analytics for tenant ${tenantId}`);
    return this.getDashboardMetrics(tenantId);
  }
}
