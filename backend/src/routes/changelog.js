const express = require('express');
const { PrismaClient } = require('@prisma/client');
const { authenticate } = require('../middleware/auth');
const { normalizeItems, presentEntry } = require('../lib/changelogView');

const router = express.Router();
const prisma = new PrismaClient();

function requireAdmin(req, res, next) {
  if (req.user.role !== 'admin') return res.status(403).json({ error: 'Admin only' });
  next();
}

// List changelog entries — visible to every authenticated user, across all projects.
router.get('/', authenticate, async (req, res) => {
  try {
    const isAdmin = req.user.role === 'admin';
    const take = Math.min(parseInt(req.query.limit, 10) || 50, 100);

    const memberships = await prisma.boardMember.findMany({
      where: { userId: req.user.id },
      select: { boardId: true },
    });
    const memberBoardIds = new Set(memberships.map((m) => m.boardId));

    const entries = await prisma.changelogEntry.findMany({
      where: isAdmin ? {} : { publishedAt: { not: null } },
      include: {
        board: { select: { id: true, name: true } },
        author: { select: { id: true, name: true } },
      },
      orderBy: [{ publishedAt: 'desc' }, { createdAt: 'desc' }],
      take,
    });

    res.json(entries.map((e) => presentEntry(e, { isAdmin, memberBoardIds })));
  } catch (e) { console.error(e); res.status(500).json({ error: 'Something went wrong. Please try again.' }); }
});

// Create an entry (admin). Publishes immediately unless { draft: true }.
router.post('/', authenticate, requireAdmin, async (req, res) => {
  try {
    const { version, title, summary, items, boardId, draft } = req.body;
    if (!title || !title.trim()) return res.status(400).json({ error: 'title required' });

    const entry = await prisma.changelogEntry.create({
      data: {
        version: version?.trim() || null,
        title: title.trim(),
        summary: summary?.trim() || null,
        items: normalizeItems(items),
        boardId: boardId || null,
        authorId: req.user.id,
        publishedAt: draft ? null : new Date(),
      },
      include: {
        board: { select: { id: true, name: true } },
        author: { select: { id: true, name: true } },
      },
    });

    res.json(presentEntry(entry, { isAdmin: true, memberBoardIds: new Set() }));
  } catch (e) { console.error(e); res.status(500).json({ error: 'Something went wrong. Please try again.' }); }
});

// Update an entry (admin). Pass { draft: false } to publish a draft.
router.patch('/:id', authenticate, requireAdmin, async (req, res) => {
  try {
    const existing = await prisma.changelogEntry.findUnique({ where: { id: req.params.id } });
    if (!existing) return res.status(404).json({ error: 'Not found' });

    const { version, title, summary, items, boardId, draft } = req.body;
    const data = {};
    if (version !== undefined) data.version = version?.trim() || null;
    if (title !== undefined) {
      if (!title.trim()) return res.status(400).json({ error: 'title required' });
      data.title = title.trim();
    }
    if (summary !== undefined) data.summary = summary?.trim() || null;
    if (items !== undefined) data.items = normalizeItems(items);
    if (boardId !== undefined) data.boardId = boardId || null;
    if (draft !== undefined) {
      // Publishing stamps the date once; re-publishing an already-live entry
      // keeps its original date so the feed doesn't reshuffle on a typo fix.
      data.publishedAt = draft ? null : existing.publishedAt || new Date();
    }

    const entry = await prisma.changelogEntry.update({
      where: { id: req.params.id },
      data,
      include: {
        board: { select: { id: true, name: true } },
        author: { select: { id: true, name: true } },
      },
    });

    res.json(presentEntry(entry, { isAdmin: true, memberBoardIds: new Set() }));
  } catch (e) { console.error(e); res.status(500).json({ error: 'Something went wrong. Please try again.' }); }
});

// Delete an entry (admin)
router.delete('/:id', authenticate, requireAdmin, async (req, res) => {
  try {
    await prisma.changelogEntry.delete({ where: { id: req.params.id } });
    res.json({ success: true });
  } catch (e) { console.error(e); res.status(500).json({ error: 'Something went wrong. Please try again.' }); }
});

module.exports = router;
