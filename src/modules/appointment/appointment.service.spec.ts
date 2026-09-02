// Avoid a real BullMQ/Redis connection from the constructor.
jest.mock('bullmq', () => ({
  Queue: jest.fn().mockImplementation(() => ({ add: jest.fn() })),
}));
jest.mock('../../queue/queue.config', () => ({
  ...jest.requireActual('../../queue/queue.config'),
  getRedisConnection: () => ({}),
}));

import { BadRequestException } from '@nestjs/common';
import { AppointmentService } from './appointment.service';

// A group of three contacts; "Bob" is the one whose booking will fail.
const CONTACTS = [
  { id: 'c1', name: 'Alice A', phone: '+15551110001', email: null },
  { id: 'c2', name: 'Bob B', phone: '+15551110002', email: null },
  { id: 'c3', name: 'Carol C', phone: '+15551110003', email: null },
];

const futureIso = () => new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString();

function buildService(opts: { failContactIds: Set<string> }) {
  const prisma: any = {
    contactGroupMember: {
      findMany: jest
        .fn()
        .mockResolvedValue(CONTACTS.map((contact) => ({ contact }))),
    },
    customer: {
      findFirst: jest.fn().mockResolvedValue(null),
      create: jest.fn().mockImplementation(({ data }: any) =>
        Promise.resolve({
          id: `cust-${data.phone}`,
          firstName: data.firstName,
          lastName: data.lastName,
          phone: data.phone ?? null,
          email: data.email ?? null,
        }),
      ),
    },
    event: {
      create: jest.fn().mockImplementation(({ data }: any) => {
        const contactId = data.participants.create.contactId;
        if (opts.failContactIds.has(contactId)) {
          // Simulate a broken row (e.g. a required field that slipped past
          // earlier validation) blowing up mid-creation for this one contact.
          return Promise.reject(new Error('Broken contact data'));
        }
        return Promise.resolve({
          id: `evt-${contactId}`,
          appointments: [
            {
              id: `apt-${contactId}`,
              title: data.title,
              scheduledAt: data.startTime,
              location: null,
              customer: { id: data.appointments.create.customerId },
            },
          ],
        });
      }),
    },
    appointmentParticipant: { create: jest.fn().mockResolvedValue({}) },
    contactActivity: { create: jest.fn().mockResolvedValue({}) },
    reminder: { create: jest.fn(), updateMany: jest.fn().mockResolvedValue({}) },
  };

  const auditService: any = { log: jest.fn().mockResolvedValue(undefined) };
  const reminderScheduler: any = {
    scheduleForAppointment: jest.fn().mockResolvedValue([]),
  };
  const eventLifecycle: any = {
    onEventScheduled: jest.fn().mockResolvedValue(undefined),
    setupBulkRsvpCampaign: jest.fn().mockResolvedValue(undefined),
  };
  const templateRenderer: any = { renderTemplate: jest.fn() };

  const service = new AppointmentService(
    prisma,
    auditService,
    reminderScheduler,
    eventLifecycle,
    templateRenderer,
  );
  return { service, prisma, eventLifecycle };
}

const dto = () => ({
  targetType: 'group' as const,
  targetId: 'g1',
  title: 'Checkup',
  scheduledAt: futureIso(),
  durationMinutes: 30,
});

describe('AppointmentService.create — per-contact isolation (bulk)', () => {
  it('creates the other contacts when one fails, and reports the failure', async () => {
    const { service, prisma } = buildService({
      failContactIds: new Set(['c2']),
    });

    const result: any = await service.create('tenant1', 'user1', dto() as any);

    // Two real appointments still created despite Bob failing.
    expect(result.count).toBe(2);
    expect(result.appointments).toHaveLength(2);
    expect(result.failures).toHaveLength(1);
    expect(result.failures[0]).toMatchObject({
      contactId: 'c2',
      contactName: 'Bob B',
    });
    expect(result.failures[0].error).toMatch(/Broken contact data/);

    // All three were attempted (the loop did not abort on Bob).
    expect(prisma.event.create).toHaveBeenCalledTimes(3);
  });

  it('returns all appointments with no failures when nothing breaks (no regression)', async () => {
    const { service } = buildService({ failContactIds: new Set() });

    const result: any = await service.create('tenant1', 'user1', dto() as any);

    expect(result.count).toBe(3);
    expect(result.appointments).toHaveLength(3);
    expect(result.failures).toHaveLength(0);
  });

  it('throws when every contact fails (does not report success for zero bookings)', async () => {
    const { service } = buildService({
      failContactIds: new Set(['c1', 'c2', 'c3']),
    });

    await expect(
      service.create('tenant1', 'user1', dto() as any),
    ).rejects.toBeInstanceOf(BadRequestException);
  });
});
