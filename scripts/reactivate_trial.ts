
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function main() {
  const tenantId = '2197806b-8672-44c3-a3f9-646b2b77b101';
  
  // Set trial active and set end date to 14 days from now
  const fourteenDaysFromNow = new Date();
  fourteenDaysFromNow.setDate(fourteenDaysFromNow.getDate() + 14);

  const updatedTenant = await prisma.tenant.update({
    where: { id: tenantId },
    data: {
      trialActive: true,
      subscriptionStatus: 'TRIALING',
      trialEndDate: fourteenDaysFromNow
    }
  });

  console.log('Tenant trial reactivated:');
  console.log(JSON.stringify(updatedTenant, null, 2));
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
