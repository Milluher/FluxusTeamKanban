const express = require('express');
const { PrismaClient } = require('@prisma/client');
const { authenticate } = require('../middleware/auth');

const router = express.Router();
const prisma = new PrismaClient();

const GROUP_MENTION = /(?<![\w@])@(all|board|everyone)(?![\w])/i;

function escapeRegex(str) {
  return str.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

// Comment bodies carry inline images as __IMG__<data-uri>__IMG__ and may contain
// rich-text markup — neither should be searched for mentions.
function toPlainText(content = '') {
  return String(content)
    .replace(/__IMG__[\s\S]*?__IMG__/g, ' ')
    .replace(/<[^>]*>/g, ' ');
}

// Resolve "@Name" mentions against board members.
//
// Matching is longest-name-first and word-bounded, so "@Alice Smith" resolves to
// Alice Smith rather than also pinging a member named "Al", and each matched
// span is consumed so a shorter name can't re-match inside a longer one.
// "@all" / "@board" / "@everyone" addresses the whole board.
function resolveMentions(content, members) {
  const text = toPlainText(content);

  if (GROUP_MENTION.test(text)) return { users: members, group: true };

  const byLongestName = [...members].sort((a, b) => b.name.length - a.name.length);
  const matched = [];
  let scan = text;

  for (const member of byLongestName) {
    if (!member.name) continue;
    const pattern = new RegExp(`(?<![\\w@])@${escapeRegex(member.name)}(?![\\w])`, 'gi');
    if (pattern.test(scan)) {
      matched.push(member);
      scan = scan.replace(pattern, ' ');
    }
  }

  return { users: matched, group: false };
}

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
      const candidates = boardMembers
        .map((m) => m.user)
        .filter((u) => u.id !== req.user.id);

      const { users: mentioned, group } = resolveMentions(content, candidates);

      for (const user of mentioned) {
        const notification = await prisma.notification.create({
          data: {
            userId: user.id,
            type: 'comment_mention',
            title: group
              ? `${commenterName} mentioned the board`
              : `${commenterName} mentioned you`,
            body: `In "${ticket?.title}": ${content}`,
            ticketId,
            boardId,
          },
        });
        req.io.to(`user:${user.id}`).emit('notification', notification);
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
