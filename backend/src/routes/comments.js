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

    // Process @mention notifications
    if (boardId) {
      const boardMembers = await prisma.boardMember.findMany({
        where: { boardId },
        include: { user: { select: { id: true, name: true } } },
      });

      const ticket = await prisma.ticket.findUnique({
        where: { id: ticketId },
        select: { title: true },
      });

      const commenterName = comment.author.name;
      const notified = new Set();

      for (const member of boardMembers) {
        if (member.user.id === req.user.id) continue;
        if (content.includes(`@${member.user.name}`)) {
          if (notified.has(member.user.id)) continue;
          notified.add(member.user.id);
          const notification = await prisma.notification.create({
            data: {
              userId: member.user.id,
              type: 'comment_mention',
              title: `${commenterName} mentioned you`,
              body: `In "${ticket?.title}": ${content}`,
              ticketId,
              boardId,
            },
          });
          req.io.to(`user:${member.user.id}`).emit('notification', notification);
        }
      }
    }

    res.json(comment);
  } catch (e) { console.error(e); res.status(500).json({ error: 'Something went wrong. Please try again.' }); }
});

router.delete('/:id', authenticate, async (req, res) => {
  try {
    const comment = await prisma.comment.findUnique({ where: { id: req.params.id } });
    if (!comment) return res.status(404).json({ error: 'Not found' });
    if (comment.authorId !== req.user.id) return res.status(403).json({ error: 'Not authorized' });
    await prisma.comment.delete({ where: { id: req.params.id } });
    res.json({ success: true });
  } catch (e) { console.error(e); res.status(500).json({ error: 'Something went wrong. Please try again.' }); }
});

module.exports = router;
