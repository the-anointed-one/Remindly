
import { PrismaClient } from '@prisma/client';
import { Queue } from 'bullmq';
import { REMINDER_QUEUE, getRedisConnection, REMINDER_JOB_OPTIONS } from '../src/queue/queue.config';

const prisma = new PrismaClient();
const queue = new Queue(REMINDER_QUEUE, { connection: getRedisConnection() });

async function recover() {
    console.log('🚀 Starting reminder recovery...');

    // Find all PENDING reminders
    const reminders = await prisma.reminder.findMany({
        where: { status: 'PENDING' }
    });

    console.log(`Found ${reminders.length} pending reminders.`);

    let queuedCount = 0;
    for (const reminder of reminders) {
        const jobId = `reminder-${reminder.id}`;
        
        // Check if job already exists in queue
        const existingJob = await queue.getJob(jobId);
        if (existingJob) {
            console.log(`Job ${jobId} already exists in queue. Skipping.`);
            continue;
        }

        const delay = reminder.scheduledSendTime.getTime() - Date.now();
        
        const jobData = {
            reminderId: reminder.id,
            tenantId: reminder.tenantId,
            appointmentId: reminder.appointmentId,
            channel: reminder.channel,
            messageContent: reminder.messageContent,
            scheduledFor: reminder.scheduledSendTime.toISOString(),
        };

        await queue.add('send-reminder', jobData, {
            ...REMINDER_JOB_OPTIONS,
            delay: Math.max(delay, 0),
            jobId,
        });

        console.log(`Queued reminder ${reminder.id} (scheduled for ${reminder.scheduledSendTime.toISOString()}, delay: ${Math.round(delay/1000)}s)`);
        queuedCount++;
    }

    console.log(`✅ Recovery complete. Re-queued ${queuedCount} reminders.`);
}

recover()
    .catch(console.error)
    .finally(async () => {
        await prisma.$disconnect();
        await queue.close();
        process.exit(0);
    });
