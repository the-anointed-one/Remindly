import { Injectable, Logger, ForbiddenException, OnModuleDestroy } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { FeatureType } from './usage-validation.service';
import Redis from 'ioredis';

/**
 * Redis-backed rate limiter for SMS (hourly) and AI (daily during trial).
 *
 * Uses Redis INCR + EXPIRE so limits are enforced globally across all
 * API replicas and workers — no in-memory state.
 */
@Injectable()
export class RateLimitService implements OnModuleDestroy {
  private readonly logger = new Logger(RateLimitService.name);
  private readonly redis: Redis;

  private readonly hourlySmsLimit: number;
  private readonly dailyAiLimit: number;

  constructor(private readonly configService: ConfigService) {
    this.hourlySmsLimit = this.configService.get<number>('HOURLY_SMS_RATE_LIMIT', 20);
    this.dailyAiLimit   = this.configService.get<number>('TRIAL_DAILY_AI_LIMIT', 2);

    this.redis = new Redis({
      host:     this.configService.get<string>('REDIS_HOST', 'localhost'),
      port:     this.configService.get<number>('REDIS_PORT', 6379),
      password: this.configService.get<string>('REDIS_PASSWORD') || undefined,
      lazyConnect: true,
    });
  }

  async onModuleDestroy() {
    await this.redis.quit();
  }

  /**
   * Check and consume a rate limit slot.
   * Throws ForbiddenException if rate limit exceeded.
   */
  async checkRateLimit(tenantId: string, feature: FeatureType, isTrial: boolean) {
    if (feature === 'SMS') {
      await this.enforceWindow(tenantId, 'SMS', this.hourlySmsLimit, 60 * 60); // 1 hour TTL in seconds
    }

    if (feature === 'AI' && isTrial) {
      await this.enforceWindow(tenantId, 'AI_DAILY', this.dailyAiLimit, 24 * 60 * 60); // 24h
    }
  }

  private async enforceWindow(
    tenantId: string,
    bucket: string,
    limit: number,
    windowSeconds: number,
  ) {
    const key = `rl:${tenantId}:${bucket}`;

    // INCR returns new count; SET expiry only on first increment
    const count = await this.redis.incr(key);

    if (count === 1) {
      // First call in this window — set expiry
      await this.redis.expire(key, windowSeconds);
    }

    if (count > limit) {
      const ttl = await this.redis.ttl(key);
      const resetInMinutes = Math.ceil(ttl / 60);
      const unit = bucket === 'AI_DAILY' ? 'daily' : 'hourly';

      this.logger.warn(
        `Rate limit hit: tenant ${tenantId}, bucket ${bucket}, count ${count}/${limit}`,
      );

      throw new ForbiddenException(
        `${bucket.replace('_', ' ')} rate limit exceeded (${limit}/${unit}). Try again in ${resetInMinutes} minutes.`,
      );
    }
  }

  /**
   * Get rate limit status for a tenant (for headers / dashboard).
   */
  async getStatus(tenantId: string, feature: FeatureType) {
    const bucket  = feature === 'SMS' ? 'SMS' : 'AI_DAILY';
    const key     = `rl:${tenantId}:${bucket}`;
    const limit   = feature === 'SMS' ? this.hourlySmsLimit : this.dailyAiLimit;

    const [countStr, ttl] = await Promise.all([
      this.redis.get(key),
      this.redis.ttl(key),
    ]);

    const count = parseInt(countStr ?? '0', 10);

    return {
      remaining: Math.max(0, limit - count),
      resetAt: ttl > 0 ? new Date(Date.now() + ttl * 1000).toISOString() : null,
    };
  }

  /** No-op — kept for API compatibility; Redis TTLs handle cleanup automatically. */
  cleanup() {}
}
