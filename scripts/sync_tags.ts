
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function main() {
  const contacts = await prisma.contact.findMany({
    select: { id: true, tenantId: true, tags: true }
  });

  console.log(`Checking ${contacts.length} contacts for tag synchronization...`);

  let tagsCreated = 0;
  let contactTagsLinked = 0;

  for (const contact of contacts) {
    if (!contact.tags || contact.tags.length === 0) continue;

    for (const tagName of contact.tags) {
      const normalized = tagName.trim().toLowerCase();
      if (!normalized) continue;

      // Ensure Tag record exists
      let tag = await prisma.tag.findUnique({
        where: { tenantId_name: { tenantId: contact.tenantId, name: normalized } }
      });

      if (!tag) {
        tag = await prisma.tag.create({
          data: { tenantId: contact.tenantId, name: normalized }
        });
        tagsCreated++;
      }

      // Ensure link exists in ContactTag junction table
      const link = await prisma.contactTag.findUnique({
        where: { contactId_tagId: { contactId: contact.id, tagId: tag.id } }
      });

      if (!link) {
        await prisma.contactTag.create({
          data: { contactId: contact.id, tagId: tag.id }
        });
        contactTagsLinked++;
      }
    }
  }

  console.log('Synchronization complete.');
  console.log(`Tags records created: ${tagsCreated}`);
  console.log(`Contact-Tag links established: ${contactTagsLinked}`);
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
