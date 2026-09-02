/**
 * Regression tests for the inbound-reply → status-update → automation loop.
 *
 * A customer replying "YES"/"1" (or "NO"/"3") updates the appointment with a
 * direct prisma.update() rather than going through AppointmentService.update(),
 * so it used to skip EventLifecycleService.onStatusChanged() entirely — the
 * status changed but no appointment_confirmed / appointment_cancelled trigger
 * ever fired, and any follow-up automation the tenant built silently never ran.
 * These tests pin the lifecycle call to the reply path.
 */

// Avoid a real BullMQ/Redis connection from the transitive import chain.
jest.mock('bullmq', () => ({
  Queue: jest.fn().mockImplementation(() => ({ add: jest.fn() })),
  Worker: jest.fn().mockImplementation(() => ({ on: jest.fn() })),
}));
jest.mock('../../queue/queue.config', () => ({
  ...jest.requireActual('../../queue/queue.config'),
  getRedisConnection: () => ({}),
}));

import { TwilioWebhookController } from './twilio-webhook.controller';

const CUSTOMER = {
  id: 'cust-1',
  tenantId: 'tenant-1',
  firstName: 'Ada',
  lastName: 'Lovelace',
  phone: '+15551110001',
  email: 'ada@example.com',
};

const APPOINTMENT = {
  id: 'apt-1',
  title: 'Dental cleaning',
  status: 'SCHEDULED',
  scheduledAt: new Date('2026-09-01T10:00:00.000Z'),
};

function buildController(appointment: any = APPOINTMENT) {
  const prisma: any = {
    customer: { findFirst: jest.fn().mockResolvedValue(CUSTOMER) },
    appointment: {
      findFirst: jest.fn().mockResolvedValue(appointment),
      update: jest.fn().mockResolvedValue({}),
    },
  };
  const auditService: any = { log: jest.fn().mockResolvedValue(undefined) };
  const reminderScheduler: any = {
    cancelForAppointment: jest.fn().mockResolvedValue(undefined),
  };
  const eventLifecycle: any = {
    onStatusChanged: jest.fn().mockResolvedValue(undefined),
  };

  const controller = new TwilioWebhookController(
    prisma,
    {} as any, // twilioProvider
    reminderScheduler,
    auditService,
    {} as any, // reschedulingService
    {} as any, // failoverService
    {} as any, // complianceService
    {} as any, // rsvpQueueService
    {} as any, // rsvpProcessor
    {} as any, // reputationService
    eventLifecycle,
  );

  return { controller, prisma, eventLifecycle, reminderScheduler };
}

describe('inbound reply → appointment lifecycle', () => {
  it('fires the lifecycle hook when a customer confirms by reply', async () => {
    const { controller, prisma, eventLifecycle } = buildController();

    await (controller as any).processConfirmation(CUSTOMER.phone);

    expect(prisma.appointment.update).toHaveBeenCalledWith(
      expect.objectContaining({ data: { status: 'CONFIRMED' } }),
    );
    expect(eventLifecycle.onStatusChanged).toHaveBeenCalledTimes(1);

    const [tenantId, appointmentId, oldStatus, newStatus, entityData] =
      eventLifecycle.onStatusChanged.mock.calls[0];
    expect(tenantId).toBe('tenant-1');
    expect(appointmentId).toBe('apt-1');
    expect(oldStatus).toBe('SCHEDULED');
    expect(newStatus).toBe('CONFIRMED');
    // entityData feeds the automation's template variables — if these are
    // missing the follow-up message renders with blank/unresolved values.
    expect(entityData).toMatchObject({
      appointmentId: 'apt-1',
      appointmentTitle: 'Dental cleaning',
      appointmentStatus: 'CONFIRMED',
      customerId: 'cust-1',
      customerName: 'Ada Lovelace',
      customerPhone: '+15551110001',
      tenantId: 'tenant-1',
    });
  });

  it('fires the lifecycle hook with the real prior status when cancelling', async () => {
    // Cancelling is allowed from SCHEDULED *or* CONFIRMED; onStatusChanged
    // early-returns when oldStatus === newStatus, so the prior status has to be
    // the row's actual value rather than a hardcoded guess.
    const { controller, eventLifecycle } = buildController({
      ...APPOINTMENT,
      status: 'CONFIRMED',
    });

    await (controller as any).processCancellation(CUSTOMER.phone);

    const [, , oldStatus, newStatus] =
      eventLifecycle.onStatusChanged.mock.calls[0];
    expect(oldStatus).toBe('CONFIRMED');
    expect(newStatus).toBe('CANCELLED');
  });

  it('still cancels reminders when cancelling by reply', async () => {
    const { controller, reminderScheduler } = buildController();

    await (controller as any).processCancellation(CUSTOMER.phone);

    expect(reminderScheduler.cancelForAppointment).toHaveBeenCalledWith('apt-1');
  });

  it('does not fail the reply when the automation hook throws', async () => {
    // The customer's reply is already persisted and acknowledged by this point.
    // Letting a downstream automation error escape would 500 the webhook and
    // make Twilio retry, double-processing the reply.
    const { controller, eventLifecycle } = buildController();
    eventLifecycle.onStatusChanged.mockRejectedValue(new Error('queue down'));

    await expect(
      (controller as any).processConfirmation(CUSTOMER.phone),
    ).resolves.toBeUndefined();
  });

  it('does nothing when no matching appointment exists', async () => {
    const { controller, eventLifecycle } = buildController(null);

    await (controller as any).processConfirmation(CUSTOMER.phone);

    expect(eventLifecycle.onStatusChanged).not.toHaveBeenCalled();
  });
});

/**
 * The RSVP keyword set (yes/y/1/no/n/2/3/maybe/confirm/cancel/…) is a superset
 * of the appointment reply vocabulary, so routing on the keyword alone captured
 * every appointment reply into the RSVP queue, where it matched no invitation
 * and died silently. The router must also require a live invitation.
 */
describe('reply routing: RSVP vs appointment', () => {
  function buildRouter(hasInvitation: boolean) {
    const rsvpProcessor: any = {
      isRsvpKeyword: jest.fn().mockReturnValue(true),
      hasActiveInvitation: jest.fn().mockResolvedValue(hasInvitation),
    };
    const rsvpQueueService: any = {
      enqueueRsvp: jest.fn().mockResolvedValue(undefined),
    };
    const complianceService: any = {
      isOptOutKeyword: jest.fn().mockReturnValue(false),
      isOptInKeyword: jest.fn().mockReturnValue(false),
    };
    const reputationService: any = {
      hasPendingFeedbackRequest: jest.fn().mockResolvedValue({ has: false }),
    };
    const reschedulingService: any = {
      hasActiveSession: jest.fn().mockResolvedValue(false),
    };
    const prisma: any = {
      customer: { findFirst: jest.fn().mockResolvedValue(CUSTOMER) },
      appointment: {
        findFirst: jest.fn().mockResolvedValue(APPOINTMENT),
        update: jest.fn().mockResolvedValue({}),
      },
    };
    const eventLifecycle: any = {
      onStatusChanged: jest.fn().mockResolvedValue(undefined),
    };

    const controller = new TwilioWebhookController(
      prisma,
      {} as any,
      { cancelForAppointment: jest.fn() } as any,
      { log: jest.fn() } as any,
      reschedulingService,
      {} as any,
      complianceService,
      rsvpQueueService,
      rsvpProcessor,
      reputationService,
      eventLifecycle,
    );

    return { controller, rsvpQueueService, prisma, eventLifecycle };
  }

  it('routes to the RSVP queue when the sender has a live invitation', async () => {
    const { controller, rsvpQueueService, prisma } = buildRouter(true);

    const reply = await (controller as any).processInboundReply(
      CUSTOMER.phone,
      'YES',
      'SMS',
      'tenant-1',
    );

    expect(rsvpQueueService.enqueueRsvp).toHaveBeenCalledTimes(1);
    expect(prisma.appointment.update).not.toHaveBeenCalled();
    expect(reply).toMatch(/RSVP/i);
  });

  it('falls through to appointment confirmation when there is no invitation', async () => {
    const { controller, rsvpQueueService, prisma, eventLifecycle } =
      buildRouter(false);

    const reply = await (controller as any).processInboundReply(
      CUSTOMER.phone,
      'YES',
      'SMS',
      'tenant-1',
    );

    expect(rsvpQueueService.enqueueRsvp).not.toHaveBeenCalled();
    expect(prisma.appointment.update).toHaveBeenCalledWith(
      expect.objectContaining({ data: { status: 'CONFIRMED' } }),
    );
    expect(eventLifecycle.onStatusChanged).toHaveBeenCalledTimes(1);
    expect(reply).toMatch(/confirmed/i);
  });
});
