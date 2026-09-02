/**
 * Meetora — Application Entry Point (Production-Ready)
 *
 * SCALABILITY STRATEGY:
 * ─────────────────────
 * 1. HORIZONTAL SCALING: The API is stateless (JWT auth, no sessions).
 *    Run multiple instances behind a load balancer (nginx, ALB, etc).
 *
 * 2. WORKER SCALING: The BullMQ reminder worker is a separate process
 *    (src/workers/reminder.worker.ts). Scale workers independently from
 *    the API. Each worker processes jobs with concurrency=5 by default.
 *    Scale by running more worker processes: `npm run worker:reminder`.
 *
 * 3. DATABASE: PostgreSQL handles read replicas natively. Configure
 *    Prisma with `replicaRead` for read scaling when needed.
 *
 * 4. REDIS: Used for BullMQ job queues. Supports Redis Cluster for HA.
 *    Configure via REDIS_HOST/REDIS_PORT/REDIS_PASSWORD.
 *
 * 5. RATE LIMITING: Global (100 req/60s per IP) + per-route throttling.
 *    Uses in-memory store by default; switch to Redis store in multi-instance.
 *
 * 6. GRACEFUL SHUTDOWN: SIGTERM/SIGINT handlers ensure in-flight requests
 *    complete, database connections close, and BullMQ workers drain.
 */

import { NestFactory } from '@nestjs/core';
import { ValidationPipe, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import helmet from 'helmet';
import compression from 'compression';
import cookieParser from 'cookie-parser';
import basicAuth from 'express-basic-auth';
import { AppModule } from './app.module';
import { createBullBoard } from '@bull-board/api';
import { BullMQAdapter } from '@bull-board/api/bullMQAdapter';
import { ExpressAdapter } from '@bull-board/express';
import { Queue } from 'bullmq';
import {
  WORKFLOW_QUEUE,
  EVENT_WORKFLOW_QUEUE,
  REMINDER_QUEUE,
  CAMPAIGN_QUEUE,
  getRedisConnection,
} from './queue/queue.config';
import { initSentry, captureException } from './common/sentry';

// ── Error tracking ───────────────────────────
// Initialize before bootstrap() (and before the safety-net handlers below can
// fire). No-op unless SENTRY_DSN is set, so local dev is unaffected.
initSentry('api');

// ── Process-level safety net ─────────────────
// NestJS's own exception filters already catch errors thrown inside a
// request/controller and turn them into proper HTTP error responses — those
// never crash the process. This is for everything outside that cycle:
// background cron/interval code, fire-and-forget calls missing a .catch(),
// or a bug in a library. Node kills the whole process by default for an
// unhandled rejection or uncaught exception; that means every in-flight
// request drops and the API is briefly down until Docker restarts it, with
// no record of why. Log it loudly instead — this is the customer-facing
// API, a silent crash here is the most disruptive place it could happen.
const processLogger = new Logger('ProcessSafetyNet');

process.on('unhandledRejection', (reason: unknown) => {
  processLogger.error(
    `🚨 Unhandled promise rejection in API process: ${reason instanceof Error ? reason.stack : String(reason)}`,
  );
  captureException(reason);
});

process.on('uncaughtException', (err: Error) => {
  processLogger.error(`🚨 Uncaught exception in API process: ${err.stack}`);
  captureException(err);
});

async function bootstrap() {
  const logger = new Logger('Bootstrap');

  const app = await NestFactory.create(AppModule, {
    // Production: only error, warn, log. Dev: all levels.
    logger:
      process.env.NODE_ENV === 'production'
        ? ['error', 'warn', 'log']
        : ['error', 'warn', 'log', 'debug', 'verbose'],
  });

  // ── Security ────────────────────────────────
  app.use(helmet()); // Security headers (XSS, CSP, etc.)
  app.use(compression()); // Gzip/Brotli compression
  app.use(cookieParser()); // Parse HttpOnly auth cookies

  // ── Global Prefix ───────────────────────────
  app.setGlobalPrefix('api');

  // ── Validation ──────────────────────────────
  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true, // Strip unknown properties
      forbidNonWhitelisted: true, // Reject unknown properties
      transform: true, // Auto-transform payloads to DTOs
    }),
  );

  // ── CORS ────────────────────────────────────
  const configService = app.get(ConfigService);
  const allowedOriginsRaw = configService.get<string>(
    'CORS_ORIGINS',
    'http://localhost:3001',
  );
  // Support comma-separated list: "https://app.meetora.co,https://www.meetora.co"
  const allowedOrigins = allowedOriginsRaw
    .split(',')
    .map((o) => o.trim())
    .filter(Boolean);

  app.enableCors({
    origin: allowedOrigins.length === 1 ? allowedOrigins[0] : allowedOrigins,
    credentials: true,
    methods: ['GET', 'POST', 'PUT', 'DELETE', 'PATCH', 'OPTIONS'],
    allowedHeaders: ['Content-Type', 'Authorization', 'X-Tenant-ID'],
  });

  // ── Graceful Shutdown ───────────────────────
  app.enableShutdownHooks();

  // ── Bull Board (queue monitor) ───────────────
  const serverAdapter = new ExpressAdapter();
  serverAdapter.setBasePath('/queues');
  const connection = getRedisConnection();
  createBullBoard({
    queues: [
      WORKFLOW_QUEUE,
      EVENT_WORKFLOW_QUEUE,
      REMINDER_QUEUE,
      CAMPAIGN_QUEUE,
    ].map((name) => new BullMQAdapter(new Queue(name, { connection }))),
    serverAdapter,
  });
  // Protect Bull Board with HTTP Basic Auth.
  // Set QUEUE_BASIC_AUTH_USER + QUEUE_BASIC_AUTH_PASS in .env.
  // In development (no creds set) access is still guarded — set the vars.
  const queueUser = configService.get<string>('QUEUE_BASIC_AUTH_USER', '');
  const queuePass = configService.get<string>('QUEUE_BASIC_AUTH_PASS', '');
  if (!queueUser || !queuePass) {
    logger.warn(
      '⚠️  QUEUE_BASIC_AUTH_USER / QUEUE_BASIC_AUTH_PASS not set — /queues is disabled',
    );
    app.use('/queues', (_req: any, res: any) =>
      res.status(503).json({ message: 'Queue dashboard not configured' }),
    );
  } else {
    app.use(
      '/queues',
      basicAuth({ users: { [queueUser]: queuePass }, challenge: true }),
      serverAdapter.getRouter(),
    );
    logger.log(`📊 Bull Board available at /queues (basic auth required)`);
  }

  // ── Start ───────────────────────────────────
  const port = configService.get<number>('PORT', 3000);
  await app.listen(port);

  logger.log(`🚀 Meetora API listening on port ${port}`);
  logger.log(`📋 Environment: ${configService.get('NODE_ENV', 'development')}`);
  logger.log(`🔒 CORS origins: ${allowedOrigins}`);
}

bootstrap();
