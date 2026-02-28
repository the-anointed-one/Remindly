import {
    Injectable,
    Logger,
    ForbiddenException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Cron, CronExpression } from '@nestjs/schedule';
import { PrismaService } from '../../prisma/prisma.service';
import { PaystackProvider } from './paystack.provider';
import { AuditService } from '../audit/audit.service';

@Injectable()
export class BillingService {
    private readonly logger = new Logger(BillingService.name);

    // Plan code → PlanType mapping
    private readonly planCodeMap: Record<string, string>;

    constructor(
        private readonly prisma: PrismaService,
        private readonly configService: ConfigService,
        private readonly paystackProvider: PaystackProvider,
        private readonly auditService: AuditService,
    ) {
        this.planCodeMap = {
            [this.configService.get('PAYSTACK_SMS_PLAN_CODE', '')]: 'SMS',
            [this.configService.get('PAYSTACK_SMS_VOICE_PLAN_CODE', '')]: 'SMS_VOICE',
            [this.configService.get('PAYSTACK_SMS_VOICE_AI_PLAN_CODE', '')]: 'SMS_VOICE_AI',
        };
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

        // Initialize subscription
        const result = await this.paystackProvider.initializeSubscription({
            customerCode: email,
            planCode,
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

    // ── Activate Subscription ──────────────────

    async activateSubscription(
        tenantId: string,
        planCode: string,
        subscriptionCode: string,
        amount: number,
    ) {
        const planType = this.planCodeMap[planCode] || 'SMS';

        await this.prisma.tenant.update({
            where: { id: tenantId },
            data: {
                subscriptionStatus: 'ACTIVE',
                planType: planType as any,
                trialActive: false,
                subscriptionRenewalDate: new Date(
                    Date.now() + 30 * 24 * 60 * 60 * 1000,
                ),
                smsUsageCount: 0,
                voiceUsageCount: 0,
                aiUsageCount: 0,
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
                smsTrialLimit: true,
                aiTrialLimit: true,
                aiMonthlyLimit: true,
            },
        });

        if (!tenant) throw new ForbiddenException('Tenant not found');

        const now = new Date();
        const trialDaysRemaining = tenant.trialEndDate
            ? Math.max(0, Math.ceil((tenant.trialEndDate.getTime() - now.getTime()) / (1000 * 60 * 60 * 24)))
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
                ai: { used: tenant.aiUsageCount, limit: tenant.trialActive ? tenant.aiTrialLimit : tenant.aiMonthlyLimit },
            },
            recentSubscriptions: subscriptions,
        };
    }
}
