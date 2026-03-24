import { PrismaClient } from '@prisma/client';
import * as bcrypt from 'bcrypt';

const prisma = new PrismaClient();

async function main() {
  const email = 'ajahbenz@gmail.com';
  const password = '@Byte5050';
  const tenantId = '2197806b-8672-44c3-a3f9-646b2b77b101'; // Existing tenant

  const passwordHash = await bcrypt.hash(password, 10);

  const user = await prisma.user.create({
    data: {
      email,
      passwordHash,
      tenantId,
      role: 'OWNER',
      firstName: 'Ajah',
      lastName: 'Benz',
    },
  });

  console.log('User created successfully:');
  console.log(JSON.stringify(user, null, 2));
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
