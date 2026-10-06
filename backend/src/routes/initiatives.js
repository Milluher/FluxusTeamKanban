const express = require('express');
const { PrismaClient } = require('@prisma/client');
const { authenticate } = require('../middleware/auth');

const router = express.Router();
const prisma = new PrismaClient();

const STATUSES = ['in_progress', 'achieved'];

// The tickets opened to fulfil an initiative, by title and status — enough to
// see whether the work is moving without leaving the page. Deliberately not the
// whole ticket: an initiative spans boards, and a member of the workspace is
// not necessarily a member of every board whose tickets appear here.
const initiativeInclude = {
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

// Every initiative, to every member. Live work first, newest within that —
// descending, because "in_progress" sorts after "achieved" alphabetically.
router.get('/', authenticate, async (req, res) => {
  try {
    const initiatives = await prisma.initiative.findMany({
      include: initiativeInclude,
      orderBy: [{ status: 'desc' }, { createdAt: 'desc' }],
    });
    res.json(initiatives);
  } catch (e) { console.error(e); res.status(500).json({ error: 'Something went wrong. Please try again.' }); }
});

// Create one. Open to any member of the workspace.
router.post('/', authenticate, async (req, res) => {
  try {
    const title = (req.body.title || '').trim();
    const description = (req.body.description || '').trim();
    if (!title) return res.status(400).json({ error: 'Say what the initiative is' });
    if (!description) return res.status(400).json({ error: 'Add a bit more about it' });

    const status = req.body.status && STATUSES.includes(req.body.status)
      ? req.body.status
      : 'in_progress';

    const initiative = await prisma.initiative.create({
      data: { title, description, status, createdById: req.user.id },
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
