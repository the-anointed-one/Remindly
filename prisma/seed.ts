/**
 * Attendlyx — Database Seed Script
 *
 * Creates demo data for development and staging environments:
 * - 1 tenant with trial active
 * - 1 admin user (admin@demo.com / REDACTED_PASSWORD)
 * - 3 sample appointments
 * - 2 reminder rules
 * - 2 templates
 *
 * Usage:  npx ts-node prisma/seed.ts
 *    or:  npm run seed
 */

import { PrismaClient } from '@prisma/client';
import * as bcrypt from 'bcrypt';

const prisma = new PrismaClient();

async function main() {
    console.log('🌱 Seeding database...');

    // ── Tenant ──────────────────────────────────
    const tenant = await prisma.tenant.upsert({
        where: { slug: 'demo-clinic' },
        update: {},
        create: {
            name: 'Demo Dental Clinic',
            slug: 'demo-clinic',
            planType: 'SMS_VOICE_AI' as any,
            subscriptionStatus: 'TRIALING' as any,
            trialActive: true,
            trialEndDate: new Date(Date.now() + 14 * 24 * 60 * 60 * 1000), // 14 days
            smsMonthlyLimit: 500,
            smsUsageCount: 12,
            voiceUsageCount: 3,
            aiUsageCount: 1,
            aiTrialLimit: 5,
            aiMonthlyLimit: 50,
        },
    });
    console.log(`  ✓ Tenant: ${tenant.name} (${tenant.id})`);

    // ── Admin User ──────────────────────────────
    const hashedPassword = await bcrypt.hash('REDACTED_PASSWORD', 10);
    const user = await prisma.user.upsert({
        where: { email: 'admin@demo.com' },
        update: {},
        create: {
            email: 'admin@demo.com',
            password: hashedPassword,
            firstName: 'Admin',
            lastName: 'User',
            role: 'ADMIN',
            tenantId: tenant.id,
        },
    });
    console.log(`  ✓ User: ${user.email} (password: REDACTED_PASSWORD)`);

    // ── Customers ───────────────────────────────
    const customers = await Promise.all(
        [
            { firstName: 'John', lastName: 'Doe', email: 'john@example.com', phone: '+2348012345678' },
            { firstName: 'Jane', lastName: 'Smith', email: 'jane@example.com', phone: '+2348098765432' },
            { firstName: 'Mike', lastName: 'Johnson', email: 'mike@example.com', phone: '+2348055555555' },
        ].map((c) =>
            prisma.customer.upsert({
                where: { email_tenantId: { email: c.email, tenantId: tenant.id } },
                update: {},
                create: { ...c, tenantId: tenant.id },
            }),
        ),
    );
    console.log(`  ✓ Customers: ${customers.length} created`);

    // ── Appointments ────────────────────────────
    const tomorrow = new Date(Date.now() + 24 * 60 * 60 * 1000);
    const dayAfter = new Date(Date.now() + 48 * 60 * 60 * 1000);
    const nextWeek = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000);

    const appointments = await Promise.all(
        [
            { title: 'Dental Checkup', scheduledAt: tomorrow, customerId: customers[0].id, durationMinutes: 30, status: 'SCHEDULED' as any },
            { title: 'Root Canal', scheduledAt: dayAfter, customerId: customers[1].id, durationMinutes: 60, status: 'CONFIRMED' as any },
            { title: 'Teeth Cleaning', scheduledAt: nextWeek, customerId: customers[2].id, durationMinutes: 45, status: 'SCHEDULED' as any },
        ].map((a) =>
            prisma.appointment.create({
                data: { ...a, tenantId: tenant.id },
            }),
        ),
    );
    console.log(`  ✓ Appointments: ${appointments.length} created`);

    // ── Templates ───────────────────────────────
    const templates = await Promise.all(
        [
            {
                name: '24h SMS Reminder',
                channel: 'SMS' as any,
                body: 'Hi {{customer_name}}, this is a reminder about your {{appointment_title}} tomorrow at {{appointment_time}}. Reply YES to confirm.',
            },
            {
                name: '1h Voice Reminder',
                channel: 'VOICE' as any,
                body: 'Hello {{customer_name}}, this is a reminder that your {{appointment_title}} is in one hour at {{appointment_time}}. Press 1 to confirm.',
            },
        ].map((t) =>
            prisma.template.create({
                data: { ...t, tenantId: tenant.id, isActive: true },
            }),
        ),
    );
    console.log(`  ✓ Templates: ${templates.length} created`);

    // ── Reminder Rules ──────────────────────────
    const rules = await Promise.all(
        [
            { name: '24h Before SMS', channel: 'SMS' as any, offsetMinutes: 1440, templateId: templates[0].id },
            { name: '1h Before Voice', channel: 'VOICE' as any, offsetMinutes: 60, templateId: templates[1].id },
        ].map((r) =>
            prisma.reminderRule.create({
                data: { ...r, tenantId: tenant.id, isActive: true },
            }),
        ),
    );
    console.log(`  ✓ Reminder Rules: ${rules.length} created`);

    console.log('\n✅ Seed complete!');
    console.log('\n📋 Login credentials:');
    console.log('   Email:    admin@demo.com');
    console.log('   Password: REDACTED_PASSWORD');
}

main()
    .catch((e) => {
        console.error('❌ Seed failed:', e);
        process.exit(1);
    })
    .finally(() => prisma.$disconnect());
