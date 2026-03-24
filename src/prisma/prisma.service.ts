/**
 * PrismaService — Database Client with Graceful Shutdown
 *
 * SCALABILITY NOTES:
 * - Connection pooling is managed by Prisma's query engine (default: 10 connections)
 * - For high-traffic, increase via DATABASE_URL?connection_limit=20
 * - Read replicas: use Prisma's @prisma/extension-read-replicas for read scaling
 * - Graceful shutdown ensures in-flight queries complete before disconnect
 */
import {
  Injectable,
  OnModuleInit,
  OnModuleDestroy,
  Logger,
} from '@nestjs/common';
import { PrismaClient } from '@prisma/client';

@Injectable()
export class PrismaService
  extends PrismaClient
  implements OnModuleInit, OnModuleDestroy
{
  private readonly logger = new Logger(PrismaService.name);

  constructor() {
    super({
      log:
        process.env.NODE_ENV === 'production'
          ? ['error', 'warn']
          : ['query', 'info', 'warn', 'error'],
    });
  }

  async onModuleInit() {
    await this.$connect();
    this.logger.log('✅ Database connected');
  }

  async onModuleDestroy() {
    this.logger.log('🔄 Graceful shutdown: disconnecting database...');
    await this.$disconnect();
    this.logger.log('✅ Database disconnected');
  }
}
