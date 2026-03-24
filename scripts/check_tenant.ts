
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function main() {
  const tenantId = '2197806b-8672-44c3-a3f9-646b2b77b101';
  const tenant = await prisma.tenant.findUnique({
    where: { id: tenantId }
  });

  console.log('Tenant details:');
  console.log(JSON.stringify(tenant, null, 2));

  // Also check if there are other tenants
  const allTenants = await prisma.tenant.findMany({
    select: { id: true, name: true, slug: true, subscriptionStatus: true, trialActive: true }
  });
  console.log('\nAll tenants:');
  console.log(JSON.stringify(allTenants, null, 2));
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
