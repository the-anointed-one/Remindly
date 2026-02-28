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

        this.logger.log(`Paystack webhook: ${event}`);

        // ── 2. Route events ──────────────────────
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
                this.logger.log(`Invoice event: ${event} — ${data.reference || data.id}`);
                break;

            default:
                this.logger.debug(`Unhandled Paystack event: ${event}`);
        }

        return { received: true };
    }

    // ── Event Handlers ─────────────────────────

    private async handleChargeSuccess(data: any) {
        const email = data.customer?.email;
        const planCode = data.plan?.plan_code;
        const subscriptionCode = data.subscription_code || data.reference;
        const amount = data.amount || 0;

        if (!email) {
            this.logger.warn('charge.success with no customer email — skipping');
            return;
        }

        // Find tenant by Paystack customer or email
        const tenant = await this.findTenantByEmail(email);
        if (!tenant) {
            this.logger.warn(`charge.success — no tenant found for ${email}`);
            return;
        }

        // Store authorization for future charges (trial auto-conversion)
        if (data.authorization?.authorization_code) {
            await this.prisma.tenant.update({
                where: { id: tenant.id },
                data: {
                    paystackCustomerId:
                        tenant.paystackCustomerId || data.customer.customer_code,
                },
            });
        }

        // If this charge is linked to a plan, activate the subscription
        if (planCode) {
            await this.billingService.activateSubscription(
                tenant.id,
                planCode,
                subscriptionCode,
                amount / 100, // kobo → naira
            );
        }

        this.logger.log(
            `charge.success processed for tenant ${tenant.id}`,
        );
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
            (data.amount || 0) / 100,
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

    private async findTenantByEmail(email: string) {
        // Find user by email, then get their tenant
        const user = await this.prisma.user.findFirst({
            where: { email },
            select: {
                tenantId: true,
                tenant: { select: { id: true, paystackCustomerId: true } },
            },
        });

        return user?.tenant || null;
    }
}
