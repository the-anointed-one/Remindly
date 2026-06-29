#!/usr/bin/env node
/**
 * Billing Currency Migration Script
 *
 * Objective: Migrate existing NGN subscriptions to USD
 * This script marks existing NGN test subscriptions as deprecated
 * and provides guidance for production migration.
 *
 * WARNING: For test environments only - do not auto-migrate production data
 * without manual review.
 */

import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function migrateBillingCurrency() {
  console.log('🔄 Starting billing currency migration (NGN → USD)...\n');

  try {
    // Step 1: Check current subscription status
    console.log('📊 Current subscription status:');
    const ngSubscriptions = await prisma.subscriptionRecord.count({
      where: { currency: 'NGN' },
    });
    const usdSubscriptions = await prisma.subscriptionRecord.count({
      where: { currency: 'USD' },
    });
    const totalSubscriptions = await prisma.subscriptionRecord.count();

    console.log(`  - NGN subscriptions: ${ngSubscriptions}`);
    console.log(`  - USD subscriptions: ${usdSubscriptions}`);
    console.log(`  - Total: ${totalSubscriptions}\n`);

    // Step 2: For test environment - mark NGN subscriptions as deprecated
    // DO NOT run this on production without manual review
    if (process.env.NODE_ENV !== 'production') {
      console.log('⚠️  Test environment detected');
      console.log('📝 Marking existing NGN subscriptions as deprecated...\n');

      const deprecated = await prisma.subscriptionRecord.updateMany({
        where: {
          currency: 'NGN',
          status: { not: 'DEPRECATED' },
        },
        data: {
          status: 'DEPRECATED',
        },
      });

      console.log(`✅ Marked ${deprecated.count} NGN subscriptions as deprecated\n`);

      // Step 3: Show migration notice for test tenants
      const activeTenants = await prisma.tenant.findMany({
        where: {
          subscriptionStatus: { in: ['ACTIVE', 'TRIALING'] },
        },
        select: {
          id: true,
          name: true,
          subscriptionStatus: true,
        },
      });

      console.log('📋 Active test tenants requiring migration notice:');
      for (const tenant of activeTenants) {
        console.log(`  - ${tenant.name} (${tenant.id}): ${tenant.subscriptionStatus}`);
      }
      console.log('\n📢 Migration notice for these tenants:');
      console.log('  "Your subscription has been marked for currency migration.');
      console.log('   Please re-subscribe to continue using USD pricing."\n');

    } else {
      console.log('⚠️  PRODUCTION ENVIRONMENT DETECTED');
      console.log('❌ This script does NOT auto-migrate production data.');
      console.log('📋 Manual review required. Steps:');
      console.log('  1. Export all subscription records');
      console.log('  2. Review each subscription with stakeholders');
      console.log('  3. Create new USD subscriptions for active accounts');
      console.log('  4. Mark old NGN subscriptions as deprecated after confirmation\n');
    }

    // Step 4: Summary
    console.log('📈 Post-migration status:');
    const finalNgSubscriptions = await prisma.subscriptionRecord.count({
      where: { currency: 'NGN' },
    });
    const deprecatedCount = await prisma.subscriptionRecord.count({
      where: { status: 'DEPRECATED' },
    });

    console.log(`  - Remaining NGN subscriptions: ${finalNgSubscriptions}`);
    console.log(`  - Deprecated subscriptions: ${deprecatedCount}`);
    console.log(`  - USD subscriptions: ${usdSubscriptions}`);
    console.log('\n✅ Migration script completed.\n');

    // Important notes
    console.log('🔔 Important notes:');
    console.log('  - New subscriptions will be created in USD');
    console.log('  - Webhook signatures remain valid (no change to secret)');
    console.log('  - UI should display "$19.00" format, not cents');
    console.log('  - Ensure PAYSTACK_CURRENCY=USD is set in environment\n');

  } catch (error) {
    console.error('❌ Migration failed:', error);
    process.exit(1);
  } finally {
    await prisma.$disconnect();
  }
}

// Run if called directly
if (require.main === module) {
  migrateBillingCurrency();
}

export { migrateBillingCurrency };
