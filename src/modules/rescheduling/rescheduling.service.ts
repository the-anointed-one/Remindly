import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { ChannelType } from '@prisma/client';
import { PrismaService } from '../../prisma/prisma.service';
import { ReminderSchedulerService } from '../reminder/reminder-scheduler.service';
import { TwilioProvider } from '../messaging/twilio.provider';
import { MockSendService } from '../messaging/mock-send.service';

// ── Constants ─────────────────────────────────────────────────────────────────

/** Session expires 30 minutes after creation. */
const SESSION_TTL_MS = 30 * 60 * 1000;

/** Number of slots offered per reschedule request. */
const SLOTS_TO_OFFER = 5;

/** Business hours (tenant-level configuration not yet implemented; defaults used). */
const BUSINESS_START_HOUR = 9; // 9 AM
const BUSINESS_END_HOUR = 17; // 5 PM (last slot at 16:00)
const SLOT_DURATION_MINUTES = 60;

/** How many days ahead to search for slots. */
const SEARCH_WINDOW_DAYS = 14;

export interface AvailableSlot {
  index: number; // 1-based for SMS replies
  dateTime: Date;
  label: string; // human-readable, e.g. "Mon 11 Mar, 10:00am"
}

// ── Helpers ────────────────────────────────────────────────────────────────────

function isWeekday(d: Date): boolean {
  const day = d.getDay();
  return day !== 0 && day !== 6;
}

function formatSlotLabel(dt: Date): string {
  return dt.toLocaleString('en-GB', {
    weekday: 'short',
    day: 'numeric',
    month: 'short',
    hour: '2-digit',
    minute: '2-digit',
    hour12: true,
  });
}

// ── Service ────────────────────────────────────────────────────────────────────

@Injectable()
export class ReschedulingService {
  private readonly logger = new Logger(ReschedulingService.name);
  private readonly useTwilio: boolean;

  constructor(
    private readonly prisma: PrismaService,
    private readonly config: ConfigService,
    private readonly reminderScheduler: ReminderSchedulerService,
    private readonly twilioProvider: TwilioProvider,
    private readonly mockSendService: MockSendService,
  ) {
    this.useTwilio = !!this.config.get('TWILIO_ACCOUNT_SID');
  }

  // ── generateAvailableSlots ────────────────────────────────────────────────

  /**
   * Returns up to SLOTS_TO_OFFER open time slots within the next
   * SEARCH_WINDOW_DAYS, avoiding:
   *   - Times already occupied by SCHEDULED/CONFIRMED appointments
   *   - Calendar synced events for the tenant
   *   - The appointment being rescheduled itself
   *   - Past times and the current appointment's original time
   */
  async generateAvailableSlots(
    tenantId: string,
    appointmentId: string,
  ): Promise<AvailableSlot[]> {
    const now = new Date();
    const windowEnd = new Date(
      now.getTime() + SEARCH_WINDOW_DAYS * 24 * 60 * 60 * 1000,
    );

    // Fetch all occupied blocks in the window
    const [existingAppointments, calendarEvents] = await Promise.all([
      this.prisma.appointment.findMany({
        where: {
          tenantId,
          id: { not: appointmentId },
          status: { in: ['SCHEDULED', 'CONFIRMED'] },
          scheduledAt: { gte: now, lt: windowEnd },
        },
        select: { scheduledAt: true, durationMinutes: true },
      }),
      this.prisma.calendarSyncedEvent.findMany({
        where: {
          tenantId,
          startAt: { gte: now, lt: windowEnd },
        },
        select: { startAt: true, endAt: true },
      }),
    ]);

    // Build a set of blocked start-hours (rounded to hour boundaries)
    const blockedMs = new Set<number>();

    for (const appt of existingAppointments) {
      const start = new Date(appt.scheduledAt);
      const end = new Date(start.getTime() + appt.durationMinutes * 60_000);
      // Block every SLOT_DURATION slot that overlaps
      for (
        let ms = start.getTime();
        ms < end.getTime();
        ms += SLOT_DURATION_MINUTES * 60_000
      ) {
        blockedMs.add(snapToHour(ms));
      }
    }

    for (const evt of calendarEvents) {
      const start = new Date(evt.startAt);
      const end = new Date(evt.endAt);
      for (
        let ms = start.getTime();
        ms < end.getTime();
        ms += SLOT_DURATION_MINUTES * 60_000
      ) {
        blockedMs.add(snapToHour(ms));
      }
    }

    const slots: AvailableSlot[] = [];

    // Iterate through candidate slots: start from the next whole hour
    const searchStart = new Date(now);
    searchStart.setMinutes(0, 0, 0);
    searchStart.setHours(searchStart.getHours() + 1); // start from next hour

    let cursor = new Date(searchStart);

    while (cursor < windowEnd && slots.length < SLOTS_TO_OFFER) {
      const hour = cursor.getHours();

      if (
        isWeekday(cursor) &&
        hour >= BUSINESS_START_HOUR &&
        hour < BUSINESS_END_HOUR &&
        !blockedMs.has(cursor.getTime())
      ) {
        slots.push({
          index: slots.length + 1,
          dateTime: new Date(cursor),
          label: formatSlotLabel(cursor),
        });
      }

      cursor = new Date(cursor.getTime() + SLOT_DURATION_MINUTES * 60_000);
    }

    this.logger.log(
      `Generated ${slots.length} slots for appointment ${appointmentId} (tenant ${tenantId})`,
    );

    return slots;
  }

  // ── sendRescheduleOptions ─────────────────────────────────────────────────

  /**
   * Creates a RescheduleSession and sends the customer a numbered list of slots.
   */
  async sendRescheduleOptions(
    phone: string,
    tenantId: string,
    appointmentId: string,
    channel: ChannelType = ChannelType.SMS,
  ): Promise<void> {
    const slots = await this.generateAvailableSlots(tenantId, appointmentId);

    if (slots.length === 0) {
      // No slots found — send apology
      const noSlotMsg =
        'Sorry, no available slots were found in the next 2 weeks. Please call us to reschedule.';
      await this.sendMessage(phone, noSlotMsg, channel);
      return;
    }

    // Persist session so we can correlate the reply
    await this.prisma.rescheduleSession.deleteMany({
      where: { phone, tenantId },
    });

    await this.prisma.rescheduleSession.create({
      data: {
        tenantId,
        appointmentId,
        phone,
        channel,
        offeredSlots: slots.map((s) => s.dateTime.toISOString()),
        expiresAt: new Date(Date.now() + SESSION_TTL_MS),
      },
    });

    const lines = ['Choose a new time:'];
    for (const slot of slots) {
      lines.push(`${slot.index}) ${slot.label}`);
    }
    lines.push('Reply with the number (1-' + slots.length + ') to confirm.');

    await this.sendMessage(phone, lines.join('\n'), channel);
    this.logger.log(
      `Reschedule options sent to ${phone} (${slots.length} slots)`,
    );
  }

  // ── processSlotSelection ──────────────────────────────────────────────────

  /**
   * Called when a customer replies with a digit while a RescheduleSession is active.
   * Returns the response message to send back, or null if no active session.
   */
  async processSlotSelection(
    phone: string,
    digit: string,
    channel: ChannelType,
  ): Promise<string | null> {
    const session = await this.prisma.rescheduleSession.findFirst({
      where: {
        phone,
        expiresAt: { gt: new Date() },
      },
      orderBy: { createdAt: 'desc' },
    });

    if (!session) return null;

    const slots = session.offeredSlots as string[];
    const idx = parseInt(digit, 10);

    if (isNaN(idx) || idx < 1 || idx > slots.length) {
      return `Invalid selection. Please reply with a number between 1 and ${slots.length}.`;
    }

    const newTime = new Date(slots[idx - 1]);

    await this.updateAppointmentTime(
      session.appointmentId,
      newTime,
      session.tenantId,
    );
    await this.rescheduleReminderJobs(session.appointmentId, session.tenantId);

    // Clean up session
    await this.prisma.rescheduleSession.delete({ where: { id: session.id } });

    const label = formatSlotLabel(newTime);
    this.logger.log(
      `Appointment ${session.appointmentId} rescheduled to ${newTime.toISOString()} via ${channel} reply`,
    );

    return `Your appointment has been rescheduled to ${label}. New reminders will be sent.`;
  }

  // ── updateAppointmentTime ─────────────────────────────────────────────────

  async updateAppointmentTime(
    appointmentId: string,
    newTime: Date,
    tenantId: string,
  ): Promise<void> {
    await this.prisma.appointment.update({
      where: { id: appointmentId },
      data: {
        scheduledAt: newTime,
        status: 'SCHEDULED', // reset to scheduled after reschedule
      },
    });

    this.logger.log(
      `Appointment ${appointmentId} time updated to ${newTime.toISOString()}`,
    );
  }

  // ── rescheduleReminderJobs ────────────────────────────────────────────────

  async rescheduleReminderJobs(
    appointmentId: string,
    tenantId: string,
  ): Promise<void> {
    await this.reminderScheduler.cancelForAppointment(appointmentId);
    await this.reminderScheduler.scheduleForAppointment(
      appointmentId,
      tenantId,
    );
    this.logger.log(
      `Reminder jobs rescheduled for appointment ${appointmentId}`,
    );
  }

  // ── hasActiveSession ──────────────────────────────────────────────────────

  async hasActiveSession(phone: string): Promise<boolean> {
    const session = await this.prisma.rescheduleSession.findFirst({
      where: { phone, expiresAt: { gt: new Date() } },
    });
    return !!session;
  }

  // ── Send helper ───────────────────────────────────────────────────────────

  private async sendMessage(
    phone: string,
    message: string,
    channel: ChannelType,
  ): Promise<void> {
    if (channel === ChannelType.WHATSAPP) {
      if (this.useTwilio) {
        await this.twilioProvider.sendWhatsApp(phone, message);
      } else {
        await this.mockSendService.sendWhatsApp(phone, message);
      }
    } else {
      if (this.useTwilio) {
        await this.twilioProvider.sendSms(phone, message);
      } else {
        await this.mockSendService.sendSms(phone, message);
      }
    }
  }
}

// ── Utility ────────────────────────────────────────────────────────────────────

/** Snap a millisecond timestamp to the start of its SLOT_DURATION_MINUTES block. */
function snapToHour(ms: number): number {
  const slotMs = SLOT_DURATION_MINUTES * 60_000;
  return Math.floor(ms / slotMs) * slotMs;
}
