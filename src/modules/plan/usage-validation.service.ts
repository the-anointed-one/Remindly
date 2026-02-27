import {
    Injectable,
    Logger,
    ForbiddenException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { PrismaService } from '../../prisma/prisma.service';
import type { Tenant } from '@prisma/client';
import { AuditService } from '../audit/audit.service';

export type FeatureType = 'SMS' | 'VOICE' | 'AI';

export interface UsageCheckResult {
    allowed: boolean;
    reason?: string;
    remaining?: number;
}

@Injectable()
export class UsageValidationService {
    private readonly logger = new Logger(UsageValidationService.name);

    constructor(
        private readonly prisma: PrismaService,
        private readonly configService: ConfigService,
        private readonly auditService: AuditService,
    ) { }

    /**
     * Check whether a tenant can use a feature, and optionally increment usage.
     * Throws ForbiddenException if blocked.
     */
    async validateAndIncrement(
        tenantId: string,
        feature: FeatureType,
        userId?: string,
    ): Promise<UsageCheckResult> {
        const tenant = await this.prisma.tenant.findUnique({
            where: { id: tenantId },
        });

        if (!tenant) {
            throw new ForbiddenException('Tenant not found');
        }

        // 1. Check trial / subscription status
        const statusCheck = this.checkSubscriptionAccess(tenant, feature);
        if (!statusCheck.allowed) {
            await this.logBlockedAttempt(tenantId, userId, feature, statusCheck.reason!);
            throw new ForbiddenException(statusCheck.reason);
        }

        // 2. Check feature-specific limits
        const limitCheck = this.checkFeatureLimits(tenant, feature);
        if (!limitCheck.allowed) {
            await this.logBlockedAttempt(tenantId, userId, feature, limitCheck.reason!);
            throw new ForbiddenException(limitCheck.reason);
        }

        // 3. Increment usage
        await this.incrementUsage(tenantId, feature);

        return {
            allowed: true,
            remaining: limitCheck.remaining ? limitCheck.remaining - 1 : undefined,
        };
    }

    /**
     * Check-only (don't increment). Use for pre-flight checks.
     */
    async validate(tenantId: string, feature: FeatureType): Promise<UsageCheckResult> {
        const tenant = await this.prisma.tenant.findUnique({
            where: { id: tenantId },
        });

        if (!tenant) {
            return { allowed: false, reason: 'Tenant not found' };
        }

        const statusCheck = this.checkSubscriptionAccess(tenant, feature);
        if (!statusCheck.allowed) return statusCheck;

        return this.checkFeatureLimits(tenant, feature);
    }

    // ── Subscription / Trial status check ──────

    private checkSubscriptionAccess(tenant: Tenant, feature: FeatureType): UsageCheckResult {
        const now = new Date();

        // Trial active?
        if (tenant.trialActive) {
            // Check if trial has expired
            if (tenant.trialEndDate && now > tenant.trialEndDate) {
                // Trial expired — check if they have an active subscription
                if (tenant.subscriptionStatus !== 'ACTIVE') {
                    return {
                        allowed: false,
                        reason: 'Trial has expired. Please subscribe to continue using Remindly.',
                    };
                }
                // They subscribed during trial — allow
            }

            // Voice is disabled during trial
            if (feature === 'VOICE') {
                return {
                    allowed: false,
                    reason: 'Voice features are not available during the trial period. Please upgrade your plan.',
                };
            }

            return { allowed: true };
        }

        // Not on trial — must have active subscription
        if (tenant.subscriptionStatus !== 'ACTIVE') {
            return {
                allowed: false,
                reason: 'No active subscription. Please subscribe to access this feature.',
            };
        }

        // Check plan-level feature access
        return this.checkPlanAccess(tenant, feature);
    }

    // ── Plan-level feature access ──────────────

    private checkPlanAccess(tenant: Tenant, feature: FeatureType): UsageCheckResult {
        switch (feature) {
            case 'SMS':
                // All plans include SMS
                return { allowed: true };

            case 'VOICE':
                if (tenant.planType === 'SMS') {
                    return {
                        allowed: false,
                        reason: 'Voice features require SMS_VOICE or SMS_VOICE_AI plan.',
                    };
                }
                return { allowed: true };

            case 'AI':
                if (tenant.planType !== 'SMS_VOICE_AI') {
                    return {
                        allowed: false,
                        reason: 'AI features require SMS_VOICE_AI plan.',
                    };
                }
                return { allowed: true };

            default:
                return { allowed: false, reason: `Unknown feature: ${feature}` };
        }
    }

    // ── Feature-specific limits ────────────────

    private checkFeatureLimits(tenant: Tenant, feature: FeatureType): UsageCheckResult {
        if (tenant.trialActive || tenant.subscriptionStatus === 'TRIALING') {
            return this.checkTrialLimits(tenant, feature);
        }

        // Active subscription — check monthly AI limit
        if (feature === 'AI') {
            if (tenant.aiUsageCount >= tenant.aiMonthlyLimit) {
                return {
                    allowed: false,
                    reason: `Monthly AI usage limit reached (${tenant.aiMonthlyLimit}). Resets at next billing cycle.`,
                    remaining: 0,
                };
            }
            return {
                allowed: true,
                remaining: tenant.aiMonthlyLimit - tenant.aiUsageCount,
            };
        }

        return { allowed: true };
    }

    private checkTrialLimits(tenant: Tenant, feature: FeatureType): UsageCheckResult {
        switch (feature) {
            case 'SMS':
                if (tenant.smsUsageCount >= tenant.smsTrialLimit) {
                    return {
                        allowed: false,
                        reason: `Trial SMS limit reached (${tenant.smsTrialLimit}). Please subscribe to continue.`,
                        remaining: 0,
                    };
                }
                return {
                    allowed: true,
                    remaining: tenant.smsTrialLimit - tenant.smsUsageCount,
                };

            case 'AI':
                if (tenant.aiUsageCount >= tenant.aiTrialLimit) {
                    return {
                        allowed: false,
                        reason: `Trial AI limit reached (${tenant.aiTrialLimit}). Please subscribe to continue.`,
                        remaining: 0,
                    };
                }
                return {
                    allowed: true,
                    remaining: tenant.aiTrialLimit - tenant.aiUsageCount,
                };

            default:
                return { allowed: true };
        }
    }

    // ── Usage increment ────────────────────────

    private async incrementUsage(tenantId: string, feature: FeatureType) {
        const field =
            feature === 'SMS'
                ? 'smsUsageCount'
                : feature === 'VOICE'
                    ? 'voiceUsageCount'
                    : 'aiUsageCount';

        await this.prisma.tenant.update({
            where: { id: tenantId },
            data: { [field]: { increment: 1 } },
        });
    }

    // ── Blocked attempt logging ────────────────

    private async logBlockedAttempt(
        tenantId: string,
        userId: string | undefined,
        feature: FeatureType,
        reason: string,
    ) {
        this.logger.warn(
            `Blocked ${feature} attempt for tenant ${tenantId}: ${reason}`,
        );

        await this.auditService.log({
            tenantId,
            userId,
            action: 'CREATE',
            entity: 'BlockedAttempt',
            entityId: tenantId,
            newValues: { feature, reason, timestamp: new Date().toISOString() },
        });
    }

    // ── Usage stats (for dashboards) ───────────

    async getUsageStats(tenantId: string) {
        const tenant = await this.prisma.tenant.findUnique({
            where: { id: tenantId },
            select: {
                planType: true,
                subscriptionStatus: true,
                trialActive: true,
                trialStartDate: true,
                trialEndDate: true,
                smsUsageCount: true,
                voiceUsageCount: true,
                aiUsageCount: true,
                smsTrialLimit: true,
                aiTrialLimit: true,
                aiMonthlyLimit: true,
            },
        });

        if (!tenant) {
            throw new ForbiddenException('Tenant not found');
        }

        const now = new Date();
        const trialDaysRemaining = tenant.trialEndDate
            ? Math.max(0, Math.ceil((tenant.trialEndDate.getTime() - now.getTime()) / (1000 * 60 * 60 * 24)))
            : 0;

        return {
            plan: tenant.planType,
            status: tenant.subscriptionStatus,
            trial: {
                active: tenant.trialActive,
                daysRemaining: trialDaysRemaining,
                endsAt: tenant.trialEndDate,
            },
            usage: {
                sms: {
                    used: tenant.smsUsageCount,
                    limit: tenant.trialActive ? tenant.smsTrialLimit : null,
                },
                voice: { used: tenant.voiceUsageCount },
                ai: {
                    used: tenant.aiUsageCount,
                    limit: tenant.trialActive ? tenant.aiTrialLimit : tenant.aiMonthlyLimit,
                },
            },
        };
    }
}
