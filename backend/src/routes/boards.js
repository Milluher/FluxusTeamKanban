const express = require('express');
const { PrismaClient } = require('@prisma/client');
const { authenticate } = require('../middleware/auth');

const router = express.Router();
const prisma = new PrismaClient();

// Get all boards for current user (admins see all boards)
router.get('/', authenticate, async (req, res) => {
  try {
    const isAdmin = req.user.role === 'admin';
    const boards = await prisma.board.findMany({
      where: isAdmin ? undefined : { members: { some: { userId: req.user.id } } },
      include: {
        _count: { select: { members: true } },
        columns: { orderBy: { order: 'asc' }, select: { id: true, name: true, order: true, _count: { select: { tickets: true } } } },
        members: { where: { userId: req.user.id }, select: { role: true } },
      },
    });
    const result = boards.map((b) => ({
      ...b,
      userRole: b.members[0]?.role ?? (isAdmin ? 'admin' : 'member'),
    }));
    res.json(result);
  } catch (e) { console.error(e); res.status(500).json({ error: 'Something went wrong. Please try again.' }); }
});

// Get single board with full data
router.get('/:id', authenticate, async (req, res) => {
  try {
    const isAdmin = req.user.role === 'admin';
    if (!isAdmin) {
      const membership = await prisma.boardMember.findUnique({
        where: { userId_boardId: { userId: req.user.id, boardId: req.params.id } },
      });
      if (!membership) return res.status(403).json({ error: 'Access denied' });
    }

    const board = await prisma.board.findUnique({
      where: { id: req.params.id },
      include: {
        members: { include: { user: { select: { id: true, name: true, email: true } } } },
        columns: {
          orderBy: { order: 'asc' },
          include: {
            tickets: {
              orderBy: { order: 'asc' },
              include: {
                assignee: { select: { id: true, name: true, email: true } },
                productManager: { select: { id: true, name: true, email: true } },
                createdBy: { select: { id: true, name: true } },
                _count: { select: { comments: true } },
                dependsOn: { include: { dependsOn: { select: { id: true, title: true, status: true } } } },
              },
            },
          },
        },
      },
    });
    res.json(board);
  } catch (e) { console.error(e); res.status(500).json({ error: 'Something went wrong. Please try again.' }); }
});

// Create board
router.post('/', authenticate, async (req, res) => {
  try {
    const { name } = req.body;
    if (!name) return res.status(400).json({ error: 'Name required' });
    const requestingUser = await prisma.user.findUnique({ where: { id: req.user.id }, select: { role: true } });
    if (!requestingUser || requestingUser.role !== 'admin')
      return res.status(403).json({ error: 'Only admins can create boards' });
    const board = await prisma.board.create({
      data: {
        name,
        members: { create: { userId: req.user.id, role: 'admin' } },
        columns: {
          create: [
            { name: 'Backlog', order: 0 },
            { name: 'To Do', order: 1 },
            { name: 'In Progress', order: 2 },
            { name: 'Review', order: 3 },
            { name: 'Done', order: 4 },
          ],
        },
      },
      include: { columns: { orderBy: { order: 'asc' } } },
    });
    res.json(board);
  } catch (e) { console.error(e); res.status(500).json({ error: 'Something went wrong. Please try again.' }); }
});

// Delete board (system admin or board admin)
router.delete('/:id', authenticate, async (req, res) => {
  try {
    const isSystemAdmin = req.user.role === 'admin';
    if (!isSystemAdmin) {
      const membership = await prisma.boardMember.findUnique({
        where: { userId_boardId: { userId: req.user.id, boardId: req.params.id } },
      });
      if (!membership || membership.role !== 'admin') return res.status(403).json({ error: 'Not authorized' });
    }
    await prisma.board.delete({ where: { id: req.params.id } });
    res.json({ success: true });
  } catch (e) { console.error(e); res.status(500).json({ error: 'Something went wrong. Please try again.' }); }
});

// Add member to board (system admin or board admin only)
router.post('/:id/members', authenticate, async (req, res) => {
  try {
    const isSystemAdmin = req.user.role === 'admin';
    if (!isSystemAdmin) {
      const membership = await prisma.boardMember.findUnique({
        where: { userId_boardId: { userId: req.user.id, boardId: req.params.id } },
      });
      if (!membership || membership.role !== 'admin') return res.status(403).json({ error: 'Only admins can invite members to this board' });
    }
    const { email, userId } = req.body;
    let user;
    if (userId) {
      user = await prisma.user.findUnique({ where: { id: userId } });
    } else if (email) {
      user = await prisma.user.findUnique({ where: { email } });
    }
    if (!user) return res.status(404).json({ error: 'User not found' });
    // Check if already a member
    const existing = await prisma.boardMember.findUnique({
      where: { userId_boardId: { userId: user.id, boardId: req.params.id } },
    });
    if (existing) return res.status(409).json({ error: 'User is already a member of this board' });
    const member = await prisma.boardMember.create({
      data: { userId: user.id, boardId: req.params.id },
      include: { user: { select: { id: true, name: true, email: true } } },
    });
    req.io.to(`board:${req.params.id}`).emit('member-added', member);
    res.json(member);
  } catch (e) { console.error(e); res.status(500).json({ error: 'Something went wrong. Please try again.' }); }
});

// Remove member from board (board admin only)
router.delete('/:id/members/:userId', authenticate, async (req, res) => {
  try {
    const membership = await prisma.boardMember.findUnique({
      where: { userId_boardId: { userId: req.user.id, boardId: req.params.id } },
    });
    if (!membership || membership.role !== 'admin') return res.status(403).json({ error: 'Not authorized' });
    await prisma.boardMember.deleteMany({
      where: { userId: req.params.userId, boardId: req.params.id },
    });
    req.io.to(`board:${req.params.id}`).emit('member-removed', { userId: req.params.userId });
    res.json({ success: true });
  } catch (e) { console.error(e); res.status(500).json({ error: 'Something went wrong. Please try again.' }); }
});

// --- Sprint routes ---

// List sprints for a board
router.get('/:id/sprints', authenticate, async (req, res) => {
  try {
    const sprints = await prisma.sprint.findMany({
      where: { boardId: req.params.id },
      include: { tickets: { select: { assigneeId: true } } },
      orderBy: { startDate: 'asc' },
    });
    const result = sprints.map((s) => {
      const memberIds = new Set(s.tickets.map((t) => t.assigneeId).filter(Boolean));
      return { ...s, _count: { tickets: s.tickets.length, members: memberIds.size } };
    });
    res.json(result);
  } catch (e) { console.error(e); res.status(500).json({ error: 'Something went wrong. Please try again.' }); }
});

// Create sprint (admin only)
router.post('/:id/sprints', authenticate, async (req, res) => {
  try {
    const isSystemAdmin = req.user.role === 'admin';
    if (!isSystemAdmin) {
      const membership = await prisma.boardMember.findUnique({
        where: { userId_boardId: { userId: req.user.id, boardId: req.params.id } },
      });
      if (!membership || membership.role !== 'admin') return res.status(403).json({ error: 'Only admins can create sprints' });
    }
    const { title, startDate, endDate } = req.body;
    if (!title || !startDate || !endDate) return res.status(400).json({ error: 'title, startDate and endDate required' });
    const sprint = await prisma.sprint.create({
      data: { boardId: req.params.id, title, startDate: new Date(startDate), endDate: new Date(endDate) },
      include: { tickets: { select: { assigneeId: true } } },
    });
    const result = { ...sprint, _count: { tickets: 0, members: 0 } };
    res.json(result);
  } catch (e) { console.error(e); res.status(500).json({ error: 'Something went wrong. Please try again.' }); }
});

// Delete sprint (admin only)
router.delete('/:id/sprints/:sprintId', authenticate, async (req, res) => {
  try {
    const isSystemAdmin = req.user.role === 'admin';
    if (!isSystemAdmin) {
      const membership = await prisma.boardMember.findUnique({
        where: { userId_boardId: { userId: req.user.id, boardId: req.params.id } },
      });
      if (!membership || membership.role !== 'admin') return res.status(403).json({ error: 'Only admins can delete sprints' });
    }
    await prisma.sprint.delete({ where: { id: req.params.sprintId } });
    res.json({ success: true });
  } catch (e) { console.error(e); res.status(500).json({ error: 'Something went wrong. Please try again.' }); }
});

module.exports = router;
