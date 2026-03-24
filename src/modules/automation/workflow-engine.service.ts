import { Injectable, Logger } from '@nestjs/common';
import { Queue } from 'bullmq';
import { PrismaService } from '../../prisma/prisma.service';
import {
  WORKFLOW_QUEUE,
  WORKFLOW_JOB_OPTIONS,
  WorkflowJobData,
  getRedisConnection,
} from '../../queue/queue.config';
import { AutomationExecutionTracker } from './automation-execution-tracker.service';

export interface TriggerEntityData {
  appointmentId?: string;
  appointmentTitle?: string;
  appointmentStatus?: string;
  scheduledAt?: string;
  customerId?: string;
  customerName?: string;
  customerPhone?: string;
  customerEmail?: string;
  tenantId: string;
  [key: string]: unknown;
}

@Injectable()
export class WorkflowEngineService {
  private readonly logger = new Logger(WorkflowEngineService.name);
  private readonly queue: Queue<WorkflowJobData>;

  constructor(
    private readonly prisma: PrismaService,
    private readonly tracker: AutomationExecutionTracker,
  ) {
    this.queue = new Queue<WorkflowJobData>(WORKFLOW_QUEUE, {
      connection: getRedisConnection(),
    });
  }

  /**
   * Fire a trigger event. Finds all matching active workflows and enqueues
   * a job per action (with appropriate delays) for each workflow.
   */
  async fireTrigger(
    tenantId: string,
    triggerType: string,
    entityId: string,
    entityData: TriggerEntityData,
  ): Promise<void> {
    const workflows = await this.prisma.workflow.findMany({
      where: {
        tenantId,
        isActive: true,
        trigger: { type: triggerType },
      },
      include: {
        actions: { orderBy: { stepOrder: 'asc' } },
      },
    });

    if (workflows.length === 0) return;

    this.logger.log(
      `Trigger "${triggerType}" fired for entity ${entityId} — ${workflows.length} workflow(s) matched`,
    );

    for (const workflow of workflows) {
      if (workflow.actions.length === 0) continue;

      // ── Loop detection ──────────────────────
      // Use the triggering entity id as the "contactId" proxy for loop tracking
      const allowed = this.tracker.trackExecution(workflow.id, entityId);
      if (!allowed) {
        this.logger.warn(
          `Skipping workflow "${workflow.name}" for entity ${entityId} — loop limit reached`,
        );
        continue;
      }

      const execution = await this.prisma.workflowExecution.create({
        data: {
          workflowId: workflow.id,
          tenantId,
          triggerType,
          triggerEntityId: entityId,
          status: 'RUNNING',
        },
      });

      let cumulativeDelay = 0;
      for (let i = 0; i < workflow.actions.length; i++) {
        const action = workflow.actions[i];
        cumulativeDelay += action.delayMinutes * 60 * 1000;

        const jobData: WorkflowJobData = {
          executionId: execution.id,
          workflowId: workflow.id,
          actionId: action.id,
          tenantId,
          triggerEntityId: entityId,
          entityData,
          isLastAction: i === workflow.actions.length - 1,
        };

        const jobId = `wf:${execution.id}:step:${i}`;
        await this.queue.add('execute-action', jobData, {
          ...WORKFLOW_JOB_OPTIONS,
          delay: cumulativeDelay,
          jobId,
        });
      }

      this.logger.log(
        `Workflow "${workflow.name}" execution ${execution.id} queued (${workflow.actions.length} steps)`,
      );
    }
  }
}
