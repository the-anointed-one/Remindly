import { Injectable, Logger } from '@nestjs/common';
import { Queue } from 'bullmq';
import { PrismaService } from '../../prisma/prisma.service';
import {
  REMINDER_QUEUE,
  REMINDER_JOB_OPTIONS,
  getRedisConnection,
  ReminderJobData,
} from '../../queue/queue.config';

@Injectable()
export class ReminderSchedulerService {
  private readonly logger = new Logger(ReminderSchedulerService.name);
  private readonly queue: Queue<ReminderJobData>;

  constructor(private readonly prisma: PrismaService) {
    this.queue = new Queue<ReminderJobData>(REMINDER_QUEUE, {
      connection: getRedisConnection(),
    });
  }

  /**
   * Apply all active reminder rules to an event and all its confirmed participants.
   */
  async scheduleForEvent(eventId: string, tenantId: string) {
    const event = await this.prisma.event.findUnique({
      where: { id: eventId },
      include: { participants: { include: { contact: true } } },
    });

    if (!event) {
      this.logger.warn(`Event ${eventId} not found`);
      return [];
    }

    const rules = await this.prisma.reminderRule.findMany({
      where: { tenantId, isActive: true },
      include: { template: true },
    });

    if (rules.length === 0) return [];

    const scheduledCount = 0;
    for (const participant of event.participants) {
      if (
        !participant.contact ||
        participant.contact.unsubscribed ||
        participant.status === 'cancelled'
      ) {
        continue;
      }

      for (const rule of rules) {
        const sendTime = new Date(event.startTime);
        sendTime.setMinutes(sendTime.getMinutes() - rule.offsetMinutes);

        if (sendTime <= new Date()) continue;

        const templateVars = {
          customer_name: participant.contact.name,
          appointment_title: event.title,
          appointment_time: event.startTime.toLocaleString(),
          appointment_date: event.startTime.toLocaleDateString('en-GB', {
            weekday: 'short',
            day: 'numeric',
            month: 'short',
          }),
          location: event.location || 'Office',
        };

        const messageContent = rule.messageTemplate
          ? this.resolveTemplate(rule.messageTemplate, templateVars)
          : rule.template
            ? this.resolveTemplate(rule.template.body, templateVars)
            : `Hi ${participant.contact.name}, reminder: "${event.title}" on ${templateVars.appointment_date} at ${event.startTime.toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit', hour12: true })}.`;

        const reminder = await this.prisma.reminder.create({
          data: {
            tenantId,
            eventId: event.id,
            contactId: participant.contact.id,
            reminderRuleId: rule.id,
            channel: rule.channel,
            scheduledSendTime: sendTime,
            messageContent,
            status: 'PENDING',
          },
        });

        const delay = sendTime.getTime() - Date.now();
        const jobId = `reminder-${reminder.id}`;
        const jobData: ReminderJobData = {
          reminderId: reminder.id,
          tenantId,
          appointmentId: null as any, // Null for event-wide reminders
          channel: rule.channel,
          messageContent,
          scheduledFor: sendTime.toISOString(),
          channelStrategyId: rule.channelStrategyId ?? undefined,
        };

        await this.queue.add('send-reminder', jobData, {
          ...REMINDER_JOB_OPTIONS,
          delay: Math.max(delay, 0),
          jobId,
        });
      }
    }

    this.logger.log(`Scheduled reminders for event ${eventId}`);
    return [];
  }

  /**
   * Apply all active reminder rules to a newly created appointment.
   * Creates Reminder records and schedules delayed BullMQ jobs.
   */
  async scheduleForAppointment(appointmentId: string, tenantId: string) {
    // 1. Get the appointment + customer
    const appointment = await this.prisma.appointment.findUnique({
      where: { id: appointmentId },
      include: { customer: true, location: true },
    });

    if (!appointment) {
      this.logger.warn(`Appointment ${appointmentId} not found`);
      return [];
    }

    // 1b. Compliance check — never schedule reminders for opted-out customers
    if (appointment.customer!.unsubscribed) {
      this.logger.log(
        `Skipping reminder scheduling — customer ${appointment.customer!.id} has opted out`,
      );
      return [];
    }

    // 2. Get all active reminder rules for the tenant
    const rules = await this.prisma.reminderRule.findMany({
      where: { tenantId, isActive: true },
      include: { template: true },
    });

    if (rules.length === 0) {
      this.logger.debug(`No active reminder rules for tenant ${tenantId}`);
      return [];
    }

    // 3. For each rule, create a Reminder record + schedule a job
    const scheduledReminders: any[] = [];

    for (const rule of rules) {
      const sendTime = new Date(appointment.scheduledAt);
      sendTime.setMinutes(sendTime.getMinutes() - rule.offsetMinutes);

      // Don't schedule if send time is in the past
      if (sendTime <= new Date()) {
        this.logger.debug(
          `Skipping rule "${rule.name}" — send time ${sendTime.toISOString()} is in the past`,
        );
        continue;
      }

      // Resolve message content — priority: inline messageTemplate > linked template > default
      const templateVars = {
        customer_name: `${appointment.customer!.firstName} ${appointment.customer!.lastName}`,
        appointment_title: appointment.title,
        appointment_time: appointment.scheduledAt.toLocaleString(),
        appointment_date: appointment.scheduledAt.toLocaleDateString('en-GB', {
          weekday: 'short',
          day: 'numeric',
          month: 'short',
        }),
        location: appointment.location?.name || 'Office',
      };

      const messageContent = rule.messageTemplate
        ? this.resolveTemplate(rule.messageTemplate, templateVars)
        : rule.template
          ? this.resolveTemplate(rule.template.body, templateVars)
          : `Hi ${appointment.customer!.firstName}, reminder: "${appointment.title}" on ${templateVars.appointment_date} at ${appointment.scheduledAt.toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit', hour12: true })}.\nReply:\n1 Confirm\n2 Reschedule\n3 Cancel`;

      // Create the Reminder record
      const reminder = await this.prisma.reminder.create({
        data: {
          tenantId,
          appointmentId: appointment.id,
          eventId: appointment.eventId,
          reminderRuleId: rule.id,
          channel: rule.channel,
          scheduledSendTime: sendTime,
          messageContent,
          status: 'PENDING',
        },
      });

      // Schedule the BullMQ job
      const delay = sendTime.getTime() - Date.now();
      const jobId = `reminder-${reminder.id}`; // unique, idempotent

      const jobData: ReminderJobData = {
        reminderId: reminder.id,
        tenantId,
        appointmentId: appointment.id,
        channel: rule.channel,
        messageContent,
        scheduledFor: sendTime.toISOString(),
        channelStrategyId: rule.channelStrategyId ?? undefined,
      };

      await this.queue.add('send-reminder', jobData, {
        ...REMINDER_JOB_OPTIONS,
        delay: Math.max(delay, 0),
        jobId, // ensures idempotency
      });

      this.logger.log(
        `Scheduled reminder ${reminder.id} for "${rule.name}" at ${sendTime.toISOString()} (delay: ${Math.round(delay / 1000)}s)`,
      );

      scheduledReminders.push(reminder);
    }

    return scheduledReminders;
  }

  /**
   * Cancel all pending reminders for an appointment (e.g. on cancellation).
   */
  async cancelForAppointment(appointmentId: string) {
    const reminders = await this.prisma.reminder.findMany({
      where: { appointmentId, status: 'PENDING' },
    });

    for (const reminder of reminders) {
      // Remove from queue
      const jobId = `reminder-${reminder.id}`;
      const job = await this.queue.getJob(jobId);
      if (job) {
        await job.remove();
      }

      // Update status
      await this.prisma.reminder.update({
        where: { id: reminder.id },
        data: { status: 'CANCELLED' },
      });
    }

    this.logger.log(
      `Cancelled ${reminders.length} reminders for appointment ${appointmentId}`,
    );

    return reminders.length;
  }

  /**
   * Cancel all pending reminders for an event.
   */
  async cancelForEvent(eventId: string) {
    const reminders = await this.prisma.reminder.findMany({
      where: { eventId, status: 'PENDING' },
    });

    for (const reminder of reminders) {
      const jobId = `reminder-${reminder.id}`;
      const job = await this.queue.getJob(jobId);
      if (job) await job.remove();

      await this.prisma.reminder.update({
        where: { id: reminder.id },
        data: { status: 'CANCELLED' },
      });
    }

    this.logger.log(
      `Cancelled ${reminders.length} reminders for event ${eventId}`,
    );
    return reminders.length;
  }

  /**
   * Simple template variable resolution.
   * Replaces {{variable_name}} with values.
   */
  private resolveTemplate(
    template: string,
    variables: Record<string, string>,
  ): string {
    return template.replace(/\{\{(\w+)\}\}/g, (_, key) => {
      return variables[key] ?? `{{${key}}}`;
    });
  }
}
