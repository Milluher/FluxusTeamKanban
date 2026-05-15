const express = require('express');
const { PrismaClient } = require('@prisma/client');
const { authenticate } = require('../middleware/auth');

const router = express.Router();
const prisma = new PrismaClient();

// Generate invite link (system admin or board admin only)
router.post('/boards/:boardId/invitations', authenticate, async (req, res) => {
  try {
    const isSystemAdmin = req.user.role === 'admin';
    if (!isSystemAdmin) {
      const membership = await prisma.boardMember.findUnique({
        where: { userId_boardId: { userId: req.user.id, boardId: req.params.boardId } },
      });
      if (!membership || membership.role !== 'admin') return res.status(403).json({ error: 'Only admins can generate invite links' });
    }
    const expiresAt = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000); // 7 days
    const invitation = await prisma.invitation.create({
      data: { boardId: req.params.boardId, createdBy: req.user.id, expiresAt },
    });
    const inviteUrl = `${process.env.FRONTEND_URL || 'https://fluxusteamkanban.vercel.app'}/invite/${invitation.token}`;
    res.json({ token: invitation.token, inviteUrl, expiresAt });
  } catch (e) { console.error(e); res.status(500).json({ error: 'Something went wrong. Please try again.' }); }
});

// Get invitation info (public — no auth)
router.get('/invitations/:token', async (req, res) => {
  try {
    const invitation = await prisma.invitation.findUnique({
      where: { token: req.params.token },
      include: { board: { select: { id: true, name: true } } },
    });
    if (!invitation) return res.status(404).json({ error: 'Invitation not found' });
    if (invitation.used) return res.status(410).json({ error: 'Invitation already used' });
    if (new Date() > invitation.expiresAt) return res.status(410).json({ error: 'Invitation expired' });
    res.json({ boardId: invitation.boardId, boardName: invitation.board.name, token: invitation.token });
  } catch (e) { console.error(e); res.status(500).json({ error: 'Something went wrong. Please try again.' }); }
});

// Accept invitation (authenticated)
router.post('/invitations/:token/accept', authenticate, async (req, res) => {
  try {
    const invitation = await prisma.invitation.findUnique({ where: { token: req.params.token } });
    if (!invitation) return res.status(404).json({ error: 'Invitation not found' });
    if (invitation.used) return res.status(410).json({ error: 'Invitation already used' });
    if (new Date() > invitation.expiresAt) return res.status(410).json({ error: 'Invitation expired' });

    // Add user to board (ignore if already a member)
    await prisma.boardMember.upsert({
      where: { userId_boardId: { userId: req.user.id, boardId: invitation.boardId } },
      update: {},
      create: { userId: req.user.id, boardId: invitation.boardId },
    });

    await prisma.invitation.update({ where: { token: req.params.token }, data: { used: true } });
    res.json({ boardId: invitation.boardId });
  } catch (e) { console.error(e); res.status(500).json({ error: 'Something went wrong. Please try again.' }); }
});

module.exports = router;
