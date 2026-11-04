const express = require('express');
const { PrismaClient } = require('@prisma/client');
const { authenticate } = require('../middleware/auth');
const { normalizeItems, presentEntry } = require('../lib/changelogView');
const { listScope, writeScope } = require('../lib/boardScope');

const router = express.Router();
const prisma = new PrismaClient();

function requireAdmin(req, res, next) {
  if (req.user.role !== 'admin') return res.status(403).json({ error: 'Admin only' });
  next();
}

// A board's changelog. `?boardId=` narrows to one board; without it you get the
// entries of every board you can see. Drafts stay admin-only either way.
router.get('/', authenticate, async (req, res) => {
  try {
    const isAdmin = req.user.role === 'admin';
    const take = Math.min(parseInt(req.query.limit, 10) || 50, 100);

    const scope = await listScope(req);
    if (scope.error) return res.status(scope.status).json({ error: scope.error });

    const memberships = await prisma.boardMember.findMany({
      where: { userId: req.user.id },
      select: { boardId: true },
    });
    const memberBoardIds = new Set(memberships.map((m) => m.boardId));

    const entries = await prisma.changelogEntry.findMany({
      where: isAdmin ? scope.where : { ...scope.where, publishedAt: { not: null } },
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

// Create an entry (admin) against one board. Publishes immediately unless
// { draft: true }. A board is required: there is no company-wide entry any more.
router.post('/', authenticate, requireAdmin, async (req, res) => {
  try {
    const { version, title, summary, items, boardId, draft } = req.body;
    if (!title || !title.trim()) return res.status(400).json({ error: 'title required' });

    const target = await writeScope(req, {
      boardId,
      requiredMessage: 'Choose the board this entry belongs to',
    });
    if (target.error) return res.status(target.status).json({ error: target.error });

    const entry = await prisma.changelogEntry.create({
      data: {
        version: version?.trim() || null,
        title: title.trim(),
        summary: summary?.trim() || null,
        items: normalizeItems(items),
        boardId: target.boardId,
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
    if (boardId !== undefined) {
      const target = await writeScope(req, {
        boardId,
        requiredMessage: 'An entry has to belong to a board',
      });
      if (target.error) return res.status(target.status).json({ error: target.error });
      data.boardId = target.boardId;
    }
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
