import {
  Injectable,
  Logger,
  NotFoundException,
  BadRequestException,
} from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import { resolveTenantTimezone, dayRangeInTz } from '../../common/timezone.util';
import { ActivityType } from '@prisma/client';
import { AuditService } from '../audit/audit.service';
import { ReminderSchedulerService } from '../reminder/reminder-scheduler.service';
import {
  CreateAppointmentDto,
  UpdateAppointmentDto,
} from './dto/appointment.dto';
import { EventLifecycleService } from './event-lifecycle.service';
import { TemplateRendererService } from '../messaging/template-renderer.service';
import { Queue } from 'bullmq';
import {
  REMINDER_QUEUE,
  getRedisConnection,
  ReminderJobData,
} from '../../queue/queue.config';

@Injectable()
export class AppointmentService {
  private readonly logger = new Logger(AppointmentService.name);

  private readonly queue: Queue<ReminderJobData>;

  constructor(
    private readonly prisma: PrismaService,
    private readonly auditService: AuditService,
    private readonly reminderScheduler: ReminderSchedulerService,
    private readonly eventLifecycle: EventLifecycleService,
    private readonly templateRenderer: TemplateRendererService,
  ) {
    this.queue = new Queue<ReminderJobData>(REMINDER_QUEUE, {
      connection: getRedisConnection(),
    });
  }

  async create(tenantId: string, userId: string, dto: CreateAppointmentDto) {
    // ── 1. Resolve Contacts ───────────────────
    let targetContacts: {
      id: string;
      name: string;
      phone: string | null;
      email: string | null;
    }[] = [];

    if (dto.targetType && dto.targetId) {
      if (dto.targetType === 'contact') {
        const c = await this.prisma.contact.findFirst({
          where: { id: dto.targetId, tenantId },
        });
        if (c) targetContacts.push(c);
      } else if (dto.targetType === 'tag') {
        const cts = await this.prisma.contactTag.findMany({
          where: { tagId: dto.targetId, contact: { tenantId } },
          include: { contact: true },
        });
        targetContacts = cts.map((ct) => ct.contact);
      } else if (dto.targetType === 'group') {
        const members = await this.prisma.contactGroupMember.findMany({
          where: { groupId: dto.targetId, contact: { tenantId } },
          include: { contact: true },
        });
        targetContacts = members.map((m) => m.contact);
      } else if (dto.targetType === 'segment') {
        const segment = await this.prisma.audienceSegment.findFirst({
          where: { id: dto.targetId, campaign: { tenantId } },
          include: { tag: true },
        });
        if (segment) {
          if (segment.tagId) {
            const cts = await this.prisma.contactTag.findMany({
              where: { tagId: segment.tagId, contact: { tenantId } },
              include: { contact: true },
            });
            targetContacts = cts.map((ct) => ct.contact);
          } else {
            targetContacts = await this.prisma.contact.findMany({
              where: { tenantId, unsubscribed: false },
            });
          }
        }
      }
    } else if (dto.customerId) {
      // Legacy/Direct customer flow
      const contact = await this.prisma.contact.findFirst({
        where: { id: dto.customerId, tenantId },
      });
      if (contact) {
        targetContacts.push(contact);
      } else {
        // Check if it's a Customer record ID directly
        const customer = await this.prisma.customer.findFirst({
          where: { id: dto.customerId, tenantId },
        });
        if (customer) {
          targetContacts.push({
            id: customer.id, // This is risky if we expect Contact ID, but let's assume it's handled
            name: `${customer.firstName} ${customer.lastName}`,
            phone: customer.phone,
            email: customer.email,
          });
        }
      }
    }

    if (targetContacts.length === 0) {
      throw new NotFoundException(
        'No target contacts found for this appointment',
      );
    }

    const results: any[] = [];
    const failed: { contactId: string; contactName: string; error: string }[] =
      [];

    for (const contact of targetContacts) {
      // Per-contact isolation for bulk (tag/group/segment) bookings: one
      // contact's failure (bad data, a Customer conflict, a throw from
      // ensureCustomer/event.create) must not abort the whole batch or discard
      // the appointments already committed for earlier contacts. Collect the
      // failure and continue with the rest.
      try {
      // ── 2. Ensure Customer Record exists for this Contact ──
      const customer = await this.ensureCustomer(tenantId, contact);

      // ── 3. Create Event & Appointment ──
      const endTime = new Date(dto.scheduledAt);
      endTime.setMinutes(endTime.getMinutes() + (dto.durationMinutes ?? 30));

      const event = await this.prisma.event.create({
        data: {
          tenantId,
          title: dto.title,
          description: dto.notes,
          startTime: new Date(dto.scheduledAt),
          endTime,
          status: 'ACTIVE',
          eventType: 'APPOINTMENT',
          appointments: {
            create: {
              tenantId,
              customerId: customer.id,
              locationId: dto.locationId,
              campaignId: dto.campaignId,
              audienceSegmentId: dto.audienceSegmentId,
              title: dto.title,
              scheduledAt: new Date(dto.scheduledAt),
              durationMinutes: dto.durationMinutes ?? 30,
              notes: dto.notes,
            },
          },
          participants: {
            create: {
              tenantId,
              contactId: contact.id,
              status: 'confirmed',
            },
          },
        },
        include: {
          appointments: { include: { customer: true, location: true } },
        },
      });

      const appointment = event.appointments[0];

      // ── 4. Create Legacy Participant ──
      await this.prisma.appointmentParticipant.create({
        data: {
          appointmentId: appointment.id,
          contactId: contact.id,
        },
      });

      // ── 5. Log Activity ──
      await this.prisma.contactActivity.create({
        data: {
          tenantId,
          contactId: contact.id,
          activityType: ActivityType.appointment_created,
          referenceId: appointment.id,
          metadata: {
            title: appointment.title,
            scheduledAt: appointment.scheduledAt,
          },
        },
      });

      // ── 6. Handle Reminders ──
      // IMPORTANT: the appointment + event above are already committed to the
      // database by this point (this method doesn't run inside a single
      // $transaction). Reminder scheduling is a secondary enhancement, not
      // the core booking action — a failure here (Redis hiccup, a bad
      // template, a scheduler bug) must never surface as a booking failure
      // to the customer. Without this guard, an exception here propagates
      // all the way up to a 500, the frontend reports "failed to create
      // appointment," and the user retries and creates a duplicate booking
      // while the first one — which actually succeeded — sits with no
      // reminders and no visibility. Fail soft: log it, keep
      // reminderCount at 0, let the booking stand.
      let reminderCount = 0;
      try {
        if (dto.reminderConfig) {
          const sendTime = new Date(appointment.scheduledAt);
          sendTime.setMinutes(sendTime.getMinutes() - 1440); // 24h before
          if (sendTime > new Date()) {
            const messageContent = this.templateRenderer.renderTemplate(
              dto.reminderConfig.template,
              { name: contact.name, phone: contact.phone, email: contact.email },
              {
                title: appointment.title,
                scheduledAt: appointment.scheduledAt,
                locationName: appointment.location?.name,
              },
            );

            const reminder = await this.prisma.reminder.create({
              data: {
                tenantId,
                appointmentId: appointment.id,
                eventId: event.id,
                contactId: contact.id, // LINK TO CONTACT
                channel: dto.reminderConfig.channel,
                scheduledSendTime: sendTime,
                messageContent,
                status: 'PENDING',
              },
            });
            const delay = sendTime.getTime() - Date.now();
            await this.queue.add(
              'send-reminder',
              {
                reminderId: reminder.id,
                tenantId,
                appointmentId: appointment.id,
                channel: dto.reminderConfig.channel,
                messageContent,
                scheduledFor: sendTime.toISOString(),
              },
              { delay, jobId: `rem_${reminder.id}` },
            );
            reminderCount = 1;
          }
        } else {
          const reminders = await this.reminderScheduler.scheduleForAppointment(
            appointment.id,
            tenantId,
          );
          // Update reminders to link to contactId
          if (reminders.length > 0) {
            await this.prisma.reminder.updateMany({
              where: { id: { in: reminders.map((r) => r.id) } },
              data: { contactId: contact.id, eventId: event.id },
            });
          }
          reminderCount = reminders.length;
        }
      } catch (reminderError: any) {
        this.logger.error(
          `Reminder scheduling failed for appointment ${appointment.id} (booking still succeeded): ${reminderError?.message}`,
          reminderError?.stack,
        );
      }

      // ── 7. Fire lifecycle (automation + prediction) ──
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

      results.push({ ...appointment, scheduledReminders: reminderCount });
      } catch (contactError: any) {
        this.logger.error(
          `Appointment creation failed for contact ${contact.id} (${contact.name}) in bulk booking: ${contactError?.message}`,
          contactError?.stack,
        );
        failed.push({
          contactId: contact.id,
          contactName: contact.name,
          error: contactError?.message ?? 'Unknown error',
        });
      }
    }

    // Every contact failed — this is a real failure, don't report "success"
    // for zero bookings. (targetContacts is guaranteed non-empty above.)
    if (results.length === 0) {
      throw new BadRequestException(
        `Appointment creation failed for all ${failed.length} contact(s): ` +
          failed.map((f) => `${f.contactName}: ${f.error}`).join('; '),
      );
    }

    // Auto-create RSVP campaign for bulk events (tag/group/segment targets)
    if (targetContacts.length > 1 && results[0]?.id) {
      this.eventLifecycle
        .setupBulkRsvpCampaign(tenantId, results[0].id, dto.title)
        .catch(() => {});
    }

    await this.auditService.log({
      tenantId,
      userId,
      action: 'CREATE',
      entity: 'Appointment',
      entityId: results[0]?.id || 'bulk',
      newValues: { count: results.length, dto } as any,
    });

    return targetContacts.length === 1
      ? results[0]
      : { count: results.length, appointments: results, failures: failed };
  }

  private async ensureCustomer(
    tenantId: string,
    contact: { name: string; phone: string | null; email: string | null },
  ) {
    const existing = await this.prisma.customer.findFirst({
      where: {
        tenantId,
        OR: [
          ...(contact.phone ? [{ phone: contact.phone }] : []),
          ...(contact.email ? [{ email: contact.email }] : []),
        ].filter(Boolean) as any,
      },
    });

    if (existing) return existing;

    const names = contact.name.split(' ');
    return this.prisma.customer.create({
      data: {
        tenantId,
        firstName: names[0] || 'Unknown',
        lastName: names.slice(1).join(' ') || 'Contact',
        email: contact.email,
        phone: contact.phone,
      },
    });
  }

  async findAll(tenantId: string, page = 1, limit = 20) {
    const skip = (page - 1) * limit;

    const [data, total] = await Promise.all([
      this.prisma.appointment.findMany({
        where: { tenantId },
        include: { customer: true, location: true },
        orderBy: { scheduledAt: 'asc' },
        skip,
        take: limit,
      }),
      this.prisma.appointment.count({ where: { tenantId } }),
    ]);

    return { data, total, page, limit };
  }

  async findOne(tenantId: string, id: string) {
    const appointment = await this.prisma.appointment.findFirst({
      where: { id, tenantId },
      include: {
        customer: true,
        location: true,
        reminders: true,
        participants: {
          include: {
            contact: {
              select: { id: true, name: true, phone: true, email: true },
            },
          },
        },
      },
    });

    if (!appointment) {
      throw new NotFoundException('Appointment not found');
    }

    return appointment;
  }

  async update(
    tenantId: string,
    userId: string,
    id: string,
    dto: UpdateAppointmentDto,
  ) {
    const existing = await this.findOne(tenantId, id);

    const appointment = await this.prisma.appointment.update({
      where: { id },
      data: {
        title: dto.title,
        scheduledAt: dto.scheduledAt ? new Date(dto.scheduledAt) : undefined,
        durationMinutes: dto.durationMinutes,
        locationId: dto.locationId,
        status: dto.status,
        notes: dto.notes,
      },
      include: { customer: true, location: true },
    });

    // ── Sync with underlying Event ──
    if (existing.eventId) {
      const updateData: any = {};
      if (dto.title) updateData.title = dto.title;
      if (dto.notes) updateData.description = dto.notes;
      if (dto.scheduledAt || dto.durationMinutes) {
        const newStart = dto.scheduledAt
          ? new Date(dto.scheduledAt)
          : existing.scheduledAt;
        const newDuration = dto.durationMinutes ?? existing.durationMinutes;
        const newEnd = new Date(newStart);
        newEnd.setMinutes(newEnd.getMinutes() + newDuration);
        updateData.startTime = newStart;
        updateData.endTime = newEnd;
      }
      if (dto.status) {
        if (['COMPLETED', 'NO_SHOW'].includes(dto.status)) {
          updateData.status = 'COMPLETED';
        } else if (dto.status === 'CANCELLED') {
          updateData.status = 'CANCELLED';
        } else {
          updateData.status = 'ACTIVE';
        }
      }

      if (Object.keys(updateData).length > 0) {
        await this.prisma.event.update({
          where: { id: existing.eventId },
          data: updateData,
        });
      }
    }

    await this.auditService.log({
      tenantId,
      userId,
      action: 'UPDATE',
      entity: 'Appointment',
      entityId: id,
      oldValues: {
        title: existing.title,
        scheduledAt: existing.scheduledAt,
        durationMinutes: existing.durationMinutes,
        status: existing.status,
        notes: existing.notes,
      },
      newValues: dto as any,
    });

    // ── Lifecycle: status change (CONFIRMED / CANCELLED / COMPLETED / NO_SHOW) ──
    if (dto.status && dto.status !== existing.status) {
      const entityData = {
        appointmentId: id,
        appointmentTitle: appointment.title,
        appointmentStatus: appointment.status,
        scheduledAt: appointment.scheduledAt.toISOString(),
        customerId: appointment.customerId ?? undefined,
        customerName: appointment.customer
          ? `${appointment.customer.firstName} ${appointment.customer.lastName}`
          : undefined,
        customerPhone: appointment.customer?.phone ?? undefined,
        customerEmail: appointment.customer?.email ?? undefined,
        tenantId,
      };
      this.eventLifecycle
        .onStatusChanged(tenantId, id, existing.status, dto.status, entityData)
        .catch(() => {});
    }

    // ── Lifecycle: reschedule ──
    if (
      dto.scheduledAt &&
      new Date(dto.scheduledAt).getTime() !== existing.scheduledAt.getTime()
    ) {
      const entityData = {
        appointmentId: id,
        appointmentTitle: appointment.title,
        scheduledAt: appointment.scheduledAt.toISOString(),
        tenantId,
      };
      this.eventLifecycle
        .onRescheduled(
          tenantId,
          id,
          existing.scheduledAt,
          appointment.scheduledAt,
          entityData,
        )
        .catch(() => {});
    }

    // Sync Contact.lastAppointment
    if (appointment.customer?.phone || appointment.customer?.email) {
      this.prisma.contact
        .updateMany({
          where: {
            tenantId,
            OR: [
              ...(appointment.customer.phone
                ? [{ phone: appointment.customer.phone }]
                : []),
              ...(appointment.customer.email
                ? [{ email: appointment.customer.email }]
                : []),
            ].filter(Boolean) as any,
          },
          data: { lastAppointment: appointment.scheduledAt },
        })
        .catch((err) =>
          this.logger.error(
            `Failed to sync contact.lastAppointment: ${err.message}`,
          ),
        );
    }

    return appointment;
  }

  async remove(tenantId: string, userId: string, id: string) {
    const appointment = await this.findOne(tenantId, id); // ensure it exists + belongs to tenant

    // Get participant for activity logging before deletion
    const participant = await this.prisma.appointmentParticipant.findFirst({
      where: { appointmentId: id },
    });

    // Execute all deletions in a transaction for atomicity
    const result = await this.prisma.$transaction(async (tx) => {
      // 1. Cancel pending reminders (queue jobs)
      const cancelled = await this.reminderScheduler.cancelForAppointment(id);

      // 2. Delete related records (cascade is configured, but explicit for clarity)
      await tx.reminder.deleteMany({ where: { appointmentId: id } });
      await tx.appointmentParticipant.deleteMany({
        where: { appointmentId: id },
      });
      await tx.appointmentTarget.deleteMany({ where: { appointmentId: id } });
      await tx.contactActivity.deleteMany({ where: { referenceId: id } });

      // 3. Delete the underlying event (which cascades to appointment)
      if (appointment.eventId) {
        await tx.event.delete({ where: { id: appointment.eventId } });
      } else {
        await tx.appointment.delete({ where: { id } });
      }

      return { cancelled };
    });

    if (result.cancelled > 0) {
      this.logger.log(`Cancelled ${result.cancelled} pending reminder jobs`);
    }

    // Log activity (separate transaction to avoid blocking)
    if (participant) {
      this.prisma.contactActivity
        .create({
          data: {
            tenantId,
            contactId: participant.contactId,
            activityType: ActivityType.appointment_deleted,
            metadata: {
              title: appointment.title,
              scheduledAt: appointment.scheduledAt,
            },
          },
        })
        .catch(() => {});
    }

    await this.auditService.log({
      tenantId,
      userId,
      action: 'DELETE',
      entity: 'Appointment',
      entityId: id,
    });

    return { deleted: true, cancelledReminders: result.cancelled };
  }

  async findToday(tenantId: string) {
    // "Today" is bucketed by the tenant's business timezone, not the server's
    // process clock — otherwise a late-evening appointment in e.g.
    // America/Toronto falls into the wrong UTC day near the boundary.
    const tz = await resolveTenantTimezone(this.prisma, tenantId);
    const { start, end } = dayRangeInTz(tz);

    return this.prisma.appointment.findMany({
      where: { tenantId, scheduledAt: { gte: start, lte: end } },
      include: {
        customer: true,
        location: true,
        reminders: { orderBy: { scheduledSendTime: 'asc' } },
      },
      orderBy: { scheduledAt: 'asc' },
    });
  }

  /**
   * Upcoming (next 48 h) appointments that are not yet CONFIRMED.
   * This is a rolling absolute-time window: both `now` and `now + 48h` are
   * exact instants, so — unlike findToday's calendar-day bucketing — it is
   * inherently timezone-independent and needs no tz math.
   */
  async findNeedsAttention(tenantId: string) {
    const now = new Date();
    const in48h = new Date(now.getTime() + 48 * 60 * 60 * 1000);

    return this.prisma.appointment.findMany({
      where: {
        tenantId,
        scheduledAt: { gte: now, lte: in48h },
        status: { notIn: ['CONFIRMED', 'COMPLETED', 'CANCELLED'] },
      },
      include: {
        customer: true,
        location: true,
        reminders: { orderBy: { scheduledSendTime: 'asc' } },
      },
      orderBy: { scheduledAt: 'asc' },
      take: 20,
    });
  }

  async getPipeline(tenantId: string, id: string) {
    return this.eventLifecycle.getPipeline(tenantId, id);
  }
}
