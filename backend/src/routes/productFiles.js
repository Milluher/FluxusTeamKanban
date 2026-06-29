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

// Verify the requester can EDIT product files (system admin or board admin).
async function canEditBoard(req, boardId) {
  if (req.user.role === 'admin') return true;
  const membership = await prisma.boardMember.findUnique({
    where: { userId_boardId: { userId: req.user.id, boardId } },
  });
  return !!membership && membership.role === 'admin';
}

// Notify everyone viewing this board to refetch the product files.
function emitFilesChanged(req, boardId) {
  if (boardId) req.io.to(`board:${boardId}`).emit('product-files-changed', { boardId });
}

// Basic URL sanity check — must be an http(s) link.
function isValidUrl(raw) {
  try {
    const u = new URL(raw);
    return u.protocol === 'http:' || u.protocol === 'https:';
  } catch { return false; }
}

// List all product files for a board.
router.get('/:id/product-files', authenticate, async (req, res) => {
  try {
    if (!(await canViewBoard(req, req.params.id)))
      return res.status(403).json({ error: 'Access denied' });
    const files = await prisma.productFile.findMany({
      where: { boardId: req.params.id },
      orderBy: { order: 'asc' },
    });
    res.json(files);
  } catch (e) { console.error(e); res.status(500).json({ error: 'Something went wrong. Please try again.' }); }
});

// Add a product file link (admin).
router.post('/:id/product-files', authenticate, async (req, res) => {
  try {
    if (!(await canEditBoard(req, req.params.id)))
      return res.status(403).json({ error: 'Only admins can manage product files' });
    const { title, url } = req.body;
    if (!title || !title.trim()) return res.status(400).json({ error: 'File name is required' });
    if (!url || !isValidUrl(url.trim())) return res.status(400).json({ error: 'A valid link (https://…) is required' });
    const count = await prisma.productFile.count({ where: { boardId: req.params.id } });
    const file = await prisma.productFile.create({
      data: { boardId: req.params.id, title: title.trim(), url: url.trim(), order: count },
    });
    emitFilesChanged(req, req.params.id);
    res.json(file);
  } catch (e) { console.error(e); res.status(500).json({ error: 'Something went wrong. Please try again.' }); }
});

// Edit a product file (admin).
router.patch('/:id/product-files/:fileId', authenticate, async (req, res) => {
  try {
    if (!(await canEditBoard(req, req.params.id)))
      return res.status(403).json({ error: 'Only admins can manage product files' });
    const { title, url } = req.body;
    const data = {};
    if (title !== undefined) {
      if (!title.trim()) return res.status(400).json({ error: 'File name is required' });
      data.title = title.trim();
    }
    if (url !== undefined) {
      if (!isValidUrl(url.trim())) return res.status(400).json({ error: 'A valid link (https://…) is required' });
      data.url = url.trim();
    }
    if (Object.keys(data).length === 0) return res.status(400).json({ error: 'Nothing to update.' });
    const file = await prisma.productFile.update({
      where: { id: req.params.fileId },
      data,
    });
    emitFilesChanged(req, req.params.id);
    res.json(file);
  } catch (e) { console.error(e); res.status(500).json({ error: 'Something went wrong. Please try again.' }); }
});

// Delete a product file (admin) — referencing tickets keep working (productDocId set null).
router.delete('/:id/product-files/:fileId', authenticate, async (req, res) => {
  try {
    if (!(await canEditBoard(req, req.params.id)))
      return res.status(403).json({ error: 'Only admins can manage product files' });
    await prisma.productFile.delete({ where: { id: req.params.fileId } });
    emitFilesChanged(req, req.params.id);
    res.json({ success: true });
  } catch (e) { console.error(e); res.status(500).json({ error: 'Something went wrong. Please try again.' }); }
});

module.exports = router;
