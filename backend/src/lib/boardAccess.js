const { PrismaClient } = require('@prisma/client');

const prisma = new PrismaClient();

/**
 * Who may READ a board's contents: a system admin, or any member of it.
 *
 * Shared by everything hanging off a board — the canvas, and now PRDs — so the
 * answer cannot drift between them.
 */
async function canViewBoard(req, boardId) {
  if (req.user.role === 'admin') return true;
  if (!boardId) return false;
  const membership = await prisma.boardMember.findUnique({
    where: { userId_boardId: { userId: req.user.id, boardId } },
  });
  return !!membership;
}

/** Who may EDIT a board's furniture: a system admin, or an admin of that board. */
async function canEditBoard(req, boardId) {
  if (req.user.role === 'admin') return true;
  if (!boardId) return false;
  const membership = await prisma.boardMember.findUnique({
    where: { userId_boardId: { userId: req.user.id, boardId } },
  });
  return !!membership && membership.role === 'admin';
}

module.exports = { canViewBoard, canEditBoard };
