const express = require('express');
const { PrismaClient } = require('@prisma/client');
const { authenticate } = require('../middleware/auth');

const router = express.Router();
const prisma = new PrismaClient();

const ticketInclude = {
  assignee: { select: { id: true, name: true, email: true } },
  productManager: { select: { id: true, name: true, email: true } },
  createdBy: { select: { id: true, name: true } },
  _count: { select: { comments: true } },
  dependsOn: { include: { dependsOn: { select: { id: true, title: true, status: true } } } },
  dependedOnBy: { include: { ticket: { select: { id: true, title: true, status: true } } } },
  comments: {
    orderBy: { createdAt: 'asc' },
    include: { author: { select: { id: true, name: true } } },
  },
  sprintHistories: {
    orderBy: { addedAt: 'asc' },
    include: { sprint: { select: { id: true, title: true } } },
  },
};

// Create ticket
router.post('/', authenticate, async (req, res) => {
  try {
    const { title, description, columnId, assigneeId, productManagerId, assignedDate, boardId, type, priority, project, epic, sprintId } = req.body;
    if (!title || !columnId) return res.status(400).json({ error: 'Title and columnId required' });
    const column = await prisma.column.findUnique({ where: { id: columnId } });
    if (!column) return res.status(404).json({ error: 'Column not found' });
    const ticket = await prisma.ticket.create({
      data: {
        title,
        description,
        status: column.name,
        columnId,
        assigneeId: assigneeId || null,
        productManagerId: productManagerId || null,
        assignedDate: assignedDate ? new Date(assignedDate) : null,
        createdById: req.user.id,
        type: type || null,
        priority: priority || null,
        project: project || null,
        epic: epic || null,
        sprintId: sprintId || null,
      },
      include: ticketInclude,
    });
    const targetBoardId = boardId || column.boardId;
    req.io.to(`board:${targetBoardId}`).emit('ticket-created', ticket);

    // Notify assignee
    if (assigneeId && assigneeId !== req.user.id) {
      const notification = await prisma.notification.create({
        data: {
          userId: assigneeId,
          type: 'ticket_assigned',
          title: 'You were assigned a ticket',
          body: `"${ticket.title}"`,
          ticketId: ticket.id,
          boardId: targetBoardId,
        },
      });
      req.io.to(`user:${assigneeId}`).emit('notification', notification);
    }

    res.json(ticket);
  } catch (e) { console.error(e); res.status(500).json({ error: 'Something went wrong. Please try again.' }); }
});

// Get single ticket
router.get('/:id', authenticate, async (req, res) => {
  try {
    const ticket = await prisma.ticket.findUnique({ where: { id: req.params.id }, include: ticketInclude });
    if (!ticket) return res.status(404).json({ error: 'Not found' });
    res.json(ticket);
  } catch (e) { console.error(e); res.status(500).json({ error: 'Something went wrong. Please try again.' }); }
});

// Reorder tickets within a column (must come before /:id routes)
router.patch('/reorder', authenticate, async (req, res) => {
  try {
    const { columnId, ticketIds, boardId } = req.body;
    if (!columnId || !Array.isArray(ticketIds) || !ticketIds.length) {
      return res.status(400).json({ error: 'columnId and ticketIds required' });
    }
    await prisma.$transaction(
      ticketIds.map((id, index) => prisma.ticket.update({ where: { id }, data: { order: index } }))
    );
    res.json({ success: true });
  } catch (e) { console.error(e); res.status(500).json({ error: 'Something went wrong. Please try again.' }); }
});

// Update ticket
router.patch('/:id', authenticate, async (req, res) => {
  try {
    const { title, description, columnId, assigneeId, productManagerId, assignedDate, boardId, type, priority, project, epic, sprintId } = req.body;
    const data = {};
    if (title !== undefined) data.title = title;
    if (description !== undefined) data.description = description;
    if (assigneeId !== undefined) data.assigneeId = assigneeId || null;
    if (productManagerId !== undefined) data.productManagerId = productManagerId || null;
    if (assignedDate !== undefined) data.assignedDate = assignedDate ? new Date(assignedDate) : null;
    if (type !== undefined) data.type = type || null;
    if (priority !== undefined) data.priority = priority || null;
    if (project !== undefined) data.project = project || null;
    if (epic !== undefined) data.epic = epic || null;
    if (sprintId !== undefined) data.sprintId = sprintId || null;
    if (columnId) {
      const col = await prisma.column.findUnique({ where: { id: columnId } });
      if (col) { data.columnId = columnId; data.status = col.name; }
    }
    const prevTicket = await prisma.ticket.findUnique({ where: { id: req.params.id }, select: { assigneeId: true, sprintId: true } });
    // Record sprint history if ticket is being moved from one sprint to another
    if (sprintId !== undefined && prevTicket?.sprintId && prevTicket.sprintId !== (sprintId || null)) {
      await prisma.sprintHistory.create({ data: { ticketId: req.params.id, sprintId: prevTicket.sprintId } });
    }
    const ticket = await prisma.ticket.update({ where: { id: req.params.id }, data, include: ticketInclude });
    req.io.to(`board:${boardId}`).emit('ticket-updated', ticket);

    // Notify new assignee if assignee changed
    const newAssigneeId = ticket.assigneeId;
    if (newAssigneeId && newAssigneeId !== prevTicket?.assigneeId && newAssigneeId !== req.user.id) {
      const notification = await prisma.notification.create({
        data: {
          userId: newAssigneeId,
          type: 'ticket_assigned',
          title: 'You were assigned a ticket',
          body: `"${ticket.title}"`,
          ticketId: ticket.id,
          boardId: boardId || null,
        },
      });
      req.io.to(`user:${newAssigneeId}`).emit('notification', notification);
    }

    res.json(ticket);
  } catch (e) { console.error(e); res.status(500).json({ error: 'Something went wrong. Please try again.' }); }
});

// Move ticket (drag-and-drop)
router.patch('/:id/move', authenticate, async (req, res) => {
  try {
    const { columnId, order, boardId } = req.body;
    const col = await prisma.column.findUnique({ where: { id: columnId } });
    if (!col) return res.status(404).json({ error: 'Column not found' });
    const ticket = await prisma.ticket.update({
      where: { id: req.params.id },
      data: { columnId, status: col.name, order: order ?? 0 },
      include: ticketInclude,
    });
    req.io.to(`board:${boardId}`).emit('ticket-moved', ticket);
    res.json(ticket);
  } catch (e) { console.error(e); res.status(500).json({ error: 'Something went wrong. Please try again.' }); }
});

// Delete ticket
router.delete('/:id', authenticate, async (req, res) => {
  try {
    const { boardId } = req.query;
    await prisma.ticket.delete({ where: { id: req.params.id } });
    req.io.to(`board:${boardId}`).emit('ticket-deleted', req.params.id);
    res.json({ success: true });
  } catch (e) { console.error(e); res.status(500).json({ error: 'Something went wrong. Please try again.' }); }
});

// Add dependency
router.post('/:id/dependencies', authenticate, async (req, res) => {
  try {
    const { dependsOnId, boardId } = req.body;
    if (req.params.id === dependsOnId) return res.status(400).json({ error: 'Self-dependency not allowed' });
    const dep = await prisma.dependency.create({
      data: { ticketId: req.params.id, dependsOnId },
    });
    const ticket = await prisma.ticket.findUnique({ where: { id: req.params.id }, include: ticketInclude });
    req.io.to(`board:${boardId}`).emit('ticket-updated', ticket);
    res.json(dep);
  } catch (e) { console.error(e); res.status(500).json({ error: 'Something went wrong. Please try again.' }); }
});

// Remove dependency
router.delete('/:id/dependencies/:depId', authenticate, async (req, res) => {
  try {
    const { boardId } = req.query;
    await prisma.dependency.deleteMany({
      where: { ticketId: req.params.id, dependsOnId: req.params.depId },
    });
    const ticket = await prisma.ticket.findUnique({ where: { id: req.params.id }, include: ticketInclude });
    req.io.to(`board:${boardId}`).emit('ticket-updated', ticket);
    res.json({ success: true });
  } catch (e) { console.error(e); res.status(500).json({ error: 'Something went wrong. Please try again.' }); }
});

// Search tickets (for dependency picker)
router.get('/', authenticate, async (req, res) => {
  try {
    const { boardId, q } = req.query;
    if (!boardId) return res.status(400).json({ error: 'boardId required' });
    const tickets = await prisma.ticket.findMany({
      where: {
        column: { boardId },
        ...(q ? { title: { contains: q } } : {}),
      },
      select: { id: true, title: true, status: true },
    });
    res.json(tickets);
  } catch (e) { console.error(e); res.status(500).json({ error: 'Something went wrong. Please try again.' }); }
});

module.exports = router;
