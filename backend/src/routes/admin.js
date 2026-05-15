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

// Generate password reset link (admin)
router.post('/users/:id/reset-link', authenticate, requireAdmin, async (req, res) => {
  try {
    const target = await prisma.user.findUnique({ where: { id: req.params.id } });
    if (!target) return res.status(404).json({ error: 'User not found' });
    // Expire any existing unused tokens for this user
    await prisma.passwordResetToken.updateMany({
      where: { userId: req.params.id, used: false },
      data: { used: true },
    });
    const resetToken = await prisma.passwordResetToken.create({
      data: {
        userId: req.params.id,
        expiresAt: new Date(Date.now() + 24 * 60 * 60 * 1000), // 24 hours
      },
    });
    const link = `https://fluxusteamkanban.vercel.app/reset-password/${resetToken.token}`;
    res.json({ link });
  } catch (e) { console.error(e); res.status(500).json({ error: 'Something went wrong. Please try again.' }); }
});

// Remove user from board (admin)
router.delete('/boards/:boardId/members/:userId', authenticate, requireAdmin, async (req, res) => {
  try {
    const target = await prisma.user.findUnique({ where: { id: req.params.userId }, select: { email: true } });
    if (target?.email === 'femi@fluxx.ng')
      return res.status(403).json({ error: 'The workspace owner cannot be removed from boards' });
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
    if (target.email === 'femi@fluxx.ng')
      return res.status(403).json({ error: 'The workspace owner cannot be deleted' });

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

// Change user role — only femi@fluxx.ng (super-admin)
router.patch('/users/:id/role', authenticate, async (req, res) => {
  try {
    if (req.user.email !== 'femi@fluxx.ng')
      return res.status(403).json({ error: 'Only the workspace owner can change user roles' });
    const { role } = req.body;
    if (!['standard', 'admin'].includes(role))
      return res.status(400).json({ error: 'Invalid role' });
    const target = await prisma.user.findUnique({ where: { id: req.params.id } });
    if (!target) return res.status(404).json({ error: 'User not found' });
    if (target.email === 'femi@fluxx.ng')
      return res.status(400).json({ error: 'Cannot change owner role' });
    const updated = await prisma.user.update({
      where: { id: req.params.id },
      data: { role },
      select: { id: true, name: true, email: true, role: true, createdAt: true },
    });
    res.json(updated);
  } catch (e) { console.error(e); res.status(500).json({ error: 'Something went wrong. Please try again.' }); }
});

module.exports = router;
