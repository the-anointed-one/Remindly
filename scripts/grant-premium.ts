import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function main() {
    const targetEmail = process.env.TARGET_EMAIL;

    if (!targetEmail) {
        console.error('❌ Missing environment variable: TARGET_EMAIL must be set.');
        process.exit(1);
    }

    const user = await prisma.user.findFirst({
        where: { email: targetEmail },
        include: { tenant: true },
    });

    if (!user) {
        console.error(`❌ User not found: ${targetEmail}`);
        process.exit(1);
    }

    const now = new Date();
    const trialEnd = new Date(now);
    trialEnd.setDate(trialEnd.getDate() + 14);

    const updated = await prisma.tenant.update({
        where: { id: user.tenantId },
        data: {
            planType: 'SMS_VOICE_AI',
            subscriptionStatus: 'ACTIVE',
            trialActive: true,
            trialStartDate: now,
            trialEndDate: trialEnd,
            smsTrialLimit: 10000,
            aiTrialLimit: 500,
            aiMonthlyLimit: 500,
            whatsappMonthlyLimit: 1000,
        },
    });

    console.log(`✅ Premium granted: ${updated.name} | Plan: ${updated.planType} | Status: ${updated.subscriptionStatus}`);
}

main().catch(console.error).finally(() => prisma.$disconnect());
