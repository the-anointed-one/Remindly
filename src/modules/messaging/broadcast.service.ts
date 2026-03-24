import {
  Injectable,
  Logger,
  BadRequestException,
  NotFoundException,
} from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import { MessagingService } from './messaging.service';
import { TemplateRendererService } from './template-renderer.service';
import {
  messageQueue,
  MESSAGE_BATCH_SIZE,
  MessageJobData,
} from '../../queues/messageQueue';
import { BroadcastDto, AudienceType } from './dto/broadcast.dto';
import { ActivityType } from '@prisma/client';

interface ResolvedContact {
  id: string;
  name: string;
  phone: string | null;
  email: string | null;
}

/**
 * BroadcastService
 *
 * Handles all "send to audience" flows triggered from the Messaging page.
 * Supports 6 audience types, template variable rendering, and auto-creates
 * a Campaign record for delivery tracking via CampaignRecipient rows.
 */
@Injectable()
export class BroadcastService {
  private readonly logger = new Logger(BroadcastService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly messagingService: MessagingService,
    private readonly renderer: TemplateRendererService,
  ) {}

  async sendBroadcast(tenantId: string, dto: BroadcastDto) {
    // 1. Resolve audience from the supported types
    const contacts = await this.resolveAudience(
      tenantId,
      dto.audienceType,
      dto.audienceId,
      dto.audienceIds,
      dto.responseFilter,
      dto.responseStatus,
    );

    if (contacts.length === 0) {
      return {
        dispatched: 0,
        message: 'No eligible contacts for this audience',
      };
    }

    // 2. Create a Campaign record for tracking this broadcast
    const campaignName =
      dto.campaignName ?? `Broadcast ${new Date().toISOString()}`;
    const [campaign, tenant, appointment] = await Promise.all([
      this.prisma.campaign.create({
        data: {
          tenantId,
          name: campaignName,
          description: `Channel: ${dto.channel}`,
        },
      }),
      this.prisma.tenant.findUnique({ where: { id: tenantId } }),
      dto.audienceType === 'appointment_participants'
        ? this.prisma.appointment.findUnique({
            where: { id: dto.audienceId },
            include: { location: true },
          })
        : Promise.resolve(null),
    ]);

    // 3. Create a CampaignRecipient row per contact (status: pending)
    const recipients = await Promise.all(
      contacts.map((c) =>
        this.prisma.campaignRecipient.create({
          data: {
            campaignId: campaign.id,
            contactId: c.id,
            recipient:
              dto.channel === 'EMAIL'
                ? (c.email ?? '')
                : (c.phone ?? c.email ?? ''),
            channel: dto.channel,
            status: 'pending',
            messageBody: this.renderer.renderTemplate(
              dto.template,
              c,
              appointment
                ? {
                    title: appointment.title,
                    scheduledAt: appointment.scheduledAt,
                    locationName: appointment.location?.name,
                  }
                : undefined,
              tenant ? { name: tenant.name } : undefined,
            ),
          },
        }),
      ),
    );

    // 4. Large audience → queue all jobs; small audience → send inline
    if (contacts.length > MESSAGE_BATCH_SIZE) {
      let queued = 0;
      for (const recipient of recipients) {
        const jobData: MessageJobData = {
          jobType:
            dto.channel === 'SMS'
              ? 'sendSMS'
              : dto.channel === 'WHATSAPP'
                ? 'sendWhatsApp'
                : 'sendVoice',
          tenantId,
          to: recipient.recipient,
          body: recipient.messageBody,
          campaignRecipientId: recipient.id,
          campaignId: campaign.id,
          contactId: recipient.contactId ?? undefined,
        };
        await messageQueue.add(
          `broadcast:${campaign.id}:${recipient.id}`,
          jobData,
          {
            jobId: `broadcast-send:${campaign.id}:${recipient.id}`,
          },
        );
        queued++;
      }
      this.logger.log(
        `Broadcast ${campaign.id}: queued ${queued} jobs for background delivery`,
      );
      return {
        campaignId: campaign.id,
        dispatched: queued,
        mode: 'queued',
        message: `${queued} messages queued for delivery`,
      };
    }

    // Small audience — send inline and update status immediately
    let sent = 0;
    let failed = 0;
    for (const recipient of recipients) {
      try {
        const result = await this.messagingService.send(
          tenantId,
          dto.channel,
          recipient.recipient,
          recipient.messageBody,
        );
        await this.prisma.campaignRecipient.update({
          where: { id: recipient.id },
          data: {
            status: result.success ? 'sent' : 'failed',
            sentAt: new Date(),
            errorMessage: result.error,
          },
        });
        if (result.success) {
          sent++;
          if (recipient.contactId) {
            this.prisma.contactActivity
              .create({
                data: {
                  tenantId,
                  contactId: recipient.contactId,
                  activityType: ActivityType.campaign_sent,
                  referenceId: campaign.id,
                  metadata: { channel: dto.channel, campaignName },
                },
              })
              .catch(() => {});
          }
        } else {
          failed++;
        }
      } catch (err: any) {
        await this.prisma.campaignRecipient.update({
          where: { id: recipient.id },
          data: { status: 'failed', errorMessage: err.message },
        });
        failed++;
        this.logger.error(
          `Send failed for recipient ${recipient.id}: ${err.message}`,
        );
      }
    }

    this.logger.log(`Broadcast ${campaign.id}: sent=${sent} failed=${failed}`);
    return {
      campaignId: campaign.id,
      dispatched: contacts.length,
      sent,
      failed,
      mode: 'inline',
    };
  }

  // ── Audience Resolution ───────────────────────────────

  private async resolveAudience(
    tenantId: string,
    type: AudienceType,
    id?: string,
    ids?: string[],
    responseFilter?: string,
    responseStatus?: string,
  ): Promise<ResolvedContact[]> {
    switch (type) {
      case 'contact':
        return this.resolveContact(tenantId, id);

      case 'contacts':
        return this.resolveContacts(tenantId, ids);

      case 'tag':
        return this.resolveByTag(tenantId, id);

      case 'group':
        return this.resolveByGroup(tenantId, id);

      case 'appointment_participants':
        return this.resolveByAppointmentParticipants(tenantId, id);

      case 'campaign':
        return this.resolveByCampaignSegment(tenantId, id);

      case 'campaign_response':
        return this.resolveByCampaignResponse(
          tenantId,
          id,
          responseStatus,
          responseFilter,
        );

      default:
        throw new BadRequestException(`Unknown audienceType: ${type}`);
    }
  }

  private async resolveContact(
    tenantId: string,
    contactId?: string,
  ): Promise<ResolvedContact[]> {
    if (!contactId)
      throw new BadRequestException(
        'audienceId required for audienceType "contact"',
      );
    const c = await this.prisma.contact.findFirst({
      where: { id: contactId, tenantId, unsubscribed: false },
      select: { id: true, name: true, phone: true, email: true },
    });
    if (!c) throw new NotFoundException('Contact not found');
    return [c];
  }

  private async resolveContacts(
    tenantId: string,
    contactIds?: string[],
  ): Promise<ResolvedContact[]> {
    if (!contactIds?.length)
      throw new BadRequestException(
        'audienceIds required for audienceType "contacts"',
      );
    return this.prisma.contact.findMany({
      where: { id: { in: contactIds }, tenantId, unsubscribed: false },
      select: { id: true, name: true, phone: true, email: true },
    });
  }

  private async resolveByTag(
    tenantId: string,
    tagId?: string,
  ): Promise<ResolvedContact[]> {
    if (!tagId)
      throw new BadRequestException(
        'audienceId (tagId) required for audienceType "tag"',
      );
    const tag = await this.prisma.tag.findFirst({
      where: { id: tagId, tenantId },
    });
    if (!tag) throw new NotFoundException('Tag not found');

    const contactTags = await this.prisma.contactTag.findMany({
      where: { tagId },
      include: {
        contact: {
          select: {
            id: true,
            name: true,
            phone: true,
            email: true,
            unsubscribed: true,
            tenantId: true,
          },
        },
      },
    });
    return contactTags
      .map((ct) => ct.contact)
      .filter((c) => c.tenantId === tenantId && !c.unsubscribed)
      .map(({ id, name, phone, email }) => ({ id, name, phone, email }));
  }

  private async resolveByGroup(
    tenantId: string,
    groupId?: string,
  ): Promise<ResolvedContact[]> {
    if (!groupId)
      throw new BadRequestException(
        'audienceId (groupId) required for audienceType "group"',
      );
    const group = await this.prisma.contactGroup.findFirst({
      where: { id: groupId, tenantId },
    });
    if (!group) throw new NotFoundException('Contact group not found');

    const members = await this.prisma.contactGroupMember.findMany({
      where: { groupId },
      include: {
        contact: {
          select: {
            id: true,
            name: true,
            phone: true,
            email: true,
            unsubscribed: true,
            tenantId: true,
          },
        },
      },
    });
    return members
      .map((m) => m.contact)
      .filter((c) => c.tenantId === tenantId && !c.unsubscribed)
      .map(({ id, name, phone, email }) => ({ id, name, phone, email }));
  }

  private async resolveByAppointmentParticipants(
    tenantId: string,
    appointmentId?: string,
  ): Promise<ResolvedContact[]> {
    if (!appointmentId)
      throw new BadRequestException(
        'audienceId (appointmentId) required for audienceType "appointment_participants"',
      );
    const participants = await this.prisma.appointmentParticipant.findMany({
      where: { appointmentId, appointment: { tenantId } },
      include: {
        contact: {
          select: {
            id: true,
            name: true,
            phone: true,
            email: true,
            unsubscribed: true,
          },
        },
      },
    });
    return participants
      .map((p) => p.contact)
      .filter((c) => !c.unsubscribed)
      .map(({ id, name, phone, email }) => ({ id, name, phone, email }));
  }

  /**
   * Resolve contacts who responded to a campaign, filtered by semantic status.
   *
   * Primary path (responseStatus provided — preferred):
   *   SELECT DISTINCT contact_id
   *   FROM message_responses
   *   WHERE broadcast_id = :campaignId
   *     AND tenant_id   = :tenantId
   *     AND response_status = :responseStatus   -- 'confirmed' | 'cancelled' | 'pending'
   *
   * Fallback (responseFilter provided — legacy text match):
   *   Queries CampaignRecipient.responseText with case-insensitive exact match.
   *
   * If neither is given, all responded contacts from message_responses are returned.
   */
  private async resolveByCampaignResponse(
    tenantId: string,
    campaignId?: string,
    responseStatus?: string,
    responseFilter?: string,
  ): Promise<ResolvedContact[]> {
    if (!campaignId)
      throw new BadRequestException(
        'audienceId (campaignId) required for audienceType "campaign_response"',
      );

    const campaign = await this.prisma.campaign.findFirst({
      where: { id: campaignId, tenantId },
    });
    if (!campaign) throw new NotFoundException('Campaign not found');

    // ── Primary: semantic status filter via message_responses ──────────────
    if (responseStatus || !responseFilter) {
      const where: any = {
        broadcastId: campaignId,
        tenantId,
        contactId: { not: null },
      };
      if (responseStatus) where.responseStatus = responseStatus;

      const responses = await this.prisma.messageResponse.findMany({
        where,
        select: { contactId: true },
        distinct: ['contactId'],
      });

      const contactIds = responses
        .map((r) => r.contactId)
        .filter(Boolean) as string[];
      if (contactIds.length === 0) return [];

      return this.prisma.contact.findMany({
        where: { id: { in: contactIds }, tenantId, unsubscribed: false },
        select: { id: true, name: true, phone: true, email: true },
      });
    }

    // ── Fallback: raw text match via campaign_recipients (legacy) ──────────
    const recipients = await this.prisma.campaignRecipient.findMany({
      where: {
        campaignId,
        status: 'responded',
        respondedAt: { not: null },
        responseText: { equals: responseFilter, mode: 'insensitive' as const },
        contactId: { not: null },
      },
      include: {
        contact: {
          select: {
            id: true,
            name: true,
            phone: true,
            email: true,
            unsubscribed: true,
          },
        },
      },
    });

    return recipients
      .map((r) => r.contact!)
      .filter((c) => c && !c.unsubscribed)
      .map(({ id, name, phone, email }) => ({ id, name, phone, email }));
  }

  private async resolveByCampaignSegment(
    tenantId: string,
    segmentId?: string,
  ): Promise<ResolvedContact[]> {
    if (!segmentId)
      throw new BadRequestException(
        'audienceId (segmentId) required for audienceType "campaign"',
      );
    const segment = await this.prisma.audienceSegment.findFirst({
      where: { id: segmentId, campaign: { tenantId } },
      include: { tag: true },
    });
    if (!segment) throw new NotFoundException('Audience segment not found');

    if (!segment.tagId) {
      return this.prisma.contact.findMany({
        where: { tenantId, unsubscribed: false },
        select: { id: true, name: true, phone: true, email: true },
      });
    }
    return this.resolveByTag(tenantId, segment.tagId);
  }
}
