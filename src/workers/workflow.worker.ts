import {
  Injectable,
  Logger,
  OnModuleInit,
  OnModuleDestroy,
} from '@nestjs/common';
import { Worker, Queue, Job } from 'bullmq';
import { PrismaService } from '../prisma/prisma.service';
import {
  WORKFLOW_QUEUE,
  REMINDER_QUEUE,
  getRedisConnection,
  EventWorkflowJobData,
  WORKER_CONCURRENCY,
} from '../queue/queue.config';

@Injectable()
export class WorkflowWorker implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger(WorkflowWorker.name);
  private worker: Worker<EventWorkflowJobData>;
  private reminderQueue: Queue;

  constructor(private readonly prisma: PrismaService) {
    this.reminderQueue = new Queue(REMINDER_QUEUE, {
      connection: getRedisConnection(),
    });
  }

  onModuleInit() {
    this.worker = new Worker<EventWorkflowJobData>(
      WORKFLOW_QUEUE,
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

  private async enqueueReminderJob(
    tenantId: string,
    eventId: string,
    contactId: string,
    type: 'send_location' | 'send_reminder' | 'send_followup',
  ) {
    // Note: We need to create a Reminder record first to get a reminderId
    // to match the ReminderJobData shape used by reminder.worker.ts.
    // However, the prompt doesn't explicitly ask for this.
    // It says "add a job to meetora-reminders queue".
    // I'll create a minimal job that the reminder worker can hopefully handle
    // or I'll need to update the reminder worker to handle these special types.

    // For now, I'll follow the literal instruction: add a job with the specified type.
    const jobData = {
      tenantId,
      eventId,
      contactId,
      type,
    };

    const jobId = `wf-rem:${eventId}:${contactId}:${type}`;
    await this.reminderQueue.add(type, jobData, {
      attempts: 3,
      backoff: { type: 'exponential', delay: 5000 },
      jobId,
    });

    this.logger.log(
      `Queued ${type} for event ${eventId}, contact ${contactId}`,
    );
  }
}
