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
import axios from 'axios';
import { Public } from '../../common/decorators';
import { PrismaService } from '../../prisma/prisma.service';
import { BillingService } from './billing.service';

/**
 * PayPal webhook controller.
 * @Public — PayPal can't authenticate with JWT.
 *
 * PayPal signature verification is a live API call (unlike Paystack/Coinbase's
 * local HMAC check) — it POSTs the transmission headers + webhook event back
 * to PayPal's /v1/notifications/verify-webhook-signature endpoint and trusts
 * whatever it returns. Requires PAYPAL_WEBHOOK_ID (from the PayPal dashboard
 * webhook config) plus the same PAYPAL_CLIENT_ID/SECRET used elsewhere.
 */
@Controller('webhooks/paypal')
export class PaypalWebhookController {
  private readonly logger = new Logger(PaypalWebhookController.name);
  private readonly clientId: string;
  private readonly clientSecret: string;
  private readonly webhookId: string;
  private readonly baseUrl: string;

  constructor(
    private readonly configService: ConfigService,
    private readonly prisma: PrismaService,
    private readonly billingService: BillingService,
  ) {
    this.clientId = this.configService.get('PAYPAL_CLIENT_ID', '');
    this.clientSecret = this.configService.get('PAYPAL_CLIENT_SECRET', '');
    this.webhookId = this.configService.get('PAYPAL_WEBHOOK_ID', '');
    const mode = this.configService.get('PAYPAL_MODE', 'sandbox');
    this.baseUrl =
      mode === 'live'
        ? 'https://api-m.paypal.com'
        : 'https://api-m.sandbox.paypal.com';
  }

  @Public()
  @Post()
  @HttpCode(HttpStatus.OK)
  async handleWebhook(
    @Body() payload: any,
    @Headers('paypal-transmission-id') transmissionId: string,
    @Headers('paypal-transmission-time') transmissionTime: string,
    @Headers('paypal-transmission-sig') transmissionSig: string,
    @Headers('paypal-cert-url') certUrl: string,
    @Headers('paypal-auth-algo') authAlgo: string,
  ) {
    const verified = await this.verifySignature({
      transmissionId,
      transmissionTime,
      transmissionSig,
      certUrl,
      authAlgo,
      payload,
    });

    if (!verified) {
      this.logger.warn('Invalid PayPal webhook signature — ignoring event');
      // Return 200 anyway: PayPal retries aggressively on non-2xx, and we
      // don't want to leak whether verification failed vs. succeeded.
      return { received: true };
    }

    const eventType = payload.event_type;
    const eventId = payload.id ? String(payload.id) : `${eventType}-${Date.now()}`;
    const resource = payload.resource;

    try {
      const existing = await this.prisma.processedWebhook.findUnique({
        where: { eventId },
      });
      if (existing) {
        this.logger.debug(`Skipping duplicate PayPal webhook: ${eventId}`);
        return { received: true };
      }
      await this.prisma.processedWebhook.create({
        data: { eventId, processedAt: new Date() },
      });
    } catch (error) {
      this.logger.warn(`Idempotency check failed for ${eventId}: ${error}`);
    }

    this.logger.log(`PayPal webhook: ${eventType} (${eventId})`);

    switch (eventType) {
      case 'BILLING.SUBSCRIPTION.ACTIVATED':
        await this.handleSubscriptionActivated(resource);
        break;

      case 'BILLING.SUBSCRIPTION.CANCELLED':
      case 'BILLING.SUBSCRIPTION.EXPIRED':
        await this.handleSubscriptionCancelled(resource);
        break;

      case 'PAYMENT.SALE.DENIED':
      case 'BILLING.SUBSCRIPTION.PAYMENT.FAILED':
        await this.handlePaymentFailed(resource);
        break;

      default:
        this.logger.debug(`Unhandled PayPal event: ${eventType}`);
    }

    return { received: true };
  }

  private async handleSubscriptionActivated(resource: any) {
    const subscriptionId = resource?.id;
    if (!subscriptionId) return;

    const record = await this.prisma.subscriptionRecord.findFirst({
      where: { provider: 'PAYPAL', providerSubscriptionId: subscriptionId },
    });
    if (!record) {
      this.logger.warn(
        `BILLING.SUBSCRIPTION.ACTIVATED — no matching SubscriptionRecord for ${subscriptionId}`,
      );
      return;
    }

    const planId = resource?.plan_id;
    await this.billingService.activateSubscription(
      record.tenantId,
      planId || 'starter',
      subscriptionId,
      Number(resource?.billing_info?.last_payment?.amount?.value) || 0,
    );

    this.logger.log(
      `PayPal subscription activated for tenant ${record.tenantId}`,
    );
  }

  private async handleSubscriptionCancelled(resource: any) {
    const subscriptionId = resource?.id;
    if (!subscriptionId) return;

    const record = await this.prisma.subscriptionRecord.findFirst({
      where: { provider: 'PAYPAL', providerSubscriptionId: subscriptionId },
    });
    if (!record) return;

    await this.billingService.deactivateSubscription(
      record.tenantId,
      subscriptionId,
    );
    this.logger.log(
      `PayPal subscription cancelled for tenant ${record.tenantId}`,
    );
  }

  private async handlePaymentFailed(resource: any) {
    const subscriptionId = resource?.billing_agreement_id || resource?.id;
    if (!subscriptionId) return;

    const record = await this.prisma.subscriptionRecord.findFirst({
      where: { provider: 'PAYPAL', providerSubscriptionId: subscriptionId },
    });
    if (!record) return;

    await this.billingService.handlePaymentFailure(
      record.tenantId,
      subscriptionId,
    );
    this.logger.warn(`PayPal payment failed for tenant ${record.tenantId}`);
  }

  // ── PayPal signature verification (live API call) ──

  private async verifySignature(params: {
    transmissionId: string;
    transmissionTime: string;
    transmissionSig: string;
    certUrl: string;
    authAlgo: string;
    payload: any;
  }): Promise<boolean> {
    if (!this.clientId || !this.clientSecret || !this.webhookId) {
      this.logger.warn(
        'PayPal webhook verification skipped — PAYPAL_CLIENT_ID/SECRET/WEBHOOK_ID not fully configured',
      );
      return false;
    }

    try {
      const { data: tokenData } = await axios.post(
        `${this.baseUrl}/v1/oauth2/token`,
        'grant_type=client_credentials',
        {
          auth: { username: this.clientId, password: this.clientSecret },
          headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
        },
      );

      const { data } = await axios.post(
        `${this.baseUrl}/v1/notifications/verify-webhook-signature`,
        {
          transmission_id: params.transmissionId,
          transmission_time: params.transmissionTime,
          cert_url: params.certUrl,
          auth_algo: params.authAlgo,
          transmission_sig: params.transmissionSig,
          webhook_id: this.webhookId,
          webhook_event: params.payload,
        },
        { headers: { Authorization: `Bearer ${tokenData.access_token}` } },
      );

      return data.verification_status === 'SUCCESS';
    } catch (error: any) {
      this.logger.error(
        `PayPal webhook signature verification request failed: ${error.message}`,
      );
      return false;
    }
  }
}
