import {
  Controller,
  Post,
  Body,
  Headers,
  Logger,
  HttpCode,
  HttpStatus,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import * as crypto from 'crypto';
import { ChannelType } from '@prisma/client';
import { Public } from '../../common/decorators';
import { TermiiProvider } from './termii.provider';
import { RsvpQueueService } from '../rsvp/rsvp-queue.service';
import { RsvpProcessorService } from '../rsvp/rsvp-processor.service';
import { ComplianceService } from '../compliance/compliance.service';
import { PrismaService } from '../../prisma/prisma.service';
import { normalizePhoneForSend } from '../../common/utils/normalize-phone.util';

/**
 * Termii inbound webhook.
 *
 * @Public() because Termii cannot present a JWT, and Termii has no
 * request-signing scheme equivalent to Twilio's x-twilio-signature. A shared
 * secret (TERMII_WEBHOOK_SECRET) stands in: configure it as a custom
 * `x-meetora-secret` header on the webhook in the Termii dashboard. When the
 * env var is unset the check is skipped, so existing setups keep working.
 */
@Controller('termii-webhook')
export class TermiiWebhookController {
  private readonly logger = new Logger(TermiiWebhookController.name);

  constructor(
    private readonly config: ConfigService,
    private readonly termii: TermiiProvider,
    private readonly rsvpQueue: RsvpQueueService,
    private readonly rsvpProcessor: RsvpProcessorService,
    private readonly compliance: ComplianceService,
    private readonly prisma: PrismaService,
  ) {}

  @Public()
  @Post('inbound')
  @HttpCode(HttpStatus.OK)
  async handleInbound(
    @Body() payload: any,
    @Headers() headers: Record<string, string>,
  ) {
    if (!this.verifySecret(payload, headers)) {
      this.logger.warn('Termii webhook: invalid secret — rejected');
      return { received: false };
    }

    // Never echo the shared secret into the logs.
    const { secret: _redacted, ...loggable } = payload ?? {};
    this.logger.log(`Termii inbound: ${JSON.stringify(loggable)}`);

    const message = this.termii.parseInbound(payload);

    if (!message.from || !message.body) {
      return { received: true };
    }

    // Termii reports msisdn in local/bare form ("2348012345678", "08012345678")
    // depending on the route, while contacts are stored E.164. Normalize before
    // matching or every lookup misses.
    const phone = normalizePhoneForSend(message.from) ?? message.from;

    // Termii retries on non-2xx, so guard against double-processing a reply.
    const duplicate = await this.prisma.messageLog.findFirst({
      where: { providerMessageId: message.messageId },
      select: { id: true },
    });
    if (duplicate) {
      this.logger.log(
        `Duplicate Termii inbound ${message.messageId} — skipping`,
      );
      return { received: true };
    }

    const contact = await this.prisma.contact.findFirst({
      where: { phone },
      select: { id: true, tenantId: true },
    });

    if (!contact) {
      this.logger.warn(`No contact for ${phone}`);
      return { received: true };
    }

    await this.logInbound(contact.tenantId, phone, message);

    // Opt-out must be honoured before anything else routes the message
    // (TCPA/CTIA), matching the Twilio inbound handler.
    if (this.compliance.isOptOutKeyword(message.body)) {
      await this.compliance.optOut(phone, contact.tenantId, ChannelType.SMS);
      this.logger.log(`Opt-out processed for ${phone} via Termii`);
      return { received: true };
    }

    if (this.compliance.isOptInKeyword(message.body)) {
      await this.compliance.optIn(phone, contact.tenantId, ChannelType.SMS);
      this.logger.log(`Opt-in processed for ${phone} via Termii`);
      return { received: true };
    }

    // Gate on a live invitation, not just the keyword. The RSVP vocabulary
    // overlaps the appointment reply vocabulary, so queueing on the keyword
    // alone swallows replies that have no invitation to match — the same
    // failure the Twilio handler documents and guards against.
    const isRsvp =
      this.rsvpProcessor.isRsvpKeyword(message.body) &&
      (await this.rsvpProcessor.hasActiveInvitation(phone, contact.tenantId));

    if (!isRsvp) {
      this.logger.log(
        `Termii reply from ${phone} ("${message.body}") is not an active RSVP — no action`,
      );
      return { received: true };
    }

    await this.rsvpQueue.enqueueRsvp({
      tenantId: contact.tenantId,
      phone,
      body: message.body,
      channel: ChannelType.SMS,
      receivedAt: new Date().toISOString(),
    });

    this.logger.log(`RSVP queued for ${contact.id}: ${message.body}`);

    return { received: true };
  }

  /**
   * Constant-time comparison of the configured shared secret against the
   * `x-meetora-secret` header (or a `secret` field in the body, for Termii
   * routes that only allow body customisation).
   *
   * timingSafeEqual needs equal-length buffers and throws otherwise, so length
   * is checked first — and a mismatched length is itself a rejection.
   */
  private verifySecret(
    payload: any,
    headers: Record<string, string>,
  ): boolean {
    const secret = this.config.get<string>('TERMII_WEBHOOK_SECRET');
    if (!secret) return true;

    const provided = headers?.['x-meetora-secret'] || payload?.secret || '';
    const a = Buffer.from(String(provided));
    const b = Buffer.from(secret);
    if (a.length !== b.length) return false;
    return crypto.timingSafeEqual(a, b);
  }

  private async logInbound(
    tenantId: string,
    phone: string,
    message: { body: string; messageId: string },
  ) {
    await this.prisma.messageLog
      .create({
        data: {
          tenantId,
          channel: ChannelType.SMS,
          direction: 'INBOUND',
          recipient: phone,
          content: message.body,
          providerMessageId: message.messageId,
          providerStatus: 'received',
          sentAt: new Date(),
        },
      })
      .catch((err) => {
        // Logging must never cost us the reply itself.
        this.logger.error(`Failed to log Termii inbound: ${err.message}`);
      });
  }
}
