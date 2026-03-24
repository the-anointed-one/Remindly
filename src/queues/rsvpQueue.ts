import { Queue } from 'bullmq';
import {
  RSVP_QUEUE,
  getRedisConnection,
  RsvpJobData,
} from '../queue/queue.config';

export const rsvpQueue = new Queue<RsvpJobData>(RSVP_QUEUE, {
  connection: getRedisConnection(),
  defaultJobOptions: {
    attempts: 5,
    backoff: { type: 'exponential', delay: 5000 },
    removeOnComplete: { count: 1000 },
    removeOnFail: false,
  },
});
