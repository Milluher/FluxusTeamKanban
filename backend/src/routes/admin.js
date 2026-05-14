const express = require('express');
const bcrypt = require('bcryptjs');
const { PrismaClient } = require('@prisma/client');
const { authenticate } = require('../middleware/auth');

const router = express.Router();
const prisma = new PrismaClient();

function requireAdmin(req, res, next) {
  if (req.user.role !== 'admin') return res.status(403).json({ error: 'Admin only' });
  next();
}

// List all users (admin)
router.get('/users', authenticate, requireAdmin, async (req, res) => {
  try {
    const users = await prisma.user.findMany({
      select: { id: true, name: true, email: true, role: true, createdAt: true },
      orderBy: { createdAt: 'asc' },
    });
    res.json(users);
  } catch (e) { console.error(e); res.status(500).json({ error: 'Something went wrong. Please try again.' }); }
});

// Reset user password (admin)
router.post('/users/:id/reset-password', authenticate, requireAdmin, async (req, res) => {
  try {
    const { newPassword } = req.body;
    if (!newPassword || newPassword.length < 6) return res.status(400).json({ error: 'Password must be at least 6 characters' });
    const hashed = await bcrypt.hash(newPassword, 10);
    await prisma.user.update({ where: { id: req.params.id }, data: { password: hashed } });
    res.json({ success: true });
  } catch (e) { console.error(e); res.status(500).json({ error: 'Something went wrong. Please try again.' }); }
});

// Remove user from board (admin)
router.delete('/boards/:boardId/members/:userId', authenticate, requireAdmin, async (req, res) => {
  try {
    await prisma.boardMember.deleteMany({
      where: { userId: req.params.userId, boardId: req.params.boardId },
    });
    res.json({ success: true });
  } catch (e) { console.error(e); res.status(500).json({ error: 'Something went wrong. Please try again.' }); }
});

// Delete user from workspace (admin only, cannot delete self)
router.delete('/users/:id', authenticate, requireAdmin, async (req, res) => {
  try {
    const targetId = req.params.id;
    if (targetId === req.user.id)
      return res.status(400).json({ error: 'You cannot delete your own account' });

    const target = await prisma.user.findUnique({ where: { id: targetId } });
    if (!target) return res.status(404).json({ error: 'User not found' });

    // Transfer ticket ownership (createdById is non-nullable) to the admin performing the action
    await prisma.ticket.updateMany({
      where: { createdById: targetId },
      data: { createdById: req.user.id },
    });

    // Nullify optional ticket references
    await prisma.ticket.updateMany({ where: { assigneeId: targetId }, data: { assigneeId: null } });
    await prisma.ticket.updateMany({ where: { productManagerId: targetId }, data: { productManagerId: null } });

    // Delete user — BoardMember and Comment cascade automatically
    await prisma.user.delete({ where: { id: targetId } });

    res.json({ success: true });
  } catch (e) { console.error(e); res.status(500).json({ error: 'Something went wrong. Please try again.' }); }
});

module.exports = router;
