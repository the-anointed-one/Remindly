import {
  Injectable,
  Logger,
  NotFoundException,
  OnModuleInit,
  OnModuleDestroy,
} from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import { WorkflowEngineService } from '../automation/workflow-engine.service';
import { MessagingService } from '../messaging/messaging.service';
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
      for (const contactId of contactIds) {
        // Find existing appointment first
        const existingAppt = await tx.appointment.findFirst({
          where: { eventId, customerId: contactId, tenantId },
        });

        const appointment = await tx.appointment.upsert({
          where: {
            id: existingAppt?.id || '00000000-0000-0000-0000-000000000000',
          },
          create: {
            tenantId,
            eventId,
            customerId: contactId,
            title: `Invitation: ${event.title}`,
            scheduledAt: event.startTime,
            status: 'SCHEDULED',
          },
          update: {
            status: 'SCHEDULED',
          },
        });

        await tx.eventParticipant.upsert({
          where: { eventId_contactId: { eventId, contactId } },
          create: { eventId, contactId, tenantId, status: 'invited' },
          update: {},
        });

        results.push(appointment);
      }
      return { invited: results.length };
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
    await this.prisma.appointment.updateMany({
      where: { eventId, customerId: contactId, tenantId },
      data: { status },
    });

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

    const message = dto.message || `Reminder for ${event.title}`;
    const channel = dto.channel || 'SMS';

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

  async getStats(tenantId: string, eventId: string) {
    const [confirmed, pending, cancelled, invited, total] = await Promise.all([
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
        where: { eventId, tenantId },
      }),
    ]);
    return { confirmed, pending, cancelled, invited, total };
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

  async getCalendarFeed(tenantId: string, from: Date, to: Date) {
    return this.prisma.event.findMany({
      where: { tenantId, startTime: { gte: from, lte: to } },
    });
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
