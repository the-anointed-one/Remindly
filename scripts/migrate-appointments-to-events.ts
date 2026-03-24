import { PrismaClient, EventStatus, EventType, EventParticipantStatus } from '@prisma/client';

const prisma = new PrismaClient();

async function main() {
  console.log('Starting migration of Appointments to Events...');

  // 1. Fetch appointments that don't have an event linked yet
  const appointmentsToMigrate = await prisma.appointment.findMany({
    where: {
      eventId: null,
    },
    include: {
      participants: true,
      reminders: true,
      predictionLogs: true,
      feedbackRequests: true,
      calendarSyncedEvents: true,
    },
  });

  console.log(`Found ${appointmentsToMigrate.length} appointments to migrate.`);

  for (const appointment of appointmentsToMigrate) {
    try {
      // Calculate end time
      const endTime = new Date(appointment.scheduledAt);
      endTime.setMinutes(endTime.getMinutes() + appointment.durationMinutes);

      // Map statuses
      let eventStatus: EventStatus = EventStatus.ACTIVE;
      if (['COMPLETED', 'NO_SHOW'].includes(appointment.status)) {
        eventStatus = EventStatus.COMPLETED;
      } else if (appointment.status === 'CANCELLED') {
        eventStatus = EventStatus.CANCELLED;
      }

      // Collect all unique contact IDs for this appointment
      const contactIds = new Set<string>();
      if (appointment.customerId) contactIds.add(appointment.customerId);
      appointment.participants.forEach(p => contactIds.add(p.contactId));

      // Create Event inside transaction for consistency
      await prisma.$transaction(async (tx) => {
        // Create the event
        const event = await tx.event.create({
          data: {
            tenantId: appointment.tenantId,
            title: appointment.title,
            description: appointment.notes,
            startTime: appointment.scheduledAt,
            endTime: endTime,
            status: eventStatus,
            eventType: EventType.APPOINTMENT,
            isDemoData: appointment.isDemoData,
            
            // Link back to appointment immediately
            appointments: {
              connect: { id: appointment.id }
            },
            
            // Create participants
            participants: {
              create: Array.from(contactIds).map(contactId => ({
                contactId: contactId,
                tenantId: appointment.tenantId,
                status: EventParticipantStatus.confirmed // default for migrated
              }))
            }
          }
        });

        // Update relations to point to the new Event
        if (appointment.reminders.length > 0) {
          await tx.reminder.updateMany({
            where: { appointmentId: appointment.id },
            data: { eventId: event.id }
          });
        }
        
        if (appointment.predictionLogs.length > 0) {
          await tx.predictionLog.updateMany({
            where: { appointmentId: appointment.id },
            data: { eventId: event.id }
          });
        }

        if (appointment.feedbackRequests.length > 0) {
          await tx.feedbackRequest.updateMany({
            where: { appointmentId: appointment.id },
            data: { eventId: event.id }
          });
        }

        if (appointment.calendarSyncedEvents.length > 0) {
          await tx.calendarSyncedEvent.updateMany({
            where: { appointmentId: appointment.id },
            data: { eventId: event.id }
          });
        }

        console.log(`✅ Migrated Appointment ${appointment.id} -> Event ${event.id}`);
      });
      
    } catch (err) {
      console.error(`❌ Failed to migrate Appointment ${appointment.id}:`, err);
    }
  }

  console.log('Migration complete.');
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
