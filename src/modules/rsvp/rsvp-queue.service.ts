import { Injectable, Logger } from '@nestjs/common';
import { rsvpQueue } from '../../queues/rsvpQueue';
import { RsvpJobData } from '../../queue/queue.config';

@Injectable()
export class RsvpQueueService {
  private readonly logger = new Logger(RsvpQueueService.name);

  async enqueueRsvp(payload: RsvpJobData) {
    // BullMQ v5 rejects ':' in a custom job id ("Custom Id cannot contain :"),
    // since it uses ':' as its own Redis key separator. The previous template
    // was colon-delimited, so every enqueue threw and the inbound webhook
    // returned 500 — the RSVP path could never complete. Use '_' instead.
    const jobId = `rsvp_${payload.tenantId}_${payload.phone}_${Date.now()}`;
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
