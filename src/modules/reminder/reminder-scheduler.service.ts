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
     * Apply all active reminder rules to a newly created appointment.
     * Creates Reminder records and schedules delayed BullMQ jobs.
     */
    async scheduleForAppointment(appointmentId: string, tenantId: string) {
        // 1. Get the appointment + customer
        const appointment = await this.prisma.appointment.findUnique({
            where: { id: appointmentId },
            include: { customer: true },
        });

        if (!appointment) {
            this.logger.warn(`Appointment ${appointmentId} not found`);
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

            // Resolve message content from template
            const messageContent = rule.template
                ? this.resolveTemplate(rule.template.body, {
                    customer_name: `${appointment.customer.firstName} ${appointment.customer.lastName}`,
                    appointment_title: appointment.title,
                    appointment_time: appointment.scheduledAt.toLocaleString(),
                    appointment_date: appointment.scheduledAt.toLocaleDateString(),
                })
                : `Reminder: You have an appointment "${appointment.title}" scheduled for ${appointment.scheduledAt.toLocaleString()}.`;

            // Create the Reminder record
            const reminder = await this.prisma.reminder.create({
                data: {
                    tenantId,
                    appointmentId: appointment.id,
                    reminderRuleId: rule.id,
                    channel: rule.channel,
                    scheduledSendTime: sendTime,
                    messageContent,
                    status: 'PENDING',
                },
            });

            // Schedule the BullMQ job
            const delay = sendTime.getTime() - Date.now();
            const jobId = `reminder:${reminder.id}`; // unique, idempotent

            const jobData: ReminderJobData = {
                reminderId: reminder.id,
                tenantId,
                appointmentId: appointment.id,
                channel: rule.channel,
                messageContent,
                scheduledFor: sendTime.toISOString(),
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
            const jobId = `reminder:${reminder.id}`;
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
