import {
  Injectable,
  Logger,
  OnModuleInit,
  OnModuleDestroy,
} from '@nestjs/common';
import { Worker, Queue, Job } from 'bullmq';
import { PrismaService } from '../prisma/prisma.service';
import { CouponService } from '../modules/billing/coupon.service';
import { MessagingService } from '../modules/messaging/messaging.service';
import {
  EVENT_WORKFLOW_QUEUE,
  REMINDER_QUEUE,
  getRedisConnection,
  EventWorkflowJobData,
  ReminderJobData,
  WORKER_CONCURRENCY,
} from '../queue/queue.config';

@Injectable()
export class WorkflowWorker implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger(WorkflowWorker.name);
  private worker: Worker<EventWorkflowJobData>;
  private reminderQueue: Queue;

  constructor(
    private readonly prisma: PrismaService,
    private readonly couponService: CouponService,
    private readonly messagingService: MessagingService,
  ) {
    this.reminderQueue = new Queue(REMINDER_QUEUE, {
      connection: getRedisConnection(),
    });
  }

  onModuleInit() {
    this.worker = new Worker<EventWorkflowJobData>(
      EVENT_WORKFLOW_QUEUE,
      async (job) => {
        if (job.name === 'event-workflow') {
          return this.processEventWorkflow(job);
        }
      },
      {
        connection: getRedisConnection(),
        concurrency: WORKER_CONCURRENCY,
      },
    );

    this.worker.on('failed', (job, err) => {
      this.logger.error(`Workflow job ${job?.id} failed: ${err.message}`);
    });

    this.logger.log(
      `Workflow worker started (concurrency=${WORKER_CONCURRENCY})`,
    );
  }

  async onModuleDestroy() {
    await this.worker?.close();
    await this.reminderQueue?.close();
  }

  private async processEventWorkflow(job: Job<EventWorkflowJobData>) {
    const { tenantId, triggerType, contactId, eventId } = job.data;
    this.logger.log(
      `Processing event workflow: ${triggerType} for event ${eventId}`,
    );

    // ── 1. Load EventAutomation ──
    const automation = await (this.prisma as any).eventAutomation.findUnique({
      where: { eventId },
    });

    if (!automation) {
      this.logger.warn(
        `EventAutomation for event ${eventId} not found — skipping`,
      );
      return;
    }

    // ── 2. Handle trigger types ──
    switch (triggerType) {
      case 'rsvp_confirmed':
        if (automation.sendLocationOnConfirm) {
          await this.enqueueReminderJob(
            tenantId,
            eventId,
            contactId,
            'send_location',
          );
        }
        await this.sendIncentive(eventId, contactId);
        break;

      case 'rsvp_no_response':
        if (automation.remindNonResponders) {
          await this.enqueueReminderJob(
            tenantId,
            eventId,
            contactId,
            'send_reminder',
          );
        }
        break;

      case 'event_completed':
        if (automation.sendFollowupAfter ?? true) {
          await this.enqueueReminderJob(
            tenantId,
            eventId,
            contactId,
            'send_followup',
          );
        }
        break;

      default:
        this.logger.warn(`Unhandled trigger type: ${triggerType}`);
    }
  }

  /**
   * Issues the event's attendee incentive (discount / cashback) to a contact
   * that just confirmed. No-op when the event has no incentive configured.
   */
  private async sendIncentive(eventId: string, contactId: string) {
    const event = await this.prisma.event.findUnique({
      where: { id: eventId },
      select: {
        title: true,
        incentiveType: true,
        incentiveValue: true,
        incentiveMessage: true,
      },
    });

    if (!event?.incentiveType || event.incentiveType === 'none') return;

    const participant = await this.prisma.eventParticipant.findUnique({
      where: { eventId_contactId: { eventId, contactId } },
      select: { couponSentAt: true },
    });

    // rsvp_confirmed can fire again if a contact replies YES more than once —
    // don't bill the tenant for a second copy of the same coupon.
    if (participant?.couponSentAt) {
      this.logger.log(
        `Incentive already sent for event ${eventId}, contact ${contactId} — skipping`,
      );
      return;
    }

    const contact = await this.prisma.contact.findUnique({
      where: { id: contactId },
      select: { phone: true, email: true, name: true, tenantId: true },
    });

    if (!contact?.phone) {
      this.logger.warn(
        `Cannot send incentive for event ${eventId}: contact ${contactId} has no phone`,
      );
      return;
    }

    const couponCode = this.couponService.generate(eventId, contactId);

    let message = '';
    if (event.incentiveType === 'discount') {
      message =
        `Hi ${contact.name}! You have earned a ` +
        `${event.incentiveValue} discount for confirming ` +
        `your attendance at ${event.title}. ` +
        `Show this code: ${couponCode}`;
    }
    if (event.incentiveType === 'cashback') {
      message =
        `Hi ${contact.name}! You have earned a ` +
        `${event.incentiveValue} cashback reward for ` +
        `confirming attendance at ${event.title}. ` +
        `Reference: ${couponCode}`;
    }
    if (event.incentiveMessage) {
      message = event.incentiveMessage
        .replace('{{name}}', contact.name)
        .replace('{{code}}', couponCode)
        .replace('{{value}}', event.incentiveValue || '');
    }

    await this.messagingService.send(
      contact.tenantId,
      'SMS',
      contact.phone,
      message,
    );

    await this.prisma.eventParticipant.updateMany({
      where: { eventId, contactId },
      data: { couponCode, couponSentAt: new Date() },
    });

    this.logger.log(`Incentive sent to ${contact.phone}: ${couponCode}`);
  }

  private async enqueueReminderJob(
    tenantId: string,
    eventId: string,
    contactId: string,
    type: 'send_location' | 'send_reminder' | 'send_followup',
  ) {
    // BullMQ rejects custom job ids containing ':' ("Custom Id cannot contain :"),
    // which made every rsvp_confirmed / rsvp_no_response / event_completed job
    // throw and retry forever. Use '-' as the separator.
    const jobId = `wf-rem-${eventId}-${contactId}-${type}`;

    // The id also dedupes repeat triggers (a contact replying YES twice). Check
    // before creating a Reminder row, or the deduped job would leave an orphan
    // PENDING reminder behind that nothing ever sends.
    const existing = await this.reminderQueue.getJob(jobId);
    if (existing) {
      this.logger.log(
        `${type} already queued for event ${eventId}, contact ${contactId} — skipping`,
      );
      return;
    }

    const [event, contact] = await Promise.all([
      this.prisma.event.findUnique({
        where: { id: eventId },
        select: { title: true, location: true, startTime: true },
      }),
      this.prisma.contact.findUnique({
        where: { id: contactId },
        select: { phone: true, name: true },
      }),
    ]);

    if (!event || !contact?.phone) {
      this.logger.warn(
        `${type} skipped — missing event or contact phone for event ${eventId}`,
      );
      return;
    }

    if (type === 'send_location' && !event.location) {
      this.logger.log(
        `send_location skipped — no location set for event ${eventId}`,
      );
      return;
    }

    const messageContent = this.buildReminderContent(type, event, contact);

    // reminder.worker.ts loads the Reminder row by job.data.reminderId and does
    // prisma.reminder.update({ where: { id: reminderId } }). This job used to
    // carry no reminderId at all, so that ran as `{ id: undefined }`, threw
    // PrismaClientValidationError on all three attempts, and every
    // send_location / send_reminder / send_followup landed in the DLQ.
    const reminder = await this.prisma.reminder.create({
      data: {
        tenantId,
        eventId,
        contactId,
        channel: 'SMS',
        status: 'PENDING',
        scheduledSendTime: new Date(), // fires immediately
        messageContent,
      },
    });

    const jobData: ReminderJobData = {
      reminderId: reminder.id,
      tenantId,
      // Null for event-driven reminders, matching ReminderSchedulerService.
      // Only the VOICE/EMAIL branches read it, and this path is SMS.
      appointmentId: null as any,
      channel: 'SMS',
      messageContent,
      scheduledFor: new Date().toISOString(),
    };

    await this.reminderQueue.add(type, jobData, {
      attempts: 3,
      backoff: { type: 'exponential', delay: 5000 },
      jobId,
    });

    this.logger.log(
      `${type} queued for ${contact.phone} — reminder ${reminder.id}`,
    );
  }

  private buildReminderContent(
    type: 'send_location' | 'send_reminder' | 'send_followup',
    event: { title: string; location: string | null; startTime: Date },
    contact: { name: string },
  ): string {
    switch (type) {
      case 'send_location':
        return (
          `Hi ${contact.name}! Your attendance at "${event.title}" is ` +
          `confirmed. Location: ${event.location}`
        );
      case 'send_reminder':
        return (
          `Hi ${contact.name}, we haven't heard from you about ` +
          `"${event.title}" on ${event.startTime.toLocaleString()}.`
        );
      case 'send_followup':
        return (
          `Hi ${contact.name}, thank you for attending "${event.title}". ` +
          `We'd love to hear how it went.`
        );
    }
  }
}
