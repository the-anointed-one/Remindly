import {
  Controller,
  Post,
  Body,
  Headers,
  Logger,
  HttpCode,
  HttpStatus,
  ForbiddenException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { createHmac } from 'crypto';
import { Public } from '../../common/decorators';
import { PrismaService } from '../../prisma/prisma.service';
import { BillingService } from './billing.service';

/**
 * Paystack webhook controller.
 * @Public — Paystack can't authenticate with JWT.
 * Security via HMAC signature verification.
 */
@Controller('webhooks/paystack')
export class PaystackWebhookController {
  private readonly logger = new Logger(PaystackWebhookController.name);
  private readonly webhookSecret: string;

  constructor(
    private readonly configService: ConfigService,
    private readonly prisma: PrismaService,
    private readonly billingService: BillingService,
  ) {
    this.webhookSecret = this.configService.get('PAYSTACK_SECRET_KEY', '');
  }

  @Public()
  @Post()
  @HttpCode(HttpStatus.OK)
  async handleWebhook(
    @Body() payload: any,
    @Headers('x-paystack-signature') signature: string,
  ) {
    // ── 1. Verify signature ──────────────────
    if (!this.verifySignature(JSON.stringify(payload), signature)) {
      this.logger.warn('Invalid Paystack webhook signature');
      throw new ForbiddenException('Invalid signature');
    }

    const event = payload.event;
    const data = payload.data;
    const eventId = payload.id ? String(payload.id) : `${event}-${Date.now()}`;

    // ── 2. Idempotency Check ─────────────────
    try {
      const existing = await this.prisma.processedWebhook.findUnique({
        where: { eventId },
      });
      if (existing) {
        this.logger.debug(`Skipping duplicate webhook: ${eventId}`);
        return { received: true };
      }
      await this.prisma.processedWebhook.create({
        data: { eventId, processedAt: new Date() },
      });
    } catch (error) {
      this.logger.warn(`Idempotency check failed for ${eventId}: ${error}`);
      // Proceed anyway if DB errors, better to process than drop a payment
    }

    this.logger.log(`Paystack webhook: ${event} (${eventId})`);

    // ── 3. Route events ──────────────────────
    switch (event) {
      case 'charge.success':
        await this.handleChargeSuccess(data);
        break;

      case 'subscription.create':
        await this.handleSubscriptionCreate(data);
        break;

      case 'subscription.not_renew':
      case 'subscription.disable':
        await this.handleSubscriptionCancel(data);
        break;

      case 'invoice.payment_failed':
        await this.handleInvoiceFailed(data);
        break;

      case 'invoice.update':
      case 'invoice.create':
        this.logger.log(
          `Invoice event: ${event} — ${data.reference || data.id}`,
        );
        break;

      default:
        this.logger.debug(`Unhandled Paystack event: ${event}`);
    }

    return { received: true };
  }

  /**
   * QA-only simulation endpoint to bypass actual Paystack interactions.
   * Requires X_QA_BYPASS_TOKEN.
   */
  @Public()
  @Post('qa-simulate')
  @HttpCode(HttpStatus.OK)
  async simulateWebhook(@Body() body: any) {
    const bypassToken = this.configService.get('X_QA_BYPASS_TOKEN');
    if (!bypassToken || body.token !== bypassToken) {
      this.logger.warn('Unauthorized QA simulation attempt');
      throw new ForbiddenException('Invalid bypass token');
    }

    const { event, email, planCode, amount, reference } = body;
    this.logger.log(`QA Simulation: simulating ${event} for ${email}`);

    if (event === 'charge.success') {
      const data = {
        customer: { email, customer_code: `CUS_MOCK_${Date.now()}` },
        plan: { plan_code: planCode },
        reference: reference || `REF_MOCK_${Date.now()}`,
        amount: amount || 1900,
      };
      await this.handleChargeSuccess(data);
    }

    return { simulated: true };
  }

  // ── Event Handlers ─────────────────────────

  private async handleChargeSuccess(data: any) {
    const email = data.customer?.email;
    const planCode = data.plan?.plan_code;
    const subscriptionCode = data.subscription_code || data.reference;
    const amount = data.amount || 0;
    const customerCode = data.customer?.customer_code;

    if (!email) {
      this.logger.warn('charge.success with no customer email — skipping');
      return;
    }

    const tenant = await this.findTenantWithStatus(email);
    if (!tenant) {
      this.logger.warn(`charge.success — no tenant found for ${email}`);
      return;
    }

    // ── Case 1: First card authorization — tenant has no active trial yet
    // Trial clock starts ONLY here, never at registration.
    if (!tenant.trialActive && tenant.subscriptionStatus === 'TRIALING') {
      await this.billingService.activateTrialAfterAuthorization(
        tenant.id,
        customerCode,
      );
      this.logger.log(
        `Trial activated for tenant ${tenant.id} via charge.success`,
      );
      return;
    }

    // ── Case 2: Recurring charge linked to a plan → activate full subscription
    if (planCode) {
      await this.billingService.activateSubscription(
        tenant.id,
        planCode,
        subscriptionCode,
        amount / 100, // cents → dollars (works for both USD cents and NGN kobo)
      );
    } else {
      // Store customer code if we got one and don't have it yet
      if (customerCode && !tenant.paystackCustomerId) {
        await this.prisma.tenant.update({
          where: { id: tenant.id },
          data: { paystackCustomerId: customerCode },
        });
      }
    }

    this.logger.log(`charge.success processed for tenant ${tenant.id}`);
  }

  private async handleSubscriptionCreate(data: any) {
    const email = data.customer?.email;
    const planCode = data.plan?.plan_code;
    const subscriptionCode = data.subscription_code;

    if (!email) return;

    const tenant = await this.findTenantByEmail(email);
    if (!tenant) return;

    await this.billingService.activateSubscription(
      tenant.id,
      planCode,
      subscriptionCode,
      (data.amount || 0) / 100, // cents → dollars
    );

    this.logger.log(`subscription.create processed for tenant ${tenant.id}`);
  }

  private async handleSubscriptionCancel(data: any) {
    const email = data.customer?.email;
    const subscriptionCode = data.subscription_code;

    if (!email) return;

    const tenant = await this.findTenantByEmail(email);
    if (!tenant) return;

    await this.billingService.deactivateSubscription(
      tenant.id,
      subscriptionCode,
    );

    this.logger.log(`subscription.cancel processed for tenant ${tenant.id}`);
  }

  private async handleInvoiceFailed(data: any) {
    const email = data.customer?.email;
    const reference = data.reference || data.id;

    if (!email) return;

    const tenant = await this.findTenantByEmail(email);
    if (!tenant) return;

    await this.billingService.handlePaymentFailure(tenant.id, reference);

    this.logger.warn(`invoice.payment_failed for tenant ${tenant.id}`);
  }

  // ── Helpers ────────────────────────────────

  private verifySignature(body: string, signature: string): boolean {
    if (!this.webhookSecret || !signature) return false;

    const hash = createHmac('sha512', this.webhookSecret)
      .update(body)
      .digest('hex');

    return hash === signature;
  }

  /** Returns minimal tenant info for event routing. */
  private async findTenantByEmail(email: string) {
    const user = await this.prisma.user.findFirst({
      where: { email },
      select: {
        tenantId: true,
        tenant: { select: { id: true, paystackCustomerId: true } },
      },
    });

    return user?.tenant || null;
  }

  /** Returns tenant with trial/subscription status for charge routing logic. */
  private async findTenantWithStatus(email: string) {
    const user = await this.prisma.user.findFirst({
      where: { email },
      select: {
        tenant: {
          select: {
            id: true,
            paystackCustomerId: true,
            trialActive: true,
            subscriptionStatus: true,
          },
        },
      },
    });

    return user?.tenant || null;
  }
}
