const express = require('express');
const { PrismaClient } = require('@prisma/client');
const { authenticate } = require('../middleware/auth');

const router = express.Router();
const prisma = new PrismaClient();

const TECH_COMFORT = ['low', 'medium', 'high'];

// The template's optional fields. Only `name` is required: a persona is filled
// in as research arrives, and a half-complete one is still worth recording.
const TEXT_FIELDS = ['segment', 'description', 'goals', 'painPoints', 'behaviours'];

const personaSelect = {
  id: true,
  name: true,
  segment: true,
  description: true,
  goals: true,
  painPoints: true,
  behaviours: true,
  techComfort: true,
  createdAt: true,
  updatedAt: true,
  createdBy: { select: { id: true, name: true } },
};

function requireAdmin(req, res, next) {
  if (req.user.role !== 'admin') return res.status(403).json({ error: 'Only an admin can change personas' });
  next();
}

/** Trims the template's optional fields, turning blanks into nulls. */
function readTemplate(body, { partial }) {
  const data = {};
  for (const field of TEXT_FIELDS) {
    if (!partial || body[field] !== undefined) {
      data[field] = (body[field] || '').trim() || null;
    }
  }
  if (!partial || body.techComfort !== undefined) {
    const value = (body.techComfort || '').trim();
    if (value && !TECH_COMFORT.includes(value)) return { error: 'Tech comfort must be low, medium or high' };
    data.techComfort = value || null;
  }
  return { data };
}

// Every persona, to every authenticated user. Read access is deliberately not
// gated: the point of a persona is that the whole team can name who they build
// for. Alphabetical, so the list is stable between visits.
router.get('/', authenticate, async (req, res) => {
  try {
    const personas = await prisma.persona.findMany({ select: personaSelect });
    res.json(personas.sort((a, b) => a.name.localeCompare(b.name, undefined, { sensitivity: 'base' })));
  } catch (e) { console.error(e); res.status(500).json({ error: 'Something went wrong. Please try again.' }); }
});

// Create — admins only.
router.post('/', authenticate, requireAdmin, async (req, res) => {
  try {
    const name = (req.body.name || '').trim();
    if (!name) return res.status(400).json({ error: 'A persona needs a name' });

    const { data, error } = readTemplate(req.body, { partial: false });
    if (error) return res.status(400).json({ error });

    const persona = await prisma.persona.create({
      data: { ...data, name, createdById: req.user.id },
      select: personaSelect,
    });
    res.json(persona);
  } catch (e) { console.error(e); res.status(500).json({ error: 'Something went wrong. Please try again.' }); }
});

// Update — admins only. Any subset of the template.
router.patch('/:id', authenticate, requireAdmin, async (req, res) => {
  try {
    const existing = await prisma.persona.findUnique({ where: { id: req.params.id } });
    if (!existing) return res.status(404).json({ error: 'Not found' });

    const { data, error } = readTemplate(req.body, { partial: true });
    if (error) return res.status(400).json({ error });

    if (req.body.name !== undefined) {
      const name = (req.body.name || '').trim();
      if (!name) return res.status(400).json({ error: 'A persona needs a name' });
      data.name = name;
    }

    const persona = await prisma.persona.update({
      where: { id: req.params.id },
      data,
      select: personaSelect,
    });
    res.json(persona);
  } catch (e) { console.error(e); res.status(500).json({ error: 'Something went wrong. Please try again.' }); }
});

// Delete — admins only.
router.delete('/:id', authenticate, requireAdmin, async (req, res) => {
  try {
    const existing = await prisma.persona.findUnique({ where: { id: req.params.id } });
    if (!existing) return res.status(404).json({ error: 'Not found' });
    await prisma.persona.delete({ where: { id: req.params.id } });
    res.json({ success: true });
  } catch (e) { console.error(e); res.status(500).json({ error: 'Something went wrong. Please try again.' }); }
});

module.exports = router;
