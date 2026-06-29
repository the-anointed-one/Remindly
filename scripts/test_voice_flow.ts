import { PrismaClient } from '@prisma/client';
import { Queue } from 'bullmq';
import { getRedisConnection, REMINDER_QUEUE, ReminderJobData } from '../src/queue/queue.config';
import * as dotenv from 'dotenv';
import { resolve } from 'path';

dotenv.config({ path: resolve(__dirname, '../.env') });

const prisma = new PrismaClient();
const connection = getRedisConnection();

async function main() {
  console.log('🚀 Starting voice flow test...');

  // 1. Context
  const tenant = await prisma.tenant.findFirst();
  if (!tenant) throw new Error('No tenant found');
  console.log(`Using tenant: ${tenant.id}`);

  let customer = await prisma.customer.findFirst({
    where: { tenantId: tenant.id, phone: { not: null } }
  });

  if (!customer) {
    console.log('Creating test customer...');
    customer = await prisma.customer.create({
      data: {
        tenantId: tenant.id,
        firstName: 'Test',
        lastName: 'User',
        phone: '+15005550006', // Twilio magic number for success
        email: 'test@example.com',
      }
    });
  }
  console.log(`Using customer: ${customer.id} (${customer.phone})`);

  let appointment = await prisma.appointment.findFirst({
    where: { customerId: customer.id }
  });

  if (!appointment) {
    console.log('Creating test appointment...');
    appointment = await prisma.appointment.create({
      data: {
        tenantId: tenant.id,
        customerId: customer.id,
        title: 'Voice Implementation Test',
        scheduledAt: new Date(Date.now() + 24 * 60 * 60 * 1000), // Tomorrow
        status: 'SCHEDULED', // Corrected enum value
      }
    });
  }
  console.log(`Using appointment: ${appointment.id}`);

  // 2. Create EMAIL reminder rule
  console.log('Creating EMAIL reminder rule...');
  const rule = await prisma.reminderRule.create({
    data: {
      tenantId: tenant.id,
      name: 'Email Flow Test Rule', // Updated name
      channel: 'EMAIL', // Changed to EMAIL
      offsetMinutes: 60,
      messageTemplate: 'This is a test email reminder.',
      isActive: true,
    }
  });

  // 3. Create Reminder record
  console.log('Creating Reminder record...');
  const reminder = await prisma.reminder.create({
    data: {
      tenantId: tenant.id,
      appointmentId: appointment.id,
      reminderRuleId: rule.id,
      scheduledSendTime: new Date(),
      messageContent: 'Test voice message content',
      status: 'PENDING', // Corrected enum value
    }
  });

  // 4. Queue the job
  console.log('Queueing job to BullMQ...');
  const queue = new Queue<ReminderJobData>(REMINDER_QUEUE, { connection });
  const jobData: ReminderJobData = {
    reminderId: reminder.id,
    tenantId: tenant.id,
    appointmentId: appointment.id,
    channel: 'EMAIL',
    messageContent: 'Test email message content',
    scheduledFor: new Date().toISOString(),
  };

  const job = await queue.add('manual-email-test', jobData);
  console.log(`✅ Job queued: ${job.id}`);

  await queue.close();
  await prisma.$disconnect();
  process.exit(0);
}

main().catch(err => {
  console.error('❌ Test failed:', err);
  process.exit(1);
});
