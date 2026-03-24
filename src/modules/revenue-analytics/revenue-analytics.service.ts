import { Injectable, Logger } from '@nestjs/common';
import { ChannelType } from '@prisma/client';
import { PrismaService } from '../../prisma/prisma.service';

const CHANNELS: ChannelType[] = [
  ChannelType.SMS,
  ChannelType.WHATSAPP,
  ChannelType.VOICE,
  ChannelType.EMAIL,
];

@Injectable()
export class RevenueAnalyticsService {
  private readonly logger = new Logger(RevenueAnalyticsService.name);

  constructor(private readonly prisma: PrismaService) {}

  // ── Helpers ────────────────────────────────

  private async getAvgValue(tenantId: string): Promise<number> {
    const tenant = await this.prisma.tenant.findUnique({
      where: { id: tenantId },
      select: { settings: true },
    });
    return (
      ((tenant?.settings as Record<string, unknown>)
        ?.averageAppointmentValue as number) ?? 150
    );
  }

  private periodStart(days: number): Date {
    const d = new Date();
    d.setDate(d.getDate() - days);
    d.setHours(0, 0, 0, 0);
    return d;
  }

  // ── Revenue summary ────────────────────────

  /**
   * High-level revenue metrics: weekly, monthly, all-time recovered revenue,
   * confirmation rate, ROI estimate, and monthly projection.
   */
  async getSummary(tenantId: string) {
    const now = new Date();
    const avgValue = await this.getAvgValue(tenantId);

    const weekStart = this.periodStart(7);
    const monthStart = this.periodStart(30);

    const [
      weeklyPrevented,
      monthlyPrevented,
      allTimePrevented,
      totalAppointments,
      totalConfirmed,
    ] = await this.prisma.$transaction([
      // Confirmed this week with a reminder
      this.prisma.appointment.count({
        where: {
          tenantId,
          scheduledAt: { gte: weekStart, lt: now },
          status: { in: ['CONFIRMED', 'COMPLETED'] },
          reminders: { some: { status: { in: ['SENT', 'DELIVERED'] } } },
        },
      }),
      // Confirmed this month with a reminder
      this.prisma.appointment.count({
        where: {
          tenantId,
          scheduledAt: { gte: monthStart, lt: now },
          status: { in: ['CONFIRMED', 'COMPLETED'] },
          reminders: { some: { status: { in: ['SENT', 'DELIVERED'] } } },
        },
      }),
      // All-time confirmed with a reminder
      this.prisma.appointment.count({
        where: {
          tenantId,
          status: { in: ['CONFIRMED', 'COMPLETED'] },
          reminders: { some: { status: { in: ['SENT', 'DELIVERED'] } } },
        },
      }),
      this.prisma.appointment.count({ where: { tenantId } }),
      this.prisma.appointment.count({
        where: { tenantId, status: { in: ['CONFIRMED', 'COMPLETED'] } },
      }),
    ]);

    // Monthly projection based on last 7-day rate
    const weeklyRate = weeklyPrevented;
    const projectedMonthly = Math.round(weeklyRate * (30 / 7));

    // ROI estimate: assume $0.04 per message sent
    const totalReminders = await this.prisma.reminder.count({
      where: { tenantId, status: { in: ['SENT', 'DELIVERED'] } },
    });
    const estimatedMessagingCost = totalReminders * 0.04;
    const allTimeRevenue = allTimePrevented * avgValue;
    const roiPct =
      estimatedMessagingCost > 0
        ? Math.round(
            ((allTimeRevenue - estimatedMessagingCost) /
              estimatedMessagingCost) *
              100,
          )
        : 0;

    return {
      avgAppointmentValue: avgValue,
      weekly: {
        noShowsPrevented: weeklyPrevented,
        revenueRecovered: weeklyPrevented * avgValue,
        formatted: this.fmt(weeklyPrevented * avgValue),
      },
      monthly: {
        noShowsPrevented: monthlyPrevented,
        revenueRecovered: monthlyPrevented * avgValue,
        formatted: this.fmt(monthlyPrevented * avgValue),
      },
      allTime: {
        noShowsPrevented: allTimePrevented,
        revenueRecovered: allTimeRevenue,
        formatted: this.fmt(allTimeRevenue),
      },
      confirmationRate:
        totalAppointments > 0
          ? Math.round((totalConfirmed / totalAppointments) * 100)
          : 0,
      projectedMonthlyRevenue: {
        value: projectedMonthly * avgValue,
        formatted: this.fmt(projectedMonthly * avgValue),
        noShowsPrevented: projectedMonthly,
      },
      roi: {
        estimatedMessagingCost: Math.round(estimatedMessagingCost * 100) / 100,
        netRevenue:
          Math.round((allTimeRevenue - estimatedMessagingCost) * 100) / 100,
        roiPercent: roiPct,
      },
      generatedAt: now.toISOString(),
    };
  }

  // ── Revenue over time ──────────────────────

  /**
   * Daily revenue recovered for the past `days` days.
   * A day's revenue = (appointments confirmed with reminder) × avgValue.
   */
  async getOverTime(tenantId: string, days = 30) {
    const clamped = Math.min(Math.max(days, 7), 365);
    const rangeStart = this.periodStart(clamped);
    const avgValue = await this.getAvgValue(tenantId);

    const appointments = await this.prisma.appointment.findMany({
      where: {
        tenantId,
        scheduledAt: { gte: rangeStart },
        status: { in: ['CONFIRMED', 'COMPLETED'] },
        reminders: { some: { status: { in: ['SENT', 'DELIVERED'] } } },
      },
      select: { scheduledAt: true },
    });

    // Build a full date map
    const byDate = new Map<string, number>();
    for (let i = 0; i < clamped; i++) {
      const d = new Date(rangeStart);
      d.setDate(rangeStart.getDate() + i);
      byDate.set(d.toISOString().slice(0, 10), 0);
    }

    for (const appt of appointments) {
      const key = appt.scheduledAt.toISOString().slice(0, 10);
      if (byDate.has(key)) {
        byDate.set(key, (byDate.get(key) ?? 0) + 1);
      }
    }

    // Weekly roll-up for periods > 30 days
    if (clamped > 30) {
      return this.rollUpToWeeks(byDate, avgValue);
    }

    let cumulative = 0;
    return Array.from(byDate.entries())
      .sort(([a], [b]) => a.localeCompare(b))
      .map(([date, prevented]) => {
        cumulative += prevented * avgValue;
        return {
          date,
          label: new Date(date + 'T12:00:00').toLocaleDateString('en-GB', {
            day: 'numeric',
            month: 'short',
          }),
          noShowsPrevented: prevented,
          revenueRecovered: prevented * avgValue,
          cumulative,
        };
      });
  }

  private rollUpToWeeks(byDate: Map<string, number>, avgValue: number) {
    const getWeekStart = (dateStr: string): string => {
      const d = new Date(dateStr + 'T12:00:00');
      const day = d.getDay();
      d.setDate(d.getDate() + (day === 0 ? -6 : 1 - day));
      return d.toISOString().slice(0, 10);
    };

    const weeks = new Map<string, number>();
    for (const [date, count] of byDate.entries()) {
      const wk = getWeekStart(date);
      weeks.set(wk, (weeks.get(wk) ?? 0) + count);
    }

    let cumulative = 0;
    return Array.from(weeks.entries())
      .sort(([a], [b]) => a.localeCompare(b))
      .map(([weekStart, prevented]) => {
        cumulative += prevented * avgValue;
        return {
          date: weekStart,
          label: new Date(weekStart + 'T12:00:00').toLocaleDateString('en-GB', {
            day: 'numeric',
            month: 'short',
          }),
          noShowsPrevented: prevented,
          revenueRecovered: prevented * avgValue,
          cumulative,
        };
      });
  }

  // ── Revenue by channel ─────────────────────

  /**
   * Per-channel revenue attribution.
   * Counts appointments that are CONFIRMED/COMPLETED AND had a reminder
   * sent via that channel. Revenue is then attributed to each channel.
   */
  async getByChannel(tenantId: string) {
    const avgValue = await this.getAvgValue(tenantId);

    const counts = await Promise.all(
      CHANNELS.map(async (channel) => {
        const count = await this.prisma.appointment.count({
          where: {
            tenantId,
            status: { in: ['CONFIRMED', 'COMPLETED'] },
            reminders: {
              some: {
                channel,
                status: { in: ['SENT', 'DELIVERED'] },
              },
            },
          },
        });
        return { channel: channel as string, appointmentsInfluenced: count };
      }),
    );

    const active = counts.filter((c) => c.appointmentsInfluenced > 0);
    const totalInfluenced = active.reduce(
      (s, c) => s + c.appointmentsInfluenced,
      0,
    );

    return active.map((c) => ({
      channel: c.channel,
      appointmentsInfluenced: c.appointmentsInfluenced,
      revenueAttributed: c.appointmentsInfluenced * avgValue,
      formatted: this.fmt(c.appointmentsInfluenced * avgValue),
      percentageOfTotal:
        totalInfluenced > 0
          ? Math.round((c.appointmentsInfluenced / totalInfluenced) * 100)
          : 0,
    }));
  }

  // ── Metrics snapshot (for dashboard card) ─

  /**
   * Compact snapshot for the main dashboard hero card.
   * Returns the five key revenue metrics.
   */
  async getSnapshot(tenantId: string) {
    const now = new Date();
    const weekStart = this.periodStart(7);
    const avgValue = await this.getAvgValue(tenantId);

    const [booked, confirmed, prevented, totalAppts] =
      await this.prisma.$transaction([
        this.prisma.appointment.count({
          where: { tenantId, scheduledAt: { gte: weekStart, lt: now } },
        }),
        this.prisma.appointment.count({
          where: {
            tenantId,
            scheduledAt: { gte: weekStart, lt: now },
            status: { in: ['CONFIRMED', 'COMPLETED'] },
          },
        }),
        this.prisma.appointment.count({
          where: {
            tenantId,
            scheduledAt: { gte: weekStart, lt: now },
            status: { in: ['CONFIRMED', 'COMPLETED'] },
            reminders: { some: { status: { in: ['SENT', 'DELIVERED'] } } },
          },
        }),
        this.prisma.appointment.count({ where: { tenantId } }),
      ]);

    const totalConfirmedAllTime = await this.prisma.appointment.count({
      where: { tenantId, status: { in: ['CONFIRMED', 'COMPLETED'] } },
    });

    return {
      appointments_booked: booked,
      appointments_confirmed: confirmed,
      no_shows_prevented: prevented,
      revenue_recovered: prevented * avgValue,
      revenue_recovered_formatted: this.fmt(prevented * avgValue),
      confirmation_rate:
        booked > 0 ? Math.round((confirmed / booked) * 100) : 0,
      all_time_confirmation_rate:
        totalAppts > 0
          ? Math.round((totalConfirmedAllTime / totalAppts) * 100)
          : 0,
    };
  }

  private fmt(value: number): string {
    return `$${value.toLocaleString('en-US', { minimumFractionDigits: 0 })}`;
  }
}
