/**
 * Meetora — Database Seed Script
 *
 * Creates realistic onboarding data:
 * - 1 tenant
 * - 1 admin user
 * - 1 contact with real details
 * - 1 welcome event in 7 days
 * - 1 SMS reminder rule (1h before)
 *
 * Usage:  npx ts-node prisma/seed.ts
 *    or:  npm run seed
 */

import { PrismaClient } from '@prisma/client';
import * as bcrypt from 'bcrypt';

const prisma = new PrismaClient();

async function main() {
  console.log('🌱 Seeding database with onboarding data...');

  // ── Tenant ──────────────────────────────────
  const tenant = await prisma.tenant.upsert({
    where: { slug: 'meetora-onboarding' },
    update: {},
    create: {
      name: 'Meetora Onboarding',
      slug: 'meetora-onboarding',
      planType: 'SMS_VOICE_AI' as any,
      subscriptionStatus: 'ACTIVE' as any,
      trialActive: false,
      aiMonthlyLimit: 100,
      smsTrialLimit: 1000,
    },
  });
  console.log(`  ✓ Tenant: ${tenant.name}`);

  // ── Admin User ──────────────────────────────
  const hashedPassword = await bcrypt.hash('Meetora2026!', 10);
  const user = await prisma.user.upsert({
    where: { tenantId_email: { email: 'admin@meetora.com', tenantId: tenant.id } },
    update: {},
    create: {
      email: 'admin@meetora.com',
      passwordHash: hashedPassword,
      firstName: 'Onboarding',
      lastName: 'Admin',
      role: 'ADMIN',
      tenantId: tenant.id,
    },
  });
  console.log(`  ✓ User: ${user.email}`);

  // ── Contact ─────────────────────────────────
  const contact = await prisma.contact.upsert({
    where: { tenantId_email: { email: 'onboarding@example.com', tenantId: tenant.id } },
    update: {},
    create: {
      tenantId: tenant.id,
      name: 'Onboarding Contact',
      email: 'onboarding@example.com',
      phone: '+15550109999',
    },
  });
  console.log(`  ✓ Contact: ${contact.name}`);

  // ── Event ───────────────────────────────────
  const nextWeek = new Date();
  nextWeek.setDate(nextWeek.getDate() + 7);
  nextWeek.setHours(10, 0, 0, 0);

  const event = await prisma.event.create({
    data: {
      tenantId: tenant.id,
      title: 'Welcome Event',
      description: 'Your first event on Meetora!',
      startTime: nextWeek,
      endTime: new Date(nextWeek.getTime() + 60 * 60 * 1000),
      status: 'PUBLISHED' as any,
      eventType: 'WEBINAR' as any,
    },
  });
  console.log(`  ✓ Event: ${event.title}`);

  // ── Reminder Rule ───────────────────────────
  const rule = await prisma.reminderRule.create({
    data: {
      tenantId: tenant.id,
      name: '60m Before SMS',
      channel: 'SMS' as any,
      offsetMinutes: 60,
      isActive: true,
      messageTemplate: 'Hi, just a reminder that {{event_title}} starts in 1 hour!',
    },
  });
  console.log(`  ✓ Reminder Rule: ${rule.name}`);

  console.log('\n✅ Onboarding seed complete!');
}

main()
  .catch((e) => {
    console.error('❌ Seed failed:', e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
