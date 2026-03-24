/**
 * Meetora — Message Queue
 *
 * Re-exports the existing CAMPAIGN_QUEUE under the MESSAGE_QUEUE alias
 * so broadcast jobs and campaign jobs share the same Redis queue,
 * processed by the campaign worker.
 *
 * Job types are distinguished by the `jobType` field in the payload.
 */

import { Queue } from 'bullmq';
import { CAMPAIGN_QUEUE, getRedisConnection } from '../queue/queue.config';

export const MESSAGE_QUEUE = CAMPAIGN_QUEUE;

export type MessageJobType = 'sendSMS' | 'sendWhatsApp' | 'sendVoice';

export interface MessageJobData {
  jobType: MessageJobType;
  tenantId: string;
  to: string; // phone number or WhatsApp number
  body: string; // fully rendered message body
  campaignRecipientId?: string; // FK → campaign_recipients.id for status tracking
  // legacy campaign fields (kept for campaign worker compatibility)
  campaignId?: string;
  contactId?: string;
  contactName?: string;
  scheduledFor?: string;
}

/** Batch size — jobs are chunked before being pushed to Redis */
export const MESSAGE_BATCH_SIZE = 100;

/** Singleton queue instance — import this wherever you need to enqueue messages */
export const messageQueue = new Queue<MessageJobData>(MESSAGE_QUEUE, {
  connection: getRedisConnection(),
  defaultJobOptions: {
    attempts: 3,
    backoff: { type: 'exponential', delay: 15_000 },
    removeOnComplete: { count: 5000 },
    removeOnFail: false,
  },
});
