import { fromZonedTime, toZonedTime } from 'date-fns-tz';
import {
  startOfDay,
  endOfDay,
  startOfMonth,
  endOfMonth,
  addMonths,
} from 'date-fns';
import { PrismaService } from '../prisma/prisma.service';

export const DEFAULT_TIMEZONE = 'UTC';

/**
 * Resolve a tenant's business timezone from its `settings.timezone` blob,
 * falling back to UTC when unset. Kept as a free function (not a service) so
 * date-boundary logic in any module can call it with the module's own
 * PrismaService without extra DI wiring.
 */
export async function resolveTenantTimezone(
  prisma: PrismaService,
  tenantId: string,
): Promise<string> {
  const tenant = await prisma.tenant.findUnique({
    where: { id: tenantId },
    select: { settings: true },
  });
  const settings = (tenant?.settings as Record<string, unknown> | null) ?? {};
  const tz = settings.timezone;
  return typeof tz === 'string' && tz.trim() ? tz : DEFAULT_TIMEZONE;
}

/**
 * Start/end of the calendar day *in the given timezone*, returned as absolute
 * UTC instants suitable for a Prisma `gte`/`lte` on a UTC-stored column. This
 * is the difference between "today" in America/Toronto vs the server's UTC
 * clock near a day boundary.
 */
export function dayRangeInTz(
  tz: string,
  ref: Date = new Date(),
): { start: Date; end: Date } {
  const zoned = toZonedTime(ref, tz);
  return {
    start: fromZonedTime(startOfDay(zoned), tz),
    end: fromZonedTime(endOfDay(zoned), tz),
  };
}

/**
 * Default calendar-feed window when the caller doesn't pass from/to: the start
 * of the current month through the end of next month, anchored to the tenant's
 * timezone (mirrors the old server-local `[monthStart, month+2 day 0]` range).
 */
export function defaultMonthRangeInTz(
  tz: string,
  ref: Date = new Date(),
): { from: Date; to: Date } {
  const zoned = toZonedTime(ref, tz);
  return {
    from: fromZonedTime(startOfMonth(zoned), tz),
    to: fromZonedTime(endOfMonth(addMonths(zoned, 1)), tz),
  };
}
