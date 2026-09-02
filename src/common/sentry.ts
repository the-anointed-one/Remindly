import * as Sentry from '@sentry/node';
import { Logger } from '@nestjs/common';

// Centralized, opt-in Sentry wiring shared by the API and the worker processes.
//
// Everything is gated on SENTRY_DSN: with no DSN set (e.g. local dev) init is a
// no-op and captureException() does nothing, so the app runs identically
// without an account configured. Each process (api, reminder-worker,
// campaign-worker) calls initSentry() once at startup.

const logger = new Logger('Sentry');
let enabled = false;

export function initSentry(context: string): boolean {
  if (enabled) return true;
  const dsn = process.env.SENTRY_DSN;
  if (!dsn) return false;
  Sentry.init({
    dsn,
    environment: process.env.NODE_ENV || 'development',
  });
  enabled = true;
  logger.log(`Error tracking enabled (${context}, env=${process.env.NODE_ENV})`);
  return true;
}

export function isSentryEnabled(): boolean {
  return enabled;
}

/** Report an exception to Sentry. No-op when Sentry isn't configured. */
export function captureException(err: unknown): void {
  if (!enabled) return;
  Sentry.captureException(err);
}
