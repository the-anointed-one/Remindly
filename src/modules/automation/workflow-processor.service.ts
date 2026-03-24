import {
  Injectable,
  Logger,
  OnModuleDestroy,
  OnModuleInit,
} from '@nestjs/common';
import { Worker, Job } from 'bullmq';
import { PrismaService } from '../../prisma/prisma.service';
import { MessagingService } from '../messaging/messaging.service';
import { ConfigService } from '@nestjs/config';
import {
  WORKFLOW_QUEUE,
  WorkflowJobData,
  getRedisConnection,
} from '../../queue/queue.config';

const TEMPLATE_VARS_RE = /\{\{(\w+)\}\}/g;

function resolveTemplate(
  template: string,
  vars: Record<string, unknown>,
): string {
  return template.replace(TEMPLATE_VARS_RE, (_, key) =>
    String(vars[key] ?? `{{${key}}}`),
  );
}

@Injectable()
export class WorkflowProcessorService implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger(WorkflowProcessorService.name);
  private worker: Worker<WorkflowJobData>;

  constructor(
    private readonly prisma: PrismaService,
    private readonly messagingService: MessagingService,
    private readonly configService: ConfigService,
  ) {}

  onModuleInit() {
    this.worker = new Worker<WorkflowJobData>(
      WORKFLOW_QUEUE,
      async (job) => this.processJob(job),
      {
        connection: getRedisConnection(),
        concurrency: 5,
      },
    );

    this.worker.on('failed', (job, err) => {
      this.logger.error(`Workflow job ${job?.id} failed: ${err.message}`);
    });

    this.logger.log('Workflow processor started');
  }

  async onModuleDestroy() {
    await this.worker?.close();
  }

  // ──────────────────────────────────────────
  // Core processing
  // ──────────────────────────────────────────

  private async processJob(job: Job<WorkflowJobData>): Promise<void> {
    const {
      executionId,
      workflowId,
      actionId,
      tenantId,
      triggerEntityId,
      entityData,
      isLastAction,
    } = job.data;

    // Load the action with its conditions
    const action = await this.prisma.workflowAction.findUnique({
      where: { id: actionId },
      include: { conditions: true },
    });

    if (!action) {
      this.logger.warn(`Action ${actionId} not found — skipping`);
      return;
    }

    // Check conditions — if any fail, skip this action
    const conditionsMet = await this.evaluateConditions(
      action.conditions,
      triggerEntityId,
      entityData,
    );

    if (!conditionsMet) {
      this.logger.log(
        `Conditions not met for action ${actionId} in execution ${executionId} — skipping`,
      );
      await this.prisma.workflowExecution.update({
        where: { id: executionId },
        data: { actionsSkipped: { increment: 1 } },
      });
      if (isLastAction) await this.markExecutionComplete(executionId);
      return;
    }

    // Execute the action
    try {
      await this.executeAction(action, tenantId, triggerEntityId, entityData);
      await this.prisma.workflowExecution.update({
        where: { id: executionId },
        data: { actionsRun: { increment: 1 } },
      });
    } catch (err: any) {
      this.logger.error(`Action ${actionId} failed: ${err.message}`);
      await this.prisma.workflowExecution.update({
        where: { id: executionId },
        data: { status: 'FAILED', error: err.message, completedAt: new Date() },
      });
      throw err; // re-throw so BullMQ retries
    }

    if (isLastAction) await this.markExecutionComplete(executionId);
  }

  private async markExecutionComplete(executionId: string) {
    await this.prisma.workflowExecution.update({
      where: { id: executionId },
      data: { status: 'COMPLETED', completedAt: new Date() },
    });
  }

  // ──────────────────────────────────────────
  // Action executor
  // ──────────────────────────────────────────

  private async executeAction(
    action: { id: string; type: string; config: unknown },
    tenantId: string,
    entityId: string,
    entityData: Record<string, unknown>,
  ): Promise<void> {
    const config = action.config as Record<string, unknown>;

    const recipients: any[] = [];

    // Fix: If entityData specifies a single contact/customer, target ONLY them.
    // This prevents triggers like 'attendance_confirmed' from messaging all event participants.
    if (entityData.customerId || entityData.contactId) {
      const cid = (entityData.customerId || entityData.contactId) as string;
      const contact = await this.prisma.contact.findUnique({
        where: { id: cid },
      });
      if (contact && !contact.unsubscribed) {
        recipients.push({
          phone: contact.phone,
          email: contact.email,
          name: contact.name,
          id: contact.id,
        });
      }
    } else if (entityData.customerPhone || entityData.customerEmail) {
      recipients.push({
        phone: entityData.customerPhone,
        email: entityData.customerEmail,
        name: entityData.customerName,
        id: entityData.customerId,
      });
    } else if (entityData.eventId) {
      const event = await this.prisma.event.findUnique({
        where: { id: String(entityData.eventId) },
        include: { participants: { include: { contact: true } } },
      });
      if (event?.participants) {
        for (const p of event.participants) {
          if (
            p.status !== 'cancelled' &&
            p.contact &&
            !p.contact.unsubscribed
          ) {
            recipients.push({
              phone: p.contact.phone,
              email: p.contact.email,
              name: p.contact.name || '',
              id: p.contact.id,
            });
          }
        }
      }
    }

    if (recipients.length === 0) return;

    for (const recipient of recipients) {
      // Resolve template variables from entity data
      const vars: Record<string, unknown> = {
        customer_name: recipient.name ?? '',
        customer_phone: recipient.phone ?? '',
        customer_email: recipient.email ?? '',
        appointment_title:
          (entityData.appointmentTitle || entityData.eventTitle) ?? '',
        appointment_status: entityData.appointmentStatus ?? '',
        scheduled_at: entityData.scheduledAt ?? '',
        tenant_id: tenantId,
      };

      const phone = String(recipient.phone ?? '');
      const email = String(recipient.email ?? '');
      const message = config.message
        ? resolveTemplate(String(config.message), vars)
        : '';

      switch (action.type) {
        case 'send_sms': {
          if (phone)
            await this.messagingService.send(tenantId, 'SMS', phone, message);
          break;
        }
        case 'send_whatsapp': {
          if (phone)
            await this.messagingService.send(
              tenantId,
              'WHATSAPP',
              phone,
              message,
            );
          break;
        }
        case 'send_voice': {
          if (phone)
            await this.messagingService.send(tenantId, 'VOICE', phone, message);
          break;
        }
        case 'send_email': {
          if (email) {
            const subject = config.subject
              ? resolveTemplate(String(config.subject), vars)
              : 'Message from Meetora';
            await this.messagingService.send(
              tenantId,
              'EMAIL',
              email,
              `${subject}\n\n${message}`,
            );
          }
          break;
        }
        case 'request_review': {
          if (phone) {
            const platform = String(config.platform ?? 'google');
            const reviewMsg =
              message ||
              `Hi ${vars.customer_name}, thank you for your visit! We'd love your ${platform} review.`;
            await this.messagingService.send(tenantId, 'SMS', phone, reviewMsg);
          }
          break;
        }
        case 'add_tag': {
          const tag = String(config.tag ?? '').trim();
          if (tag && phone) {
            const contact = await this.prisma.contact.findFirst({
              where: { tenantId, phone },
            });
            if (contact && !contact.tags.includes(tag)) {
              await this.prisma.contact.update({
                where: { id: contact.id },
                data: { tags: { push: tag } },
              });
            }
          }
          break;
        }
        case 'generate_ai_message': {
          const channel = String(config.channel ?? 'SMS').toUpperCase() as
            | 'SMS'
            | 'WHATSAPP'
            | 'EMAIL';
          const prompt = config.prompt
            ? resolveTemplate(String(config.prompt), vars)
            : message;
          const recipientStr = channel === 'EMAIL' ? email : phone;
          if (recipientStr) {
            await this.messagingService.send(
              tenantId,
              channel,
              recipientStr,
              prompt,
            );
          }
          break;
        }
        default:
          this.logger.warn(`Unknown action type: ${action.type}`);
      }
    }

    this.logger.log(
      `Executed action "${action.type}" for entity ${entityId} to ${recipients.length} recipients`,
    );
  }

  // ──────────────────────────────────────────
  // Condition evaluator
  // ──────────────────────────────────────────

  private async evaluateConditions(
    conditions: Array<{
      conditionType: string;
      operator: string;
      value: string;
    }>,
    entityId: string,
    entityData: Record<string, unknown>,
  ): Promise<boolean> {
    if (conditions.length === 0) return true;

    for (const cond of conditions) {
      const passed = await this.evaluateCondition(cond, entityId, entityData);
      if (!passed) return false; // AND logic — all must pass
    }
    return true;
  }

  private async evaluateCondition(
    cond: { conditionType: string; operator: string; value: string },
    entityId: string,
    entityData: Record<string, unknown>,
  ): Promise<boolean> {
    const { conditionType, operator, value } = cond;

    switch (conditionType) {
      case 'appointment_status_is': {
        // Fetch fresh status from DB
        const apptId = String(entityData.appointmentId ?? entityId);
        const appt = await this.prisma.appointment.findUnique({
          where: { id: apptId },
          select: { status: true },
        });
        if (!appt) return false;
        return operator === 'not_equals'
          ? appt.status !== value
          : appt.status === value;
      }
      case 'event_status_is': {
        const eventId = String(entityData.eventId ?? entityId);
        const event = await this.prisma.event.findUnique({
          where: { id: eventId },
          select: { status: true },
        });
        if (!event) return false;
        return operator === 'not_equals'
          ? event.status !== value
          : event.status === value;
      }
      case 'participant_status_is': {
        // Check participant status for a specific contact in an event
        const participantEventId = String(entityData.eventId ?? entityId);
        const contactId = String(entityData.contactId ?? '');
        if (!contactId || !participantEventId) return false;
        const participant = await this.prisma.eventParticipant.findFirst({
          where: { eventId: participantEventId, contactId },
          select: { status: true },
        });
        if (!participant) return false;
        return operator === 'not_equals'
          ? participant.status !== value
          : participant.status === value;
      }
      case 'rsvp_status_is': {
        // Check RSVP response status
        const rsvpEventId = String(entityData.eventId ?? entityId);
        const rsvpContactId = String(entityData.contactId ?? '');
        if (!rsvpContactId || !rsvpEventId) return false;
        const rsvp = await this.prisma.eventResponse.findFirst({
          where: { eventId: rsvpEventId, contactId: rsvpContactId },
          orderBy: { timestamp: 'desc' },
          select: { responseStatus: true },
        });
        if (!rsvp) {
          // No RSVP yet - check if we're looking for 'pending'
          return value === 'pending' && operator !== 'not_equals';
        }
        return operator === 'not_equals'
          ? rsvp.responseStatus !== value
          : rsvp.responseStatus === value;
      }
      case 'customer_tag_has': {
        const phone = String(entityData.customerPhone ?? '');
        const email = String(entityData.customerEmail ?? '');
        const tenantId = String(entityData.tenantId);
        const contact = await this.prisma.contact.findFirst({
          where: {
            tenantId,
            OR: [
              phone ? { phone } : undefined,
              email ? { email } : undefined,
            ].filter(Boolean) as any,
          },
          select: { tags: true },
        });
        if (!contact) return false;
        return operator === 'not_has'
          ? !contact.tags.includes(value)
          : contact.tags.includes(value);
      }
      case 'customer_unsubscribed': {
        const customerId = String(entityData.customerId ?? '');
        if (!customerId) return false;
        const customer = await this.prisma.customer.findUnique({
          where: { id: customerId },
          select: { unsubscribed: true },
        });
        if (!customer) return false;
        const expected = value === 'true';
        return customer.unsubscribed === expected;
      }
      case 'time_of_day_between': {
        // value format: "09:00-17:00"
        const [start, end] = value.split('-');
        if (!start || !end) return true;
        const now = new Date();
        const [sh, sm] = start.split(':').map(Number);
        const [eh, em] = end.split(':').map(Number);
        const currentMin = now.getHours() * 60 + now.getMinutes();
        const startMin = sh * 60 + (sm || 0);
        const endMin = eh * 60 + (em || 0);
        return operator === 'outside'
          ? currentMin < startMin || currentMin > endMin
          : currentMin >= startMin && currentMin <= endMin;
      }
      default:
        this.logger.warn(`Unknown condition type: ${conditionType}`);
        return true; // unknown conditions pass by default
    }
  }
}
