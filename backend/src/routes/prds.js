const express = require('express');
const { PrismaClient } = require('@prisma/client');
const { authenticate } = require('../middleware/auth');
const { canViewBoard, canEditBoard } = require('../lib/boardAccess');

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

    const published = await prisma.prd.update({
      where: { id: prd.id },
      data: { status: 'published', publishedAt: new Date() },
      include: prdInclude,
    });

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
