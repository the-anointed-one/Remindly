/**
 * Health Check Module
 *
 * Provides /api/health endpoint for load balancers, Docker health checks,
 * and monitoring systems (e.g., UptimeRobot, Datadog).
 *
 * Checks:
 * - Database connectivity (Prisma)
 * - Memory usage (heap < 512MB)
 * - Disk usage (< 90%)
 */
import { Module } from '@nestjs/common';
import { TerminusModule } from '@nestjs/terminus';
import { HealthController } from './health.controller';

@Module({
  imports: [TerminusModule],
  controllers: [HealthController],
})
export class HealthModule {}
