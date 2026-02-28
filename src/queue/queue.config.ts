import { ConnectionOptions } from 'bullmq';

// ── Queue names ──────────────────────────────
export const REMINDER_QUEUE = 'remindly-reminders';
export const REMINDER_DLQ = 'remindly-reminders-dlq';

// ── Redis connection ─────────────────────────
export function getRedisConnection(): ConnectionOptions {
    return {
        host: process.env.REDIS_HOST || 'localhost',
        port: parseInt(process.env.REDIS_PORT || '6379', 10),
        password: process.env.REDIS_PASSWORD || undefined,
        maxRetriesPerRequest: null, // required by BullMQ
    };
}

// ── Job options ──────────────────────────────
export const REMINDER_JOB_OPTIONS = {
    attempts: 5,
    backoff: {
        type: 'exponential' as const,
        delay: 30_000, // 30s base → 30s, 60s, 120s, 240s, 480s
    },
    removeOnComplete: { count: 1000 }, // keep last 1000 completed
    removeOnFail: false, // keep failed for DLQ processing
};

// ── Job data interface ───────────────────────
export interface ReminderJobData {
    reminderId: string;
    tenantId: string;
    appointmentId: string;
    channel: string;
    messageContent: string | null;
    scheduledFor: string; // ISO date string
    attempt?: number;
}
