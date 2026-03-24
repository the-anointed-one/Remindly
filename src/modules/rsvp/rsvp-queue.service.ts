import { Injectable, Logger } from '@nestjs/common';
import { rsvpQueue } from '../../queues/rsvpQueue';
import { RsvpJobData } from '../../queue/queue.config';

@Injectable()
export class RsvpQueueService {
  private readonly logger = new Logger(RsvpQueueService.name);

  async enqueueRsvp(payload: RsvpJobData) {
    const jobId = `rsvp:${payload.tenantId}:${payload.phone}:${Date.now()}`;
    this.logger.log(`Enqueuing RSVP job ${jobId}`);

    return rsvpQueue.add('process-rsvp', payload, {
      jobId,
      removeOnComplete: { count: 5000 },
      removeOnFail: false,
      attempts: 3,
      backoff: { type: 'exponential', delay: 3000 },
    });
  }
}
