import { Injectable, Logger, ForbiddenException, BadRequestException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Cron, CronExpression } from '@nestjs/schedule';
import { SubscriptionStatus } from '@prisma/client';
import { PrismaService } from '../../prisma/prisma.service';
import { PaystackProvider } from './paystack.provider';
import { PaypalProvider } from './paypal.provider';
import { CryptoProvider } from './crypto.provider';
import { BillingProvider } from './billing.provider';
import { AuditService } from '../audit/audit.service';
import { getLimitsForPlan } from '../plan/plan-limits';

/** Supported billing providers. Keep in sync with SubscriptionRecord.provider values. */
export type PaymentProvider = 'PAYSTACK' | 'PAYPAL' | 'CRYPTO';

@Injectable()
export class BillingService {
  private readonly logger = new Logger(BillingService.name);

  // Plan code → PlanType mapping, one per provider (each vendor has its own
  // plan identifiers — Paystack plan codes, PayPal plan IDs, etc.)
  private readonly planCodeMaps: Record<PaymentProvider, Record<string, string>>;
  private readonly planIdToCodeMaps: Record<
    PaymentProvider,
    Record<string, string>
  >;
  private readonly planIdToPriceMap: Record<string, number>;
  private readonly currency: string;

  constructor(
    private readonly prisma: PrismaService,
    private readonly configService: ConfigService,
    private readonly paystackProvider: PaystackProvider,
    private readonly paypalProvider: PaypalProvider,
    private readonly cryptoProvider: CryptoProvider,
    private readonly auditService: AuditService,
  ) {
    const paystackCodes = {
      starter: this.configService.get('PAYSTACK_SMS_PLAN_CODE', ''),
      growth: this.configService.get('PAYSTACK_SMS_VOICE_PLAN_CODE', ''),
      pro: this.configService.get('PAYSTACK_SMS_VOICE_AI_PLAN_CODE', ''),
    };

    // PayPal billing plan IDs — created once via the PayPal dashboard/API,
    // analogous to Paystack's PLN_ codes. Empty until configured.
    const paypalCodes = {
      starter: this.configService.get('PAYPAL_STARTER_PLAN_ID', ''),
      growth: this.configService.get('PAYPAL_GROWTH_PLAN_ID', ''),
      pro: this.configService.get('PAYPAL_PRO_PLAN_ID', ''),
    };

    // Crypto has no pre-registered "plan" concept on Coinbase's side — the
    // charge amount is sent directly, so the plan id itself doubles as the code.
    const cryptoCodes = { starter: 'starter', growth: 'growth', pro: 'pro' };

    this.planIdToCodeMaps = {
      PAYSTACK: {
        ...paystackCodes,
        SMS: paystackCodes.starter,
        SMS_VOICE: paystackCodes.growth,
        SMS_VOICE_AI: paystackCodes.pro,
      },
      PAYPAL: {
        ...paypalCodes,
        SMS: paypalCodes.starter,
        SMS_VOICE: paypalCodes.growth,
        SMS_VOICE_AI: paypalCodes.pro,
      },
      CRYPTO: {
        ...cryptoCodes,
        SMS: cryptoCodes.starter,
        SMS_VOICE: cryptoCodes.growth,
        SMS_VOICE_AI: cryptoCodes.pro,
      },
    };

    this.planCodeMaps = {
      PAYSTACK: {
        [paystackCodes.starter]: 'SMS',
        [paystackCodes.growth]: 'SMS_VOICE',
        [paystackCodes.pro]: 'SMS_VOICE_AI',
      },
      PAYPAL: {
        [paypalCodes.starter]: 'SMS',
        [paypalCodes.growth]: 'SMS_VOICE',
        [paypalCodes.pro]: 'SMS_VOICE_AI',
      },
      CRYPTO: {
        starter: 'SMS',
        growth: 'SMS_VOICE',
        pro: 'SMS_VOICE_AI',
      },
    };

    // Load USD prices from environment (in cents)
    // Default: starter=$19, growth=$49, pro=$99 (1900, 4900, 9900 cents)
    const defaultPrices = { starter: 1900, growth: 4900, pro: 9900 };
    try {
      const envPrices = JSON.parse(this.configService.get('DEFAULT_PLAN_PRICES', '{}'));
      Object.assign(defaultPrices, envPrices);
    } catch {
      this.logger.warn('Failed to parse DEFAULT_PLAN_PRICES, using defaults');
    }

    this.planIdToPriceMap = {
      starter: defaultPrices.starter,
      growth: defaultPrices.growth,
      pro: defaultPrices.pro,
      SMS: defaultPrices.starter, // $19.00 -> 1900 cents
      SMS_VOICE: defaultPrices.growth, // $49.00 -> 4900 cents
      SMS_VOICE_AI: defaultPrices.pro, // $99.00 -> 9900 cents
    };

    this.currency = this.configService.get('PAYSTACK_CURRENCY', 'USD');
  }

  /** Backward-compat accessor — existing webhook code reads Paystack's map directly. */
  private get planCodeMap(): Record<string, string> {
    return this.planCodeMaps.PAYSTACK;
  }

  private get planIdToCodeMap(): Record<string, string> {
    return this.planIdToCodeMaps.PAYSTACK;
  }

  private getProvider(provider: PaymentProvider): BillingProvider {
    switch (provider) {
      case 'PAYPAL':
        return this.paypalProvider;
      case 'CRYPTO':
        return this.cryptoProvider;
      case 'PAYSTACK':
      default:
        return this.paystackProvider;
    }
  }

  /**
   * Convert price in cents to display string
   * e.g., priceInCentsToDisplay(1900) → "$19.00"
   */
  priceInCentsToDisplay(cents: number): string {
    const dollars = (cents / 100).toFixed(2);
    return this.currency === 'USD' ? `$${dollars}` : `₦${dollars}`;
  }

  /**
   * Get current currency symbol
   */
  getCurrencySymbol(): string {
    return this.currency === 'USD' ? '$' : '₦';
  }

  // ── Subscription Creation ──────────────────

  async createSubscription(
    tenantId: string,
    userId: string,
    planCode: string,
    email: string,
  ) {
    const tenant = await this.prisma.tenant.findUnique({
      where: { id: tenantId },
    });

    if (!tenant) {
      throw new ForbiddenException('Tenant not found');
    }

    // Create Paystack customer if not exists
    let paystackCustomerId = tenant.paystackCustomerId;

    if (!paystackCustomerId) {
      const owner = await this.prisma.user.findFirst({
        where: { tenantId, role: 'OWNER' },
      });

      const customerResult = await this.paystackProvider.createCustomer({
        email,
        firstName: owner?.firstName ?? undefined,
        lastName: owner?.lastName ?? undefined,
        tenantId,
      });

      if (!customerResult.success) {
        throw new ForbiddenException(
          `Failed to create Paystack customer: ${customerResult.error}`,
        );
      }

      paystackCustomerId = customerResult.customerCode!;

      await this.prisma.tenant.update({
        where: { id: tenantId },
        data: { paystackCustomerId },
      });
    }

    // Check for QA Bypass
    const isQABypass = planCode === 'QA_BYPASS' || planCode.startsWith('BYPASS_');

    if (isQABypass) {
      this.logger.log(`QA Bypass triggered for tenant ${tenantId}`);
      const mockRef = `MOCK_REF_${Date.now()}`;

      await this.prisma.subscriptionRecord.create({
        data: {
          tenantId,
          planType: (this.planCodeMap[planCode] || 'SMS') as any,
          status: SubscriptionStatus.TRIALING,
          providerSubscriptionId: mockRef,
          amount: 0,
          currency: this.currency,
          currentPeriodStart: new Date(),
          currentPeriodEnd: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000),
        },
      });

      return {
        authorizationUrl: `${this.configService.get('FRONTEND_URL', 'http://localhost:3000')}/onboarding/callback?reference=${mockRef}&status=success&bypass=true`,
        reference: mockRef,
      };
    }

    // Initialize subscription
    const planId = this.planCodeMap[planCode];
    const amount = this.planIdToPriceMap[planId];

    const result = await this.paystackProvider.initializeSubscription({
      email,
      customerCode: paystackCustomerId!,
      planCode,
      amount,
    });

    if (!result.success) {
      throw new ForbiddenException(
        `Failed to initialize subscription: ${result.error}`,
      );
    }

    await this.prisma.subscriptionRecord.create({
      data: {
        tenantId,
        provider: 'PAYSTACK',
        providerSubscriptionId: result.reference,
        planType: (this.planCodeMap[planCode] || 'SMS') as any,
        status: 'TRIALING',
        currentPeriodStart: new Date(),
        currentPeriodEnd: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000),
        amount: 0,
        currency: this.currency,
      },
    });

    await this.auditService.log({
      tenantId,
      userId,
      action: 'CREATE',
      entity: 'Subscription',
      entityId: result.reference || 'unknown',
      newValues: { planCode, reference: result.reference },
    });

    return {
      authorizationUrl: result.authorizationUrl,
      reference: result.reference,
    };
  }

  // ── Activate Trial (after card authorization) ──

  /**
   * Called by Paystack webhook on first charge.success when trialActive is false.
   * Starts the 14-day trial clock — trial must NOT start before card is authorized.
   */
  async activateTrialAfterAuthorization(
    tenantId: string,
    paystackCustomerCode?: string,
  ) {
    const trialDays = this.configService.get<number>('TRIAL_DURATION_DAYS', 14);
    const now = new Date();
    const trialEnd = new Date(now.getTime() + trialDays * 24 * 60 * 60 * 1000);
    const limits = getLimitsForPlan('TRIAL');

    await this.prisma.tenant.update({
      where: { id: tenantId },
      data: {
        trialActive: true,
        trialStartDate: now,
        trialEndDate: trialEnd,
        subscriptionStatus: 'TRIALING',
        // Stamp trial limits so low-tier users can't exploit defaults
        contactLimit:        limits.contactLimit,
        workflowLimit:       limits.workflowLimit,
        eventLimit:          limits.eventLimit,
        aiMonthlyLimit:      limits.aiMonthlyLimit,
        whatsappMonthlyLimit: limits.whatsappMonthlyLimit,
        ...(paystackCustomerCode
          ? { paystackCustomerId: paystackCustomerCode }
          : {}),
      },
    });

    await this.auditService.log({
      tenantId,
      action: 'UPDATE',
      entity: 'Tenant',
      entityId: tenantId,
      newValues: {
        trialActive: true,
        trialStartDate: now,
        trialEndDate: trialEnd,
        reason: 'card_authorized',
      },
    });

    this.logger.log(
      `Trial activated for tenant ${tenantId} — ends ${trialEnd.toISOString()}`,
    );
  }

  // ── Activate Subscription ──────────────────

  async activateSubscription(
    tenantId: string,
    planCode: string,
    subscriptionCode: string,
    amount: number,
  ) {
    const planType = this.planCodeMap[planCode] || 'SMS';
    const limits = getLimitsForPlan(planType);

    await this.prisma.tenant.update({
      where: { id: tenantId },
      data: {
        subscriptionStatus: 'ACTIVE',
        planType: planType as any,
        trialActive: false,
        subscriptionRenewalDate: new Date(
          Date.now() + 30 * 24 * 60 * 60 * 1000,
        ),
        // Reset usage counters on plan change
        smsUsageCount: 0,
        voiceUsageCount: 0,
        aiUsageCount: 0,
        whatsappUsageCount: 0,
        automationExecutionsThisMonth: 0,
        // Apply plan-specific limits
        contactLimit:        limits.contactLimit,
        workflowLimit:       limits.workflowLimit,
        eventLimit:          limits.eventLimit,
        aiMonthlyLimit:      limits.aiMonthlyLimit,
        whatsappMonthlyLimit: limits.whatsappMonthlyLimit,
      },
    });

    await this.prisma.subscriptionRecord.updateMany({
      where: { tenantId, providerSubscriptionId: subscriptionCode },
      data: {
        status: 'ACTIVE',
        planType: planType as any,
        amount,
        currentPeriodStart: new Date(),
        currentPeriodEnd: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000),
      },
    });

    await this.auditService.log({
      tenantId,
      action: 'UPDATE',
      entity: 'Subscription',
      entityId: subscriptionCode,
      newValues: { status: 'ACTIVE', planType, trialActive: false },
    });

    this.logger.log(`Subscription activated: tenant ${tenantId} → ${planType}`);
  }

  // ── Deactivate Subscription ────────────────

  async deactivateSubscription(tenantId: string, subscriptionCode: string) {
    await this.prisma.tenant.update({
      where: { id: tenantId },
      data: { subscriptionStatus: 'CANCELLED' },
    });

    await this.prisma.subscriptionRecord.updateMany({
      where: { tenantId, providerSubscriptionId: subscriptionCode },
      data: { status: 'CANCELLED' },
    });

    await this.auditService.log({
      tenantId,
      action: 'UPDATE',
      entity: 'Subscription',
      entityId: subscriptionCode,
      newValues: { status: 'CANCELLED' },
    });

    this.logger.log(`Subscription cancelled: tenant ${tenantId}`);
  }

  // ── Payment Failure ────────────────────────

  async handlePaymentFailure(tenantId: string, reference: string) {
    await this.prisma.tenant.update({
      where: { id: tenantId },
      data: { subscriptionStatus: 'PAST_DUE' },
    });

    await this.auditService.log({
      tenantId,
      action: 'UPDATE',
      entity: 'Subscription',
      entityId: reference,
      newValues: { status: 'PAST_DUE', reason: 'payment_failed' },
    });

    this.logger.warn(`Payment failed: tenant ${tenantId}`);
  }

  // ── Plan Change ────────────────────────────

  async handlePlanChange(
    tenantId: string,
    newPlanCode: string,
    subscriptionCode: string,
  ) {
    const newPlanType = this.planCodeMap[newPlanCode] || 'SMS';

    await this.prisma.tenant.update({
      where: { id: tenantId },
      data: { planType: newPlanType as any },
    });

    await this.auditService.log({
      tenantId,
      action: 'UPDATE',
      entity: 'Subscription',
      entityId: subscriptionCode,
      newValues: { planType: newPlanType },
    });

    this.logger.log(`Plan changed: tenant ${tenantId} → ${newPlanType}`);
  }

  // ── Trial Auto-Conversion (Cron) ───────────

  @Cron(CronExpression.EVERY_HOUR)
  async processExpiredTrials() {
    const now = new Date();

    const expiredTrials = await this.prisma.tenant.findMany({
      where: {
        trialActive: true,
        trialEndDate: { lte: now },
        subscriptionStatus: 'TRIALING',
      },
    });

    if (expiredTrials.length === 0) return;

    this.logger.log(`Processing ${expiredTrials.length} expired trial(s)...`);

    for (const tenant of expiredTrials) {
      try {
        if (!tenant.paystackCustomerId) {
          // No card — restrict access
          await this.prisma.tenant.update({
            where: { id: tenant.id },
            data: { trialActive: false, subscriptionStatus: 'EXPIRED' },
          });

          await this.auditService.log({
            tenantId: tenant.id,
            action: 'UPDATE',
            entity: 'Tenant',
            entityId: tenant.id,
            newValues: {
              trialActive: false,
              subscriptionStatus: 'EXPIRED',
              reason: 'trial_expired_no_card',
            },
          });

          this.logger.warn(`Trial expired: tenant ${tenant.id} — no card`);
          continue;
        }

        // Card on file — mark trial inactive, await Paystack subscription charge
        await this.prisma.tenant.update({
          where: { id: tenant.id },
          data: { trialActive: false },
        });

        await this.auditService.log({
          tenantId: tenant.id,
          action: 'UPDATE',
          entity: 'Tenant',
          entityId: tenant.id,
          newValues: {
            trialActive: false,
            reason: 'trial_expired_awaiting_charge',
          },
        });

        this.logger.log(`Trial expired: tenant ${tenant.id} — awaiting charge`);
      } catch (error: any) {
        this.logger.error(
          `Trial conversion failed for tenant ${tenant.id}: ${error.message}`,
        );
      }
    }
  }

  // ── Billing Info ───────────────────────────

  async getBillingInfo(tenantId: string) {
    const tenant = await this.prisma.tenant.findUnique({
      where: { id: tenantId },
      select: {
        planType: true,
        subscriptionStatus: true,
        trialActive: true,
        trialStartDate: true,
        trialEndDate: true,
        paystackCustomerId: true,
        subscriptionRenewalDate: true,
        smsUsageCount: true,
        voiceUsageCount: true,
        aiUsageCount: true,
        whatsappUsageCount: true,
        smsTrialLimit: true,
        aiTrialLimit: true,
        aiMonthlyLimit: true,
        whatsappMonthlyLimit: true,
      },
    });

    if (!tenant) throw new ForbiddenException('Tenant not found');

    const now = new Date();
    const trialDaysRemaining = tenant.trialEndDate
      ? Math.max(
          0,
          Math.ceil(
            (tenant.trialEndDate.getTime() - now.getTime()) /
              (1000 * 60 * 60 * 24),
          ),
        )
      : 0;

    const subscriptions = await this.prisma.subscriptionRecord.findMany({
      where: { tenantId },
      orderBy: { createdAt: 'desc' },
      take: 5,
    });

    return {
      plan: tenant.planType,
      status: tenant.subscriptionStatus,
      hasPaymentMethod: !!tenant.paystackCustomerId,
      trial: {
        active: tenant.trialActive,
        daysRemaining: trialDaysRemaining,
        endsAt: tenant.trialEndDate,
      },
      renewalDate: tenant.subscriptionRenewalDate,
      usage: {
        sms: { used: tenant.smsUsageCount, limit: tenant.smsTrialLimit },
        voice: { used: tenant.voiceUsageCount },
        ai: {
          used: tenant.aiUsageCount,
          limit: tenant.trialActive
            ? tenant.aiTrialLimit
            : tenant.aiMonthlyLimit,
        },
        whatsapp: {
          used: tenant.whatsappUsageCount,
          limit: tenant.whatsappMonthlyLimit,
        },
      },
      recentSubscriptions: subscriptions,
    };
  }

  async initializeTransaction(
    tenantId: string,
    planId: string, // 'SMS', 'SMS_VOICE', etc.
    email: string,
    provider: PaymentProvider = 'PAYSTACK',
  ) {
    const planCode = this.planIdToCodeMaps[provider]?.[planId];
    if (!planCode) {
      throw new BadRequestException(
        `Invalid plan ID "${planId}" for provider ${provider}`,
      );
    }

    const billingProvider = this.getProvider(provider);
    const result = await billingProvider.initializeSubscription({
      email,
      customerCode: email,
      planCode,
      amount: this.planIdToPriceMap[planId],
    });

    if (!result.success) {
      throw new BadRequestException(result.error);
    }

    // Track the pending subscription so the webhook (or verify() below) has
    // something to match against once payment completes.
    await this.prisma.subscriptionRecord.create({
      data: {
        tenantId,
        provider,
        providerSubscriptionId: result.reference,
        planType: (this.planCodeMaps[provider][planCode] || 'SMS') as any,
        status: 'TRIALING',
        currentPeriodStart: new Date(),
        currentPeriodEnd: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000),
        amount: 0,
        currency: this.currency,
      },
    });

    return {
      authorizationUrl: result.authorizationUrl,
      reference: result.reference,
      provider,
    };
  }

  async verifyTransaction(
    tenantId: string,
    reference: string,
    provider: PaymentProvider = 'PAYSTACK',
  ) {
    if (provider !== 'PAYSTACK') {
      // PayPal/Crypto verification goes through the shared provider
      // interface rather than a hand-rolled fetch, since only Paystack's
      // REST shape was hardcoded here originally.
      const billingProvider = this.getProvider(provider);
      const result = await billingProvider.verifyTransaction(reference);

      if (!result.success || result.status !== 'success') {
        this.logger.error(
          `Payment verification failed for reference ${reference} (${provider}): ${result.error}`,
        );
        throw new BadRequestException('Payment verification failed');
      }

      await this.prisma.tenant.update({
        where: { id: tenantId },
        data: {
          subscriptionStatus: 'TRIALING',
          trialActive: true,
          trialStartDate: new Date(),
          trialEndDate: new Date(Date.now() + 14 * 24 * 60 * 60 * 1000),
        },
      });

      this.logger.log(
        `Payment verified (${provider}) and trial activated for tenant ${tenantId}`,
      );

      return { verified: true };
    }

    const response = await fetch(
      `https://api.paystack.co/transaction/verify/${reference}`,
      {
        headers: {
          Authorization: `Bearer ${this.configService.get('PAYSTACK_SECRET_KEY')}`,
        },
      },
    );
    const data = await response.json();

    if (!data.status || data.data.status !== 'success') {
      this.logger.error(`Payment verification failed for reference ${reference}: ${data.message}`);
      throw new BadRequestException('Payment verification failed');
    }

    // Update tenant subscription status and trial dates
    await this.prisma.tenant.update({
      where: { id: tenantId },
      data: {
        subscriptionStatus: 'TRIALING',
        trialActive: true,
        trialStartDate: new Date(),
        trialEndDate: new Date(Date.now() + 14 * 24 * 60 * 60 * 1000),
      },
    });

    this.logger.log(`Payment verified and trial activated for tenant ${tenantId}`);

    return { verified: true };
  }

  // ──────────────────────────────────────────────────────────────────────
  // TEMPORARY — DEV/TEST ONLY. Remove this method and its controller route
  // (POST /billing/test-checkout) before deploying to production.
  //
  // Fakes a completed checkout for any provider without calling
  // Paystack/PayPal/Coinbase at all, so the onboarding → dashboard flow can
  // be exercised end-to-end in environments that don't have real payment
  // credentials configured. Gated by ENABLE_QA_BYPASS in the controller.
  // ──────────────────────────────────────────────────────────────────────
  async testCheckout(
    tenantId: string,
    planId: string,
    provider: PaymentProvider,
  ) {
    const planType = this.planCodeMaps[provider]?.[
      this.planIdToCodeMaps[provider]?.[planId] ?? ''
    ] || planId;
    const mockRef = `TEST_${provider}_${Date.now()}`;

    await this.prisma.subscriptionRecord.create({
      data: {
        tenantId,
        provider,
        providerSubscriptionId: mockRef,
        planType: planType as any,
        status: 'TRIALING',
        amount: 0,
        currency: this.currency,
        currentPeriodStart: new Date(),
        currentPeriodEnd: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000),
      },
    });

    await this.prisma.tenant.update({
      where: { id: tenantId },
      data: {
        subscriptionStatus: 'TRIALING',
        trialActive: true,
        trialStartDate: new Date(),
        trialEndDate: new Date(Date.now() + 14 * 24 * 60 * 60 * 1000),
      },
    });

    this.logger.warn(
      `[TEST CHECKOUT] Faked ${provider} checkout for tenant ${tenantId}, plan ${planId} — remove before deploy`,
    );

    return {
      authorizationUrl: `${this.configService.get('FRONTEND_URL', 'http://localhost:3001')}/onboarding/callback?provider=${provider}&status=success&test=true`,
      reference: mockRef,
      provider,
    };
  }
}
