import {
  Injectable,
  Logger,
  NotFoundException,
  BadRequestException,
} from '@nestjs/common';
import { Queue } from 'bullmq';
import { PrismaService } from '../../prisma/prisma.service';
import {
  CreateCampaignDto,
  UpdateCampaignDto,
  CreateSegmentDto,
  UpdateSegmentDto,
  CreateTagDto,
  AssignTagsDto,
  DispatchCampaignDto,
} from './dto/campaign.dto';
import {
  CAMPAIGN_QUEUE,
  getRedisConnection,
  CampaignJobData,
} from '../../queue/queue.config';

// Threshold above which sends are queued rather than processed inline
const LARGE_AUDIENCE_THRESHOLD = 100;

@Injectable()
export class CampaignService {
  private readonly logger = new Logger(CampaignService.name);
  private readonly campaignQueue: Queue<CampaignJobData>;

  constructor(private readonly prisma: PrismaService) {
    this.campaignQueue = new Queue<CampaignJobData>(CAMPAIGN_QUEUE, {
      connection: getRedisConnection(),
      limiter: {
        max: parseInt(process.env.CAMPAIGN_RATE_LIMIT_MAX ?? '50', 10),
        duration: parseInt(
          process.env.CAMPAIGN_RATE_LIMIT_DURATION ?? '1000',
          10,
        ),
      },
    } as any);
  }

  // ── Campaigns ─────────────────────────────

  async createCampaign(tenantId: string, dto: CreateCampaignDto) {
    const campaign = await this.prisma.campaign.create({
      data: {
        tenantId,
        name: dto.name,
        description: dto.description,
        body: dto.body,
        channel: dto.channel,
        scheduledAt: dto.scheduledAt ? new Date(dto.scheduledAt) : undefined,
        status: dto.status ?? 'draft',
      } as any,
      include: { segments: true },
    });
    this.logger.log(
      `Campaign created: ${campaign.id} ("${campaign.name}") for tenant ${tenantId}`,
    );
    return campaign;
  }

  async findAllCampaigns(tenantId: string) {
    return this.prisma.campaign.findMany({
      where: { tenantId },
      include: { segments: { include: { tag: true } } },
      orderBy: { createdAt: 'desc' },
    });
  }

  async findOneCampaign(tenantId: string, id: string) {
    const campaign = await this.prisma.campaign.findFirst({
      where: { id, tenantId },
      include: { segments: { include: { tag: true } } },
    });
    if (!campaign) throw new NotFoundException('Campaign not found');
    return campaign;
  }

  async updateCampaign(tenantId: string, id: string, dto: UpdateCampaignDto) {
    await this.findOneCampaign(tenantId, id);
    return this.prisma.campaign.update({
      where: { id },
      data: {
        ...(dto.name !== undefined && { name: dto.name }),
        ...(dto.description !== undefined && { description: dto.description }),
        ...(dto.body !== undefined && { body: dto.body }),
        ...(dto.channel !== undefined && { channel: dto.channel }),
        ...(dto.scheduledAt !== undefined && {
          scheduledAt: dto.scheduledAt ? new Date(dto.scheduledAt) : null,
        }),
        ...(dto.status !== undefined && { status: dto.status }),
      } as any,
      include: { segments: { include: { tag: true } } },
    });
  }

  async removeCampaign(tenantId: string, id: string) {
    await this.findOneCampaign(tenantId, id);
    await this.prisma.campaign.delete({ where: { id } });
    return { deleted: true };
  }

  async getRecipients(tenantId: string, campaignId: string) {
    await this.findOneCampaign(tenantId, campaignId); // ownership check
    return this.prisma.campaignRecipient.findMany({
      where: { campaignId },
      include: {
        contact: { select: { id: true, name: true, phone: true, email: true } },
        messageResponse: {
          select: {
            id: true,
            responseStatus: true,
            responseText: true,
            timestamp: true,
          },
        },
      },
      orderBy: { createdAt: 'asc' },
    });
  }

  async getResponses(tenantId: string, campaignId: string) {
    await this.findOneCampaign(tenantId, campaignId); // ownership check
    return this.prisma.messageResponse.findMany({
      where: { broadcastId: campaignId, tenantId },
      include: {
        contact: { select: { id: true, name: true, phone: true, email: true } },
      },
      orderBy: { timestamp: 'desc' },
    });
  }

  /**
   * Response dashboard — per-contact rows with enriched group/tag data.
   * Filters: status (confirmed|cancelled|pending), tagId, groupId, segmentId.
   * Route: GET /campaigns/:id/responses/dashboard
   */
  async getResponseDashboard(
    tenantId: string,
    campaignId: string,
    filters: {
      status?: string;
      tagId?: string;
      groupId?: string;
      segmentId?: string;
    },
  ) {
    await this.findOneCampaign(tenantId, campaignId);

    // Resolve a contact-ID subset for scope filters (segment / group / tag)
    let contactIdSubset: string[] | undefined;
    if (filters.segmentId) {
      const contacts = await this.resolveAudience(tenantId, filters.segmentId);
      contactIdSubset = contacts.map((c) => c.id);
    } else if (filters.groupId) {
      const members = await this.prisma.contactGroupMember.findMany({
        where: { groupId: filters.groupId },
        select: { contactId: true },
      });
      contactIdSubset = members.map((m) => m.contactId);
    } else if (filters.tagId) {
      const contactTags = await this.prisma.contactTag.findMany({
        where: { tagId: filters.tagId },
        select: { contactId: true },
      });
      contactIdSubset = contactTags.map((ct) => ct.contactId);
    }

    const where: any = { broadcastId: campaignId, tenantId };
    if (filters.status) where.responseStatus = filters.status;
    if (contactIdSubset !== undefined)
      where.contactId = { in: contactIdSubset };

    const rows = await this.prisma.messageResponse.findMany({
      where,
      include: {
        contact: {
          select: {
            id: true,
            name: true,
            phone: true,
            email: true,
            contactTags: {
              include: { tag: { select: { id: true, name: true } } },
            },
            groupMemberships: {
              include: { group: { select: { id: true, name: true } } },
            },
          },
        },
      },
      orderBy: { timestamp: 'desc' },
    });

    return rows.map((r) => ({
      id: r.id,
      responseStatus: r.responseStatus,
      responseText: r.responseText,
      timestamp: r.timestamp,
      contact: r.contact
        ? {
            id: r.contact.id,
            name: r.contact.name,
            phone: r.contact.phone,
            email: r.contact.email,
            tags: r.contact.contactTags.map((ct) => ({
              id: ct.tag.id,
              name: ct.tag.name,
            })),
            groups: r.contact.groupMemberships.map((gm) => ({
              id: gm.group.id,
              name: gm.group.name,
            })),
          }
        : null,
    }));
  }

  // ── Audience Segments ─────────────────────

  async createSegment(
    tenantId: string,
    campaignId: string,
    dto: CreateSegmentDto,
  ) {
    await this.findOneCampaign(tenantId, campaignId);

    // Validate tag belongs to tenant if provided
    if (dto.tagId) {
      const tag = await this.prisma.tag.findFirst({
        where: { id: dto.tagId, tenantId },
      });
      if (!tag) throw new NotFoundException('Tag not found');
    }

    return this.prisma.audienceSegment.create({
      data: { campaignId, name: dto.name, tagId: dto.tagId },
      include: { tag: true },
    });
  }

  async findSegments(tenantId: string, campaignId: string) {
    await this.findOneCampaign(tenantId, campaignId);
    return this.prisma.audienceSegment.findMany({
      where: { campaignId },
      include: { tag: true },
      orderBy: { createdAt: 'asc' },
    });
  }

  async updateSegment(
    tenantId: string,
    campaignId: string,
    segmentId: string,
    dto: UpdateSegmentDto,
  ) {
    await this.findOneCampaign(tenantId, campaignId);
    const segment = await this.prisma.audienceSegment.findFirst({
      where: { id: segmentId, campaignId },
    });
    if (!segment) throw new NotFoundException('Audience segment not found');

    if (dto.tagId) {
      const tag = await this.prisma.tag.findFirst({
        where: { id: dto.tagId, tenantId },
      });
      if (!tag) throw new NotFoundException('Tag not found');
    }

    return this.prisma.audienceSegment.update({
      where: { id: segmentId },
      data: {
        ...(dto.name !== undefined && { name: dto.name }),
        ...(dto.tagId !== undefined && { tagId: dto.tagId }),
      },
      include: { tag: true },
    });
  }

  async removeSegment(tenantId: string, campaignId: string, segmentId: string) {
    await this.findOneCampaign(tenantId, campaignId);
    const segment = await this.prisma.audienceSegment.findFirst({
      where: { id: segmentId, campaignId },
    });
    if (!segment) throw new NotFoundException('Audience segment not found');
    await this.prisma.audienceSegment.delete({ where: { id: segmentId } });
    return { deleted: true };
  }

  // ── Tags ──────────────────────────────────

  async createTag(tenantId: string, dto: CreateTagDto) {
    const normalised = dto.name.trim().toLowerCase();
    const existing = await this.prisma.tag.findFirst({
      where: { tenantId, name: normalised },
    });
    if (existing) return existing;

    const tag = await this.prisma.tag.create({
      data: { tenantId, name: normalised },
    });
    this.logger.log(`Tag created: "${normalised}" for tenant ${tenantId}`);
    return tag;
  }

  async findAllTags(tenantId: string) {
    return this.prisma.tag.findMany({
      where: { tenantId },
      orderBy: { name: 'asc' },
      include: { _count: { select: { contactTags: true } } },
    });
  }

  async removeTag(tenantId: string, tagId: string) {
    const tag = await this.prisma.tag.findFirst({
      where: { id: tagId, tenantId },
    });
    if (!tag) throw new NotFoundException('Tag not found');
    await this.prisma.tag.delete({ where: { id: tagId } });
    return { deleted: true };
  }

  async assignTags(tenantId: string, dto: AssignTagsDto) {
    // Validate all tags belong to this tenant
    const tags = await this.prisma.tag.findMany({
      where: { id: { in: dto.tagIds }, tenantId },
    });
    if (tags.length !== dto.tagIds.length)
      throw new BadRequestException('One or more tags not found');

    // Validate all contacts belong to this tenant
    const contacts = await this.prisma.contact.findMany({
      where: { id: { in: dto.contactIds }, tenantId },
    });
    if (contacts.length !== dto.contactIds.length)
      throw new BadRequestException('One or more contacts not found');

    let assigned = 0;
    for (const contactId of dto.contactIds) {
      for (const tagId of dto.tagIds) {
        await this.prisma.contactTag.upsert({
          where: { contactId_tagId: { contactId, tagId } },
          create: { contactId, tagId },
          update: {},
        });
        assigned++;
      }
    }

    return { assigned };
  }

  async removeTagFromContact(
    tenantId: string,
    contactId: string,
    tagId: string,
  ) {
    const contact = await this.prisma.contact.findFirst({
      where: { id: contactId, tenantId },
    });
    if (!contact) throw new NotFoundException('Contact not found');

    await this.prisma.contactTag.deleteMany({ where: { contactId, tagId } });
    return { removed: true };
  }

  // ── Audience Resolution ───────────────────

  async resolveAudience(
    tenantId: string,
    segmentId: string,
  ): Promise<
    { id: string; phone: string | null; email: string | null; name: string }[]
  > {
    const segment = await this.prisma.audienceSegment.findFirst({
      where: { id: segmentId, campaign: { tenantId } },
      include: { tag: true },
    });

    if (!segment) throw new NotFoundException('Audience segment not found');

    if (!segment.tagId) {
      // No tag filter — return all active contacts for the tenant
      return this.prisma.contact.findMany({
        where: { tenantId, unsubscribed: false },
        select: { id: true, phone: true, email: true, name: true },
      });
    }

    // Contacts linked via ContactTag join table
    const contactTags = await this.prisma.contactTag.findMany({
      where: { tagId: segment.tagId },
      include: {
        contact: {
          select: {
            id: true,
            phone: true,
            email: true,
            name: true,
            unsubscribed: true,
            tenantId: true,
          },
        },
      },
    });

    return contactTags
      .map((ct) => ct.contact)
      .filter((c) => c.tenantId === tenantId && !c.unsubscribed)
      .map(({ id, phone, email, name }) => ({ id, phone, email, name }));
  }

  // ── Campaign Dispatch ─────────────────────

  async dispatchCampaign(
    tenantId: string,
    campaignId: string,
    dto: DispatchCampaignDto,
  ) {
    await this.findOneCampaign(tenantId, campaignId);

    const audience = await this.resolveAudience(tenantId, dto.segmentId);
    const audienceSize = audience.length;

    // Fetch location info if this campaign is tied to an appointment
    const appointment = await this.prisma.appointment.findFirst({
      where: { campaignId, tenantId },
      include: { location: true },
    });
    const locationName = appointment?.location?.name;

    if (audienceSize === 0) {
      return { queued: 0, message: 'No eligible contacts in segment' };
    }

    const scheduledAt = new Date(dto.scheduledAt);

    if (audienceSize > LARGE_AUDIENCE_THRESHOLD) {
      // Large audience → push one job per contact to BullMQ
      const delay = Math.max(0, scheduledAt.getTime() - Date.now());
      let queued = 0;

      for (const contact of audience) {
        const jobData: CampaignJobData = {
          tenantId,
          campaignId,
          segmentId: dto.segmentId,
          contactId: contact.id,
          recipient: contact.phone || contact.email || '',
          channel: dto.channel,
          messageTemplate: dto.messageTemplate,
          scheduledFor: scheduledAt.toISOString(),
          contactName: contact.name,
          locationName,
        };

        await this.campaignQueue.add(
          `campaign:${campaignId}:${contact.id}`,
          jobData,
          {
            delay,
            attempts: parseInt(process.env.CAMPAIGN_JOB_ATTEMPTS ?? '3', 10),
            backoff: {
              type: 'exponential',
              delay: parseInt(process.env.CAMPAIGN_BACKOFF_DELAY ?? '2000', 10),
            },
            removeOnComplete: { count: 100 },
            removeOnFail: { count: 50 },
            jobId: `campaign-send:${campaignId}:${contact.id}`,
          },
        );
        queued++;
      }

      this.logger.log(
        `Campaign ${campaignId}: queued ${queued} jobs (large audience path)`,
      );
      return {
        queued,
        message: `${queued} messages queued for background delivery`,
      };
    }

    // Small audience (≤100) → process inline in the same request cycle
    const delay = Math.max(0, scheduledAt.getTime() - Date.now());
    let queued = 0;

    for (const contact of audience) {
      const jobData: CampaignJobData = {
        tenantId,
        campaignId,
        segmentId: dto.segmentId,
        contactId: contact.id,
        recipient: contact.phone || contact.email || '',
        channel: dto.channel,
        messageTemplate: dto.messageTemplate,
        scheduledFor: scheduledAt.toISOString(),
        contactName: contact.name,
        locationName,
      };

      await this.campaignQueue.add(
        `campaign:${campaignId}:${contact.id}`,
        jobData,
        {
          delay,
          attempts: parseInt(process.env.CAMPAIGN_JOB_ATTEMPTS ?? '3', 10),
          backoff: {
            type: 'exponential',
            delay: parseInt(process.env.CAMPAIGN_BACKOFF_DELAY ?? '2000', 10),
          },
          removeOnComplete: { count: 100 },
          removeOnFail: { count: 50 },
          jobId: `campaign-send:${campaignId}:${contact.id}`,
        },
      );
      queued++;
    }

    this.logger.log(
      `Campaign ${campaignId}: queued ${queued} jobs (small audience path)`,
    );
    return { queued, message: `${queued} messages scheduled` };
  }

  // ── Segment contact count ─────────────────

  async getSegmentContactCount(tenantId: string, segmentId: string) {
    const contacts = await this.resolveAudience(tenantId, segmentId);
    return { count: contacts.length };
  }

  // ── Response Stats ────────────────────────────

  /** Shared helper — converts Prisma groupBy rows + total into a uniform stats object */
  private buildStatsSummary(
    scopeName: string,
    scopeId: string,
    total: number,
    rows: Array<{ responseStatus: string; _count: { responseStatus: number } }>,
  ) {
    const confirmed =
      rows.find((r) => r.responseStatus === 'confirmed')?._count
        .responseStatus ?? 0;
    const cancelled =
      rows.find((r) => r.responseStatus === 'cancelled')?._count
        .responseStatus ?? 0;
    const pending =
      rows.find((r) => r.responseStatus === 'pending')?._count.responseStatus ??
      0;
    const responded = confirmed + cancelled + pending;
    return {
      scopeName,
      scopeId,
      total,
      confirmed,
      cancelled,
      pending,
      noResponse: Math.max(0, total - responded),
    };
  }

  /** Campaign-level: SELECT response_status, COUNT(*) FROM message_responses WHERE broadcast_id = ? GROUP BY response_status */
  async getResponseStats(tenantId: string, campaignId: string) {
    const campaign = await this.findOneCampaign(tenantId, campaignId);
    const [rows, total] = await Promise.all([
      this.prisma.messageResponse.groupBy({
        by: ['responseStatus'],
        where: { broadcastId: campaignId, tenantId },
        _count: { responseStatus: true },
      }),
      this.prisma.campaignRecipient.count({ where: { campaignId } }),
    ]);
    return this.buildStatsSummary(
      campaign.name,
      campaignId,
      total,
      rows as any,
    );
  }

  /** Segment-level: resolve segment → contact IDs → filter stats */
  async getResponseStatsBySegment(
    tenantId: string,
    campaignId: string,
    segmentId: string,
  ) {
    await this.findOneCampaign(tenantId, campaignId);
    const segment = await this.prisma.audienceSegment.findFirst({
      where: { id: segmentId, campaignId },
    });
    if (!segment) throw new NotFoundException('Segment not found');

    const contacts = await this.resolveAudience(tenantId, segmentId);
    const contactIds = contacts.map((c) => c.id);

    const [rows, total] = await Promise.all([
      this.prisma.messageResponse.groupBy({
        by: ['responseStatus'],
        where: {
          broadcastId: campaignId,
          tenantId,
          contactId: { in: contactIds },
        },
        _count: { responseStatus: true },
      }),
      this.prisma.campaignRecipient.count({
        where: { campaignId, contactId: { in: contactIds } },
      }),
    ]);
    return this.buildStatsSummary(segment.name, segmentId, total, rows as any);
  }

  /** Tag-level: contacts with tag → filter stats */
  async getResponseStatsByTag(
    tenantId: string,
    campaignId: string,
    tagId: string,
  ) {
    await this.findOneCampaign(tenantId, campaignId);
    const tag = await this.prisma.tag.findFirst({
      where: { id: tagId, tenantId },
    });
    if (!tag) throw new NotFoundException('Tag not found');

    const contactTags = await this.prisma.contactTag.findMany({
      where: { tagId },
      select: { contactId: true },
    });
    const contactIds = contactTags.map((ct) => ct.contactId);

    const [rows, total] = await Promise.all([
      this.prisma.messageResponse.groupBy({
        by: ['responseStatus'],
        where: {
          broadcastId: campaignId,
          tenantId,
          contactId: { in: contactIds },
        },
        _count: { responseStatus: true },
      }),
      this.prisma.campaignRecipient.count({
        where: { campaignId, contactId: { in: contactIds } },
      }),
    ]);
    return this.buildStatsSummary(tag.name, tagId, total, rows as any);
  }

  /** Group-level: group members → filter stats */
  async getResponseStatsByGroup(
    tenantId: string,
    campaignId: string,
    groupId: string,
  ) {
    await this.findOneCampaign(tenantId, campaignId);
    const group = await this.prisma.contactGroup.findFirst({
      where: { id: groupId, tenantId },
    });
    if (!group) throw new NotFoundException('Group not found');

    const members = await this.prisma.contactGroupMember.findMany({
      where: { groupId },
      select: { contactId: true },
    });
    const contactIds = members.map((m) => m.contactId);

    const [rows, total] = await Promise.all([
      this.prisma.messageResponse.groupBy({
        by: ['responseStatus'],
        where: {
          broadcastId: campaignId,
          tenantId,
          contactId: { in: contactIds },
        },
        _count: { responseStatus: true },
      }),
      this.prisma.campaignRecipient.count({
        where: { campaignId, contactId: { in: contactIds } },
      }),
    ]);
    return this.buildStatsSummary(group.name, groupId, total, rows as any);
  }

  /** Appointment-level: participants → filter stats */
  async getResponseStatsByAppointment(
    tenantId: string,
    campaignId: string,
    appointmentId: string,
  ) {
    await this.findOneCampaign(tenantId, campaignId);
    const appointment = await this.prisma.appointment.findFirst({
      where: { id: appointmentId, tenantId },
      select: { id: true, title: true },
    });
    if (!appointment) throw new NotFoundException('Appointment not found');

    const participants = await this.prisma.appointmentParticipant.findMany({
      where: { appointmentId },
      select: { contactId: true },
    });
    const contactIds = participants.map((p) => p.contactId);

    const [rows, total] = await Promise.all([
      this.prisma.messageResponse.groupBy({
        by: ['responseStatus'],
        where: {
          broadcastId: campaignId,
          tenantId,
          contactId: { in: contactIds },
        },
        _count: { responseStatus: true },
      }),
      this.prisma.campaignRecipient.count({
        where: { campaignId, contactId: { in: contactIds } },
      }),
    ]);
    return this.buildStatsSummary(
      appointment.title,
      appointmentId,
      total,
      rows as any,
    );
  }

  /**
   * Combined stats for a campaign card — campaign + all its segments + per-tag
   * (single API call from frontend instead of N+1)
   */
  async getResponseStatsAll(tenantId: string, campaignId: string) {
    const campaign = await this.findOneCampaign(tenantId, campaignId);

    const [campaignStats, segmentStats] = await Promise.all([
      this.getResponseStats(tenantId, campaignId),
      Promise.all(
        campaign.segments.map((seg) =>
          this.getResponseStatsBySegment(tenantId, campaignId, seg.id),
        ),
      ),
    ]);

    // Per-tag stats only for segments that are backed by a tag
    const tagSegments = campaign.segments.filter((s) => s.tag);
    const tagStats = await Promise.all(
      tagSegments.map((s) =>
        this.getResponseStatsByTag(tenantId, campaignId, s.tag!.id),
      ),
    );

    return { campaign: campaignStats, segments: segmentStats, tags: tagStats };
  }

  // Graceful shutdown: close BullMQ connection
  async onModuleDestroy() {
    await this.campaignQueue.close();
  }
}
