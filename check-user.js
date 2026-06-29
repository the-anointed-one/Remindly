const { PrismaClient } = require('@prisma/client');

const prisma = new PrismaClient();

async function main() {
  const user = await prisma.user.findFirst({ where: { email: 'ajahbenz@gmail.com' } });
  if (user) {
    console.log(JSON.stringify(user, null, 2));
  } else {
    console.log('User not found in database.');
  }
}

main()
  .catch(console.error)
  .finally(() => prisma.$disconnect());
