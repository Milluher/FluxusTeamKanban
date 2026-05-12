const { PrismaClient } = require('@prisma/client');
const bcrypt = require('bcryptjs');

const prisma = new PrismaClient();

async function main() {
  const hashedPassword = await bcrypt.hash('password123', 10);

  const admin = await prisma.user.upsert({
    where: { email: 'admin@fluxus.com' },
    update: {},
    create: {
      email: 'admin@fluxus.com',
      name: 'Admin User',
      password: hashedPassword,
      role: 'admin',
    },
  });

  const user1 = await prisma.user.upsert({
    where: { email: 'alice@fluxus.com' },
    update: {},
    create: {
      email: 'alice@fluxus.com',
      name: 'Alice Johnson',
      password: hashedPassword,
      role: 'standard',
    },
  });

  const user2 = await prisma.user.upsert({
    where: { email: 'bob@fluxus.com' },
    update: {},
    create: {
      email: 'bob@fluxus.com',
      name: 'Bob Smith',
      password: hashedPassword,
      role: 'standard',
    },
  });

  const board = await prisma.board.create({
    data: {
      name: 'Main Project Board',
      members: {
        create: [
          { userId: admin.id, role: 'admin' },
          { userId: user1.id, role: 'member' },
          { userId: user2.id, role: 'member' },
        ],
      },
    },
  });

  const columnNames = ['Backlog', 'To Do', 'In Progress', 'Review', 'Done'];
  const columns = [];
  for (let i = 0; i < columnNames.length; i++) {
    const col = await prisma.column.create({
      data: { name: columnNames[i], order: i, boardId: board.id },
    });
    columns.push(col);
  }

  // Seed some tickets
  await prisma.ticket.create({
    data: {
      title: 'Set up project structure',
      description: 'Initialize the repository and configure the tech stack.',
      status: 'Done',
      columnId: columns[4].id,
      createdById: admin.id,
      assigneeId: user1.id,
    },
  });

  await prisma.ticket.create({
    data: {
      title: 'Design authentication flow',
      description: 'Create wireframes and specs for login/register.',
      status: 'In Progress',
      columnId: columns[2].id,
      createdById: admin.id,
      productManagerId: admin.id,
      assigneeId: user2.id,
    },
  });

  await prisma.ticket.create({
    data: {
      title: 'Implement Kanban drag-and-drop',
      description: 'Use @dnd-kit to enable card movement across columns.',
      status: 'To Do',
      columnId: columns[1].id,
      createdById: user1.id,
    },
  });

  console.log('Seed complete!');
}

main().catch(console.error).finally(() => prisma.$disconnect());
