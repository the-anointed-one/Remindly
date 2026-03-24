import { Injectable, Logger } from '@nestjs/common';
import { Cron, CronExpression } from '@nestjs/schedule';
import { PrismaService } from '../../prisma/prisma.service';

/**
 * Resets per-tenant monthly usage counters on the first of every month.
 * Uses a DB-level update so it's safe with multiple API replicas.
 */
@Injectable()
export class UsageResetJob {
  private readonly logger = new Logger(UsageResetJob.name);

  constructor(private readonly prisma: PrismaService) {}

  /** Runs at midnight UTC on the 1st of every month */
  @Cron(CronExpression.EVERY_1ST_DAY_OF_MONTH_AT_MIDNIGHT)
  async resetMonthlyUsage(): Promise<void> {
    this.logger.log('Running monthly usage reset…');

    try {
      const { count } = await this.prisma.tenant.updateMany({
        data: {
          automationExecutionsThisMonth: 0,
          lastResetDate: new Date(),
        },
      });

      this.logger.log(`Monthly usage reset complete — ${count} tenants updated`);
    } catch (err) {
      this.logger.error('Monthly usage reset failed', err);
    }
  }
}
