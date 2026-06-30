import {
  Injectable,
  Logger,
  NotFoundException,
  BadRequestException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { PrismaService } from '../../prisma/prisma.service';
import { ReminderSchedulerService } from '../reminder/reminder-scheduler.service';
import { EventLifecycleService } from '../appointment/event-lifecycle.service';
import { SaveWidgetConfigDto, CreateBookingDto } from './dto/widget-config.dto';

interface ServiceItem {
  name: string;
  duration: number;
  price?: number;
}

@Injectable()
export class BookingWidgetService {
  private readonly logger = new Logger(BookingWidgetService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly configService: ConfigService,
    private readonly reminderScheduler: ReminderSchedulerService,
    private readonly eventLifecycle: EventLifecycleService,
  ) {}

  // ── Config management ──────────────────────

  async saveWidgetConfig(tenantId: string, dto: SaveWidgetConfigDto) {
    const data = {
      tenantId,
      businessName: dto.businessName,
      welcomeMessage: dto.welcomeMessage,
      services: dto.services as any,
      accentColor: dto.accentColor ?? '#6366f1',
      workingDays: dto.workingDays,
      workingHoursStart: dto.workingHoursStart,
      workingHoursEnd: dto.workingHoursEnd,
      slotDuration: dto.slotDuration,
      isActive: dto.isActive ?? true,
    };

    const config = await this.prisma.widgetConfig.upsert({
      where: { tenantId },
      create: data,
      update: {
        businessName: dto.businessName,
        welcomeMessage: dto.welcomeMessage,
        services: dto.services as any,
        accentColor: dto.accentColor ?? '#6366f1',
        workingDays: dto.workingDays,
        workingHoursStart: dto.workingHoursStart,
        workingHoursEnd: dto.workingHoursEnd,
        slotDuration: dto.slotDuration,
        isActive: dto.isActive ?? true,
      },
    });

    this.logger.log(`Widget config saved for tenant ${tenantId}`);
    return config;
  }

  async getWidgetConfig(tenantId: string) {
    return this.prisma.widgetConfig.findUnique({ where: { tenantId } });
  }

  // ── Embed code ────────────────────────────

  generateEmbedCode(tenantId: string): { iframe: string; script: string } {
    const baseUrl =
      this.configService.get<string>('APP_URL') || 'https://app.meetora.co';

    const widgetUrl = `${baseUrl}/widget/${tenantId}`;

    const iframe = `<iframe\n  src="${widgetUrl}"\n  width="100%"\n  height="700"\n  frameborder="0"\n  style="border-radius:12px;box-shadow:0 4px 24px rgba(0,0,0,0.12);"\n  title="Book an Appointment"\n></iframe>`;

    const script = `<div id="meetora-widget"></div>\n<script>\n  (function(){\n    var f=document.createElement('iframe');\n    f.src='${widgetUrl}';\n    f.width='100%';f.height='700';f.frameBorder='0';\n    f.style='border-radius:12px;box-shadow:0 4px 24px rgba(0,0,0,.12)';\n    document.getElementById('meetora-widget').appendChild(f);\n  })();\n</script>`;

    return { iframe, script };
  }

  // ── Public: widget data ───────────────────

  async getPublicWidgetData(
    tenantId: string,
  ): Promise<Record<string, unknown>> {
    const config = await this.prisma.widgetConfig.findUnique({
      where: { tenantId },
    });

    if (!config || !config.isActive) {
      throw new NotFoundException('Booking widget not found or inactive');
    }

    return {
      tenantId,
      businessName: config.businessName,
      welcomeMessage: config.welcomeMessage,
      services: config.services,
      accentColor: config.accentColor,
      slotDuration: config.slotDuration,
      workingDays: config.workingDays,
      workingHoursStart: config.workingHoursStart,
      workingHoursEnd: config.workingHoursEnd,
    };
  }

  // ── Public: available slots ───────────────

  async getAvailableSlots(tenantId: string, dateStr: string, duration: number) {
    const config = await this.prisma.widgetConfig.findUnique({
      where: { tenantId },
    });
    if (!config || !config.isActive)
      throw new NotFoundException('Widget not found');

    // Parse date (YYYY-MM-DD)
    const [year, month, day] = dateStr.split('-').map(Number);
    const date = new Date(year, month - 1, day);

    // ISO weekday: getDay() returns 0=Sun..6=Sat; convert to 1=Mon..7=Sun
    const isoDay = date.getDay() === 0 ? 7 : date.getDay();
    if (!config.workingDays.includes(isoDay)) {
      return []; // not a working day
    }

    // All appointments (SCHEDULED or CONFIRMED) that day
    const dayStart = new Date(year, month - 1, day, 0, 0, 0);
    const dayEnd = new Date(year, month - 1, day, 23, 59, 59);

    const existing = await this.prisma.appointment.findMany({
      where: {
        tenantId,
        scheduledAt: { gte: dayStart, lte: dayEnd },
        status: { in: ['SCHEDULED', 'CONFIRMED'] },
      },
      select: { scheduledAt: true, durationMinutes: true },
    });

    // Build set of blocked minute-of-day ranges
    const blocked: Array<{ start: number; end: number }> = existing.map((a) => {
      const s = a.scheduledAt;
      const startMin = s.getHours() * 60 + s.getMinutes();
      return { start: startMin, end: startMin + a.durationMinutes };
    });

    // Generate candidate slots
    const [startH, startM] = config.workingHoursStart.split(':').map(Number);
    const [endH, endM] = config.workingHoursEnd.split(':').map(Number);
    const windowStart = startH * 60 + startM;
    const windowEnd = endH * 60 + endM;

    const slots: string[] = [];
    for (
      let t = windowStart;
      t + duration <= windowEnd;
      t += config.slotDuration
    ) {
      const slotEnd = t + duration;
      const overlaps = blocked.some((b) => t < b.end && slotEnd > b.start);
      if (!overlaps) {
        const h = Math.floor(t / 60)
          .toString()
          .padStart(2, '0');
        const m = (t % 60).toString().padStart(2, '0');
        slots.push(`${h}:${m}`);
      }
    }

    return slots;
  }

  // ── Public: create appointment ────────────

  async createAppointmentFromWidget(tenantId: string, dto: CreateBookingDto) {
    const config = await this.prisma.widgetConfig.findUnique({
      where: { tenantId },
    });
    if (!config || !config.isActive)
      throw new NotFoundException('Widget not found');

    const services = config.services as unknown as ServiceItem[];
    if (dto.serviceIndex < 0 || dto.serviceIndex >= services.length) {
      throw new BadRequestException('Invalid service selection');
    }

    const service = services[dto.serviceIndex];
    const scheduledAt = new Date(dto.scheduledAt);

    if (isNaN(scheduledAt.getTime()) || scheduledAt < new Date()) {
      throw new BadRequestException('Invalid or past appointment time');
    }

    if (!dto.phone && !dto.email) {
      throw new BadRequestException('Phone or email is required');
    }

    // Upsert customer — match by phone or email within the tenant
    let customer = await this.prisma.customer.findFirst({
      where: {
        tenantId,
        OR: [
          dto.phone ? { phone: dto.phone } : {},
          dto.email ? { email: dto.email } : {},
        ].filter((c) => Object.keys(c).length > 0),
      },
    });

    const [firstName, ...rest] = dto.name.trim().split(' ');
    const lastName = rest.join(' ') || '—';

    if (!customer) {
      customer = await this.prisma.customer.create({
        data: {
          tenantId,
          firstName,
          lastName,
          phone: dto.phone,
          email: dto.email,
        },
      });
    }

    const appointment = await this.prisma.appointment.create({
      data: {
        tenantId,
        customerId: customer.id,
        title: service.name,
        scheduledAt,
        durationMinutes: service.duration,
        status: 'SCHEDULED',
      },
    });

    // ── Upsert Contact record so automations have a reachable recipient ──
    // The Contact model is what automations target; Customer is for appointments.
    // We upsert by phone or email within the tenant to avoid duplicates.
    let contact = await this.prisma.contact.findFirst({
      where: {
        tenantId,
        OR: [
          ...(dto.phone ? [{ phone: dto.phone }] : []),
          ...(dto.email ? [{ email: dto.email }] : []),
        ],
      },
    });

    if (!contact) {
      contact = await this.prisma.contact.create({
        data: {
          tenantId,
          name: dto.name.trim(),
          phone: dto.phone || null,
          email: dto.email || null,
        },
      });
    }

    // ── Link contact as event participant (needed for event-scoped automations) ──
    // Best-effort — ignore if event participant table not applicable for widget bookings
    await this.prisma.appointmentParticipant.upsert({
      where: { appointmentId_contactId: { appointmentId: appointment.id, contactId: contact.id } },
      create: { appointmentId: appointment.id, contactId: contact.id },
      update: {},
    }).catch(() => {});

    // Schedule reminder jobs
    const reminders = await this.reminderScheduler.scheduleForAppointment(
      appointment.id,
      tenantId,
    );

    // Link reminders to contact
    if (reminders.length > 0) {
      await this.prisma.reminder.updateMany({
        where: { id: { in: reminders.map((r) => r.id) } },
        data: { contactId: contact.id },
      });
    }

    // ── Fire automation trigger ──
    this.eventLifecycle
      .onEventScheduled(tenantId, appointment.id, {
        appointmentId: appointment.id,
        appointmentTitle: appointment.title,
        customerId: customer.id,
        contactId: contact.id,
        customerName: `${customer.firstName} ${customer.lastName}`,
        customerPhone: customer.phone ?? undefined,
        customerEmail: customer.email ?? undefined,
        tenantId,
      })
      .catch(() => {});

    this.logger.log(
      `Widget booking: appointment ${appointment.id} for ${dto.name}, ${reminders.length} reminders scheduled`,
    );

    return {
      appointmentId: appointment.id,
      service: service.name,
      scheduledAt: appointment.scheduledAt.toISOString(),
      remindersScheduled: reminders.length,
    };
  }
}
