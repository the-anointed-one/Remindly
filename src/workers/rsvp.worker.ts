import { Worker, Queue, Job } from 'bullmq';
import { NestFactory } from '@nestjs/core';
import { AppModule } from '../app.module';
import { RsvpProcessorService } from '../modules/rsvp/rsvp-processor.service';
import { PrismaClient } from '@prisma/client';
import { Logger } from '@nestjs/common';
import {
  RSVP_QUEUE,
  RSVP_DLQ,
  getRedisConnection,
  RsvpJobData,
} from '../queue/queue.config';

(async () => {
  const logger = new Logger('RsvpWorker');
  const prisma = new PrismaClient();
  const appContext = await NestFactory.createApplicationContext(AppModule, {
    logger: false,
  });
  const rsvpProcessor = appContext.get(RsvpProcessorService);

  const dlq = new Queue<RsvpJobData>(RSVP_DLQ, {
    connection: getRedisConnection(),
  });

  logger.log('🎯 Starting Meetora RSVP worker...');

  const worker = new Worker<RsvpJobData>(
    RSVP_QUEUE,
    async (job: Job<RsvpJobData>) => {
      const { tenantId, phone, body } = job.data;
      logger.log(
        `📥 RSVP Worker processing job ${job.id}: ${phone} -> ${body}`,
      );

      try {
        const rsvpResponse = await rsvpProcessor.processInboundMessage(
          phone,
          body,
          tenantId,
        );

        if (rsvpResponse) {
          logger.log(`✅ RSVP processed for ${phone}: ${rsvpResponse}`);

          // Trigger Workflow Worker for RSVP confirmed
          const responseType = rsvpProcessor.parseResponse(body);
          if (responseType === 'confirmed') {
            const contact = await prisma.contact.findFirst({
              where: { tenantId, phone },
              select: { id: true },
            });

            if (contact) {
              const participant = await prisma.eventParticipant.findFirst({
                where: {
                  contactId: contact.id,
                  status: 'confirmed',
                },
                orderBy: { lastResponseAt: 'desc' },
                select: { eventId: true },
              });

              if (participant) {
                const workflowQueue = new Queue('meetora-event-workflows', {
                  connection: getRedisConnection(),
                });
                await workflowQueue.add(
                  'event-workflow',
                  {
                    tenantId,
                    triggerType: 'rsvp_confirmed',
                    contactId: contact.id,
                    eventId: participant.eventId,
                  },
                  {
                    attempts: 3,
                    backoff: { type: 'exponential', delay: 2000 },
                  },
                );
                await workflowQueue.close();
                logger.log(
                  `🚀 Workflow triggered for confirmed RSVP: ${phone}`,
                );
              }
            }
          }
        } else {
          logger.log(
            `⚠️  RSVP entry did not map to current event for ${phone}`,
          );
        }
        return rsvpResponse;
      } catch (error: any) {
        logger.error(
          `❌ RSVP processing failed for ${phone}: ${error.message}`,
        );
        throw error;
      }
    },
    {
      connection: getRedisConnection(),
      concurrency: 20,
      limiter: {
        max: 10,
        duration: 1000,
      },
    },
  );

  worker.on('completed', (job) => {
    logger.log(`✓ RSVP job ${job.id} completed`);
  });

  worker.on('failed', async (job, err) => {
    if (!job) return;
    logger.error(
      `✗ RSVP job ${job.id} failed: ${err?.message || 'unknown error'}`,
    );

    if ((job.attemptsMade ?? 0) >= (job.opts.attempts ?? 1)) {
      logger.log(`💀 RSVP job ${job.id} moving to DLQ`);
      await dlq.add('failed-rsvp', job.data, { removeOnComplete: false });
    }
  });

  worker.on('error', (err) => {
    logger.error('RSVP worker error: ' + err.message);
  });

  async function shutdown() {
    logger.log('\n🛑 Shutting down RSVP worker...');
    await worker.close();
    await dlq.close();
    await prisma.$disconnect();
    await appContext.close();
    process.exit(0);
  }

  process.on('SIGTERM', shutdown);
  process.on('SIGINT', shutdown);
})();
