import { ConnectionOptions } from 'bullmq';
import { ChannelType } from '@prisma/client';

// ── Queue names ──────────────────────────────
export const REMINDER_QUEUE = 'meetora-reminders';
export const REMINDER_DLQ = 'meetora-reminders-dlq';
export const CALENDAR_SYNC_QUEUE = 'meetora-calendar-sync';
export const UNREAD_CHECK_QUEUE = 'meetora-unread-checks';
export const CAMPAIGN_QUEUE = 'meetora-campaigns';
export const CAMPAIGN_DLQ = 'meetora-campaigns-dlq';

// ── Worker concurrency ───────────────────────
// Configure per-worker concurrency via the WORKER_CONCURRENCY env var.
// Supports horizontal scaling: each worker replica reads this independently.
export const WORKER_CONCURRENCY = parseInt(
  process.env.WORKER_CONCURRENCY || '5',
  10,
);

// RSVP queue config
export const RSVP_QUEUE = 'meetora-rsvp';
export const RSVP_DLQ = 'meetora-rsvp-dlq';

export const RSVP_JOB_OPTIONS = {
  attempts: 5,
  backoff: {
    type: 'exponential' as const,
    delay: 5000,
  },
  removeOnComplete: { count: 1000 },
  removeOnFail: false,
};

export interface RsvpJobData {
  tenantId: string;
  phone: string;
  body: string;
  channel: ChannelType;
  receivedAt: string;
}

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
  channelStrategyId?: string; // ChannelStrategy.id — drives fallback chain
}

// ── Unread-check job (scheduled after WhatsApp send) ──
export const UNREAD_CHECK_JOB_OPTIONS = {
  attempts: 1,
  removeOnComplete: { count: 500 },
  removeOnFail: false,
};

export interface UnreadCheckJobData {
  reminderId: string;
  tenantId: string;
  strategyId: string;
  strategyChain: string[]; // full ordered chain from ChannelStrategy.chain
  currentChannelIndex: number; // index of the WhatsApp channel that was just sent
  recipient: string;
  messageContent: string;
}

// ── Workflow queue ────────────────────────────
export const WORKFLOW_QUEUE = 'meetora-workflows';

export const WORKFLOW_JOB_OPTIONS = {
  attempts: 3,
  backoff: { type: 'exponential' as const, delay: 5_000 },
  removeOnComplete: { count: 500 },
  removeOnFail: false,
};

export interface WorkflowJobData {
  executionId: string;
  workflowId: string;
  actionId: string;
  tenantId: string;
  triggerEntityId: string;
  entityData: Record<string, unknown>;
  isLastAction: boolean;
}

export interface EventWorkflowJobData {
  tenantId: string;
  workflowId?: string;
  triggerId?: string;
  triggerType: string;
  contactId: string;
  eventId: string;
}

// ── Campaign send job ─────────────────────────
export interface CampaignJobData {
  tenantId: string;
  campaignId: string;
  segmentId: string;
  contactId: string;
  recipient: string; // phone or email
  channel: string; // SMS | WHATSAPP | EMAIL | VOICE
  messageTemplate: string; // raw template with {{variables}}
  scheduledFor: string; // ISO datetime string
  contactName: string;
  locationName?: string;
}
