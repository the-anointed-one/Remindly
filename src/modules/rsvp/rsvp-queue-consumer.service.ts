import {
  Injectable,
  Logger,
  OnModuleInit,
  OnModuleDestroy,
} from '@nestjs/common';
import { Worker, Queue, Job } from 'bullmq';
import { PrismaService } from '../../prisma/prisma.service';
import { RsvpProcessorService } from './rsvp-processor.service';
import { MessagingService } from '../messaging/messaging.service';
import {
  RSVP_QUEUE,
  RSVP_DLQ,
  EVENT_WORKFLOW_QUEUE,
  getRedisConnection,
  RsvpJobData,
  WORKER_CONCURRENCY,
} from '../../queue/queue.config';

/**
 * In-process consumer for the RSVP queue.
 *
 * The webhook enqueues inbound RSVP replies rather than processing them inline,
 * so Twilio gets a fast response. A standalone `src/workers/rsvp.worker.ts`
 * existed for this but was never deployed — it appears in no compose service, no
 * package.json script, and no Dockerfile CMD — so every enqueued RSVP sat in
 * Redis unconsumed and the customer's reply was silently dropped.
 *
 * This runs the same logic inside the API process, matching the pattern
 * `WorkflowProcessorService` and `WorkflowWorker` already use for the workflow
 * queues, so no extra container or deploy step is required.
 */
@Injectable()
export class RsvpQueueConsumer implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger(RsvpQueueConsumer.name);
  private worker?: Worker<RsvpJobData>;
  private dlq?: Queue<RsvpJobData>;
  private eventWorkflowQueue?: Queue;

  constructor(
    private readonly prisma: PrismaService,
    private readonly rsvpProcessor: RsvpProcessorService,
    private readonly messagingService: MessagingService,
  ) {}

  onModuleInit() {
    this.dlq = new Queue<RsvpJobData>(RSVP_DLQ, {
      connection: getRedisConnection(),
    });
    this.eventWorkflowQueue = new Queue(EVENT_WORKFLOW_QUEUE, {
      connection: getRedisConnection(),
    });

    this.worker = new Worker<RsvpJobData>(
      RSVP_QUEUE,
      async (job) => this.processJob(job),
      {
        connection: getRedisConnection(),
        concurrency: WORKER_CONCURRENCY,
      },
    );

    this.worker.on('failed', async (job, err) => {
      if (!job) return;
      this.logger.error(`RSVP job ${job.id} failed: ${err?.message}`);

      // Exhausted retries — park it in the DLQ so the reply isn't lost silently.
      if ((job.attemptsMade ?? 0) >= (job.opts.attempts ?? 1)) {
        this.logger.warn(`RSVP job ${job.id} moving to DLQ`);
        await this.dlq
          ?.add('failed-rsvp', job.data, { removeOnComplete: false })
          .catch((e) =>
            this.logger.error(`Failed to write RSVP DLQ entry: ${e.message}`),
          );
      }
    });

    this.worker.on('error', (err) => {
      this.logger.error(`RSVP worker error: ${err.message}`);
    });

    this.logger.log(
      `RSVP queue consumer started (concurrency=${WORKER_CONCURRENCY})`,
    );
  }

  async onModuleDestroy() {
    await this.worker?.close();
    await this.dlq?.close();
    await this.eventWorkflowQueue?.close();
  }

  private async processJob(job: Job<RsvpJobData>) {
    const { tenantId, phone, body, channel } = job.data;
    this.logger.log(`Processing RSVP job ${job.id}: ${phone} -> ${body}`);

    const response = await this.rsvpProcessor.processInboundMessage(
      phone,
      body,
      tenantId,
      channel as any,
    );

    if (!response) {
      // The router gates on hasActiveInvitation() before enqueuing, so this now
      // means the invitation was consumed or expired between the reply landing
      // and this job running — not the common case it used to be.
      this.logger.warn(
        `RSVP job ${job.id} did not map to a live event for ${phone}`,
      );
      return null;
    }

    this.logger.log(`RSVP processed for ${phone}`);

    // Actually deliver the acknowledgement. The Twilio webhook returns this
    // string as TwiML so the reply rides back on the same HTTP response, but
    // this queued path (used by the Termii webhook) has no such channel — until
    // now the text was computed and thrown away, so those customers were told
    // nothing after replying.
    if (response && phone) {
      try {
        await this.messagingService.send(
          tenantId,
          (channel as any) || 'SMS',
          phone,
          response,
        );
        this.logger.log(
          `Confirmation sent to ${phone}: "${response.substring(0, 50)}..."`,
        );
      } catch (err: any) {
        // Deliberately not rethrown: the RSVP itself is already committed, and
        // retrying the job would re-run the whole reply and double-process it.
        this.logger.error(
          `Failed to send confirmation to ${phone}: ${err.message}`,
        );
      }
    }

    // A confirmed RSVP feeds the event-automation chain (e.g. "send location on
    // confirm"), which is what turns a customer's reply into the next message.
    if (this.rsvpProcessor.parseResponse(body) === 'confirmed') {
      await this.fireConfirmedWorkflow(tenantId, phone);
    }

    return response;
  }

  private async fireConfirmedWorkflow(tenantId: string, phone: string) {
    try {
      const contact = await this.prisma.contact.findFirst({
        where: { tenantId, phone },
        select: { id: true },
      });
      if (!contact) return;

      const participant = await this.prisma.eventParticipant.findFirst({
        where: { contactId: contact.id, status: 'confirmed' },
        orderBy: { lastResponseAt: 'desc' } as any,
        select: { eventId: true },
      });
      if (!participant) return;

      await this.eventWorkflowQueue?.add(
        'event-workflow',
        {
          tenantId,
          triggerType: 'rsvp_confirmed',
          contactId: contact.id,
          eventId: participant.eventId,
        },
        { attempts: 3, backoff: { type: 'exponential', delay: 2000 } },
      );

      this.logger.log(`Event workflow queued for confirmed RSVP from ${phone}`);
    } catch (err: any) {
      // The RSVP itself is already recorded; a follow-up automation failure
      // must not fail the job and trigger a re-processing of the reply.
      this.logger.error(
        `Failed to queue event workflow for ${phone}: ${err.message}`,
      );
    }
  }
}
