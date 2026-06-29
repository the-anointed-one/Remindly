import {
  Injectable,
  Logger,
  BadRequestException,
  NotFoundException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Queue } from 'bullmq';
import { CalendarProvider, CalendarSyncStatus } from '@prisma/client';
import { PrismaService } from '../../prisma/prisma.service';
import { ReminderSchedulerService } from '../reminder/reminder-scheduler.service';
import { WorkflowEngineService } from '../automation/workflow-engine.service';
import { GoogleCalendarProvider } from './providers/google-calendar.provider';
import { OutlookCalendarProvider } from './providers/outlook-calendar.provider';
import {
  CALENDAR_SYNC_QUEUE,
  getRedisConnection,
} from '../../queue/queue.config';

@Injectable()
export class CalendarIntegrationService {
  private readonly logger = new Logger(CalendarIntegrationService.name);
  private readonly syncQueue: Queue;

  constructor(
    private readonly prisma: PrismaService,
    private readonly config: ConfigService,
    private readonly googleProvider: GoogleCalendarProvider,
    private readonly outlookProvider: OutlookCalendarProvider,
    private readonly reminderScheduler: ReminderSchedulerService,
    private readonly workflowEngine: WorkflowEngineService,
  ) {
    this.syncQueue = new Queue(CALENDAR_SYNC_QUEUE, {
      connection: getRedisConnection(),
    });
  }

  // ── OAuth connect ─────────────────────────

  getConnectUrl(tenantId: string, provider: CalendarProvider): { url: string } {
    const state = Buffer.from(
      JSON.stringify({ tenantId, provider, ts: Date.now() }),
    ).toString('base64url');
    const url =
      provider === CalendarProvider.GOOGLE
        ? this.googleProvider.buildAuthUrl(state)
        : this.outlookProvider.buildAuthUrl(state);
    return { url };
  }

  async handleOAuthCallback(
    code: string,
    state: string,
  ): Promise<{ provider: CalendarProvider; email: string }> {
    let parsed: { tenantId: string; provider: CalendarProvider; ts: number };
    try {
      parsed = JSON.parse(Buffer.from(state, 'base64url').toString('utf8'));
    } catch {
      throw new BadRequestException('Invalid OAuth state');
    }

    const { tenantId, provider } = parsed;

    let tokens: {
      accessToken: string;
      refreshToken: string;
      expiresAt: Date;
      email: string;
    };

    if (provider === CalendarProvider.GOOGLE) {
      tokens = await this.googleProvider.exchangeCode(code);
    } else {
      tokens = await this.outlookProvider.exchangeCode(code);
    }

    await this.prisma.calendarConnection.upsert({
      where: { tenantId_provider: { tenantId, provider } },
      create: {
        tenantId,
        provider,
        accessToken: tokens.accessToken,
        refreshToken: tokens.refreshToken,
        expiresAt: tokens.expiresAt,
        email: tokens.email,
        syncStatus: CalendarSyncStatus.IDLE,
      },
      update: {
        accessToken: tokens.accessToken,
        refreshToken: tokens.refreshToken,
        expiresAt: tokens.expiresAt,
        email: tokens.email,
        syncStatus: CalendarSyncStatus.IDLE,
        syncError: null,
      },
    });

    this.logger.log(
      `Calendar connected: tenant=${tenantId} provider=${provider} email=${tokens.email}`,
    );

    // Enqueue an immediate sync
    await this.syncQueue.add(
      'sync-calendar',
      { tenantId, provider },
      { attempts: 3, backoff: { type: 'exponential', delay: 10_000 } },
    );

    return { provider, email: tokens.email };
  }

  // ── List connections ──────────────────────

  async getConnections(tenantId: string) {
    const connections = await this.prisma.calendarConnection.findMany({
      where: { tenantId },
      select: {
        id: true,
        provider: true,
        email: true,
        syncStatus: true,
        lastSyncAt: true,
        syncError: true,
        connectedAt: true,
        _count: { select: { syncedEvents: true } },
      },
    });
    return connections.map((c) => ({
      ...c,
      eventCount: c._count.syncedEvents,
    }));
  }

  // ── Disconnect ────────────────────────────

  async disconnect(tenantId: string, provider: CalendarProvider) {
    const connection = await this.prisma.calendarConnection.findUnique({
      where: { tenantId_provider: { tenantId, provider } },
    });
    if (!connection)
      throw new NotFoundException('Calendar connection not found');

    await this.prisma.calendarConnection.delete({
      where: { id: connection.id },
    });
    this.logger.log(
      `Calendar disconnected: tenant=${tenantId} provider=${provider}`,
    );
  }

  // ── Token refresh helper ──────────────────

  private async getFreshToken(connectionId: string): Promise<string> {
    const connection = await this.prisma.calendarConnection.findUniqueOrThrow({
      where: { id: connectionId },
    });

    if (connection.expiresAt > new Date(Date.now() + 60_000)) {
      return connection.accessToken;
    }

    const refreshed =
      connection.provider === CalendarProvider.GOOGLE
        ? await this.googleProvider.refreshAccessToken(connection.refreshToken)
        : await this.outlookProvider.refreshAccessToken(
            connection.refreshToken,
          );

    await this.prisma.calendarConnection.update({
      where: { id: connectionId },
      data: {
        accessToken: refreshed.accessToken,
        expiresAt: refreshed.expiresAt,
      },
    });

    return refreshed.accessToken;
  }

  // ── Sync events ───────────────────────────

  async syncConnection(
    tenantId: string,
    provider: CalendarProvider,
  ): Promise<{ synced: number; created: number }> {
    const connection = await this.prisma.calendarConnection.findUnique({
      where: { tenantId_provider: { tenantId, provider } },
    });
    if (!connection)
      throw new NotFoundException('Calendar connection not found');

    await this.prisma.calendarConnection.update({
      where: { id: connection.id },
      data: { syncStatus: CalendarSyncStatus.SYNCING },
    });

    try {
      const result = await this.performSync(connection.id, tenantId, provider);

      await this.prisma.calendarConnection.update({
        where: { id: connection.id },
        data: {
          syncStatus: CalendarSyncStatus.IDLE,
          lastSyncAt: new Date(),
          syncError: null,
        },
      });

      return result;
    } catch (err: any) {
      await this.prisma.calendarConnection.update({
        where: { id: connection.id },
        data: {
          syncStatus: CalendarSyncStatus.ERROR,
          syncError: err.message,
        },
      });
      throw err;
    }
  }

  private async performSync(
    connectionId: string,
    tenantId: string,
    provider: CalendarProvider,
  ): Promise<{ synced: number; created: number }> {
    const accessToken = await this.getFreshToken(connectionId);
    const now = new Date();
    const windowEnd = new Date(now.getTime() + 30 * 24 * 60 * 60 * 1000); // 30 days ahead

    let synced = 0;
    let created = 0;

    if (provider === CalendarProvider.GOOGLE) {
      let pageToken: string | undefined;
      do {
        const { events, nextPageToken } = await this.googleProvider.listEvents(
          accessToken,
          now,
          windowEnd,
          pageToken,
        );
        pageToken = nextPageToken;

        for (const event of events) {
          if (!event.summary) continue;
          const startAt = new Date(
            event.start.dateTime || event.start.date || '',
          );
          const endAt = new Date(event.end.dateTime || event.end.date || '');
          if (isNaN(startAt.getTime())) continue;

          const isNew = await this.upsertSyncedEvent(connectionId, tenantId, {
            externalEventId: event.id,
            title: event.summary,
            startAt,
            endAt,
            attendeeEmail: event.attendees?.[0]?.email,
          });
          synced++;
          if (isNew) created++;
        }
      } while (pageToken);
    } else {
      let skipToken: string | undefined;
      do {
        const { events, nextSkipToken } = await this.outlookProvider.listEvents(
          accessToken,
          now,
          windowEnd,
          skipToken,
        );
        skipToken = nextSkipToken;

        for (const event of events) {
          if (!event.subject) continue;
          const startAt = new Date(event.start.dateTime);
          const endAt = new Date(event.end.dateTime);
          if (isNaN(startAt.getTime())) continue;

          const isNew = await this.upsertSyncedEvent(connectionId, tenantId, {
            externalEventId: event.id,
            title: event.subject,
            startAt,
            endAt,
            attendeeEmail: event.attendees?.[0]?.emailAddress?.address,
          });
          synced++;
          if (isNew) created++;
        }
      } while (skipToken);
    }

    this.logger.log(
      `Calendar sync complete: connectionId=${connectionId} synced=${synced} created=${created}`,
    );
    return { synced, created };
  }

  /**
   * Upsert a synced event. If new, also create an Appointment + schedule reminders.
   * Returns true if the event was newly created.
   */
  private async upsertSyncedEvent(
    connectionId: string,
    tenantId: string,
    data: {
      externalEventId: string;
      title: string;
      startAt: Date;
      endAt: Date;
      attendeeEmail?: string;
    },
  ): Promise<boolean> {
    const existing = await this.prisma.calendarSyncedEvent.findUnique({
      where: {
        connectionId_externalEventId: {
          connectionId,
          externalEventId: data.externalEventId,
        },
      },
    });
    if (existing) return false;

    let customerId: string | null = null;
    if (data.attendeeEmail) {
      const customer = await this.prisma.customer.findFirst({
        where: { tenantId, email: data.attendeeEmail },
      });
      customerId = customer?.id ?? null;
    }

    let appointmentId: string | null = null;
    let eventId: string | null = null;

    if (customerId) {
      const contact = await this.prisma.contact.findFirst({
        where: { tenantId, email: data.attendeeEmail },
      });
      const durationOut =
        Math.round((data.endAt.getTime() - data.startAt.getTime()) / 60000) ||
        30;

      const event = await this.prisma.event.create({
        data: {
          tenantId,
          title: data.title,
          startTime: data.startAt,
          endTime: data.endAt,
          status: 'ACTIVE',
          eventType: 'APPOINTMENT',
          appointments: {
            create: {
              tenantId,
              customerId,
              title: data.title,
              scheduledAt: data.startAt,
              durationMinutes: durationOut,
            },
          },
          participants: contact
            ? {
                create: {
                  tenantId,
                  contactId: contact.id,
                  status: 'confirmed',
                },
              }
            : undefined,
        },
        include: { appointments: true },
      });
      appointmentId = event.appointments[0].id;
      eventId = event.id;

      if (appointmentId) {
        await this.reminderScheduler
          .scheduleForAppointment(appointmentId, tenantId)
          .catch((err) => {
            this.logger.warn(
              `Could not schedule reminders for calendar appointment ${appointmentId}: ${err.message}`,
            );
          });

        // Fire new Event automation trigger
        this.workflowEngine
          .fireTrigger(tenantId, 'event_created', event.id, {
            eventId: event.id,
            eventTitle: event.title,
            customerId: customerId ?? undefined,
            tenantId,
          })
          .catch(() => {});
      }
    }

    await this.prisma.calendarSyncedEvent.create({
      data: {
        connectionId,
        tenantId,
        externalEventId: data.externalEventId,
        title: data.title,
        startAt: data.startAt,
        endAt: data.endAt,
        attendeeEmail: data.attendeeEmail,
        appointmentId,
        eventId,
      },
    });

    return true;
  }

  // ── Manual sync trigger ───────────────────

  async enqueueSyncNow(
    tenantId: string,
    provider: CalendarProvider,
  ): Promise<{ queued: true }> {
    const connection = await this.prisma.calendarConnection.findUnique({
      where: { tenantId_provider: { tenantId, provider } },
    });
    if (!connection)
      throw new NotFoundException('Calendar connection not found');

    await this.syncQueue.add(
      'sync-calendar',
      { tenantId, provider },
      { attempts: 3, backoff: { type: 'exponential', delay: 10_000 } },
    );

    return { queued: true };
  }
}
