
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function main() {
  const tenantId = '2197806b-8672-44c3-a3f9-646b2b77b101';
  
  const tags = await prisma.tag.findMany({
    where: { tenantId }
  });
  console.log('Tags in DB:');
  console.log(JSON.stringify(tags, null, 2));

  const contactsWithTags = await prisma.contact.findMany({
    where: { tenantId },
    select: { id: true, name: true, tags: true }
  });
  console.log('\nContacts with tags (from JSON field?):');
  console.log(JSON.stringify(contactsWithTags, null, 2));
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
