import { Injectable, Logger, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import { CreateWorkflowDto, UpdateWorkflowDto } from './dto/automation.dto';

@Injectable()
export class AutomationService {
  private readonly logger = new Logger(AutomationService.name);

  constructor(private readonly prisma: PrismaService) {}

  async create(tenantId: string, dto: CreateWorkflowDto) {
    const workflow = await this.prisma.$transaction(async (tx) => {
      const wf = await tx.workflow.create({
        data: {
          tenantId,
          name: dto.name,
          description: dto.description,
          isActive: dto.isActive ?? true,
        },
      });

      await tx.workflowTrigger.create({
        data: {
          workflowId: wf.id,
          type: dto.trigger.type,
          config: (dto.trigger.config ?? {}) as any,
        },
      });

      for (const actionDto of dto.actions) {
        const action = await tx.workflowAction.create({
          data: {
            workflowId: wf.id,
            stepOrder: actionDto.stepOrder,
            type: actionDto.type,
            config: (actionDto.config ?? {}) as any,
            delayMinutes: actionDto.delayMinutes ?? 0,
          },
        });

        if (actionDto.conditions?.length) {
          await tx.workflowCondition.createMany({
            data: actionDto.conditions.map((c) => ({
              workflowId: wf.id,
              actionId: action.id,
              conditionType: c.conditionType,
              operator: c.operator ?? 'equals',
              value: c.value,
            })),
          });
        }
      }

      return wf;
    });

    this.logger.log(
      `Workflow "${workflow.name}" created for tenant ${tenantId}`,
    );
    return this.findOne(tenantId, workflow.id);
  }

  async findAll(tenantId: string) {
    return this.prisma.workflow.findMany({
      where: { tenantId },
      include: {
        trigger: true,
        actions: { orderBy: { stepOrder: 'asc' }, include: { conditions: true } },
        _count: { select: { executions: true } },
      },
      orderBy: { createdAt: 'desc' },
    });
  }

  async findOne(tenantId: string, id: string) {
    const wf = await this.prisma.workflow.findFirst({
      where: { id, tenantId },
      include: {
        trigger: true,
        actions: {
          orderBy: { stepOrder: 'asc' },
          include: { conditions: true },
        },
        executions: {
          orderBy: { startedAt: 'desc' },
          take: 20,
        },
      },
    });
    if (!wf) throw new NotFoundException('Workflow not found');
    return wf;
  }

  async update(tenantId: string, id: string, dto: UpdateWorkflowDto) {
    await this.findOne(tenantId, id); // existence check

    await this.prisma.$transaction(async (tx) => {
      await tx.workflow.update({
        where: { id },
        data: {
          name: dto.name,
          description: dto.description,
          isActive: dto.isActive,
        },
      });

      if (dto.trigger) {
        await tx.workflowTrigger.upsert({
          where: { workflowId: id },
          create: {
            workflowId: id,
            type: dto.trigger.type,
            config: (dto.trigger.config ?? {}) as any,
          },
          update: {
            type: dto.trigger.type,
            config: (dto.trigger.config ?? {}) as any,
          },
        });
      }

      if (dto.actions) {
        // Replace all actions
        await tx.workflowAction.deleteMany({ where: { workflowId: id } });
        for (const actionDto of dto.actions) {
          const action = await tx.workflowAction.create({
            data: {
              workflowId: id,
              stepOrder: actionDto.stepOrder,
              type: actionDto.type,
              config: (actionDto.config ?? {}) as any,
              delayMinutes: actionDto.delayMinutes ?? 0,
            },
          });
          if (actionDto.conditions?.length) {
            await tx.workflowCondition.createMany({
              data: actionDto.conditions.map((c) => ({
                workflowId: id,
                actionId: action.id,
                conditionType: c.conditionType,
                operator: c.operator ?? 'equals',
                value: c.value,
              })),
            });
          }
        }
      }
    });

    return this.findOne(tenantId, id);
  }

  async remove(tenantId: string, id: string) {
    await this.findOne(tenantId, id);
    await this.prisma.workflow.delete({ where: { id } });
    return { deleted: true };
  }

  async toggleActive(tenantId: string, id: string) {
    const wf = await this.findOne(tenantId, id);
    await this.prisma.workflow.update({
      where: { id },
      data: { isActive: !wf.isActive },
    });
    return { id, isActive: !wf.isActive };
  }

  async getExecutions(tenantId: string, workflowId: string, limit = 50) {
    await this.findOne(tenantId, workflowId);
    return this.prisma.workflowExecution.findMany({
      where: { workflowId, tenantId },
      orderBy: { startedAt: 'desc' },
      take: limit,
    });
  }

  /**
   * Return all supported trigger types that workflows can be triggered by.
   * This helps users understand what events can start workflows.
   */
  getSupportedTriggers() {
    return {
      event_triggers: [
        {
          type: 'event_created',
          description: 'Fired when a new event is created',
          entityType: 'Event',
        },
        {
          type: 'event_updated',
          description: 'Fired when an event is updated',
          entityType: 'Event',
        },
        {
          type: 'event_published',
          description: 'Fired when an event is published',
          entityType: 'Event',
        },
        {
          type: 'event_activated',
          description: 'Fired when an event is activated',
          entityType: 'Event',
        },
        {
          type: 'event_completed',
          description: 'Fired when an event has been completed',
          entityType: 'Event',
        },
      ],
      rsvp_triggers: [
        {
          type: 'rsvp_received',
          description:
            'Fired when any RSVP response is received (YES/NO/MAYBE)',
          entityType: 'EventParticipant',
        },
        {
          type: 'rsvp_yes',
          description: 'Fired when a participant confirms attendance (YES)',
          entityType: 'EventParticipant',
        },
        {
          type: 'attendance_confirmed',
          description: 'Fired when a participant confirms attendance',
          entityType: 'EventParticipant',
        },
        {
          type: 'rsvp_no',
          description: 'Fired when a participant declines (NO)',
          entityType: 'EventParticipant',
        },
        {
          type: 'attendance_cancelled',
          description: 'Fired when a participant cancels',
          entityType: 'EventParticipant',
        },
      ],
      appointment_triggers: [
        {
          type: 'appointment_created',
          description: 'Fired when a new appointment is created',
          entityType: 'Appointment',
        },
        {
          type: 'appointment_scheduled',
          description: 'Fired when an appointment is scheduled',
          entityType: 'Appointment',
        },
      ],
    };
  }

  /**
   * Return all supported action types that workflows can execute.
   */
  getSupportedActions() {
    return {
      messaging_actions: [
        {
          type: 'send_sms',
          description: 'Send an SMS message to the participant',
          configSchema: {
            message: 'string (supports {{variable}} substitution)',
          },
        },
        {
          type: 'send_email',
          description: 'Send an email to the participant',
          configSchema: {
            subject: 'string',
            message: 'string (supports {{variable}} substitution)',
          },
        },
        {
          type: 'send_voice',
          description: 'Send a voice call to the participant',
          configSchema: {
            message: 'string (supports {{variable}} substitution)',
          },
        },
        {
          type: 'send_whatsapp',
          description: 'Send a WhatsApp message to the participant',
          configSchema: {
            message: 'string (supports {{variable}} substitution)',
          },
        },
      ],
      contact_actions: [
        {
          type: 'add_tag',
          description: 'Add a tag to the contact',
          configSchema: {
            tagName: 'string',
          },
        },
        {
          type: 'remove_tag',
          description: 'Remove a tag from the contact',
          configSchema: {
            tagName: 'string',
          },
        },
        {
          type: 'add_to_group',
          description: 'Add the contact to a group',
          configSchema: {
            groupId: 'UUID',
          },
        },
        {
          type: 'remove_from_group',
          description: 'Remove the contact from a group',
          configSchema: {
            groupId: 'UUID',
          },
        },
      ],
      system_actions: [
        {
          type: 'log_activity',
          description: 'Log an activity to the contact timeline',
          configSchema: {
            activityType: 'string',
            metadata: 'object',
          },
        },
        {
          type: 'webhook',
          description: 'Make an HTTP POST request to an external URL',
          configSchema: {
            url: 'string (HTTPS required)',
            payload: 'object',
          },
        },
      ],
      supported_variables: {
        contact: ['customer_name', 'customer_phone', 'customer_email'],
        event: [
          'appointment_title',
          'appointment_date',
          'appointment_time',
          'location',
        ],
        system: ['tenant_id', 'event_id', 'contact_id'],
      },
    };
  }
}
