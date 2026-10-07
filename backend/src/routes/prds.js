const express = require('express');
const { PrismaClient } = require('@prisma/client');
const { authenticate } = require('../middleware/auth');
const { canViewBoard, canEditBoard } = require('../lib/boardAccess');
const { ticketInclude } = require('../lib/ticketInclude');

const router = express.Router();
const prisma = new PrismaClient();

const CLASSIFICATIONS = ['new_product', 'major_feature', 'minor_enhancement'];

/**
 * The sections an author may write. The brief's numbering is kept in the
 * comments so the two can be read side by side.
 */
const SECTIONS = [
  'overview',
  'goals',
  'userStories',
  'functionalReqs',
  'nonFunctionalReqs',
  'userFlows',
  'assumptions',
  'platforms',
  'inScope',
  'outOfScope',
  'acceptanceCriteria',
  'successMetrics',
];

/**
 * Sections that must be filled in before a PRD can be published, with the
 * wording used to refuse. Required is a condition of *publishing*: a draft is
 * saved from the first keystroke and is allowed to be as empty as it likes.
 */
const REQUIRED_TO_PUBLISH = [
  ['overview', 'an overview and problem statement'],
  ['goals', 'goals'],
  ['inScope', 'what is in scope'],
  ['outOfScope', 'what is out of scope'],
  ['acceptanceCriteria', 'acceptance criteria'],
  ['successMetrics', 'success metrics'],
];

const prdInclude = {
  createdBy: { select: { id: true, name: true } },
  board: { select: { id: true, name: true } },
  canvasFeature: { select: { id: true, text: true } },
  personas: {
    include: { persona: { select: { id: true, name: true, segment: true } } },
  },
  adminBlocks: {
    orderBy: { createdAt: 'asc' },
    include: {
      assignee: { select: { id: true, name: true, email: true } },
      ticket: { select: { id: true, title: true, status: true } },
    },
  },
};

/** Loads a PRD with the board id needed to authorise against it. */
async function loadPrd(id) {
  return prisma.prd.findUnique({ where: { id }, include: prdInclude });
}

/** The creator owns the document; a system admin can act on it too. */
function isOwner(prd, user) {
  return prd.createdById === user.id || user.role === 'admin';
}

/** Trims a section, turning a blank into null so "required" means something. */
function section(value) {
  return (value || '').trim() || null;
}

/**
 * Escapes text going into a generated ticket description.
 *
 * Descriptions are rich-text HTML and are rendered with
 * dangerouslySetInnerHTML, so a PRD title or a role name containing markup
 * would otherwise be executed in every reader's browser.
 */
function escapeHtml(text) {
  return String(text)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

/**
 * Where a generated task lands: the board's "To Do" column, which is what the
 * brief means by "their To-do". Falls back to the first column, because a board
 * can have been renamed and a task nobody can find is worse than one in the
 * wrong column.
 */
async function todoColumnFor(boardId) {
  const columns = await prisma.column.findMany({
    where: { boardId },
    orderBy: { order: 'asc' },
    select: { id: true, name: true },
  });
  return columns.find((c) => c.name.trim().toLowerCase() === 'to do') ?? columns[0] ?? null;
}

/** The assignee has to be someone on the board, or the task lands where they cannot see it. */
async function isBoardMember(userId, boardId) {
  const membership = await prisma.boardMember.findUnique({
    where: { userId_boardId: { userId, boardId } },
  });
  return !!membership;
}

// Every PRD on a board, to anyone who can see that board. Drafts included:
// a board member seeing that a document exists and is unfinished is the point
// of having it in the tool rather than in somebody's notes app.
router.get('/', authenticate, async (req, res) => {
  try {
    const { boardId } = req.query;
    if (!boardId) return res.status(400).json({ error: 'boardId required' });
    if (!(await canViewBoard(req, boardId))) return res.status(403).json({ error: 'Access denied' });

    const prds = await prisma.prd.findMany({
      where: { boardId },
      include: prdInclude,
      orderBy: [{ updatedAt: 'desc' }],
    });
    res.json(prds);
  } catch (e) { console.error(e); res.status(500).json({ error: 'Something went wrong. Please try again.' }); }
});

router.get('/:id', authenticate, async (req, res) => {
  try {
    const prd = await loadPrd(req.params.id);
    if (!prd) return res.status(404).json({ error: 'Not found' });
    if (!(await canViewBoard(req, prd.boardId))) return res.status(403).json({ error: 'Access denied' });
    res.json(prd);
  } catch (e) { console.error(e); res.status(500).json({ error: 'Something went wrong. Please try again.' }); }
});

// Start one. Opens as a draft with nothing but a title, because the builder is
// reached by adding a feature to the canvas — the author has not written
// anything yet at the moment it opens.
router.post('/', authenticate, async (req, res) => {
  try {
    const { boardId, canvasFeatureId } = req.body;
    const title = (req.body.title || '').trim();
    if (!boardId) return res.status(400).json({ error: 'boardId required' });
    if (!title) return res.status(400).json({ error: 'A PRD needs a title' });
    if (!(await canEditBoard(req, boardId))) {
      return res.status(403).json({ error: 'Only a board admin can start a PRD' });
    }

    if (canvasFeatureId) {
      const existing = await prisma.prd.findUnique({ where: { canvasFeatureId } });
      if (existing) return res.status(409).json({ error: 'That feature already has a PRD' });
    }

    const prd = await prisma.prd.create({
      data: {
        title,
        boardId,
        canvasFeatureId: canvasFeatureId || null,
        version: (req.body.version || '').trim() || null,
        createdById: req.user.id,
      },
      include: prdInclude,
    });
    req.io.to(`board:${boardId}`).emit('prd-changed', { boardId, prdId: prd.id });
    res.json(prd);
  } catch (e) { console.error(e); res.status(500).json({ error: 'Something went wrong. Please try again.' }); }
});

// Save progress. Any subset of the sections, so the form can autosave as it is
// written rather than only on a deliberate Save.
router.patch('/:id', authenticate, async (req, res) => {
  try {
    const prd = await loadPrd(req.params.id);
    if (!prd) return res.status(404).json({ error: 'Not found' });
    if (!isOwner(prd, req.user)) {
      return res.status(403).json({ error: 'Only the author of a PRD can change it' });
    }

    const data = {};
    if (req.body.title !== undefined) {
      const title = (req.body.title || '').trim();
      if (!title) return res.status(400).json({ error: 'A PRD needs a title' });
      data.title = title;
    }
    if (req.body.version !== undefined) data.version = section(req.body.version);
    if (req.body.classification !== undefined) {
      const value = (req.body.classification || '').trim();
      if (value && !CLASSIFICATIONS.includes(value)) {
        return res.status(400).json({ error: 'Classification must be new_product, major_feature or minor_enhancement' });
      }
      data.classification = value || null;
    }
    for (const field of SECTIONS) {
      if (req.body[field] !== undefined) data[field] = section(req.body[field]);
    }

    // §10 Target Personas: the whole selection is replaced, so unticking one
    // removes it without a separate call.
    const personaIds = Array.isArray(req.body.personaIds) ? [...new Set(req.body.personaIds)] : null;

    const updated = await prisma.$transaction(async (tx) => {
      if (personaIds) {
        await tx.prdPersona.deleteMany({ where: { prdId: prd.id } });
        if (personaIds.length) {
          await tx.prdPersona.createMany({
            data: personaIds.map((personaId) => ({ prdId: prd.id, personaId })),
            skipDuplicates: true,
          });
        }
      }
      return tx.prd.update({ where: { id: prd.id }, data, include: prdInclude });
    });

    req.io.to(`board:${prd.boardId}`).emit('prd-changed', { boardId: prd.boardId, prdId: prd.id });
    res.json(updated);
  } catch (e) {
    if (e.code === 'P2003' || e.code === 'P2025') {
      return res.status(400).json({ error: 'One of those personas no longer exists' });
    }
    console.error(e);
    res.status(500).json({ error: 'Something went wrong. Please try again.' });
  }
});

// --- §16 Administrative blocks ---

// Add a block: a role, and the board member who owns it. Only while the PRD is
// a draft — the brief ties notification to publishing, so a block appearing
// afterwards would have nobody to tell.
router.post('/:id/admin-blocks', authenticate, async (req, res) => {
  try {
    const prd = await loadPrd(req.params.id);
    if (!prd) return res.status(404).json({ error: 'Not found' });
    if (!isOwner(prd, req.user)) {
      return res.status(403).json({ error: 'Only the author of a PRD can assign its admin blocks' });
    }
    if (prd.status === 'published') {
      return res.status(409).json({ error: 'A published PRD cannot take new admin blocks' });
    }

    const role = (req.body.role || '').trim();
    const { assigneeId } = req.body;
    if (!role) return res.status(400).json({ error: 'Give the block a role' });
    if (!assigneeId) return res.status(400).json({ error: 'Choose who the block is for' });
    if (!(await isBoardMember(assigneeId, prd.boardId))) {
      return res.status(400).json({ error: 'That person is not a member of this board' });
    }

    await prisma.prdAdminBlock.create({ data: { prdId: prd.id, role, assigneeId } });
    const updated = await loadPrd(prd.id);
    req.io.to(`board:${prd.boardId}`).emit('prd-changed', { boardId: prd.boardId, prdId: prd.id });
    res.json(updated);
  } catch (e) { console.error(e); res.status(500).json({ error: 'Something went wrong. Please try again.' }); }
});

/**
 * Fill in or retarget a block.
 *
 * The author owns the role and the assignee; the assignee owns the two answers.
 * Neither writes the other's half — that is what assigning a block means, and
 * the brief says the assignee "is only able to fill out the admin role block
 * they've been assigned".
 */
router.patch('/admin-blocks/:blockId', authenticate, async (req, res) => {
  try {
    const block = await prisma.prdAdminBlock.findUnique({
      where: { id: req.params.blockId },
      include: { prd: { select: { id: true, boardId: true, status: true, createdById: true } } },
    });
    if (!block) return res.status(404).json({ error: 'Not found' });

    const owner = isOwner(block.prd, req.user);
    const assignee = block.assigneeId === req.user.id;
    if (!owner && !assignee) return res.status(403).json({ error: 'That block is not yours to change' });

    const data = {};

    if (req.body.dataNeeded !== undefined || req.body.actionsNeeded !== undefined) {
      if (!assignee) {
        return res.status(403).json({ error: 'Only the person a block is assigned to can answer it' });
      }
      if (req.body.dataNeeded !== undefined) data.dataNeeded = section(req.body.dataNeeded);
      if (req.body.actionsNeeded !== undefined) data.actionsNeeded = section(req.body.actionsNeeded);
    }

    if (req.body.role !== undefined || req.body.assigneeId !== undefined) {
      if (!owner) return res.status(403).json({ error: 'Only the author of a PRD can retarget a block' });
      if (block.prd.status === 'published') {
        return res.status(409).json({ error: 'A published block cannot be retargeted' });
      }
      if (req.body.role !== undefined) {
        const role = (req.body.role || '').trim();
        if (!role) return res.status(400).json({ error: 'Give the block a role' });
        data.role = role;
      }
      if (req.body.assigneeId !== undefined) {
        if (!(await isBoardMember(req.body.assigneeId, block.prd.boardId))) {
          return res.status(400).json({ error: 'That person is not a member of this board' });
        }
        data.assigneeId = req.body.assigneeId;
      }
    }

    await prisma.prdAdminBlock.update({ where: { id: block.id }, data });
    const updated = await loadPrd(block.prd.id);
    req.io.to(`board:${block.prd.boardId}`).emit('prd-changed', { boardId: block.prd.boardId, prdId: block.prd.id });
    res.json(updated);
  } catch (e) { console.error(e); res.status(500).json({ error: 'Something went wrong. Please try again.' }); }
});

router.delete('/admin-blocks/:blockId', authenticate, async (req, res) => {
  try {
    const block = await prisma.prdAdminBlock.findUnique({
      where: { id: req.params.blockId },
      include: { prd: { select: { id: true, boardId: true, status: true, createdById: true } } },
    });
    if (!block) return res.status(404).json({ error: 'Not found' });
    if (!isOwner(block.prd, req.user)) {
      return res.status(403).json({ error: 'Only the author of a PRD can remove its admin blocks' });
    }
    if (block.prd.status === 'published') {
      return res.status(409).json({ error: 'A published block cannot be removed' });
    }

    await prisma.prdAdminBlock.delete({ where: { id: block.id } });
    const updated = await loadPrd(block.prd.id);
    req.io.to(`board:${block.prd.boardId}`).emit('prd-changed', { boardId: block.prd.boardId, prdId: block.prd.id });
    res.json(updated);
  } catch (e) { console.error(e); res.status(500).json({ error: 'Something went wrong. Please try again.' }); }
});

/**
 * Publish. This is where "required" is enforced, and the moment the brief ties
 * notifications and generated tickets to — so a draft can be as incomplete as
 * its author likes without telling anybody anything.
 */
router.post('/:id/publish', authenticate, async (req, res) => {
  try {
    const prd = await loadPrd(req.params.id);
    if (!prd) return res.status(404).json({ error: 'Not found' });
    if (!isOwner(prd, req.user)) {
      return res.status(403).json({ error: 'Only the author of a PRD can publish it' });
    }
    if (prd.status === 'published') {
      return res.status(409).json({ error: 'That PRD is already published' });
    }

    const missing = REQUIRED_TO_PUBLISH.filter(([field]) => !prd[field]).map(([, label]) => label);
    if (missing.length) {
      return res.status(400).json({
        error: `Before publishing, fill in ${missing.join(', ')}.`,
        missing: REQUIRED_TO_PUBLISH.filter(([field]) => !prd[field]).map(([field]) => field),
      });
    }

    // §16: publishing is the moment the people with blocks are told. Each gets
    // a real Ticket on the board, because "their To-do on the workspace Kanban
    // board" is a view over tickets assigned to them — a separate kind of task
    // would simply not appear there.
    const column = prd.adminBlocks.length ? await todoColumnFor(prd.boardId) : null;
    if (prd.adminBlocks.length && !column) {
      return res.status(400).json({ error: 'This board has no columns, so the admin tasks cannot be raised' });
    }

    const notifications = [];
    const published = await prisma.$transaction(async (tx) => {
      for (const block of prd.adminBlocks) {
        // Idempotent by construction: a block that already has a task keeps it.
        if (block.ticketId) continue;

        const ticket = await tx.ticket.create({
          data: {
            title: `${prd.title} — ${block.role}`,
            description:
              `<p>Your <strong>${escapeHtml(block.role)}</strong> section of the PRD ` +
              `“${escapeHtml(prd.title)}” is ready to fill in: the data you need, and the ` +
              `actions you need to take with this product.</p>`,
            status: column.name,
            columnId: column.id,
            assigneeId: block.assigneeId,
            createdById: req.user.id,
            prdId: prd.id,
          },
        });
        await tx.prdAdminBlock.update({ where: { id: block.id }, data: { ticketId: ticket.id } });

        if (block.assigneeId !== req.user.id) {
          notifications.push(
            await tx.notification.create({
              data: {
                userId: block.assigneeId,
                type: 'prd_admin_block',
                title: 'You have a PRD section to complete',
                body: `"${prd.title}" — ${block.role}`,
                ticketId: ticket.id,
                boardId: prd.boardId,
              },
            })
          );
        }
      }

      return tx.prd.update({
        where: { id: prd.id },
        data: { status: 'published', publishedAt: new Date() },
        include: prdInclude,
      });
    });

    // Emitted after the transaction commits, so nobody is told about work that
    // then rolled back.
    for (const notification of notifications) {
      req.io.to(`user:${notification.userId}`).emit('notification', notification);
    }
    // Fetched in full rather than emitted from the block's narrow selection:
    // the board renders fields a partial ticket would not carry.
    const raisedIds = published.adminBlocks.map((b) => b.ticketId).filter(Boolean);
    if (raisedIds.length) {
      const raised = await prisma.ticket.findMany({
        where: { id: { in: raisedIds } },
        include: ticketInclude,
      });
      for (const ticket of raised) {
        req.io.to(`board:${prd.boardId}`).emit('ticket-created', ticket);
      }
    }
    req.io.to(`board:${prd.boardId}`).emit('prd-changed', { boardId: prd.boardId, prdId: prd.id });
    res.json(published);
  } catch (e) { console.error(e); res.status(500).json({ error: 'Something went wrong. Please try again.' }); }
});

router.delete('/:id', authenticate, async (req, res) => {
  try {
    const prd = await loadPrd(req.params.id);
    if (!prd) return res.status(404).json({ error: 'Not found' });
    if (!isOwner(prd, req.user)) {
      return res.status(403).json({ error: 'Only the author of a PRD can remove it' });
    }
    await prisma.prd.delete({ where: { id: prd.id } });
    req.io.to(`board:${prd.boardId}`).emit('prd-changed', { boardId: prd.boardId, prdId: prd.id });
    res.json({ success: true });
  } catch (e) { console.error(e); res.status(500).json({ error: 'Something went wrong. Please try again.' }); }
});

module.exports = router;
module.exports.REQUIRED_TO_PUBLISH = REQUIRED_TO_PUBLISH;
module.exports.SECTIONS = SECTIONS;
module.exports.CLASSIFICATIONS = CLASSIFICATIONS;
