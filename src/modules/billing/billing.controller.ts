import { Controller, Get, Post, Body, Req, UseGuards, Logger } from '@nestjs/common';
import { BillingService } from './billing.service';
import { CurrentUser } from '../../common/decorators';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { QaBypassGuard } from '../../common/guards/qa-bypass.guard';
import { InitializeBillingDto } from './dto/initialize-billing.dto';
import { AuditService } from '../audit/audit.service';
import { ConfigService } from '@nestjs/config';

@Controller('billing')
export class BillingController {
  private readonly logger = new Logger(BillingController.name);

  constructor(
    private readonly billingService: BillingService,
    private readonly auditService: AuditService,
    private readonly configService: ConfigService,
  ) {}

  @Get()
  getBillingInfo(@CurrentUser('tenantId') tenantId: string) {
    return this.billingService.getBillingInfo(tenantId);
  }

  @Post('subscribe')
  subscribe(
    @CurrentUser('tenantId') tenantId: string,
    @CurrentUser('userId') userId: string,
    @Body() body: { planCode: string; email: string },
  ) {
    return this.billingService.createSubscription(
      tenantId,
      userId,
      body.planCode,
      body.email,
    );
  }

  @Post('initialize')
  @UseGuards(JwtAuthGuard)
  async initialize(
    @CurrentUser('tenantId') tenantId: string,
    @CurrentUser('email') email: string,
    @Body() body: InitializeBillingDto,
  ) {
    return this.billingService.initializeTransaction(
      tenantId,
      body.plan,
      email,
      body.provider || 'PAYSTACK',
    );
  }

  // ──────────────────────────────────────────────────────────────────────
  // TEMPORARY — DEV/TEST ONLY. Remove before deploying to production.
  // Fakes a completed checkout for any provider (Paystack/PayPal/Crypto)
  // without calling out to the real payment vendor, so the onboarding flow
  // can be tested end-to-end without live payment credentials configured.
  // Gated the same way as /billing/initialize-qa: requires
  // ENABLE_QA_BYPASS=true (non-production only) plus a valid x-qa-bypass
  // header matching QA_BYPASS_TOKEN.
  // ──────────────────────────────────────────────────────────────────────
  @Post('test-checkout')
  @UseGuards(JwtAuthGuard, QaBypassGuard)
  async testCheckout(
    @CurrentUser('tenantId') tenantId: string,
    @Body() body: InitializeBillingDto,
    @Req() req: any,
  ) {
    if (!req.qaMockPayment) {
      this.logger.warn('test-checkout attempted without valid QA bypass');
      return {
        success: false,
        error: 'Test checkout is disabled — set ENABLE_QA_BYPASS and pass a valid x-qa-bypass header',
      };
    }

    return this.billingService.testCheckout(
      tenantId,
      body.plan,
      body.provider || 'PAYSTACK',
    );
  }

  @Post('initialize-qa')
  @UseGuards(JwtAuthGuard, QaBypassGuard)
  async initializeQa(
    @CurrentUser('tenantId') tenantId: string,
    @CurrentUser('userId') userId: string,
    @CurrentUser('email') email: string,
    @Body() body: InitializeBillingDto,
    @Req() req: any,
  ) {
    // Check if QA bypass is actually enabled
    if (!req.qaMockPayment) {
      this.logger.warn('QA payment attempted without valid bypass token');
      return {
        success: false,
        error: 'QA bypass not enabled or invalid token',
      };
    }

    // Generate a mock reference
    const mockReference = `qa_${Date.now()}_${Math.random().toString(36).substring(2, 11)}`;

    this.logger.log(`QA bypass payment initialized for ${email}, reference: ${mockReference}`);

    // Log for audit
    await this.auditService.log({
      tenantId,
      userId,
      action: 'CREATE',
      entity: 'Subscription',
      entityId: mockReference,
      newValues: {
        plan: body.plan,
        reference: mockReference,
        qaBypass: true,
        environment: process.env.NODE_ENV,
      },
    });

    // Return mock authorization URL that will redirect to callback with success
    const callbackUrl = this.configService.get(
      'PAYSTACK_CALLBACK_URL',
      `${this.configService.get('FRONTEND_URL', 'http://localhost:3001')}/onboarding/callback`,
    );

    // Add QA bypass parameters to callback URL for seamless flow
    const mockCallbackUrl = `${callbackUrl}?reference=${mockReference}&qaBypass=true&plan=${body.plan}`;

    return {
      success: true,
      authorizationUrl: mockCallbackUrl,
      reference: mockReference,
      qaBypass: true,
    };
  }

  @Post('verify')
  @UseGuards(JwtAuthGuard)
  async verify(
    @CurrentUser('tenantId') tenantId: string,
    @CurrentUser('userId') userId: string,
    @Body() body: { reference: string },
    @Req() req: any,
  ) {
    // Check if this is a QA mock transaction
    if (body.reference?.startsWith('qa_')) {
      this.logger.log(`QA transaction verified: ${body.reference}`);

      // Log QA verification
      await this.auditService.log({
        tenantId,
        userId,
        action: 'UPDATE',
        entity: 'Subscription',
        entityId: body.reference,
        newValues: {
          status: 'verified',
          qaBypass: true,
        },
      });

      return {
        verified: true,
        qaBypass: true,
        reference: body.reference,
      };
    }

    return this.billingService.verifyTransaction(
      tenantId,
      body.reference,
    );
  }
}
