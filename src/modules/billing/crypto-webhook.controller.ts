import {
  Controller,
  Post,
  Body,
  Headers,
  Logger,
  HttpCode,
  HttpStatus,
  ForbiddenException,
  Req,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { createHmac } from 'crypto';
import { Public } from '../../common/decorators';
import { PrismaService } from '../../prisma/prisma.service';
import { BillingService } from './billing.service';

/**
 * Coinbase Commerce webhook controller.
 * @Public — Coinbase can't authenticate with JWT.
 * Security via HMAC signature verification (X-CC-Webhook-Signature).
 *
 * NOTE: crypto charges are one-time, not recurring subscriptions — a
 * "charge:confirmed" event here activates/extends the current billing
 * period the same way a Paystack charge.success does, but nothing will
 * fire automatically next month. Re-charging is not yet built (see the
 * note in crypto.provider.ts).
 */
@Controller('webhooks/crypto')
export class CryptoWebhookController {
  private readonly logger = new Logger(CryptoWebhookController.name);
  private readonly webhookSecret: string;

  constructor(
    private readonly configService: ConfigService,
    private readonly prisma: PrismaService,
    private readonly billingService: BillingService,
  ) {
    this.webhookSecret = this.configService.get(
      'COINBASE_COMMERCE_WEBHOOK_SECRET',
      '',
    );
  }

  @Public()
  @Post()
  @HttpCode(HttpStatus.OK)
  async handleWebhook(
    @Req() req: any,
    @Body() payload: any,
    @Headers('x-cc-webhook-signature') signature: string,
  ) {
    // Coinbase signs the raw request body. This needs `rawBody: true` passed
    // to NestFactory.create() in main.ts (not currently enabled) for
    // req.rawBody to be populated — without it this falls back to
    // re-stringifying the parsed payload, which works for simple cases but
    // isn't guaranteed byte-identical to what Coinbase actually signed.
    // TODO: enable rawBody capture in main.ts before relying on this in production.
    const rawBody = req.rawBody
      ? req.rawBody.toString('utf8')
      : JSON.stringify(payload);

    if (!this.verifySignature(rawBody, signature)) {
      this.logger.warn('Invalid Coinbase Commerce webhook signature');
      throw new ForbiddenException('Invalid signature');
    }

    const event = payload.event;
    const eventType = event?.type;
    const data = event?.data;
    const eventId = event?.id ? String(event.id) : `${eventType}-${Date.now()}`;

    // ── Idempotency ──────────────────────────
    try {
      const existing = await this.prisma.processedWebhook.findUnique({
        where: { eventId },
      });
      if (existing) {
        this.logger.debug(`Skipping duplicate Coinbase webhook: ${eventId}`);
        return { received: true };
      }
      await this.prisma.processedWebhook.create({
        data: { eventId, processedAt: new Date() },
      });
    } catch (error) {
      this.logger.warn(`Idempotency check failed for ${eventId}: ${error}`);
    }

    this.logger.log(`Coinbase Commerce webhook: ${eventType} (${eventId})`);

    switch (eventType) {
      case 'charge:confirmed':
      case 'charge:resolved':
        await this.handleChargeConfirmed(data);
        break;

      case 'charge:failed':
        await this.handleChargeFailed(data);
        break;

      default:
        this.logger.debug(`Unhandled Coinbase Commerce event: ${eventType}`);
    }

    return { received: true };
  }

  private async handleChargeConfirmed(data: any) {
    const reference = data?.code;
    const email = data?.metadata?.email;
    const planCode = data?.metadata?.planCode;

    if (!reference) {
      this.logger.warn('charge:confirmed with no charge code — skipping');
      return;
    }

    const record = await this.prisma.subscriptionRecord.findFirst({
      where: { provider: 'CRYPTO', providerSubscriptionId: reference },
    });

    if (!record) {
      this.logger.warn(
        `charge:confirmed — no matching SubscriptionRecord for ${reference}`,
      );
      return;
    }

    await this.billingService.activateSubscription(
      record.tenantId,
      planCode || 'starter',
      reference,
      (data.pricing?.local?.amount && Number(data.pricing.local.amount)) || 0,
    );

    this.logger.log(
      `Crypto charge confirmed for tenant ${record.tenantId} (${email || 'no email'})`,
    );
  }

  private async handleChargeFailed(data: any) {
    const reference = data?.code;
    if (!reference) return;

    const record = await this.prisma.subscriptionRecord.findFirst({
      where: { provider: 'CRYPTO', providerSubscriptionId: reference },
    });
    if (!record) return;

    await this.billingService.handlePaymentFailure(record.tenantId, reference);
    this.logger.warn(`Crypto charge failed for tenant ${record.tenantId}`);
  }

  private verifySignature(rawBody: string, signature: string): boolean {
    if (!this.webhookSecret || !signature) return false;

    const hash = createHmac('sha256', this.webhookSecret)
      .update(rawBody)
      .digest('hex');

    return hash === signature;
  }
}
