import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import { MessagingService } from '../messaging/messaging.service';
import { appendRsvpFooter } from '../../common/utils/rsvp-footer.util';
import { generateQrToken } from '../../common/utils/qr-token.util';

@Injectable()
export class EventInviteService {
  constructor(
    private prisma: PrismaService,
    private messaging: MessagingService,
  ) {}

  async inviteByAudience(
    tenantId: string,
    eventId: string,
    audience: {
      type: 'all' | 'tag' | 'group';
      ids?: string[];
    },
  ) {
    // Get contacts based on audience type
    let contacts: any[] = [];

    switch (audience.type) {
      case 'all':
        contacts = await this.prisma.contact.findMany({
          where: { tenantId },
          select: { id: true, name: true, phone: true, email: true },
        });
        break;

      case 'tag':
        contacts = await this.prisma.contact.findMany({
          where: {
            tenantId,
            contactTags: { some: { tagId: { in: audience.ids || [] } } },
          },
          select: { id: true, name: true, phone: true, email: true },
        });
        break;

      case 'group':
        const groupMembers = await this.prisma.contactGroupMember.findMany({
          where: { groupId: { in: audience.ids || [] } },
          include: {
            contact: {
              select: { id: true, name: true, phone: true, email: true },
            },
          },
        });
        contacts = groupMembers.map((gm) => gm.contact);
        break;
    }

    if (contacts.length === 0) {
      return { invitedCount: 0, message: 'No contacts found for this audience' };
    }

    // Get event details
    const event = await this.prisma.event.findFirst({
      where: { id: eventId, tenantId },
      select: { title: true, startTime: true, location: true, id: true },
    });

    if (!event) {
      throw new Error('Event not found');
    }

    // Create event participants (skip duplicates)
    await this.prisma.eventParticipant.createMany({
      data: contacts.map((contact) => ({
        eventId,
        contactId: contact.id,
        tenantId,
        status: 'invited' as any,
        qrToken: generateQrToken(eventId, contact.id),
      })),
      // skipDuplicates leaves already-invited participants (and their existing
      // QR tokens) untouched.
      skipDuplicates: true,
    });

    // Send invitations
    const invitePromises = contacts.map((contact) => {
      if (!contact.phone) return Promise.resolve(null);
      return this.messaging.send(
        tenantId,
        'SMS',
        contact.phone,
        this.buildInviteMessage(event, contact),
        undefined,
        undefined,
        eventId,
        contact.id,
      ).catch((err) => {
        console.error(`Failed to send invite to ${contact.phone}:`, err.message);
        return null;
      });
    });

    await Promise.all(invitePromises);

    return {
      invitedCount: contacts.length,
      eventId,
      eventTitle: event.title,
    };
  }

  private buildInviteMessage(event: any, contact: any): string {
    const rsvpLink = `${process.env.FRONTEND_URL || 'http://localhost:3001'}/rsvp/${event.id}?contact=${contact.id}`;
    const formattedDate = event.startTime
      ? new Date(event.startTime).toLocaleString()
      : 'TBD';
    const location = event.location || 'Virtual event';

    const body = `🎉 You're invited to: ${event.title}

📅 When: ${formattedDate}
📍 Where: ${location}

Or RSVP here: ${rsvpLink}`;

    // appendRsvpFooter adds "Reply YES to confirm, NO to decline, or MAYBE if unsure."
    return appendRsvpFooter(body, 'SMS');
  }
}
