import * as http from 'http';
import { Queue } from 'bullmq';
import { Logger } from '@nestjs/common';

// Shared, lightweight HTTP health endpoint for the BullMQ worker processes.
//
// The old docker-compose healthcheck (`ps aux | grep node`) only proved the
// process existed — it stayed "healthy" while the worker was deadlocked, cut
// off from Redis, or otherwise not making progress. This exposes a real
// liveness signal on an internal port (not published in docker-compose) that
// the healthcheck can wget:
//
//   • Redis connectivity — a PING via the queue's own client.
//   • Progress — how long since a job last completed/failed. Only treated as
//     unhealthy if the worker is ALSO behind (queue has waiting jobs); a worker
//     that's idle simply because there's no work is still healthy.

const DEFAULT_MAX_IDLE_MS = 10 * 60 * 1000; // 10 minutes
const REDIS_PROBE_TIMEOUT_MS = 2000;

interface WorkerHealthOptions {
  name: string;
  port: number;
  /** The queue this worker consumes — used for both the Redis PING and the
   *  waiting-job count. */
  queue: Queue;
  /** Returns the epoch-ms of the last completed/failed job. */
  getLastProcessedAt: () => number;
  maxIdleMs?: number;
  logger: Logger;
}

function withTimeout<T>(p: Promise<T>, ms: number): Promise<T> {
  return Promise.race([
    p,
    new Promise<T>((_, reject) =>
      setTimeout(() => reject(new Error('timeout')), ms),
    ),
  ]);
}

export function startWorkerHealthServer(
  opts: WorkerHealthOptions,
): http.Server {
  const maxIdleMs = opts.maxIdleMs ?? DEFAULT_MAX_IDLE_MS;

  const server = http.createServer(async (req, res) => {
    if (!req.url || !req.url.startsWith('/health')) {
      res.writeHead(404);
      res.end();
      return;
    }

    const idleMs = Date.now() - opts.getLastProcessedAt();

    let redisOk = false;
    let waiting = 0;
    let redisError: string | undefined;
    try {
      // A hung Redis with maxRetriesPerRequest:null would otherwise make these
      // calls wait forever, so bound them — a timeout counts as "unhealthy".
      const probe = await withTimeout(
        (async () => {
          const client = await opts.queue.client;
          const pong = await client.ping();
          const waitingCount = await opts.queue.getWaitingCount();
          return { pong, waitingCount };
        })(),
        REDIS_PROBE_TIMEOUT_MS,
      );
      redisOk = probe.pong === 'PONG';
      waiting = probe.waitingCount;
    } catch (err: any) {
      redisError = err?.message ?? 'redis error';
    }

    // "Stuck" = not making progress while there is work waiting to be done.
    const stalled = idleMs > maxIdleMs && waiting > 0;
    const ok = redisOk && !stalled;

    const body = {
      status: ok ? 'ok' : 'unhealthy',
      worker: opts.name,
      redis: redisOk ? 'ok' : `unreachable${redisError ? `: ${redisError}` : ''}`,
      idleMs,
      maxIdleMs,
      waiting,
      stalled,
    };

    res.writeHead(ok ? 200 : 503, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify(body));
  });

  server.on('error', (err) => {
    opts.logger.error(`Health server error (${opts.name}): ${err.message}`);
  });

  server.listen(opts.port, () => {
    opts.logger.log(
      `🩺 ${opts.name} health endpoint listening on :${opts.port}/health`,
    );
  });

  return server;
}
