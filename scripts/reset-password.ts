import { PrismaClient } from '@prisma/client';
import * as bcrypt from 'bcrypt';

const prisma = new PrismaClient();

async function main() {
    const targetEmail = process.env.TARGET_EMAIL;
    const newPassword = process.env.NEW_PASSWORD;

    if (!targetEmail || !newPassword) {
        console.error('❌ Missing environment variables: TARGET_EMAIL and NEW_PASSWORD must be set.');
        process.exit(1);
    }

    const hash = await bcrypt.hash(newPassword, 12);

    const user = await prisma.user.findFirst({ where: { email: targetEmail } });
    if (!user) {
        console.error(`❌ User not found: ${targetEmail}`);
        process.exit(1);
    }

    await prisma.user.update({
        where: { id: user.id },
        data: { passwordHash: hash },
    });

    console.log(`✅ Password reset successfully.`);
    console.log(`   Email: ${targetEmail}`);
}

main().catch(console.error).finally(() => prisma.$disconnect());
