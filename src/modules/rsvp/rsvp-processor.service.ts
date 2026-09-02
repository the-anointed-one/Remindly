import { Injectable, Logger, Inject, forwardRef } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import { ChannelType } from '@prisma/client';
import { WorkflowEngineService } from '../automation/workflow-engine.service';
import { ResponseParser } from './utils/response-parser.util';

/**
 * RSVP Processor Service
 *
 * Handles automatic RSVP responses for events.
 *
 * Incoming message flow:
 *   1. Extract phone number from message
 *   2. Find contact by phone
 *   3. Find active event invitation for contact
 *   4. Parse response (YES/NO/MAYBE)
 *   5. Update EventParticipant status
 *   6. Fire automation workflows
 */
@Injectable()
export class RsvpProcessorService {
  private readonly logger = new Logger(RsvpProcessorService.name);

  constructor(
    private readonly prisma: PrismaService,
    @Inject(forwardRef(() => WorkflowEngineService))
    private readonly workflowEngine: WorkflowEngineService,
  ) {}

  /**
   * Does this sender actually have an event invitation an RSVP could apply to?
   *
   * `isRsvpKeyword()` only inspects the words in the message, and its keyword
   * set (yes/y/1/no/n/2/3/maybe/confirm/cancel/…) overlaps almost entirely with
   * the appointment reply vocabulary. Routing on the keyword alone therefore
   * captured *every* appointment reply into the RSVP queue, where it matched no
   * invitation and silently died — the appointment was never confirmed or
   * cancelled. Callers must gate on this before treating a reply as an RSVP, so
   * that senders with no pending invitation fall through to appointment handling.
   *
   * Mirrors the contact + invitation lookup in `processInboundMessage()`; keep
   * the two in sync.
   */
  async hasActiveInvitation(phone: string, tenantId: string): Promise<boolean> {
    const contact = await this.prisma.contact.findFirst({
      where: { tenantId, phone, unsubscribed: false },
      select: { id: true },
    });
    if (!contact) return false;

    const count = await this.prisma.eventParticipant.count({
      where: {
        contactId: contact.id,
        status: { in: ['invited', 'pending'] },
        event: {
          tenantId,
          startTime: { gte: new Date() },
          status: { in: ['DRAFT', 'PUBLISHED', 'ACTIVE'] },
        },
      },
    });
    return count > 0;
  }

  /**
   * Process an inbound message and auto-update RSVP if applicable.
   *
   * @param phone - Sender's phone number (E.164 format)
   * @param body - Message body (trimmed, uppercase)
   * @param tenantId - Tenant ID
   * @returns - Response message to send back, or null if not an RSVP
   */
  async processInboundMessage(
    phone: string,
    body: string,
    tenantId: string,
    channel: 'SMS' | 'WHATSAPP' | 'VOICE' | 'API' = 'API',
  ): Promise<string | null> {
    try {
      // Step 1: Find contact by phone
      const contact = await this.prisma.contact.findFirst({
        where: { tenantId, phone, unsubscribed: false },
        select: { id: true, name: true },
      });

      if (!contact) {
        this.logger.debug(
          `No active contact found for phone ${phone} in tenant ${tenantId}`,
        );
        return null; // Not an RSVP — let other handlers process it
      }

      // Step 2: Find active event invitations (invited or pending status)
      const activeInvitations = await this.prisma.eventParticipant.findMany({
        where: {
          contactId: contact.id,
          status: { in: ['invited', 'pending'] },
          event: {
            tenantId,
            startTime: { gte: new Date() }, // Only future events
            status: { in: ['DRAFT', 'PUBLISHED', 'ACTIVE'] },
          },
        },
        include: {
          event: { select: { id: true, title: true, startTime: true } },
        },
        orderBy: { event: { startTime: 'asc' } }, // Closest event first
      });

      if (activeInvitations.length === 0) {
        this.logger.debug(
          `No active event invitations for contact ${contact.id}`,
        );
        return null; // Not an RSVP
      }

      // Step 3: Determine response type
      const responseType = this.parseResponse(body);
      if (!responseType) {
        return null; // Not an RSVP keyword
      }

      // Step 4: Update the most recent active invitation
      const invitation = activeInvitations[0]; // Closest event
      const newStatus =
        responseType === 'confirmed'
          ? 'confirmed'
          : responseType === 'declined'
            ? 'cancelled'
            : 'pending';
      const now = new Date();

      // Step 4a: Record append-only RSVP event log (fast write)
      await (this.prisma as any).rsvpEvent.create({
        data: {
          eventId: invitation.event.id,
          contactId: contact.id,
          tenantId,
          response: body,
          channel,
          createdAt: now,
        },
      });

      // Step 4b: Update participant status and last response timestamp
      if (invitation.status === newStatus) {
        await this.prisma.eventParticipant.update({
          where: { id: invitation.id },
          data: { lastResponseAt: now } as any,
        });
        // Already in the target status
        return this.getResponseMessage(
          contact.name,
          invitation.event.title,
          responseType,
        );
      }

      await this.prisma.eventParticipant.update({
        where: { id: invitation.id },
        data: { status: newStatus as any, lastResponseAt: now } as any,
      });

      this.logger.log(
        `RSVP updated: contact=${contact.id} event=${invitation.event.id} response=${responseType}`,
      );

      // Step 5: Create/update event response record
      await (this.prisma as any).eventResponse.upsert({
        where: {
          eventId_contactId: {
            eventId: invitation.event.id,
            contactId: contact.id,
          },
        },
        create: {
          eventId: invitation.event.id,
          contactId: contact.id,
          tenantId,
          response: body,
          responseStatus: newStatus as any,
        },
        update: {
          response: body,
          responseStatus: newStatus as any,
          timestamp: new Date(),
        },
      });

      // Step 6: Cancel pending RSVP reminders if confirmed or declined
      if (responseType !== 'maybe') {
        await this.prisma.reminder.updateMany({
          where: {
            eventId: invitation.event.id,
            contactId: contact.id,
            status: 'PENDING',
          },
          data: { status: 'CANCELLED' },
        });

        this.logger.log(
          `Cancelled pending reminders for contact ${contact.id} on event ${invitation.event.id}`,
        );
      }

      // Step 7: Fire automation workflows
      if (responseType === 'confirmed') {
        this.workflowEngine
          .fireTrigger(tenantId, 'rsvp_yes', invitation.event.id, {
            eventId: invitation.event.id,
            contactId: contact.id,
            tenantId,
            eventTitle: invitation.event.title,
            customerName: contact.name,
            response: 'YES',
          })
          .catch((err) => {
            this.logger.error(
              `Failed to fire rsvp_yes workflow: ${err.message}`,
            );
          });

        this.workflowEngine
          .fireTrigger(tenantId, 'rsvp_confirmed', invitation.event.id, {
            eventId: invitation.event.id,
            contactId: contact.id,
            tenantId,
            eventTitle: invitation.event.title,
            customerName: contact.name,
            response: 'YES',
          })
          .catch((err) => {
            this.logger.error(
              `Failed to fire rsvp_confirmed workflow: ${err.message}`,
            );
          });

        this.workflowEngine
          .fireTrigger(tenantId, 'attendance_confirmed', invitation.event.id, {
            eventId: invitation.event.id,
            contactId: contact.id,
            tenantId,
          })
          .catch((err) => {
            this.logger.error(
              `Failed to fire attendance_confirmed workflow: ${err.message}`,
            );
          });
      } else if (responseType === 'declined') {
        this.workflowEngine
          .fireTrigger(tenantId, 'rsvp_no', invitation.event.id, {
            eventId: invitation.event.id,
            contactId: contact.id,
            tenantId,
            eventTitle: invitation.event.title,
            customerName: contact.name,
            response: 'NO',
          })
          .catch((err) => {
            this.logger.error(
              `Failed to fire rsvp_no workflow: ${err.message}`,
            );
          });

        this.workflowEngine
          .fireTrigger(tenantId, 'rsvp_cancelled', invitation.event.id, {
            eventId: invitation.event.id,
            contactId: contact.id,
            tenantId,
            eventTitle: invitation.event.title,
            customerName: contact.name,
            response: 'NO',
          })
          .catch((err) => {
            this.logger.error(
              `Failed to fire rsvp_cancelled workflow: ${err.message}`,
            );
          });

        this.workflowEngine
          .fireTrigger(tenantId, 'attendance_cancelled', invitation.event.id, {
            eventId: invitation.event.id,
            contactId: contact.id,
            tenantId,
          })
          .catch((err) => {
            this.logger.error(
              `Failed to fire attendance_cancelled workflow: ${err.message}`,
            );
          });
      } else if (responseType === 'maybe') {
        this.workflowEngine
          .fireTrigger(tenantId, 'rsvp_pending', invitation.event.id, {
            eventId: invitation.event.id,
            contactId: contact.id,
            tenantId,
            eventTitle: invitation.event.title,
            customerName: contact.name,
            response: body,
          })
          .catch((err) => {
            this.logger.error(
              `Failed to fire rsvp_pending workflow: ${err.message}`,
            );
          });
      }

      // Always fire rsvp_received
      this.workflowEngine
        .fireTrigger(tenantId, 'rsvp_received', invitation.event.id, {
          eventId: invitation.event.id,
          contactId: contact.id,
          tenantId,
          response: body,
          responseStatus: newStatus,
        })
        .catch((err) => {
          this.logger.error(
            `Failed to fire rsvp_received workflow: ${err.message}`,
          );
        });

      return this.getResponseMessage(
        contact.name,
        invitation.event.title,
        responseType,
      );
    } catch (error) {
      this.logger.error(`Error processing RSVP: ${error.message}`);
      return null;
    }
  }

  /**
   * Parse response type from message body.
   * Returns: 'confirmed', 'declined', 'maybe', or null if no match
   */
  /**
   * Returns RSVP semantic type, or null if not an RSVP keyword.
   */
  parseResponse(body: string): 'confirmed' | 'declined' | 'maybe' | null {
    return ResponseParser.parseRSVP(body);
  }

  isRsvpKeyword(body: string): boolean {
    return ResponseParser.parseRSVP(body) !== null;
  }

  /**
   * Generate a friendly response message.
   */
  private getResponseMessage(
    contactName: string,
    eventTitle: string,
    response: 'confirmed' | 'declined' | 'maybe',
  ): string {
    const shortName = contactName.split(' ')[0];

    switch (response) {
      case 'confirmed':
        return `Thanks ${shortName}! We've confirmed your attendance at "${eventTitle}". See you there! ✓`;
      case 'declined':
        return `Got it, ${shortName}. We've noted that you won't be attending "${eventTitle}". Thanks for letting us know!`;
      case 'maybe':
        return `Thanks ${shortName}! We've marked you as maybe for "${eventTitle}". Please confirm when you're sure.`;
      default:
        return 'Thank you for your response!';
    }
  }

  /**
   * Get RSVP stats for an event.
   */
  async getEventRsvpStats(tenantId: string, eventId: string) {
    const event = await this.prisma.event.findFirst({
      where: { id: eventId, tenantId },
    });

    if (!event) throw new Error(`Event ${eventId} not found`);

    const stats = await this.prisma.eventParticipant.groupBy({
      by: ['status'],
      where: { eventId },
      _count: { _all: true },
    });

    const counts = {
      invited: 0,
      confirmed: 0,
      pending: 0,
      cancelled: 0,
    };

    stats.forEach((s) => {
      const status = s.status as keyof typeof counts;
      counts[status] = s._count._all;
    });

    const total = Object.values(counts).reduce((a, b) => a + b, 0);

    return {
      eventId,
      eventTitle: event.title,
      eventStartTime: event.startTime,
      total,
      ...counts,
      confirmationRate:
        total > 0 ? Math.round((counts.confirmed / total) * 100) : 0,
    };
  }

  /**
   * Bulk update RSVPs for an event (admin action).
   */
  async bulkUpdateRsvp(
    tenantId: string,
    eventId: string,
    contactIds: string[],
    newStatus: 'confirmed' | 'cancelled' | 'pending',
  ) {
    const result = await this.prisma.eventParticipant.updateMany({
      where: {
        eventId,
        contactId: { in: contactIds },
        event: { tenantId },
      },
      data: { status: newStatus as any },
    });

    return { updated: result.count };
  }
}
