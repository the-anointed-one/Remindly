import { Injectable, Logger } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import { ActivityType } from '@prisma/client';
import {
  WorkflowEngineService,
  TriggerEntityData,
} from '../automation/workflow-engine.service';
import { ReputationService } from '../reputation/reputation.service';

/**
 * EventLifecycleService
 *
 * Central orchestrator for the Attendance Automation Pipeline.
 * Every significant moment in an appointment's lifecycle flows through here:
 *
 *   Scheduled → Reminders → RSVP Campaign → Automation Triggers → Prediction
 *   Confirmed → Workflow → Activity Log
 *   Completed → Feedback Request → Workflow
 *   No-Show   → Prediction Refresh → Workflow
 *   Rescheduled → Workflow → Activity Log
 *
 * AppointmentService delegates all side-effect orchestration here,
 * keeping the core CRUD methods focused on data operations.
 */
@Injectable()
export class EventLifecycleService {
  private readonly logger = new Logger(EventLifecycleService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly workflowEngine: WorkflowEngineService,
    private readonly reputationService: ReputationService,
  ) {}

  // ── On Appointment Created ────────────────────────────────────────────────

  /**
   * Called after each appointment is persisted in AppointmentService.create().
   * Fires the appointment_created automation trigger and schedules prediction scoring.
   */
  async onEventScheduled(
    tenantId: string,
    appointmentId: string,
    entityData: TriggerEntityData,
  ) {
    this.workflowEngine
      .fireTrigger(tenantId, 'appointment_created', appointmentId, entityData)
      .catch((err) =>
        this.logger.error(`Workflow trigger failed: ${err.message}`),
      );
  }

  /**
   * Called once after a bulk appointment batch (tag/group/segment target with >1 contacts).
   * Creates a Campaign record to track RSVPs across all participants.
   */
  async setupBulkRsvpCampaign(
    tenantId: string,
    firstAppointmentId: string,
    title: string,
  ) {
    try {
      const campaign = await this.prisma.campaign.create({
        data: { tenantId, name: `RSVP: ${title}` },
      });
      await this.prisma.appointment.update({
        where: { id: firstAppointmentId },
        data: { campaignId: campaign.id },
      });
      this.logger.log(
        `RSVP campaign ${campaign.id} created for bulk event "${title}"`,
      );
    } catch (err: any) {
      this.logger.error(`Failed to create RSVP campaign: ${err.message}`);
    }
  }

  // ── On Status Change ──────────────────────────────────────────────────────

  /**
   * Called by AppointmentService.update() when appointment.status changes.
   * Covers CONFIRMED, CANCELLED, COMPLETED, NO_SHOW — all new and existing transitions.
   */
  async onStatusChanged(
    tenantId: string,
    appointmentId: string,
    oldStatus: string,
    newStatus: string,
    entityData: TriggerEntityData,
  ) {
    if (!newStatus || oldStatus === newStatus) return;

    const triggerMap: Record<string, string> = {
      CONFIRMED: 'appointment_confirmed',
      CANCELLED: 'appointment_cancelled',
      COMPLETED: 'appointment_completed',
      NO_SHOW: 'appointment_no_show',
    };

    const trigger = triggerMap[newStatus];
    if (trigger) {
      this.workflowEngine
        .fireTrigger(tenantId, trigger, appointmentId, entityData)
        .catch((err) =>
          this.logger.error(`Failed to fire ${trigger}: ${err.message}`),
        );
    }

    // CONFIRMED — log activity for first participant
    if (newStatus === 'CONFIRMED') {
      const participant = await this.prisma.appointmentParticipant.findFirst({
        where: { appointmentId },
      });
      if (participant) {
        this.prisma.contactActivity
          .create({
            data: {
              tenantId,
              contactId: participant.contactId,
              activityType: ActivityType.appointment_confirmed,
              referenceId: appointmentId,
              metadata: { status: newStatus },
            },
          })
          .catch(() => {});
      }
    }

    // COMPLETED — send post-event feedback request
    if (newStatus === 'COMPLETED') {
      this.reputationService
        .sendFeedbackRequest(appointmentId, tenantId)
        .catch((err) =>
          this.logger.error(`Feedback request failed: ${err.message}`),
        );
    }

  }

  // ── On Rescheduled ────────────────────────────────────────────────────────

  /**
   * Called by AppointmentService.update() when scheduledAt changes.
   * Fires appointment_rescheduled trigger and logs activity for the participant.
   */
  async onRescheduled(
    tenantId: string,
    appointmentId: string,
    oldTime: Date,
    newTime: Date,
    entityData: TriggerEntityData,
  ) {
    this.workflowEngine
      .fireTrigger(
        tenantId,
        'appointment_rescheduled',
        appointmentId,
        entityData,
      )
      .catch((err) =>
        this.logger.error(
          `Failed to fire appointment_rescheduled: ${err.message}`,
        ),
      );

    const participant = await this.prisma.appointmentParticipant.findFirst({
      where: { appointmentId },
    });
    if (participant) {
      this.prisma.contactActivity
        .create({
          data: {
            tenantId,
            contactId: participant.contactId,
            activityType: ActivityType.appointment_rescheduled,
            referenceId: appointmentId,
            metadata: { oldTime, newTime },
          },
        })
        .catch(() => {});
    }
  }

  // ── Pipeline View ─────────────────────────────────────────────────────────

  /**
   * Returns the complete lifecycle state for a single appointment.
   * Used by GET /appointments/:id/pipeline.
   */
  async getPipeline(tenantId: string, appointmentId: string) {
    const appointment = await this.prisma.appointment.findFirst({
      where: { id: appointmentId, tenantId },
      include: {
        customer: true,
        location: true,
        reminders: { orderBy: { scheduledSendTime: 'asc' } },
        participants: { include: { contact: true } },
      },
    });

    if (!appointment) return null;

    const apt = appointment as any;

    // RSVP campaign linked via appointment.campaignId
    let rsvpCampaign: Record<string, any> | null = null;
    if (apt.campaignId) {
      const campaign = await this.prisma.campaign.findFirst({
        where: { id: apt.campaignId, tenantId },
        include: { _count: { select: { recipients: true } } },
      });
      if (campaign) {
        const [confirmed, cancelled, pending] = await Promise.all([
          this.prisma.messageResponse.count({
            where: {
              broadcastId: campaign.id,
              tenantId,
              responseStatus: 'confirmed',
            },
          }),
          this.prisma.messageResponse.count({
            where: {
              broadcastId: campaign.id,
              tenantId,
              responseStatus: 'cancelled',
            },
          }),
          this.prisma.messageResponse.count({
            where: {
              broadcastId: campaign.id,
              tenantId,
              responseStatus: 'pending',
            },
          }),
        ]);
        rsvpCampaign = {
          id: campaign.id,
          name: campaign.name,
          confirmed,
          cancelled,
          pending,
          total: campaign._count.recipients,
        };
      }
    }

    // Post-event feedback
    const feedbackRequest = await this.prisma.feedbackRequest.findFirst({
      where: { appointmentId, tenantId },
      include: { responses: { orderBy: { receivedAt: 'desc' }, take: 1 } },
    });

    // Activity timeline for this appointment
    const timeline = await this.prisma.contactActivity.findMany({
      where: { referenceId: appointmentId, tenantId },
      orderBy: { createdAt: 'asc' },
    });

    return {
      appointment: {
        id: appointment.id,
        title: appointment.title,
        status: appointment.status,
        scheduledAt: appointment.scheduledAt,
        durationMinutes: appointment.durationMinutes,
        notes: appointment.notes,
        location: apt.location ?? null,
        customer: apt.customer ?? null,
      },
      participants: (apt.participants ?? []).map((p: any) => ({
        contactId: p.contactId,
        name: p.contact?.name ?? null,
        phone: p.contact?.phone ?? null,
        status: p.status,
      })),
      reminders: (apt.reminders ?? []).map((r: any) => ({
        id: r.id,
        channel: r.channel,
        scheduledSendTime: r.scheduledSendTime,
        status: r.status,
        messageContent: r.messageContent,
      })),
      rsvpCampaign,
      feedback: feedbackRequest
        ? {
            status: feedbackRequest.status,
            rating: feedbackRequest.responses[0]?.rating ?? null,
            sentiment: feedbackRequest.responses[0]?.sentiment ?? null,
          }
        : null,
      timeline,
    };
  }
}
