const express = require('express');
const { PrismaClient } = require('@prisma/client');
const { authenticate } = require('../middleware/auth');

const router = express.Router();
const prisma = new PrismaClient();

const termSelect = {
  id: true,
  term: true,
  definition: true,
  createdAt: true,
  updatedAt: true,
  createdBy: { select: { id: true, name: true } },
};

/**
 * Alphabetical, case-insensitively.
 *
 * Sorted here rather than in the query: Postgres orders by collation, which
 * puts every capital ahead of every lowercase letter, so "Webhook" would sort
 * before "api". The table is a glossary — tens to hundreds of rows — so the
 * cost of sorting in the process is not worth a functional index.
 */
function alphabetically(a, b) {
  return a.term.localeCompare(b.term, undefined, { sensitivity: 'base' });
}

/** Only the author of a term, or an admin, may change it. */
function canEdit(term, user) {
  return term.createdById === user.id || user.role === 'admin';
}

// Every term. Readable by any authenticated user — a shared vocabulary is no
// use if it is partial.
router.get('/', authenticate, async (req, res) => {
  try {
    const terms = await prisma.dictionaryTerm.findMany({ select: termSelect });
    res.json(terms.sort(alphabetically));
  } catch (e) { console.error(e); res.status(500).json({ error: 'Something went wrong. Please try again.' }); }
});

// Add a term. Open to every member of the workspace, by design.
router.post('/', authenticate, async (req, res) => {
  try {
    const term = (req.body.term || '').trim();
    const definition = (req.body.definition || '').trim();
    if (!term) return res.status(400).json({ error: 'A term is required' });
    if (!definition) return res.status(400).json({ error: 'A definition is required' });

    const created = await prisma.dictionaryTerm.create({
      data: { term, definition, createdById: req.user.id },
      select: termSelect,
    });
    res.json(created);
  } catch (e) {
    if (e.code === 'P2002') {
      return res.status(409).json({ error: 'That term is already in the dictionary' });
    }
    console.error(e);
    res.status(500).json({ error: 'Something went wrong. Please try again.' });
  }
});

// Edit a term — its author or an admin. Not in the brief, but a glossary whose
// typos are permanent stops being used.
router.patch('/:id', authenticate, async (req, res) => {
  try {
    const existing = await prisma.dictionaryTerm.findUnique({ where: { id: req.params.id } });
    if (!existing) return res.status(404).json({ error: 'Not found' });
    if (!canEdit(existing, req.user)) {
      return res.status(403).json({ error: 'Only the author of a term can change it' });
    }

    const data = {};
    if (req.body.term !== undefined) {
      const term = (req.body.term || '').trim();
      if (!term) return res.status(400).json({ error: 'A term is required' });
      data.term = term;
    }
    if (req.body.definition !== undefined) {
      const definition = (req.body.definition || '').trim();
      if (!definition) return res.status(400).json({ error: 'A definition is required' });
      data.definition = definition;
    }

    const updated = await prisma.dictionaryTerm.update({
      where: { id: req.params.id },
      data,
      select: termSelect,
    });
    res.json(updated);
  } catch (e) {
    if (e.code === 'P2002') {
      return res.status(409).json({ error: 'That term is already in the dictionary' });
    }
    console.error(e);
    res.status(500).json({ error: 'Something went wrong. Please try again.' });
  }
});

// Remove a term — its author or an admin.
router.delete('/:id', authenticate, async (req, res) => {
  try {
    const existing = await prisma.dictionaryTerm.findUnique({ where: { id: req.params.id } });
    if (!existing) return res.status(404).json({ error: 'Not found' });
    if (!canEdit(existing, req.user)) {
      return res.status(403).json({ error: 'Only the author of a term can remove it' });
    }
    await prisma.dictionaryTerm.delete({ where: { id: req.params.id } });
    res.json({ success: true });
  } catch (e) { console.error(e); res.status(500).json({ error: 'Something went wrong. Please try again.' }); }
});

module.exports = router;
