import {
  Injectable,
  Logger,
  NotFoundException,
  ConflictException,
} from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import {
  CreateContactDto,
  UpdateContactDto,
  ContactQueryDto,
  BulkTagDto,
  BulkDeleteDto,
  CreateGroupDto,
  AddMembersDto,
  CreateTagDto,
  AssignTagDto,
} from './dto/contact.dto';
import { Prisma, ActivityType } from '@prisma/client';

@Injectable()
export class ContactsService {
  private readonly logger = new Logger(ContactsService.name);

  constructor(private readonly prisma: PrismaService) {}

  // ── Create ────────────────────────────────

  async create(tenantId: string, dto: CreateContactDto) {
    // Prevent duplicate contacts by phone/email within same tenant
    const duplicate = await this.prisma.contact.findFirst({
      where: {
        tenantId,
        OR: [
          ...(dto.phone ? [{ phone: dto.phone }] : []),
          ...(dto.email ? [{ email: dto.email }] : []),
        ],
      },
    });

    if (duplicate) {
      throw new ConflictException(
        'A contact with this phone or email already exists for this tenant',
      );
    }

    const contact = await this.prisma.contact.create({
      data: {
        tenantId,
        name: dto.name,
        phone: dto.phone,
        email: dto.email,
        tags: dto.tags ?? [],
        notes: dto.notes,
      },
    });
    if (dto.tags && dto.tags.length > 0) {
      await this.syncTags(tenantId, contact.id, dto.tags);
    }
    this.prisma.contactActivity
      .create({
        data: {
          tenantId,
          contactId: contact.id,
          activityType: ActivityType.contact_created,
          metadata: { name: contact.name },
        },
      })
      .catch(() => {});
    this.logger.log(`Contact created: ${contact.id} for tenant ${tenantId}`);
    return contact;
  }

  // ── List / search ─────────────────────────

  async findAll(tenantId: string, query: ContactQueryDto) {
    const { search, tag, unsubscribed, page = 1, limit = 20 } = query;
    const skip = (page - 1) * limit;

    const where: Prisma.ContactWhereInput = { tenantId };

    if (search) {
      where.OR = [
        { name: { contains: search, mode: 'insensitive' } },
        { email: { contains: search, mode: 'insensitive' } },
        { phone: { contains: search } },
      ];
    }

    if (tag) {
      where.tags = { has: tag.toLowerCase() };
    }

    if (unsubscribed !== undefined) {
      where.unsubscribed = unsubscribed;
    }

    const [data, total] = await Promise.all([
      this.prisma.contact.findMany({
        where,
        orderBy: { createdAt: 'desc' },
        skip,
        take: limit,
      }),
      this.prisma.contact.count({ where }),
    ]);

    return {
      data,
      total,
      page,
      limit,
      totalPages: Math.ceil(total / limit),
    };
  }

  // ── Single contact ────────────────────────

  async findOne(tenantId: string, id: string) {
    const contact = await this.prisma.contact.findFirst({
      where: { id, tenantId },
    });
    if (!contact) throw new NotFoundException('Contact not found');

    // Fetch appointment history for this contact
    const appointments = await this.prisma.appointment.findMany({
      where: {
        tenantId,
        OR: [
          { customer: { email: contact.email ?? undefined } },
          { customer: { phone: contact.phone ?? undefined } },
        ],
      },
      orderBy: { scheduledAt: 'desc' },
      take: 10,
      select: {
        id: true,
        title: true,
        scheduledAt: true,
        status: true,
        durationMinutes: true,
      },
    });

    return { ...contact, appointments };
  }

  async getActivity(tenantId: string, id: string) {
    // verify contact exists
    const contact = await this.prisma.contact.findFirst({
      where: { id, tenantId },
    });
    if (!contact) throw new NotFoundException('Contact not found');

    return this.prisma.contactActivity.findMany({
      where: { contactId: id, tenantId },
      orderBy: { createdAt: 'desc' },
      take: 50,
    });
  }

  /**
   * Reminders for a contact, with their appointment and — crucially — any
   * FailedReminder row so send failures (e.g. INVALID_PHONE_FORMAT) are
   * surfaced in the UI instead of vanishing. Matches both directly-linked
   * reminders (contactId) and appointment reminders reached via the
   * appointment's participant, so pending reminders whose contactId wasn't
   * backfilled still appear.
   */
  async getReminders(tenantId: string, id: string) {
    const contact = await this.prisma.contact.findFirst({
      where: { id, tenantId },
    });
    if (!contact) throw new NotFoundException('Contact not found');

    return this.prisma.reminder.findMany({
      where: {
        tenantId,
        OR: [
          { contactId: id },
          { appointment: { participants: { some: { contactId: id } } } },
        ],
      },
      include: {
        appointment: {
          select: { id: true, title: true, scheduledAt: true, status: true },
        },
        failedReminder: {
          select: {
            errorCode: true,
            errorMessage: true,
            retryCount: true,
            resolvedAt: true,
            createdAt: true,
          },
        },
      },
      orderBy: { scheduledSendTime: 'desc' },
      take: 100,
    });
  }

  /** Outbound/inbound message logs for a contact (direct or via reminder). */
  async getMessages(tenantId: string, id: string) {
    const contact = await this.prisma.contact.findFirst({
      where: { id, tenantId },
    });
    if (!contact) throw new NotFoundException('Contact not found');

    return this.prisma.messageLog.findMany({
      where: {
        tenantId,
        OR: [{ contactId: id }, { reminder: { contactId: id } }],
      },
      orderBy: { createdAt: 'desc' },
      take: 100,
    });
  }

  // ── Update ────────────────────────────────

  async update(tenantId: string, id: string, dto: UpdateContactDto) {
    const existing = await this.prisma.contact.findFirst({
      where: { id, tenantId },
    });
    if (!existing) throw new NotFoundException('Contact not found');

    const contact = await this.prisma.contact.update({
      where: { id },
      data: {
        ...(dto.name !== undefined && { name: dto.name }),
        ...(dto.phone !== undefined && { phone: dto.phone }),
        ...(dto.email !== undefined && { email: dto.email }),
        ...(dto.tags !== undefined && { tags: dto.tags }),
        ...(dto.notes !== undefined && { notes: dto.notes }),
        ...(dto.unsubscribed !== undefined && {
          unsubscribed: dto.unsubscribed,
        }),
      },
    });

    if (dto.tags !== undefined) {
      await this.syncTags(tenantId, id, dto.tags);
    }

    return contact;
  }

  // ── Delete ────────────────────────────────

  async remove(tenantId: string, id: string) {
    const existing = await this.prisma.contact.findFirst({
      where: { id, tenantId },
    });
    if (!existing) throw new NotFoundException('Contact not found');

    await this.prisma.contact.delete({ where: { id } });
    return { deleted: true };
  }

  // ── Bulk tag ──────────────────────────────

  async bulkTag(tenantId: string, dto: BulkTagDto) {
    const newTags = dto.tags.map((t) => t.trim().toLowerCase()).filter(Boolean);

    // Use raw update to merge tags (append without duplicates)
    const contacts = await this.prisma.contact.findMany({
      where: { id: { in: dto.contactIds }, tenantId },
      select: { id: true, tags: true },
    });

    let updated = 0;
    for (const contact of contacts) {
      const merged = Array.from(new Set([...contact.tags, ...newTags]));
      await this.prisma.contact.update({
        where: { id: contact.id },
        data: { tags: merged },
      });
      await this.syncTags(tenantId, contact.id, merged);
      updated++;
    }

    return { updated };
  }

  // ── Bulk delete ───────────────────────────

  async bulkDelete(tenantId: string, dto: BulkDeleteDto) {
    const { count } = await this.prisma.contact.deleteMany({
      where: { id: { in: dto.contactIds }, tenantId },
    });
    return { deleted: count };
  }

  // ── All tags for tenant ───────────────────

  async getAllTags(tenantId: string) {
    return this.prisma.tag.findMany({
      where: { tenantId },
      orderBy: { name: 'asc' },
    });
  }

  async getAllGroups(tenantId: string) {
    return this.prisma.contactGroup.findMany({
      where: { tenantId },
      orderBy: { name: 'asc' },
      include: {
        _count: {
          select: { members: true },
        },
      },
    });
  }

  async createGroup(tenantId: string, dto: CreateGroupDto) {
    const existing = await this.prisma.contactGroup.findFirst({
      where: { tenantId, name: dto.name.trim() },
    });
    if (existing) throw new ConflictException('Group name already exists');

    return this.prisma.contactGroup.create({
      data: {
        tenantId,
        name: dto.name.trim(),
      },
    });
  }

  async addMembersToGroup(
    tenantId: string,
    groupId: string,
    dto: AddMembersDto,
  ) {
    const group = await this.prisma.contactGroup.findFirst({
      where: { id: groupId, tenantId },
    });
    if (!group) throw new NotFoundException('Group not found');

    return this.prisma.$transaction(
      dto.contactIds.map((contactId) =>
        this.prisma.contactGroupMember.upsert({
          where: { groupId_contactId: { groupId, contactId } },
          create: { groupId, contactId },
          update: {},
        }),
      ),
    );
  }

  async removeMemberFromGroup(
    tenantId: string,
    groupId: string,
    contactId: string,
  ) {
    const group = await this.prisma.contactGroup.findFirst({
      where: { id: groupId, tenantId },
    });
    if (!group) throw new NotFoundException('Group not found');

    return this.prisma.contactGroupMember.deleteMany({
      where: { groupId, contactId },
    });
  }

  async createTag(tenantId: string, dto: CreateTagDto) {
    const name = dto.name.trim().toLowerCase();
    const existing = await this.prisma.tag.findFirst({
      where: { tenantId, name },
    });
    if (existing) throw new ConflictException('Tag already exists');

    return this.prisma.tag.create({
      data: {
        tenantId,
        name,
      },
    });
  }

  async assignTagToContact(
    tenantId: string,
    contactId: string,
    dto: AssignTagDto,
  ) {
    const contact = await this.prisma.contact.findFirst({
      where: { id: contactId, tenantId },
    });
    if (!contact) throw new NotFoundException('Contact not found');

    const tag = await this.prisma.tag.findFirst({
      where: { id: dto.tagId, tenantId },
    });
    if (!tag) throw new NotFoundException('Tag not found');

    try {
      const link = await this.prisma.contactTag.create({
        data: { contactId, tagId: dto.tagId },
      });

      // Update the tags array on the contact model for backward compatibility
      const currentTags = contact.tags || [];
      if (!currentTags.includes(tag.name)) {
        await this.prisma.contact.update({
          where: { id: contactId },
          data: { tags: [...currentTags, tag.name] },
        });
      }

      await this.prisma.contactActivity.create({
        data: {
          tenantId,
          contactId,
          activityType: ActivityType.tag_added,
          metadata: { tag: tag.name },
        },
      });

      return link;
    } catch (err: any) {
      if (err?.code === 'P2002')
        throw new ConflictException('Tag is already assigned to this contact');
      throw err;
    }
  }

  async getContactGroups(tenantId: string, contactId: string) {
    const contact = await this.prisma.contact.findFirst({
      where: { id: contactId, tenantId },
    });
    if (!contact) throw new NotFoundException('Contact not found');

    return this.prisma.contactGroupMember.findMany({
      where: { contactId },
      include: { group: { select: { id: true, name: true } } },
      orderBy: { group: { name: 'asc' } },
    });
  }

  async addContactToGroup(
    tenantId: string,
    contactId: string,
    groupId?: string,
    groupName?: string,
  ) {
    const contact = await this.prisma.contact.findFirst({
      where: { id: contactId, tenantId },
    });
    if (!contact) throw new NotFoundException('Contact not found');

    let resolvedGroupId = groupId;

    if (!resolvedGroupId && groupName) {
      const group = await this.prisma.contactGroup.upsert({
        where: { tenantId_name: { tenantId, name: groupName.trim() } },
        create: { tenantId, name: groupName.trim() },
        update: {},
      });
      resolvedGroupId = group.id;
    }

    if (!resolvedGroupId) throw new NotFoundException('Group not found');

    const group = await this.prisma.contactGroup.findFirst({
      where: { id: resolvedGroupId, tenantId },
    });
    if (!group) throw new NotFoundException('Group not found');

    try {
      await this.prisma.contactGroupMember.create({
        data: { groupId: resolvedGroupId, contactId },
      });
    } catch (err: any) {
      if (err?.code === 'P2002')
        throw new ConflictException('Contact is already in this group');
      throw err;
    }

    return { groupId: resolvedGroupId, name: group.name };
  }

  async removeContactFromGroup(
    tenantId: string,
    contactId: string,
    groupId: string,
  ) {
    const contact = await this.prisma.contact.findFirst({
      where: { id: contactId, tenantId },
    });
    if (!contact) throw new NotFoundException('Contact not found');

    await this.prisma.contactGroupMember.deleteMany({
      where: { contactId, groupId },
    });
    return { success: true };
  }

  // ── Stats ─────────────────────────────────

  async getStats(tenantId: string) {
    const [total, unsubscribed, withPhone, withEmail] = await Promise.all([
      this.prisma.contact.count({ where: { tenantId } }),
      this.prisma.contact.count({ where: { tenantId, unsubscribed: true } }),
      this.prisma.contact.count({ where: { tenantId, phone: { not: null } } }),
      this.prisma.contact.count({ where: { tenantId, email: { not: null } } }),
    ]);
    return {
      total,
      unsubscribed,
      withPhone,
      withEmail,
      active: total - unsubscribed,
    };
  }

  // ── Internal Helpers ──────────────────────

  private async syncTags(tenantId: string, contactId: string, tags: string[]) {
    try {
      const normalizedTags = tags
        .map((t) => t.trim().toLowerCase())
        .filter(Boolean);

      // Load existing links BEFORE any changes so we can diff added vs removed
      const existingLinks = await this.prisma.contactTag.findMany({
        where: { contactId },
        include: { tag: true },
      });
      const existingTagNames = existingLinks.map((l) => l.tag.name);

      if (normalizedTags.length === 0) {
        await this.prisma.contactTag.deleteMany({ where: { contactId } });
        for (const link of existingLinks) {
          this.prisma.contactActivity
            .create({
              data: {
                tenantId,
                contactId,
                activityType: ActivityType.tag_removed,
                metadata: { tag: link.tag.name },
              },
            })
            .catch(() => {});
        }
        return;
      }

      // 1. Upsert each tag + link
      for (const tagName of normalizedTags) {
        const tag = await this.prisma.tag.upsert({
          where: { tenantId_name: { tenantId, name: tagName } },
          create: { tenantId, name: tagName },
          update: {},
        });
        await this.prisma.contactTag.upsert({
          where: { contactId_tagId: { contactId, tagId: tag.id } },
          create: { contactId, tagId: tag.id },
          update: {},
        });
      }

      // 2. Remove links to tags no longer present
      const tagsToRemove = existingLinks.filter(
        (link) => !normalizedTags.includes(link.tag.name),
      );
      if (tagsToRemove.length > 0) {
        await this.prisma.contactTag.deleteMany({
          where: { id: { in: tagsToRemove.map((t) => t.id) } },
        });
      }

      // 3. Log tag_added for newly added tags
      const newlyAdded = normalizedTags.filter(
        (t) => !existingTagNames.includes(t),
      );
      for (const tagName of newlyAdded) {
        this.prisma.contactActivity
          .create({
            data: {
              tenantId,
              contactId,
              activityType: ActivityType.tag_added,
              metadata: { tag: tagName },
            },
          })
          .catch(() => {});
      }

      // 4. Log tag_removed for removed tags
      for (const link of tagsToRemove) {
        this.prisma.contactActivity
          .create({
            data: {
              tenantId,
              contactId,
              activityType: ActivityType.tag_removed,
              metadata: { tag: link.tag.name },
            },
          })
          .catch(() => {});
      }
    } catch (error) {
      this.logger.error(
        `Failed to sync tags for contact ${contactId}: ${error.message}`,
      );
    }
  }
}
