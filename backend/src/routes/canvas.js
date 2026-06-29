const express = require('express');
const { PrismaClient } = require('@prisma/client');
const { authenticate } = require('../middleware/auth');

const router = express.Router();
const prisma = new PrismaClient();

// Verify the requester can READ the board (system admin or any board member).
async function canViewBoard(req, boardId) {
  if (req.user.role === 'admin') return true;
  const membership = await prisma.boardMember.findUnique({
    where: { userId_boardId: { userId: req.user.id, boardId } },
  });
  return !!membership;
}

// Verify the requester can EDIT the canvas (system admin or board admin).
async function canEditBoard(req, boardId) {
  if (req.user.role === 'admin') return true;
  const membership = await prisma.boardMember.findUnique({
    where: { userId_boardId: { userId: req.user.id, boardId } },
  });
  return !!membership && membership.role === 'admin';
}

// Resolve the boardId that owns a given block, for nested edit auth.
async function boardIdForBlock(blockId) {
  const block = await prisma.canvasBlock.findUnique({
    where: { id: blockId },
    select: { project: { select: { boardId: true } } },
  });
  return block?.project?.boardId ?? null;
}

// Resolve the boardId that owns a given feature, for nested edit auth.
async function boardIdForFeature(featureId) {
  const feature = await prisma.canvasFeature.findUnique({
    where: { id: featureId },
    select: { block: { select: { project: { select: { boardId: true } } } } },
  });
  return feature?.block?.project?.boardId ?? null;
}

// Notify everyone viewing this board to refetch the canvas.
function emitCanvasChanged(req, boardId) {
  if (boardId) req.io.to(`board:${boardId}`).emit('canvas-changed', { boardId });
}

// List all canvas projects for a board (with nested blocks + features).
router.get('/:id/canvas', authenticate, async (req, res) => {
  try {
    if (!(await canViewBoard(req, req.params.id)))
      return res.status(403).json({ error: 'Access denied' });
    const projects = await prisma.canvasProject.findMany({
      where: { boardId: req.params.id },
      orderBy: { order: 'asc' },
      include: {
        blocks: {
          orderBy: { order: 'asc' },
          include: { features: { orderBy: { order: 'asc' } } },
        },
      },
    });
    res.json(projects);
  } catch (e) { console.error(e); res.status(500).json({ error: 'Something went wrong. Please try again.' }); }
});

// Create a project (admin).
router.post('/:id/canvas/projects', authenticate, async (req, res) => {
  try {
    if (!(await canEditBoard(req, req.params.id)))
      return res.status(403).json({ error: 'Only admins can edit the canvas' });
    const { name } = req.body;
    if (!name || !name.trim()) return res.status(400).json({ error: 'Project name is required' });
    const count = await prisma.canvasProject.count({ where: { boardId: req.params.id } });
    const project = await prisma.canvasProject.create({
      data: { boardId: req.params.id, name: name.trim(), order: count },
      include: { blocks: { include: { features: true } } },
    });
    emitCanvasChanged(req, req.params.id);
    res.json(project);
  } catch (e) { console.error(e); res.status(500).json({ error: 'Something went wrong. Please try again.' }); }
});

// Rename a project (admin).
router.patch('/:id/canvas/projects/:projectId', authenticate, async (req, res) => {
  try {
    if (!(await canEditBoard(req, req.params.id)))
      return res.status(403).json({ error: 'Only admins can edit the canvas' });
    const { name } = req.body;
    if (!name || !name.trim()) return res.status(400).json({ error: 'Project name is required' });
    const project = await prisma.canvasProject.update({
      where: { id: req.params.projectId },
      data: { name: name.trim() },
    });
    emitCanvasChanged(req, req.params.id);
    res.json(project);
  } catch (e) { console.error(e); res.status(500).json({ error: 'Something went wrong. Please try again.' }); }
});

// Delete a project (admin) — cascades to blocks + features.
router.delete('/:id/canvas/projects/:projectId', authenticate, async (req, res) => {
  try {
    if (!(await canEditBoard(req, req.params.id)))
      return res.status(403).json({ error: 'Only admins can edit the canvas' });
    await prisma.canvasProject.delete({ where: { id: req.params.projectId } });
    emitCanvasChanged(req, req.params.id);
    res.json({ success: true });
  } catch (e) { console.error(e); res.status(500).json({ error: 'Something went wrong. Please try again.' }); }
});

// Add a block to a project (admin).
router.post('/:id/canvas/projects/:projectId/blocks', authenticate, async (req, res) => {
  try {
    if (!(await canEditBoard(req, req.params.id)))
      return res.status(403).json({ error: 'Only admins can edit the canvas' });
    const { title } = req.body;
    if (!title || !title.trim()) return res.status(400).json({ error: 'Block title is required' });
    const count = await prisma.canvasBlock.count({ where: { projectId: req.params.projectId } });
    const block = await prisma.canvasBlock.create({
      data: { projectId: req.params.projectId, title: title.trim(), order: count },
      include: { features: true },
    });
    emitCanvasChanged(req, req.params.id);
    res.json(block);
  } catch (e) { console.error(e); res.status(500).json({ error: 'Something went wrong. Please try again.' }); }
});

// Rename a block (admin).
router.patch('/:id/canvas/blocks/:blockId', authenticate, async (req, res) => {
  try {
    const boardId = await boardIdForBlock(req.params.blockId);
    if (!boardId) return res.status(404).json({ error: 'Block not found' });
    if (!(await canEditBoard(req, boardId)))
      return res.status(403).json({ error: 'Only admins can edit the canvas' });
    const { title } = req.body;
    if (!title || !title.trim()) return res.status(400).json({ error: 'Block title is required' });
    const block = await prisma.canvasBlock.update({
      where: { id: req.params.blockId },
      data: { title: title.trim() },
    });
    emitCanvasChanged(req, boardId);
    res.json(block);
  } catch (e) { console.error(e); res.status(500).json({ error: 'Something went wrong. Please try again.' }); }
});

// Delete a block (admin).
router.delete('/:id/canvas/blocks/:blockId', authenticate, async (req, res) => {
  try {
    const boardId = await boardIdForBlock(req.params.blockId);
    if (!boardId) return res.status(404).json({ error: 'Block not found' });
    if (!(await canEditBoard(req, boardId)))
      return res.status(403).json({ error: 'Only admins can edit the canvas' });
    await prisma.canvasBlock.delete({ where: { id: req.params.blockId } });
    emitCanvasChanged(req, boardId);
    res.json({ success: true });
  } catch (e) { console.error(e); res.status(500).json({ error: 'Something went wrong. Please try again.' }); }
});

// Add a feature to a block (admin).
router.post('/:id/canvas/blocks/:blockId/features', authenticate, async (req, res) => {
  try {
    const boardId = await boardIdForBlock(req.params.blockId);
    if (!boardId) return res.status(404).json({ error: 'Block not found' });
    if (!(await canEditBoard(req, boardId)))
      return res.status(403).json({ error: 'Only admins can edit the canvas' });
    const { text } = req.body;
    if (!text || !text.trim()) return res.status(400).json({ error: 'Feature text is required' });
    const count = await prisma.canvasFeature.count({ where: { blockId: req.params.blockId } });
    const feature = await prisma.canvasFeature.create({
      data: { blockId: req.params.blockId, text: text.trim(), order: count },
    });
    emitCanvasChanged(req, boardId);
    res.json(feature);
  } catch (e) { console.error(e); res.status(500).json({ error: 'Something went wrong. Please try again.' }); }
});

// Edit a feature (admin).
router.patch('/:id/canvas/features/:featureId', authenticate, async (req, res) => {
  try {
    const boardId = await boardIdForFeature(req.params.featureId);
    if (!boardId) return res.status(404).json({ error: 'Feature not found' });
    if (!(await canEditBoard(req, boardId)))
      return res.status(403).json({ error: 'Only admins can edit the canvas' });
    const { text, active } = req.body;
    const data = {};
    if (text !== undefined) {
      if (!text.trim()) return res.status(400).json({ error: 'Feature text is required' });
      data.text = text.trim();
    }
    if (active !== undefined) data.active = !!active;
    if (Object.keys(data).length === 0) return res.status(400).json({ error: 'Nothing to update.' });
    const feature = await prisma.canvasFeature.update({
      where: { id: req.params.featureId },
      data,
    });
    emitCanvasChanged(req, boardId);
    res.json(feature);
  } catch (e) { console.error(e); res.status(500).json({ error: 'Something went wrong. Please try again.' }); }
});

// Delete a feature (admin).
router.delete('/:id/canvas/features/:featureId', authenticate, async (req, res) => {
  try {
    const boardId = await boardIdForFeature(req.params.featureId);
    if (!boardId) return res.status(404).json({ error: 'Feature not found' });
    if (!(await canEditBoard(req, boardId)))
      return res.status(403).json({ error: 'Only admins can edit the canvas' });
    await prisma.canvasFeature.delete({ where: { id: req.params.featureId } });
    emitCanvasChanged(req, boardId);
    res.json({ success: true });
  } catch (e) { console.error(e); res.status(500).json({ error: 'Something went wrong. Please try again.' }); }
});

module.exports = router;
