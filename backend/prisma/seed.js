const { PrismaClient } = require('@prisma/client');
const bcrypt = require('bcryptjs');

const prisma = new PrismaClient();

async function main() {
  // Only seed if no users exist yet — prevents re-creating deleted users on restart
  const existingUsers = await prisma.user.count();
  if (existingUsers > 0) {
    console.log('Database already seeded, skipping.');
    return;
  }

  const hashedPassword = await bcrypt.hash('Fluxx$', 10);

  await prisma.user.create({
    data: {
      email: 'femi@fluxx.ng',
      name: 'Femi',
      password: hashedPassword,
      role: 'admin',
    },
  });

  console.log('Seed complete.');
}

main().catch(console.error).finally(() => prisma.$disconnect());
