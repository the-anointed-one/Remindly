import {
  Injectable,
  Logger,
  NotFoundException,
  BadRequestException,
  OnModuleInit,
  OnModuleDestroy,
} from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import { WorkflowEngineService } from '../automation/workflow-engine.service';
import { MessagingService } from '../messaging/messaging.service';
import { appendRsvpFooter } from '../../common/utils/rsvp-footer.util';
import { generateQrToken } from '../../common/utils/qr-token.util';
import {
  resolveTenantTimezone,
  defaultMonthRangeInTz,
} from '../../common/timezone.util';
import { ReminderSchedulerService } from '../reminder/reminder-scheduler.service';
import { Queue } from 'bullmq';
import {
  EVENT_WORKFLOW_QUEUE,
  CAMPAIGN_QUEUE,
  getRedisConnection,
  EventWorkflowJobData,
  CampaignJobData,
} from '../../queue/queue.config';
import { CreateEventDto, UpdateEventDto } from './dto/event.dto';
import { BroadcastDto as BroadcastActionDto } from './dto/event-actions.dto';

@Injectable()
export class EventService implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger(EventService.name);
  private workflowQueue: Queue<EventWorkflowJobData>;
  private campaignQueue: Queue<CampaignJobData>;

  constructor(
    private readonly prisma: PrismaService,
    private readonly workflowEngine: WorkflowEngineService,
    private readonly messagingService: MessagingService,
    private readonly reminderScheduler: ReminderSchedulerService,
  ) {}

  onModuleInit() {
    const connection = getRedisConnection();
    this.workflowQueue = new Queue<EventWorkflowJobData>(EVENT_WORKFLOW_QUEUE, {
      connection,
    });
    this.campaignQueue = new Queue<CampaignJobData>(CAMPAIGN_QUEUE, {
      connection,
    });
  }

  async onModuleDestroy() {
    await this.workflowQueue.close();
    await this.campaignQueue.close();
  }

  async create(tenantId: string, userId: string, dto: CreateEventDto) {
    const event = await this.prisma.$transaction(async (tx) => {
      const e = await tx.event.create({
        data: {
          tenantId,
          createdBy: userId,
          title: dto.title,
          description: dto.description,
          location: dto.location ?? null,
          startTime: new Date(dto.startTime),
          endTime: dto.endTime ? new Date(dto.endTime) : undefined,
          eventType: dto.eventType ?? 'APPOINTMENT',
          status: 'DRAFT',
          incentiveType: dto.incentiveType ?? 'none',
          incentiveValue: dto.incentiveValue ?? null,
          incentiveMessage: dto.incentiveMessage ?? null,
        },
      });

      await (tx as any).eventAutomation.create({
        data: {
          tenantId,
          eventId: e.id,
          remindNonResponders:
            dto.automationSettings?.remindNonResponders ?? true,
          sendLocationOnConfirm:
            dto.automationSettings?.sendLocationOnConfirm ?? true,
          sendFollowupAfter: dto.automationSettings?.sendFollowupAfter ?? true,
        },
      });

      return e;
    });

    // Auto-invite contacts if provided
    if (dto.contactIds && dto.contactIds.length > 0) {
      await this.invite(event.id, tenantId, dto.contactIds);
    }

    // Fire automation trigger
    this.workflowEngine
      .fireTrigger(tenantId, 'event_created', event.id, {
        eventId: event.id,
        eventTitle: event.title,
        tenantId,
      })
      .catch((err) => {
        this.logger.error(
          `Failed to fire event_created trigger for ${event.id}: ${err.message}`,
        );
      });

    // Schedule reminders
    this.reminderScheduler.scheduleForEvent(event.id, tenantId).catch((err) => {
      this.logger.error(
        `Failed to schedule reminders for event ${event.id}: ${err.message}`,
      );
    });

    this.logger.log(
      `Event created: ${event.id} "${event.title}" tenant=${tenantId}`,
    );
    return event;
  }

  async findAll(tenantId: string, page = 1, limit = 20) {
    return this.prisma.event.findMany({
      where: { tenantId },
      orderBy: { startTime: 'asc' },
      skip: (page - 1) * limit,
      take: limit,
      include: {
        _count: { select: { participants: true } },
      },
    });
  }

  async findActive(tenantId: string) {
    const now = new Date();
    const startOfToday = new Date(
      now.getFullYear(),
      now.getMonth(),
      now.getDate(),
    );

    return this.prisma.event.findMany({
      where: {
        tenantId,
        startTime: { gte: startOfToday },
        status: { not: 'CANCELLED' },
      },
      include: {
        _count: { select: { participants: true } },
      },
      orderBy: { startTime: 'asc' },
      take: 10,
    });
  }

  async findOne(id: string, tenantId: string) {
    const event = await this.prisma.event.findFirst({
      where: { id, tenantId },
      include: {
        appointments: true,
        automation: true,
        participants: {
          include: {
            contact: {
              select: {
                id: true,
                name: true,
                phone: true,
                email: true,
              },
            },
          },
        },
      },
    });

    if (!event) throw new NotFoundException('Event not found');
    return event;
  }

  async update(tenantId: string, id: string, dto: UpdateEventDto) {
    const existing = await this.prisma.event.findFirst({
      where: { id, tenantId },
    });
    if (!existing) throw new NotFoundException('Event not found');

    const updated = await this.prisma.event.update({
      where: { id },
      data: {
        title: dto.title,
        description: dto.description,
        location: dto.location ?? null,
        startTime: dto.startTime ? new Date(dto.startTime) : undefined,
        endTime: dto.endTime ? new Date(dto.endTime) : undefined,
        eventType: dto.eventType as any,
        status: dto.status as any,
        incentiveType: dto.incentiveType,
        incentiveValue: dto.incentiveValue,
        incentiveMessage: dto.incentiveMessage,
      },
    });

    // Fire event_completed trigger
    if (updated.status === 'COMPLETED' && existing.status !== 'COMPLETED') {
      this.workflowEngine
        .fireTrigger(tenantId, 'event_completed', id, {
          tenantId,
          eventId: id,
          title: existing.title,
          startTime: existing.startTime,
        })
        .catch((err) => {
          this.logger.error(
            `Failed to fire event_completed trigger: ${err.message}`,
          );
        });

      // Cancel any remaining reminders if completed
      this.reminderScheduler.cancelForEvent(id).catch((err) => {
        this.logger.error(
          `Failed to cancel reminders for event ${id}: ${err.message}`,
        );
      });
    }

    return updated;
  }

  async remove(tenantId: string, id: string) {
    const event = await this.prisma.event.findFirst({
      where: { id, tenantId },
    });
    if (!event) throw new NotFoundException('Event not found');

    await this.reminderScheduler.cancelForEvent(id);
    try {
      await this.prisma.event.delete({ where: { id } });
    } catch (error) {
      this.logger.error(`Failed to delete event ${id}: ${error.message}`);
      throw error;
    }
    return { deleted: true };
  }

  async invite(eventId: string, tenantId: string, contactIds: string[]) {
    const event = await this.prisma.event.findFirst({
      where: { id: eventId, tenantId },
    });
    if (!event) throw new NotFoundException('Event not found');

    return this.prisma.$transaction(async (tx) => {
      const results: any[] = [];
      const skipped: string[] = [];

      for (const contactId of contactIds) {
        // `contacts` and `customers` are separate tables with separate id
        // spaces. Appointment.customerId is a FK to Customer, so passing the
        // contact id straight through violated
        // `appointments_customer_id_fkey` and rolled back the whole
        // transaction — meaning no participant was recorded either and every
        // event invite failed. Resolve (or create) the matching Customer first,
        // exactly as AppointmentService.ensureCustomer() does.
        const contact = await tx.contact.findFirst({
          where: { id: contactId, tenantId },
        });
        if (!contact) {
          // Unknown id, or one belonging to another tenant — skip rather than
          // abort the whole batch.
          skipped.push(contactId);
          continue;
        }

        const customer = await this.ensureCustomerTx(tx, tenantId, contact);

        const existingAppt = await tx.appointment.findFirst({
          where: { eventId, customerId: customer.id, tenantId },
        });

        const appointment = await tx.appointment.upsert({
          where: {
            id: existingAppt?.id || '00000000-0000-0000-0000-000000000000',
          },
          create: {
            tenantId,
            eventId,
            customerId: customer.id,
            title: `Invitation: ${event.title}`,
            scheduledAt: event.startTime,
            status: 'SCHEDULED',
          },
          update: {
            status: 'SCHEDULED',
          },
        });

        // EventParticipant.contactId is a genuine FK to `contacts` — this one
        // correctly stays the contact id.
        await tx.eventParticipant.upsert({
          where: { eventId_contactId: { eventId, contactId } },
          create: {
            eventId,
            contactId,
            tenantId,
            status: 'invited',
            qrToken: generateQrToken(eventId, contactId),
          },
          // Empty on purpose: re-inviting must not mint a new token, or any QR
          // already handed to the attendee would stop scanning.
          update: {},
        });

        results.push(appointment);
      }

      if (skipped.length) {
        this.logger.warn(
          `invite(): skipped ${skipped.length} unknown contact(s) for event ${eventId}`,
        );
      }

      return { invited: results.length, skipped: skipped.length };
    });
  }

  /**
   * Find the Customer matching a Contact (by phone or email), creating one if
   * absent. Mirrors AppointmentService.ensureCustomer(), but takes the
   * transaction client so invite() stays atomic.
   */
  private async ensureCustomerTx(
    tx: any,
    tenantId: string,
    contact: { name: string; phone: string | null; email: string | null },
  ) {
    const match = [
      ...(contact.phone ? [{ phone: contact.phone }] : []),
      ...(contact.email ? [{ email: contact.email }] : []),
    ];

    if (match.length) {
      const existing = await tx.customer.findFirst({
        where: { tenantId, OR: match },
      });
      if (existing) return existing;
    }

    const names = (contact.name || '').split(' ');
    return tx.customer.create({
      data: {
        tenantId,
        firstName: names[0] || 'Unknown',
        lastName: names.slice(1).join(' ') || 'Contact',
        email: contact.email,
        phone: contact.phone,
      },
    });
  }

  async respond(
    eventId: string,
    tenantId: string,
    contactId: string,
    response: string,
  ) {
    const event = await this.prisma.event.findFirst({
      where: { id: eventId, tenantId },
    });
    if (!event) throw new NotFoundException('Event not found');

    const normalized = response.trim().toUpperCase();
    let status: any = 'SCHEDULED';
    let triggerType = 'rsvp_maybe';

    if (normalized === 'YES') {
      status = 'CONFIRMED';
      triggerType = 'rsvp_confirmed';
    } else if (normalized === 'NO') {
      status = 'CANCELLED';
      triggerType = 'rsvp_declined';
    }

    // 1. Update Appointment status
    // Same contact-id-vs-customer-id mismatch as invite() had. Here it was a
    // silent failure rather than a crash: updateMany matched zero rows, so the
    // appointment status was never updated even though the endpoint returned
    // success. Resolve the Contact's Customer and match on that.
    const respondent = await this.prisma.contact.findFirst({
      where: { id: contactId, tenantId },
      select: { phone: true, email: true },
    });

    const customerMatch = [
      ...(respondent?.phone ? [{ phone: respondent.phone }] : []),
      ...(respondent?.email ? [{ email: respondent.email }] : []),
    ];

    const customer = customerMatch.length
      ? await this.prisma.customer.findFirst({
          where: { tenantId, OR: customerMatch },
          select: { id: true },
        })
      : null;

    if (customer) {
      await this.prisma.appointment.updateMany({
        where: { eventId, customerId: customer.id, tenantId },
        data: { status },
      });
    } else {
      this.logger.warn(
        `respond(): no Customer found for contact ${contactId} — appointment status not updated for event ${eventId}`,
      );
    }

    // Update EventParticipant
    const participantStatus =
      normalized === 'YES'
        ? 'confirmed'
        : normalized === 'NO'
          ? 'cancelled'
          : 'pending';
    await this.prisma.eventParticipant.updateMany({
      where: { eventId, contactId, tenantId },
      data: { status: participantStatus as any, lastResponseAt: new Date() },
    });

    // 2. Create RsvpEvent
    await (this.prisma as any).rsvpEvent.create({
      data: {
        eventId,
        contactId,
        tenantId,
        response,
        channel: 'API',
      },
    });

    // 3. Add job to meetora-workflows queue
    const jobData: EventWorkflowJobData = {
      tenantId,
      triggerType,
      contactId,
      eventId,
    };
    await this.workflowQueue.add('event-workflow', jobData, {
      attempts: 3,
      backoff: { type: 'exponential', delay: 5000 },
    });

    return { success: true, triggerType };
  }

  async broadcastAction(
    eventId: string,
    tenantId: string,
    dto: BroadcastActionDto,
  ) {
    const event = await this.prisma.event.findFirst({
      where: { id: eventId, tenantId },
      include: {
        participants: { include: { contact: true } },
      },
    });
    if (!event) throw new NotFoundException('Event not found');

    const channel = dto.channel || 'SMS';
    const message = appendRsvpFooter(
      dto.message || `Reminder for ${event.title}`,
      channel,
    );

    let queuedCount = 0;
    for (const p of event.participants) {
      if (!p.contact) continue;

      const recipient =
        channel === 'EMAIL' || channel === 'WHATSAPP'
          ? p.contact.email || p.contact.phone
          : p.contact.phone;
      if (!recipient) continue;

      const jobData: CampaignJobData = {
        tenantId,
        campaignId: eventId,
        segmentId: 'event-broadcast',
        contactId: p.contactId,
        recipient,
        channel,
        messageTemplate: message,
        scheduledFor: new Date().toISOString(),
        contactName: p.contact.name,
        locationName: event.location || '',
      };

      await this.campaignQueue.add('broadcast-send', jobData);
      queuedCount++;
    }

    return { queuedCount };
  }

  /**
   * Renders the participant's check-in QR as a data URL.
   *
   * Participants invited before QR support existed have no token, so mint one
   * on first request rather than leaving those events un-scannable.
   */
  async generateQrCode(eventId: string, contactId: string, tenantId: string) {
    const participant = await this.prisma.eventParticipant.findFirst({
      where: { eventId, contactId, tenantId },
      include: { contact: true },
    });

    if (!participant) {
      throw new NotFoundException('Participant not found');
    }

    let qrToken = participant.qrToken;
    if (!qrToken) {
      qrToken = generateQrToken(eventId, contactId);
      await this.prisma.eventParticipant.update({
        where: { id: participant.id },
        data: { qrToken },
      });
    }

    const QRCode = await import('qrcode');

    const qrPayload = JSON.stringify({ eventId, contactId, token: qrToken });

    const qrDataUrl = await QRCode.toDataURL(qrPayload, {
      width: 300,
      margin: 2,
      color: { dark: '#000000', light: '#ffffff' },
    });

    return {
      qrCode: qrDataUrl,
      contactName: participant.contact.name,
      token: qrToken,
    };
  }

  /**
   * Checks a participant in from a scanned QR token and fires the thank-you SMS.
   */
  async processArrival(
    eventId: string,
    qrToken: string,
    tenantId: string,
    scannedByUserId: string,
  ) {
    if (!qrToken || typeof qrToken !== 'string' || !qrToken.trim()) {
      throw new BadRequestException('No QR token supplied');
    }

    const participant = await this.prisma.eventParticipant.findFirst({
      where: { eventId, tenantId, qrToken: qrToken.trim() },
      include: {
        contact: true,
        event: { select: { title: true } },
      },
    });

    if (!participant) {
      throw new NotFoundException(
        'Invalid QR code — not found for this event',
      );
    }

    if (participant.arrivedAt) {
      throw new BadRequestException(
        `${participant.contact.name} already checked in at ` +
          `${participant.arrivedAt.toLocaleTimeString()}`,
      );
    }

    // Conditional update: two organisers scanning the same badge at once would
    // both pass the check above, but only one can match arrivedAt: null here.
    const claimed = await this.prisma.eventParticipant.updateMany({
      where: { id: participant.id, arrivedAt: null },
      data: {
        arrivedAt: new Date(),
        status: 'confirmed',
        qrScannedBy: scannedByUserId,
      },
    });

    if (claimed.count === 0) {
      throw new BadRequestException(
        `${participant.contact.name} already checked in`,
      );
    }

    const arrivedAt = new Date();

    const thankYouMsg =
      `Welcome, ${participant.contact.name}! ` +
      `Thank you for attending ${participant.event?.title}. ` +
      `We are delighted to have you here!`;

    if (participant.contact.phone) {
      // A messaging failure must not cost the organiser the check-in they
      // already recorded — the arrival is committed above.
      await this.messagingService
        .send(
          tenantId,
          'SMS',
          participant.contact.phone,
          thankYouMsg,
          undefined,
          undefined,
          eventId,
          participant.contactId,
        )
        .catch((err) => {
          this.logger.error(
            `Check-in recorded but thank-you SMS failed for ${participant.contact.name}: ${err.message}`,
          );
        });
    }

    this.logger.log(
      `${participant.contact.name} checked in at event ${eventId}`,
    );

    return {
      success: true,
      contactName: participant.contact.name,
      arrivedAt,
      message: `${participant.contact.name} checked in successfully`,
    };
  }

  async getStats(tenantId: string, eventId: string) {
    const [confirmed, pending, cancelled, invited, arrived, total] =
      await Promise.all([
        this.prisma.eventParticipant.count({
          where: { eventId, tenantId, status: 'confirmed' },
        }),
        this.prisma.eventParticipant.count({
          where: { eventId, tenantId, status: 'pending' },
        }),
        this.prisma.eventParticipant.count({
          where: { eventId, tenantId, status: 'cancelled' },
        }),
        this.prisma.eventParticipant.count({
          where: { eventId, tenantId, status: 'invited' },
        }),
        this.prisma.eventParticipant.count({
          where: { eventId, tenantId, arrivedAt: { not: null } },
        }),
        this.prisma.eventParticipant.count({
          where: { eventId, tenantId },
        }),
      ]);
    return { confirmed, pending, cancelled, invited, arrived, total };
  }

  async getSmartReminders(tenantId: string, eventId: string) {
    const event = await this.prisma.event.findFirst({
      where: { id: eventId, tenantId },
    });
    if (!event) throw new NotFoundException('Event not found');

    const reminders = await this.prisma.reminder.findMany({
      where: { eventId, tenantId },
      include: {
        contact: { select: { id: true, name: true, phone: true, email: true } },
        reminderRule: { select: { name: true } },
      },
      orderBy: { scheduledSendTime: 'asc' },
    });

    const pending = reminders
      .filter((r) => r.status === 'PENDING')
      .map(this.mapReminder);
    const sent = reminders
      .filter((r) => ['SENT', 'DELIVERED'].includes(r.status))
      .map(this.mapReminder);
    const failed = reminders
      .filter((r) => r.status === 'FAILED')
      .map(this.mapReminder);

    const recommendations: string[] = [];
    if (failed.length > 0)
      recommendations.push(`${failed.length} reminder(s) failed.`);
    if (pending.length > 0)
      recommendations.push(`${pending.length} reminder(s) pending.`);

    return {
      eventId,
      eventTitle: event.title,
      eventStartTime: event.startTime,
      totalReminders: reminders.length,
      pending,
      sent,
      failed,
      recommendations,
    };
  }

  private mapReminder(reminder: any) {
    return {
      id: reminder.id,
      contactId: reminder.contactId,
      contactName: reminder.contact?.name || 'Unknown',
      contactPhone: reminder.contact?.phone,
      contactEmail: reminder.contact?.email,
      status: reminder.status,
      channel: reminder.channel,
      scheduledSendTime: reminder.scheduledSendTime,
      sentAt: reminder.sentAt,
      messageContent: reminder.messageContent,
      reminderRuleName: reminder.reminderRule?.name,
    };
  }

  async getCalendarFeed(tenantId: string, fromStr?: string, toStr?: string) {
    // Appointments are Events with eventType 'APPOINTMENT' (see
    // appointment.service.create). The calendar UI consumes a
    // { events, appointments } shape, so split the rows by type rather than
    // returning a flat array (which left `data.events`/`data.appointments`
    // undefined and the calendar permanently empty).
    //
    // When the caller omits from/to, the default month window is anchored to
    // the tenant's business timezone rather than the server's local clock.
    let from = fromStr ? new Date(fromStr) : undefined;
    let to = toStr ? new Date(toStr) : undefined;
    if (!from || !to) {
      const tz = await resolveTenantTimezone(this.prisma, tenantId);
      const def = defaultMonthRangeInTz(tz);
      from = from ?? def.from;
      to = to ?? def.to;
    }

    const rows = await this.prisma.event.findMany({
      where: { tenantId, startTime: { gte: from, lte: to } },
      orderBy: { startTime: 'asc' },
    });
    return {
      events: rows
        .filter((e) => e.eventType !== 'APPOINTMENT')
        .map((e) => ({ ...e, type: 'event' as const })),
      appointments: rows
        .filter((e) => e.eventType === 'APPOINTMENT')
        .map((e) => ({ ...e, type: 'appointment' as const })),
    };
  }

  async suggestReplacements(tenantId: string, eventId: string, limit = 5) {
    try {
      const participants = await this.prisma.eventParticipant.findMany({
        where: { eventId },
        select: { contactId: true },
      });
      const participantIds = participants.map((p) => p.contactId);

      return await this.prisma.contact.findMany({
        where: {
          tenantId,
          id: { notIn: participantIds },
          unsubscribed: false,
        },
        take: limit,
        orderBy: { updatedAt: 'desc' },
      });
    } catch (error: any) {
      this.logger.error(`Failed to suggest replacements: ${error.message}`);
      return [];
    }
  }

  async replaceParticipant(
    tenantId: string,
    eventId: string,
    oldParticipantId: string,
    newContactId: string,
  ) {
    return this.invite(eventId, tenantId, [newContactId]);
  }
}
