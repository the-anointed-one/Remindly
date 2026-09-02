import {
  Controller,
  Post,
  Body,
  Headers,
  Logger,
  Req,
  HttpCode,
  HttpStatus,
  ForbiddenException,
  Inject,
  forwardRef,
} from '@nestjs/common';
import { ChannelType, ActivityType } from '@prisma/client';
import { Public } from '../../common/decorators';
import { PrismaService } from '../../prisma/prisma.service';
import { TwilioProvider } from './twilio.provider';
import { ReminderSchedulerService } from '../reminder/reminder-scheduler.service';
import { AuditService } from '../audit/audit.service';
import { ReschedulingService } from '../rescheduling/rescheduling.service';
import { MessageFailoverService } from './message-failover.service';
import {
  ComplianceService,
  OPT_OUT_REPLY,
  OPT_IN_REPLY,
} from '../compliance/compliance.service';
import { ReputationService } from '../reputation/reputation.service';
import { RsvpProcessorService } from '../rsvp/rsvp-processor.service';
import { RsvpQueueService } from '../rsvp/rsvp-queue.service';
import { EventLifecycleService } from '../appointment/event-lifecycle.service';

/**
 * Twilio webhook controller.
 * All endpoints are @Public() — Twilio can't authenticate with JWT.
 * Security is enforced via Twilio signature validation.
 *
 * SMS reply handling:
 *   1 / YES / CONFIRM / Y  → confirm appointment or event RSVP
 *   2 / RESCHEDULE / R     → start reschedule flow (sends slot options)
 *   3 / NO / CANCEL / N    → cancel appointment or RSVP decline
 *
 *   If a RescheduleSession is active for the sender's phone:
 *     1–5  → select the corresponding offered slot
 */
@Controller('webhooks/twilio')
export class TwilioWebhookController {
  private readonly logger = new Logger(TwilioWebhookController.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly twilioProvider: TwilioProvider,
    private readonly reminderScheduler: ReminderSchedulerService,
    private readonly auditService: AuditService,
    private readonly reschedulingService: ReschedulingService,
    private readonly failoverService: MessageFailoverService,
    private readonly complianceService: ComplianceService,
    private readonly rsvpQueueService: RsvpQueueService,
    private readonly rsvpProcessor: RsvpProcessorService,
    @Inject(forwardRef(() => ReputationService))
    private readonly reputationService: ReputationService,
    @Inject(forwardRef(() => EventLifecycleService))
    private readonly eventLifecycle: EventLifecycleService,
  ) {}

  // ── SMS Status Callback ────────────────────

  @Public()
  @Post('status')
  @HttpCode(HttpStatus.OK)
  async handleSmsStatus(
    @Body() params: any,
    @Headers('x-twilio-signature') signature: string,
    @Req() req: any,
  ) {
    const fullUrl = `${req.protocol}://${req.get('host')}${req.originalUrl}`;
    const validation = this.twilioProvider.validateWebhook(
      signature || '',
      fullUrl,
      params || {},
    );

    if (!validation.valid) {
      this.logger.warn('Invalid Twilio signature on SMS status webhook');
      throw new ForbiddenException('Invalid signature');
    }

    const messageSid = params?.MessageSid;
    const messageStatus = params?.MessageStatus;

    this.logger.log(`SMS status update: ${messageSid} → ${messageStatus}`);

    if (messageSid) {
      await this.prisma.messageLog.updateMany({
        where: { providerMessageId: messageSid },
        data: {
          providerStatus: messageStatus,
          deliveredAt: messageStatus === 'delivered' ? new Date() : undefined,
        },
      });

      if (messageStatus === 'delivered') {
        const messageLog = await this.prisma.messageLog.findFirst({
          where: { providerMessageId: messageSid },
        });
        if (messageLog?.reminderId) {
          await this.prisma.reminder.update({
            where: { id: messageLog.reminderId },
            data: { status: 'DELIVERED' },
          });

          // Log message_delivered activity for the contact
          const reminder = await this.prisma.reminder.findUnique({
            where: { id: messageLog.reminderId },
            include: {
              appointment: {
                include: { customer: { select: { phone: true, email: true } } },
              },
            },
          });
          const phone = reminder?.appointment?.customer?.phone;
          const email = reminder?.appointment?.customer?.email;
          if (phone || email) {
            this.prisma.contact
              .findFirst({
                where: {
                  tenantId: messageLog.tenantId,
                  ...(phone ? { phone } : { email }),
                },
                select: { id: true },
              })
              .then((contact) => {
                if (contact) {
                  return this.prisma.contactActivity.create({
                    data: {
                      tenantId: messageLog.tenantId,
                      contactId: contact.id,
                      activityType: ActivityType.message_delivered,
                      referenceId: messageLog.reminderId!,
                      metadata: { channel: messageLog.channel, messageSid },
                    },
                  });
                }
              })
              .catch(() => {});
          }
        }
      }

      // Trigger channel failover on terminal delivery failure
      if (messageStatus === 'undelivered' || messageStatus === 'failed') {
        const { failed, messageLog } =
          await this.failoverService.detectDeliveryFailure(messageSid);
        if (failed && messageLog?.reminderId) {
          await this.failoverService.triggerFallbackChannel(
            messageLog.reminderId,
            messageLog.tenantId,
            messageLog.channel,
          );
        }
      }
    }

    return '<Response></Response>';
  }

  // ── Inbound SMS ────────────────────────────

  @Public()
  @Post('inbound')
  @HttpCode(HttpStatus.OK)
  async handleInboundSms(
    @Body() params: any,
    @Headers('x-twilio-signature') signature: string,
    @Req() req: any,
  ) {
    const fullUrl = `${req.protocol}://${req.get('host')}${req.originalUrl}`;
    const validation = this.twilioProvider.validateWebhook(
      signature || '',
      fullUrl,
      params || {},
    );

    if (!validation.valid) {
      this.logger.warn('Invalid Twilio signature on inbound SMS webhook');
      throw new ForbiddenException('Invalid signature');
    }

    const from = params?.From;
    const body = (params?.Body || '').trim().toUpperCase();
    const messageSid = params?.MessageSid;

    this.logger.log(`Inbound SMS from ${from}: "${body}"`);

    // ── Idempotency Check ──
    if (messageSid) {
      const existing = await this.prisma.messageLog.findFirst({
        where: { providerMessageId: messageSid },
      });
      if (existing) {
        this.logger.log(`Duplicate inbound SMS ${messageSid} — skipping`);
        return { received: true };
      }
    }

    const tenantId = await this.resolveTenantFromPhone(from);
    await Promise.all([
      this.logInbound(tenantId, from, body, messageSid, ChannelType.SMS),
      this.linkResponseToCampaign(from, body),
    ]);

    const responseText = await this.processInboundReply(
      from,
      body,
      ChannelType.SMS,
      tenantId,
    );
    return `<Response><Message>${responseText}</Message></Response>`;
  }

  // ── Inbound WhatsApp ───────────────────────

  @Public()
  @Post('whatsapp-inbound')
  @HttpCode(HttpStatus.OK)
  async handleInboundWhatsApp(
    @Body() params: any,
    @Headers('x-twilio-signature') signature: string,
    @Req() req: any,
  ) {
    const fullUrl = `${req.protocol}://${req.get('host')}${req.originalUrl}`;
    const validation = this.twilioProvider.validateWebhook(
      signature || '',
      fullUrl,
      params || {},
    );

    if (!validation.valid) {
      this.logger.warn('Invalid Twilio signature on inbound WhatsApp webhook');
      throw new ForbiddenException('Invalid signature');
    }

    const rawFrom = params?.From || '';
    const from = rawFrom.replace(/^whatsapp:/, '');
    const body = (params?.Body || '').trim().toUpperCase();
    const messageSid = params?.MessageSid;

    this.logger.log(`Inbound WhatsApp from ${from}: "${body}"`);

    // ── Idempotency Check ──
    if (messageSid) {
      const existing = await this.prisma.messageLog.findFirst({
        where: { providerMessageId: messageSid },
      });
      if (existing) {
        this.logger.log(`Duplicate inbound WhatsApp ${messageSid} — skipping`);
        return { received: true };
      }
    }

    const tenantId = await this.resolveTenantFromPhone(from);
    await Promise.all([
      this.logInbound(tenantId, from, body, messageSid, ChannelType.WHATSAPP),
      this.linkResponseToCampaign(from, body),
    ]);

    const responseText = await this.processInboundReply(
      from,
      body,
      ChannelType.WHATSAPP,
      tenantId,
    );
    return `<Response><Message>${responseText}</Message></Response>`;
  }

  // ── Voice IVR Gather Callback ──────────────

  @Public()
  @Post('voice-gather')
  @HttpCode(HttpStatus.OK)
  async handleVoiceGather(
    @Body() params: any,
    @Headers('x-twilio-signature') signature: string,
    @Req() req: any,
  ) {
    const fullUrl = `${req.protocol}://${req.get('host')}${req.originalUrl}`;
    const validation = this.twilioProvider.validateWebhook(
      signature || '',
      fullUrl,
      params || {},
    );

    if (!validation.valid) {
      throw new ForbiddenException('Invalid signature');
    }

    const digit = params?.Digits;
    const from = params?.From;

    this.logger.log(`Voice IVR input: digit=${digit} from=${from}`);

    if (digit === '1') {
      await this.processConfirmation(from);
    } else if (digit === '2') {
      // Trigger reschedule via SMS (voice back-and-forth isn't practical)
      await this.triggerVoiceReschedule(from);
    } else if (digit === '3') {
      await this.processCancellation(from);
    }

    return TwilioProvider.generateGatherResponse(digit);
  }

  // ── Voice Status Callback ──────────────────

  @Public()
  @Post('voice-status')
  @HttpCode(HttpStatus.OK)
  async handleVoiceStatus(@Body() params: any) {
    const callSid = params?.CallSid;
    const callStatus = params?.CallStatus;
    this.logger.log(`Voice status update: ${callSid} → ${callStatus}`);
    return '<Response></Response>';
  }

  // ── Core reply router ─────────────────────────────────────────────────────

  private async processInboundReply(
    phone: string,
    body: string,
    channel: ChannelType,
    tenantId: string,
  ): Promise<string> {
    // ── Step 0: Compliance opt-out / opt-in — must run before everything else ─
    // Per TCPA/CTIA rules, STOP must be honoured immediately and unconditionally.
    if (this.complianceService.isOptOutKeyword(body)) {
      await this.complianceService.optOut(phone, tenantId, channel);
      this.logger.log(`Opt-out processed for ${phone} via ${channel}`);
      return OPT_OUT_REPLY;
    }

    if (this.complianceService.isOptInKeyword(body)) {
      await this.complianceService.optIn(phone, tenantId, channel);
      this.logger.log(`Opt-in processed for ${phone} via ${channel}`);
      return OPT_IN_REPLY;
    }

    // ── Step 0.5: Feedback reply — check if customer has pending feedback request ─
    if (['1', '2', '3'].includes(body)) {
      const feedbackCheck =
        await this.reputationService.hasPendingFeedbackRequest(phone, tenantId);
      if (feedbackCheck.has && feedbackCheck.requestId) {
        const rating = parseInt(body, 10);
        return await this.reputationService.processFeedbackReply(
          phone,
          rating,
          tenantId,
          feedbackCheck.requestId,
        );
      }
    }

    // ── Step 0.75: Event RSVP — queue for asynchronous processing ─
    // Gate on an actual pending invitation, not just the keyword. The RSVP
    // keyword set (yes/y/1/no/n/2/3/maybe/confirm/cancel/…) is a superset of the
    // appointment reply vocabulary below, so matching on the keyword alone
    // swallowed every appointment confirm/cancel/reschedule reply into the RSVP
    // queue — where it matched no invitation and vanished, leaving the
    // appointment untouched while the customer was told their response "has
    // been received and is being processed". Senders with no live invitation now
    // fall through to the appointment steps.
    if (
      this.rsvpProcessor.isRsvpKeyword(body) &&
      (await this.rsvpProcessor.hasActiveInvitation(phone, tenantId))
    ) {
      await this.rsvpQueueService.enqueueRsvp({
        tenantId,
        phone,
        body,
        channel,
        receivedAt: new Date().toISOString(),
      });

      this.logger.log(`Queued RSVP for ${phone} in tenant ${tenantId}`);
      return 'Thanks! Your RSVP response has been received and is being processed.';
    }

    // ── Step 1: Active reschedule session? route to slot selection ─────────
    const hasSession = await this.reschedulingService.hasActiveSession(phone);

    if (hasSession) {
      // Only numeric single digits are slot selections
      const slotResponse = await this.reschedulingService.processSlotSelection(
        phone,
        body,
        channel,
      );
      if (slotResponse) return slotResponse;
      // If non-matching digit, fall through to check for new commands
    }

    // ── Step 2: Confirm ────────────────────────────────────────────────────
    if (['1', 'YES', 'CONFIRM', 'Y'].includes(body)) {
      await this.processConfirmation(phone);
      return 'Thank you! Your appointment has been confirmed.';
    }

    // ── Step 3: Reschedule ─────────────────────────────────────────────────
    if (['2', 'RESCHEDULE', 'R'].includes(body)) {
      return await this.initiateReschedule(phone, tenantId, channel);
    }

    // ── Step 4: Cancel ─────────────────────────────────────────────────────
    if (['3', 'NO', 'CANCEL', 'N'].includes(body)) {
      await this.processCancellation(phone);
      return 'Your appointment has been cancelled. Contact us to book a new time.';
    }

    // ── Step 4.5: Maybe / unsure ───────────────────────────────────────────
    // The RSVP footer (appendRsvpFooter) explicitly invites "MAYBE if unsure"
    // on every event-related reminder, but until now nothing here recognised
    // it — it fell through to the generic "unknown reply" message below,
    // which contradicts the instructions the customer was just given. There's
    // no dedicated "tentative" status on Appointment/Participant, so this
    // doesn't change appointment status; it just acknowledges the reply and
    // logs it so staff can see the customer is uncertain and can follow up.
    if (['MAYBE', 'M', 'MAYBE?'].includes(body)) {
      const customer = await this.prisma.customer.findFirst({ where: { phone } });
      if (customer) {
        await this.auditService.log({
          tenantId: customer.tenantId,
          action: 'UPDATE',
          entity: 'Customer',
          entityId: customer.id,
          newValues: { rsvpReply: 'MAYBE', via: 'reply' },
        });
      }
      return "Thanks for letting us know — we've noted you're unsure. Reply 1 to confirm or 3 to cancel whenever you're ready, or call us if you'd like to talk it through.";
    }

    // ── Step 5: Unknown ────────────────────────────────────────────────────
    return 'Reply 1 to Confirm, 2 to Reschedule, or 3 to Cancel your appointment.';
  }

  // ── Reschedule initiation ─────────────────────────────────────────────────

  private async initiateReschedule(
    phone: string,
    tenantId: string,
    channel: ChannelType,
  ): Promise<string> {
    const customer = await this.prisma.customer.findFirst({ where: { phone } });
    if (!customer)
      return 'We could not find your appointment. Please call us to reschedule.';

    const appointment = await this.prisma.appointment.findFirst({
      where: {
        customerId: customer.id,
        status: { in: ['SCHEDULED', 'CONFIRMED'] },
        scheduledAt: { gte: new Date() },
      },
      orderBy: { scheduledAt: 'asc' },
    });

    if (!appointment) {
      return 'No upcoming appointment found to reschedule.';
    }

    // sendRescheduleOptions fires the follow-up SMS with slot list and returns void.
    // We acknowledge immediately, the slot list arrives in a separate message.
    await this.reschedulingService.sendRescheduleOptions(
      phone,
      tenantId,
      appointment.id,
      channel,
    );

    await this.auditService.log({
      tenantId,
      action: 'UPDATE',
      entity: 'Appointment',
      entityId: appointment.id,
      newValues: {
        rescheduleRequested: true,
        via: `${channel.toLowerCase()}_reply`,
      },
    });

    return "Great! We'll send you available time options in a moment.";
  }

  private async triggerVoiceReschedule(phone: string): Promise<void> {
    const tenantId = await this.resolveTenantFromPhone(phone);
    await this.initiateReschedule(phone, tenantId, ChannelType.SMS);
  }

  // ── Confirmation / Cancellation ───────────────────────────────────────────

  private async processConfirmation(phone: string) {
    const customer = await this.prisma.customer.findFirst({ where: { phone } });
    if (!customer) return;

    const appointment = await this.prisma.appointment.findFirst({
      where: {
        customerId: customer.id,
        status: 'SCHEDULED',
        scheduledAt: { gte: new Date() },
      },
      orderBy: { scheduledAt: 'asc' },
    });

    if (appointment) {
      await this.prisma.appointment.update({
        where: { id: appointment.id },
        data: { status: 'CONFIRMED' },
      });

      await this.auditService.log({
        tenantId: customer.tenantId,
        action: 'UPDATE',
        entity: 'Appointment',
        entityId: appointment.id,
        newValues: { status: 'CONFIRMED', via: 'reply' },
      });

      await this.fireStatusLifecycle(
        customer,
        appointment,
        appointment.status,
        'CONFIRMED',
      );

      this.logger.log(`Appointment ${appointment.id} confirmed via reply`);
    }
  }

  private async processCancellation(phone: string) {
    const customer = await this.prisma.customer.findFirst({ where: { phone } });
    if (!customer) return;

    const appointment = await this.prisma.appointment.findFirst({
      where: {
        customerId: customer.id,
        status: { in: ['SCHEDULED', 'CONFIRMED'] },
        scheduledAt: { gte: new Date() },
      },
      orderBy: { scheduledAt: 'asc' },
    });

    if (appointment) {
      await this.prisma.appointment.update({
        where: { id: appointment.id },
        data: { status: 'CANCELLED' },
      });

      await this.reminderScheduler.cancelForAppointment(appointment.id);

      await this.auditService.log({
        tenantId: customer.tenantId,
        action: 'UPDATE',
        entity: 'Appointment',
        entityId: appointment.id,
        newValues: { status: 'CANCELLED', via: 'reply' },
      });

      await this.fireStatusLifecycle(
        customer,
        appointment,
        appointment.status,
        'CANCELLED',
      );

      this.logger.log(`Appointment ${appointment.id} cancelled via reply`);
    }
  }

  /**
   * Run the shared appointment-status lifecycle for a status change that came
   * from an inbound reply (SMS / WhatsApp / voice IVR).
   *
   * Why this exists: replies update the appointment with a direct
   * `prisma.appointment.update()` rather than going through
   * `AppointmentService.update()`, so until now they skipped
   * `EventLifecycleService.onStatusChanged()` entirely. That meant a customer
   * texting "YES" silently changed the status but fired no
   * `appointment_confirmed` / `appointment_cancelled` automation trigger and
   * logged no contact activity — the same change made in the dashboard did
   * both. Any follow-up automation the tenant built on those triggers simply
   * never ran for reply-driven changes, which is the more common path.
   *
   * Failures are logged and swallowed: the customer's reply has already been
   * persisted and acknowledged, so a downstream automation problem must not
   * turn into a webhook error (Twilio would retry and double-process).
   */
  private async fireStatusLifecycle(
    customer: { id: string; tenantId: string; firstName: string | null; lastName: string | null; phone: string | null; email: string | null },
    appointment: { id: string; title: string; scheduledAt: Date },
    oldStatus: string,
    newStatus: string,
  ) {
    try {
      await this.eventLifecycle.onStatusChanged(
        customer.tenantId,
        appointment.id,
        oldStatus,
        newStatus,
        {
          appointmentId: appointment.id,
          appointmentTitle: appointment.title,
          appointmentStatus: newStatus,
          scheduledAt: appointment.scheduledAt.toISOString(),
          customerId: customer.id,
          customerName:
            [customer.firstName, customer.lastName].filter(Boolean).join(' ') ||
            undefined,
          customerPhone: customer.phone ?? undefined,
          customerEmail: customer.email ?? undefined,
          tenantId: customer.tenantId,
        },
      );
    } catch (err: any) {
      this.logger.error(
        `Lifecycle hook failed for appointment ${appointment.id} (${oldStatus} → ${newStatus}): ${err.message}`,
      );
    }
  }

  // ── Log helpers ───────────────────────────────────────────────────────────

  private async logInbound(
    tenantId: string,
    from: string,
    body: string,
    messageSid: string,
    channel: ChannelType,
  ) {
    await this.prisma.messageLog.create({
      data: {
        tenantId,
        channel,
        direction: 'INBOUND',
        recipient: from,
        content: body,
        providerMessageId: messageSid,
        providerStatus: 'received',
        sentAt: new Date(),
      },
    });
  }

  /**
   * Parse a raw reply body into a semantic ResponseStatus.
   *   YES / Y / CONFIRM / 1  → confirmed
   *   NO  / N / CANCEL  / 3  → cancelled
   *   anything else          → pending
   */
  private parseResponseStatus(
    body: string,
  ): 'confirmed' | 'cancelled' | 'pending' {
    const upper = body.trim().toUpperCase();
    if (['YES', 'Y', 'CONFIRM', 'CONFIRMED', '1'].includes(upper))
      return 'confirmed';
    if (['NO', 'N', 'CANCEL', 'CANCELLED', 'DECLINE', '3'].includes(upper))
      return 'cancelled';
    return 'pending';
  }

  /**
   * Link an inbound reply to the most recent unresponded CampaignRecipient for
   * this phone number. Also writes a MessageResponse record and a ContactActivity
   * entry so the full response is visible on the contact timeline.
   * Runs silently — never throws.
   */
  private async linkResponseToCampaign(
    phone: string,
    body: string,
  ): Promise<void> {
    try {
      // 1. Find the most recent unresponded campaign message sent to this phone
      const recent = await this.prisma.campaignRecipient.findFirst({
        where: {
          recipient: phone,
          status: { in: ['sent', 'delivered'] },
          respondedAt: null,
        },
        orderBy: { sentAt: 'desc' },
        include: { campaign: { select: { tenantId: true } } },
      });

      if (!recent) return;

      // 2. Parse semantic status from the reply text
      const responseStatus = this.parseResponseStatus(body);

      // 3. Update CampaignRecipient with raw text + status
      await this.prisma.campaignRecipient.update({
        where: { id: recent.id },
        data: {
          responseText: body,
          respondedAt: new Date(),
          status: 'responded',
        },
      });

      // 4. Match phone to Contact record
      const contact = await this.prisma.contact.findFirst({
        where: { phone, tenantId: recent.campaign?.tenantId ?? undefined },
        select: { id: true, tenantId: true },
      });
      const contactId = contact?.id ?? null;

      // Fallback: resolve tenantId from recipient if contact not found
      const tenantId =
        contact?.tenantId ?? (await this.resolveTenantFromPhone(phone));

      // 5. Write to message_responses table
      await this.prisma.messageResponse.create({
        data: {
          tenantId,
          contactId,
          broadcastId: recent.campaignId,
          campaignRecipientId: recent.id,
          responseText: body,
          responseStatus: responseStatus as any,
        },
      });

      // 6. Log a ContactActivity entry so the reply appears on the timeline
      if (contactId) {
        await this.prisma.contactActivity.create({
          data: {
            tenantId,
            contactId,
            activityType: 'campaign_response_received' as any,
            referenceId: recent.campaignId,
            metadata: {
              responseText: body,
              responseStatus,
              campaignRecipientId: recent.id,
            },
          },
        });
      }

      this.logger.log(
        `Response captured: recipient=${recent.id} status=${responseStatus} response="${body}"`,
      );
    } catch (err: any) {
      this.logger.error(`linkResponseToCampaign failed: ${err.message}`);
    }
  }

  private async resolveTenantFromPhone(phone: string): Promise<string> {
    const lastMessage = await this.prisma.messageLog.findFirst({
      where: { recipient: phone, direction: 'OUTBOUND' },
      orderBy: { createdAt: 'desc' },
      select: { tenantId: true },
    });
    return lastMessage?.tenantId || 'unknown';
  }
}
