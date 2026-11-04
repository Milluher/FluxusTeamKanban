const express = require('express');
const { PrismaClient } = require('@prisma/client');
const { authenticate } = require('../middleware/auth');
const { listScope, writeScope } = require('../lib/boardScope');

const router = express.Router();
const prisma = new PrismaClient();

const STATUSES = ['in_progress', 'achieved'];

// The tickets opened to fulfil an initiative, by title and status — enough to
// see whether the work is moving without leaving the page. Deliberately not the
// whole ticket, and the board is still reported per ticket: an initiative now
// belongs to one board, but tickets linked before the board-scoping migration
// may sit on another, and hiding which board a ticket is on would make that
// list unreadable.
const initiativeInclude = {
  board: { select: { id: true, name: true } },
  createdBy: { select: { id: true, name: true } },
  tickets: {
    select: {
      id: true,
      title: true,
      status: true,
      column: { select: { board: { select: { id: true, name: true } } } },
    },
    orderBy: { updatedAt: 'desc' },
  },
};

/** The creator sets the status; an admin can too, for when someone has left. */
function canEdit(initiative, user) {
  return initiative.createdById === user.id || user.role === 'admin';
}

// A board's initiatives. `?boardId=` narrows to one board; without it you get
// the initiatives of every board you can see. Live work first, newest within
// that — descending, because "in_progress" sorts after "achieved"
// alphabetically.
router.get('/', authenticate, async (req, res) => {
  try {
    const scope = await listScope(req);
    if (scope.error) return res.status(scope.status).json({ error: scope.error });

    const initiatives = await prisma.initiative.findMany({
      where: scope.where,
      include: initiativeInclude,
      orderBy: [{ status: 'desc' }, { createdAt: 'desc' }],
    });
    res.json(initiatives);
  } catch (e) { console.error(e); res.status(500).json({ error: 'Something went wrong. Please try again.' }); }
});

// Create one on a board. Open to any member of that board.
router.post('/', authenticate, async (req, res) => {
  try {
    const title = (req.body.title || '').trim();
    const description = (req.body.description || '').trim();
    if (!title) return res.status(400).json({ error: 'Say what the initiative is' });
    if (!description) return res.status(400).json({ error: 'Add a bit more about it' });

    const target = await writeScope(req, {
      boardId: req.body.boardId,
      requiredMessage: 'Choose the board this initiative belongs to',
    });
    if (target.error) return res.status(target.status).json({ error: target.error });

    const status = req.body.status && STATUSES.includes(req.body.status)
      ? req.body.status
      : 'in_progress';

    const initiative = await prisma.initiative.create({
      data: { title, description, status, boardId: target.boardId, createdById: req.user.id },
      include: initiativeInclude,
    });
    res.json(initiative);
  } catch (e) { console.error(e); res.status(500).json({ error: 'Something went wrong. Please try again.' }); }
});

// Update one — its creator or an admin. Status, title and description.
router.patch('/:id', authenticate, async (req, res) => {
  try {
    const existing = await prisma.initiative.findUnique({ where: { id: req.params.id } });
    if (!existing) return res.status(404).json({ error: 'Not found' });
    if (!canEdit(existing, req.user)) {
      return res.status(403).json({ error: 'Only the creator of an initiative can change it' });
    }

    const data = {};
    if (req.body.status !== undefined) {
      if (!STATUSES.includes(req.body.status)) {
        return res.status(400).json({ error: 'Status must be in_progress or achieved' });
      }
      data.status = req.body.status;
    }
    if (req.body.title !== undefined) {
      const title = (req.body.title || '').trim();
      if (!title) return res.status(400).json({ error: 'Say what the initiative is' });
      data.title = title;
    }
    if (req.body.description !== undefined) {
      const description = (req.body.description || '').trim();
      if (!description) return res.status(400).json({ error: 'Add a bit more about it' });
      data.description = description;
    }
    if (req.body.boardId !== undefined) {
      const target = await writeScope(req, {
        boardId: req.body.boardId,
        requiredMessage: 'An initiative has to belong to a board',
      });
      if (target.error) return res.status(target.status).json({ error: target.error });
      data.boardId = target.boardId;
    }

    const initiative = await prisma.initiative.update({
      where: { id: req.params.id },
      data,
      include: initiativeInclude,
    });
    res.json(initiative);
  } catch (e) { console.error(e); res.status(500).json({ error: 'Something went wrong. Please try again.' }); }
});

// Remove one — its creator or an admin. The tickets raised for it survive: the
// foreign key is SET NULL, so retiring an initiative never deletes work.
router.delete('/:id', authenticate, async (req, res) => {
  try {
    const existing = await prisma.initiative.findUnique({ where: { id: req.params.id } });
    if (!existing) return res.status(404).json({ error: 'Not found' });
    if (!canEdit(existing, req.user)) {
      return res.status(403).json({ error: 'Only the creator of an initiative can remove it' });
    }
    await prisma.initiative.delete({ where: { id: req.params.id } });
    res.json({ success: true });
  } catch (e) { console.error(e); res.status(500).json({ error: 'Something went wrong. Please try again.' }); }
});

module.exports = router;
