import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function main() {
  const email = 'ajahbenz@gmail.com';
  console.log(`Searching for account associated with: ${email}`);

  // 1. Search in User model
  const user = await prisma.user.findFirst({
    where: { email: { equals: email, mode: 'insensitive' } },
    include: { tenant: true }
  });

  if (user) {
    console.log('\n--- User Found ---');
    console.log(JSON.stringify(user, null, 2));
  } else {
    console.log('\nNo matching User found.');
  }

  // 2. Search in Customer model
  const customer = await prisma.customer.findFirst({
    where: { email: { equals: email, mode: 'insensitive' } },
    include: { tenant: true }
  });

  if (customer) {
    console.log('\n--- Customer Found ---');
    console.log(JSON.stringify(customer, null, 2));
  } else {
    console.log('\nNo matching Customer found.');
  }

  // 3. Search in Contact model
  const contact = await prisma.contact.findFirst({
    where: { email: { equals: email, mode: 'insensitive' } },
    include: { tenant: true }
  });

  if (contact) {
    console.log('\n--- Contact Found ---');
    console.log(JSON.stringify(contact, null, 2));
  } else {
    console.log('\nNo matching Contact found.');
  }
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
