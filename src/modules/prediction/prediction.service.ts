import { Injectable, Logger, NotFoundException } from '@nestjs/common';
import { Queue } from 'bullmq';
import { PrismaService } from '../../prisma/prisma.service';
import {
  REMINDER_QUEUE,
  REMINDER_JOB_OPTIONS,
  ReminderJobData,
  getRedisConnection,
} from '../../queue/queue.config';

// ── Signal interface ──────────────────────────────────────────────────────────

interface CustomerSignals {
  totalPastAppointments: number;
  noShowCount: number;
  cancellationCount: number;
  confirmationCount: number;
  avgResponseMinutes: number | null;
  dayOfWeek: number; // 0=Sun … 6=Sat
  hourOfDay: number; // 0-23
}

// ── Score computation ─────────────────────────────────────────────────────────

function computeScore(s: CustomerSignals): {
  score: number;
  breakdown: Record<string, number>;
} {
  // Signal 1: Historical no-show rate → 0-40 pts
  const noShowPts =
    s.totalPastAppointments > 0
      ? (s.noShowCount / s.totalPastAppointments) * 40
      : 15;

  // Signal 2: Historical cancellation rate → 0-20 pts
  const cancelPts =
    s.totalPastAppointments > 0
      ? (s.cancellationCount / s.totalPastAppointments) * 20
      : 5;

  // Signal 3: Low confirmation rate → 0-10 pts
  const confirmPts =
    s.totalPastAppointments > 0
      ? (1 - s.confirmationCount / s.totalPastAppointments) * 10
      : 5;

  // Signal 4: Day of week → 0-10 pts [Sun, Mon, Tue, Wed, Thu, Fri, Sat]
  const dayRisk = [9, 3, 2, 2, 3, 6, 9];
  const dayPts = dayRisk[s.dayOfWeek];

  // Signal 5: Time of day → 0-10 pts
  let timePts = 1;
  if (s.hourOfDay < 8) timePts = 10;
  else if (s.hourOfDay < 9) timePts = 6;
  else if (s.hourOfDay >= 18) timePts = 7;
  else if (s.hourOfDay >= 17) timePts = 4;

  // Signal 6: Response time to reminders → 0-10 pts
  let responsePts = 5;
  if (s.avgResponseMinutes !== null) {
    if (s.avgResponseMinutes > 360) responsePts = 10;
    else if (s.avgResponseMinutes > 120) responsePts = 6;
    else if (s.avgResponseMinutes > 30) responsePts = 3;
    else responsePts = 0;
  }

  const score =
    noShowPts + cancelPts + confirmPts + dayPts + timePts + responsePts;
  const clamped = Math.round(Math.min(100, Math.max(0, score)));

  return {
    score: clamped,
    breakdown: {
      historicalNoShows: Math.round(noShowPts),
      historicalCancellations: Math.round(cancelPts),
      lowConfirmationRate: Math.round(confirmPts),
      dayOfWeekRisk: dayPts,
      timeOfDayRisk: timePts,
      reminderResponseTime: responsePts,
    },
  };
}

// ── Service ───────────────────────────────────────────────────────────────────

@Injectable()
export class PredictionService {
  private readonly logger = new Logger(PredictionService.name);
  private readonly queue: Queue<ReminderJobData>;

  constructor(private readonly prisma: PrismaService) {
    this.queue = new Queue<ReminderJobData>(REMINDER_QUEUE, {
      connection: getRedisConnection(),
    });
  }

  // ── Load signals from DB ───────────────────────────────────────────────────

  private async loadSignals(
    customerId: string,
    tenantId: string,
    scheduledAt: Date,
  ): Promise<CustomerSignals> {
    // Fetch all past appointments for this customer
    const pastAppointments = await this.prisma.appointment.findMany({
      where: {
        customerId,
        tenantId,
        status: { in: ['COMPLETED', 'NO_SHOW', 'CONFIRMED', 'CANCELLED'] },
      },
      include: {
        reminders: {
          include: {
            messageLogs: true,
          },
        },
      },
    });

    const totalPastAppointments = pastAppointments.length;
    const noShowCount = pastAppointments.filter(
      (a) => a.status === 'NO_SHOW',
    ).length;
    const cancellationCount = pastAppointments.filter(
      (a) => a.status === 'CANCELLED',
    ).length;
    const confirmationCount = pastAppointments.filter(
      (a) => a.status === 'CONFIRMED' || a.status === 'COMPLETED',
    ).length;

    // Calculate average response time per appointment:
    // time from first OUTBOUND reminder to the INBOUND confirmation reply
    const responseTimes: number[] = [];
    for (const appt of pastAppointments) {
      for (const reminder of appt.reminders) {
        const outboundLog = reminder.messageLogs
          .filter((ml) => ml.direction === 'OUTBOUND' && ml.sentAt)
          .sort((a, b) => a.sentAt!.getTime() - b.sentAt!.getTime())[0];
        const inboundLog = reminder.messageLogs
          .filter((ml) => ml.direction === 'INBOUND' && ml.createdAt)
          .sort((a, b) => a.createdAt.getTime() - b.createdAt.getTime())[0];

        if (outboundLog?.sentAt && inboundLog) {
          const diffMs =
            inboundLog.createdAt.getTime() - outboundLog.sentAt.getTime();
          if (diffMs > 0) {
            responseTimes.push(diffMs / 60000); // convert to minutes
          }
        }
      }
    }

    const avgResponseMinutes =
      responseTimes.length > 0
        ? responseTimes.reduce((sum, t) => sum + t, 0) / responseTimes.length
        : null;

    return {
      totalPastAppointments,
      noShowCount,
      cancellationCount,
      confirmationCount,
      avgResponseMinutes,
      dayOfWeek: scheduledAt.getDay(),
      hourOfDay: scheduledAt.getHours(),
    };
  }

  // ── Schedule escalation reminders ─────────────────────────────────────────

  private async scheduleEscalation(
    appointment: {
      id: string;
      title: string;
      scheduledAt: Date;
      customerId: string | null;
      customer: {
        firstName: string;
        lastName: string;
        phone: string | null;
        email: string | null;
      } | null;
    },
    score: number,
    tenantId: string,
  ): Promise<string[]> {
    const now = Date.now();
    const appointmentMs = appointment.scheduledAt.getTime();
    const minutesUntil = (appointmentMs - now) / 60000;
    const scheduledChannels: string[] = [];

    const timeStr = appointment.scheduledAt.toLocaleTimeString('en-US', {
      hour: '2-digit',
      minute: '2-digit',
      hour12: true,
    });
    const messageBase = `⚠️ High Priority: Hi ${appointment.customer?.firstName ?? 'Customer'}, please confirm your ${appointment.title} appointment at ${timeStr}. Reply YES to confirm or call us.`;

    const escalations: Array<{
      channel: string;
      offsetMinutes: number;
      minMinutesUntil: number;
    }> = [
      { channel: 'SMS', offsetMinutes: 120, minMinutesUntil: 130 },
      { channel: 'WHATSAPP', offsetMinutes: 60, minMinutesUntil: 70 },
    ];

    if (score >= 76) {
      escalations.push({
        channel: 'VOICE',
        offsetMinutes: 240,
        minMinutesUntil: 250,
      });
    }

    for (const esc of escalations) {
      if (minutesUntil < esc.minMinutesUntil) continue;

      const sendTime = new Date(appointmentMs - esc.offsetMinutes * 60000);
      const delayMs = Math.max(0, sendTime.getTime() - now);

      // Create reminder record
      const reminder = await this.prisma.reminder.create({
        data: {
          tenantId,
          appointmentId: appointment.id,
          reminderRuleId: null,
          channel: esc.channel as any,
          scheduledSendTime: sendTime,
          status: 'PENDING',
          messageContent: messageBase,
        },
      });

      // Enqueue BullMQ job
      const jobData: ReminderJobData = {
        reminderId: reminder.id,
        tenantId,
        appointmentId: appointment.id,
        channel: esc.channel,
        messageContent: messageBase,
        scheduledFor: sendTime.toISOString(),
      };

      await this.queue.add(`escalation:${reminder.id}`, jobData, {
        ...REMINDER_JOB_OPTIONS,
        delay: delayMs,
        jobId: `escalation:${reminder.id}`,
      });

      scheduledChannels.push(esc.channel);
      this.logger.log(
        `Escalation ${esc.channel} scheduled for appointment ${appointment.id} at ${sendTime.toISOString()}`,
      );
    }

    return scheduledChannels;
  }

  // ── Main prediction generator ─────────────────────────────────────────────

  async generatePrediction(appointmentId: string, tenantId: string) {
    const appointment = await this.prisma.appointment.findFirst({
      where: { id: appointmentId, tenantId },
      include: { customer: true },
    });

    if (!appointment) {
      throw new NotFoundException('Appointment not found');
    }

    const signals = await this.loadSignals(
      appointment.customerId!,
      tenantId,
      appointment.scheduledAt,
    );

    const { score, breakdown } = computeScore(signals);

    const riskLevel = score >= 61 ? 'HIGH' : score >= 36 ? 'MEDIUM' : 'LOW';

    // Upsert risk fields on appointment
    await this.prisma.appointment.update({
      where: { id: appointmentId },
      data: {
        noShowRiskScore: score,
        riskCalculatedAt: new Date(),
      },
    });

    // Determine escalation
    let escalationTriggered = false;
    let escalationChannels: string[] = [];

    if (riskLevel === 'HIGH') {
      escalationChannels = await this.scheduleEscalation(
        appointment,
        score,
        tenantId,
      );
      escalationTriggered = escalationChannels.length > 0;
    }

    // Create PredictionLog
    await this.prisma.predictionLog.create({
      data: {
        tenantId,
        appointmentId,
        customerId: appointment.customerId!,
        riskScore: score,
        riskLevel,
        signals: breakdown,
        escalationTriggered,
        escalationChannels,
      },
    });

    this.logger.log(
      `Prediction for appointment ${appointmentId}: score=${score}, level=${riskLevel}`,
    );

    return {
      appointmentId,
      customerId: appointment.customerId,
      riskScore: score,
      riskLevel,
      signals: breakdown,
      escalationTriggered,
      escalationChannels,
    };
  }

  // ── Get high-risk appointments ────────────────────────────────────────────

  async getHighRiskAppointments(tenantId: string, days = 7) {
    const now = new Date();
    const future = new Date(now.getTime() + days * 86400000);

    return this.prisma.appointment.findMany({
      where: {
        tenantId,
        status: { in: ['SCHEDULED', 'CONFIRMED'] },
        scheduledAt: { gte: now, lte: future },
        noShowRiskScore: { gte: 61 },
      },
      orderBy: { noShowRiskScore: 'desc' },
      include: {
        customer: true,
        predictionLogs: {
          orderBy: { generatedAt: 'desc' },
          take: 1,
        },
      },
    });
  }

  // ── Stats ─────────────────────────────────────────────────────────────────

  async getStats(tenantId: string) {
    const now = new Date();
    const future7d = new Date(now.getTime() + 7 * 86400000);

    const upcoming = await this.prisma.appointment.findMany({
      where: {
        tenantId,
        status: { in: ['SCHEDULED', 'CONFIRMED'] },
        scheduledAt: { gte: now, lte: future7d },
        noShowRiskScore: { not: null },
      },
      select: { noShowRiskScore: true },
    });

    const highRiskCount = upcoming.filter(
      (a) => (a.noShowRiskScore ?? 0) >= 61,
    ).length;
    const mediumRiskCount = upcoming.filter(
      (a) => (a.noShowRiskScore ?? 0) >= 36 && (a.noShowRiskScore ?? 0) < 61,
    ).length;
    const lowRiskCount = upcoming.filter(
      (a) => (a.noShowRiskScore ?? 0) < 36,
    ).length;

    const scores = upcoming.map((a) => a.noShowRiskScore ?? 0);
    const avgRiskScore =
      scores.length > 0
        ? Math.round(scores.reduce((sum, s) => sum + s, 0) / scores.length)
        : null;

    const [totalPredicted, escalationsTriggered] = await Promise.all([
      this.prisma.predictionLog.count({ where: { tenantId } }),
      this.prisma.predictionLog.count({
        where: { tenantId, escalationTriggered: true },
      }),
    ]);

    return {
      highRiskCount,
      mediumRiskCount,
      lowRiskCount,
      avgRiskScore,
      totalPredicted,
      escalationsTriggered,
      predictedNoShows: highRiskCount,
    };
  }

  // ── Recalculate ───────────────────────────────────────────────────────────

  async recalculate(tenantId: string, appointmentId: string) {
    return this.generatePrediction(appointmentId, tenantId);
  }

  // ── Get prediction for single appointment ─────────────────────────────────

  async getForAppointment(tenantId: string, appointmentId: string) {
    const appointment = await this.prisma.appointment.findFirst({
      where: { id: appointmentId, tenantId },
      include: {
        customer: true,
        predictionLogs: {
          orderBy: { generatedAt: 'desc' },
          take: 1,
        },
      },
    });

    if (!appointment) {
      throw new NotFoundException('Appointment not found');
    }

    return appointment;
  }
}
