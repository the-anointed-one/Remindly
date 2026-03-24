import { PrismaClient } from '@prisma/client';
const prisma = new PrismaClient();
async function main() {
  try {
    const tenant = await prisma.tenant.findFirst();
    if (!tenant) throw new Error('No tenant');
    const contact = await prisma.contact.create({
      data: {
        tenantId: tenant.id,
        name: 'Test Contact',
      }
    });
    console.log('Created contact:', contact);
  } catch (e) {
    console.error('Error:', e);
  }
}
main().finally(() => prisma.$disconnect());
