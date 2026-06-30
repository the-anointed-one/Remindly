import { Injectable, Logger, OnModuleDestroy } from '@nestjs/common';
import Redis from 'ioredis';

const MAX_EXECUTIONS = 5;
const WINDOW_SECONDS = 60 * 60; // 1 hour

/**
 * Tracks per-automation-per-contact execution counts within a rolling window
 * to detect and break infinite automation loops.
 *
 * Uses Redis so loop detection works correctly across multiple API replicas.
 */
@Injectable()
export class AutomationExecutionTracker implements OnModuleDestroy {
  private readonly logger = new Logger(AutomationExecutionTracker.name);
  private readonly redis: Redis;

  constructor() {
    this.redis = new Redis({
      host:     process.env.REDIS_HOST || 'localhost',
      port:     parseInt(process.env.REDIS_PORT || '6379', 10),
      password: process.env.REDIS_PASSWORD || undefined,
      lazyConnect: true,
    });
  }

  async onModuleDestroy() {
    await this.redis.quit();
  }

  /**
   * Record an execution attempt. Returns false if the maximum execution count
   * for this automation+contact pair is exceeded within the rolling window.
   */
  async trackExecution(automationId: string, contactId: string): Promise<boolean> {
    const key = `loop:${automationId}:${contactId}`;

    const count = await this.redis.incr(key);

    if (count === 1) {
      // First call in this window — set expiry
      await this.redis.expire(key, WINDOW_SECONDS);
    }

    if (count > MAX_EXECUTIONS) {
      this.logger.warn(
        `Automation loop detected — automationId=${automationId} contactId=${contactId} ` +
          `exceeded ${MAX_EXECUTIONS} executions within the last hour. Blocking further runs.`,
      );
      return false;
    }

    return true;
  }

  /** Expose current count for monitoring/testing. */
  async getCount(automationId: string, contactId: string): Promise<number> {
    const val = await this.redis.get(`loop:${automationId}:${contactId}`);
    return parseInt(val ?? '0', 10);
  }

  /** Reset a specific key (e.g., after admin intervention). */
  async reset(automationId: string, contactId: string): Promise<void> {
    await this.redis.del(`loop:${automationId}:${contactId}`);
  }
}
