import {
    Injectable,
    Logger,
    ForbiddenException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { PrismaService } from '../../prisma/prisma.service';
import { FeatureType } from './usage-validation.service';

/**
 * In-memory rate limiter for SMS (hourly) and AI (daily during trial).
 *
 * For production, replace the in-memory Map with Redis
 * to support multi-instance deployments.
 */
@Injectable()
export class RateLimitService {
    private readonly logger = new Logger(RateLimitService.name);

    // Map<tenantId:feature, { count, windowStart }>
    private readonly windows = new Map<
        string,
        { count: number; windowStart: number }
    >();

    private readonly hourlySmsLimit: number;
    private readonly dailyAiLimit: number;

    constructor(
        private readonly configService: ConfigService,
        private readonly prisma: PrismaService,
    ) {
        this.hourlySmsLimit = this.configService.get<number>('HOURLY_SMS_RATE_LIMIT', 20);
        this.dailyAiLimit = this.configService.get<number>('TRIAL_DAILY_AI_LIMIT', 2);
    }

    /**
     * Check and consume a rate limit slot.
     * Throws ForbiddenException if rate limit exceeded.
     */
    async checkRateLimit(tenantId: string, feature: FeatureType, isTrial: boolean) {
        if (feature === 'SMS') {
            this.enforceWindow(tenantId, 'SMS', this.hourlySmsLimit, 60 * 60 * 1000); // 1 hour
        }

        if (feature === 'AI' && isTrial) {
            this.enforceWindow(tenantId, 'AI_DAILY', this.dailyAiLimit, 24 * 60 * 60 * 1000); // 24 hours
        }
    }

    private enforceWindow(
        tenantId: string,
        bucket: string,
        limit: number,
        windowMs: number,
    ) {
        const key = `${tenantId}:${bucket}`;
        const now = Date.now();
        const entry = this.windows.get(key);

        if (!entry || now - entry.windowStart > windowMs) {
            // New window
            this.windows.set(key, { count: 1, windowStart: now });
            return;
        }

        if (entry.count >= limit) {
            const resetIn = Math.ceil((entry.windowStart + windowMs - now) / 1000 / 60);
            const unit = bucket === 'AI_DAILY' ? 'daily' : 'hourly';

            this.logger.warn(
                `Rate limit hit: tenant ${tenantId}, bucket ${bucket}, count ${entry.count}/${limit}`,
            );

            throw new ForbiddenException(
                `${bucket.replace('_', ' ')} rate limit exceeded (${limit}/${unit}). Try again in ${resetIn} minutes.`,
            );
        }

        entry.count++;
    }

    /**
     * Get rate limit status for a tenant (for headers / dashboard).
     */
    getStatus(tenantId: string, feature: FeatureType) {
        const key = `${tenantId}:${feature}`;
        const entry = this.windows.get(key);

        if (!entry) {
            return {
                remaining: feature === 'SMS' ? this.hourlySmsLimit : this.dailyAiLimit,
                resetAt: null,
            };
        }

        const windowMs = feature === 'SMS' ? 60 * 60 * 1000 : 24 * 60 * 60 * 1000;
        const limit = feature === 'SMS' ? this.hourlySmsLimit : this.dailyAiLimit;

        return {
            remaining: Math.max(0, limit - entry.count),
            resetAt: new Date(entry.windowStart + windowMs).toISOString(),
        };
    }

    /**
     * Periodic cleanup of expired windows (call from a cron job or interval).
     */
    cleanup() {
        const now = Date.now();
        const maxWindow = 24 * 60 * 60 * 1000; // 24h

        for (const [key, entry] of this.windows.entries()) {
            if (now - entry.windowStart > maxWindow) {
                this.windows.delete(key);
            }
        }
    }
}
