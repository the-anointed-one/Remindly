import { Controller, Get } from '@nestjs/common';
import {
  HealthCheck,
  HealthCheckService,
  MemoryHealthIndicator,
  DiskHealthIndicator,
} from '@nestjs/terminus';
import { PrismaService } from '../prisma/prisma.service';
import { Public } from '../common/decorators';

@Controller('health')
export class HealthController {
  constructor(
    private health: HealthCheckService,
    private memory: MemoryHealthIndicator,
    private disk: DiskHealthIndicator,
    private prisma: PrismaService,
  ) {}

  @Public()
  @Get()
  @HealthCheck()
  check() {
    return this.health.check([
      // Database connectivity
      async () => {
        try {
          await this.prisma.$queryRaw`SELECT 1`;
          return { database: { status: 'up' } };
        } catch {
          return { database: { status: 'down' } };
        }
      },
      // Memory: heap should be under 512MB
      () => this.memory.checkHeap('memory_heap', 512 * 1024 * 1024),
      // Disk: usage under 98%
      () =>
        this.disk.checkStorage('disk', { path: '/', thresholdPercent: 0.98 }),
    ]);
  }

  // Simple liveness probe for Kubernetes/Docker
  @Public()
  @Get('live')
  live() {
    return { status: 'ok', timestamp: new Date().toISOString() };
  }

  // Readiness probe — checks if app can serve traffic
  @Public()
  @Get('ready')
  async ready() {
    try {
      await this.prisma.$queryRaw`SELECT 1`;
      return { status: 'ready', timestamp: new Date().toISOString() };
    } catch {
      return { status: 'not_ready', timestamp: new Date().toISOString() };
    }
  }
}
