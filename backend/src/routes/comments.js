const express = require('express');
const { PrismaClient } = require('@prisma/client');
const { authenticate } = require('../middleware/auth');

const router = express.Router();
const prisma = new PrismaClient();

router.post('/', authenticate, async (req, res) => {
  try {
    const { content, ticketId, boardId } = req.body;
    if (!content || !ticketId) return res.status(400).json({ error: 'content and ticketId required' });
    const comment = await prisma.comment.create({
      data: { content, ticketId, authorId: req.user.id },
      include: { author: { select: { id: true, name: true } } },
    });
    req.io.to(`board:${boardId}`).emit('comment-added', { ticketId, comment });
    res.json(comment);
  } catch (e) { res.status(500).json({ error: e.message }); }
});

router.delete('/:id', authenticate, async (req, res) => {
  try {
    const comment = await prisma.comment.findUnique({ where: { id: req.params.id } });
    if (!comment) return res.status(404).json({ error: 'Not found' });
    if (comment.authorId !== req.user.id) return res.status(403).json({ error: 'Not authorized' });
    await prisma.comment.delete({ where: { id: req.params.id } });
    res.json({ success: true });
  } catch (e) { res.status(500).json({ error: e.message }); }
});

module.exports = router;
