const express = require('express');
const { PrismaClient } = require('@prisma/client');
const { authenticate } = require('../middleware/auth');
const { ticketInclude } = require('../lib/ticketInclude');
const { emailNotification } = require('../lib/email');
const { sprintRejectionReason } = require('../lib/sprintWindow');
const { canEditBoard } = require('../lib/boardAccess');

const router = express.Router();
const prisma = new PrismaClient();

/**
 * A ticket with no sprint is in the backlog, and the backlog is a list of work
 * nobody has been asked to do yet.
 *
 * Giving a backlog ticket an owner is how work gets silently committed to: it
 * sits in somebody's "My tickets" with no sprint to say when it is due and no
 * sprint board to show it against anything else. Scheduling comes first —
 * putting a ticket in a sprint is the act of deciding it is being done — and
 * only then is there anything to assign.
 */
const BACKLOG_UNASSIGNABLE =
  'A ticket in the backlog cannot be assigned to anyone. Put it in a sprint first.';

/**
 * Whether a ticket may join this sprint: it has to exist, belong to the same
 * board, and still be open — see `lib/sprintWindow.js` for what closes one.
 *
 * `boardId` may be undefined if the ticket's column could not be resolved. Like
 * the initiative check below, that counts as "cannot prove it fits" and is
 * refused rather than waved through.
 */
async function sprintFitsBoard(sprintId, boardId) {
  if (!sprintId) return { ok: true };

  const sprint = await prisma.sprint.findUnique({
    where: { id: sprintId },
    select: { id: true, title: true, boardId: true, status: true, endDate: true },
  });
  const reason = sprintRejectionReason(sprint, boardId);
  if (!reason) return { ok: true };
  return { ok: false, status: sprint ? 422 : 404, error: reason };
}

/**
 * An initiative belongs to one board since 20261104_board_scoping, so a ticket
 * may only be linked to one on its own board.
 *
 * Enforced here rather than as a database constraint on purpose: links made
 * before that migration legitimately cross boards, and a constraint would
 * either reject them or require deleting them. This guards *new* links only,
 * which is the agreed behaviour — existing ones are left exactly as they are.
 *
 * `boardId` may be undefined if the ticket's column could not be resolved; that
 * is treated as "cannot prove it fits", and refused, rather than waved through.
 */
async function initiativeFitsBoard(initiativeId, boardId) {
  if (!initiativeId) return { ok: true };

  const initiative = await prisma.initiative.findUnique({
    where: { id: initiativeId },
    select: { boardId: true, board: { select: { name: true } } },
  });
  if (!initiative) return { ok: false, status: 404, error: 'That initiative no longer exists' };

  if (!boardId || initiative.boardId !== boardId) {
    return {
      ok: false,
      status: 422,
      error: `That initiative belongs to another board${initiative.board ? ` (${initiative.board.name})` : ''}`,
    };
  }
  return { ok: true };
}

// Create ticket
router.post('/', authenticate, async (req, res) => {
  try {
    const { title, description, columnId, assigneeId, productManagerId, assignedDate, boardId, type, priority, project, epic, flow, sprintId, productDocId, initiativeId, prdId } = req.body;
    if (!title || !columnId) return res.status(400).json({ error: 'Title and columnId required' });
    const column = await prisma.column.findUnique({ where: { id: columnId } });
    if (!column) return res.status(404).json({ error: 'Column not found' });

    const fit = await initiativeFitsBoard(initiativeId, column.boardId);
    if (!fit.ok) return res.status(fit.status).json({ error: fit.error });

    const sprintFit = await sprintFitsBoard(sprintId, column.boardId);
    if (!sprintFit.ok) return res.status(sprintFit.status).json({ error: sprintFit.error });

    // Raised straight into a sprint, or raised into the backlog — and a backlog
    // ticket has no owner yet. The form hides the field in that case; this is
    // what makes it true rather than merely unoffered.
    if (!sprintId && assigneeId) {
      return res.status(422).json({ error: BACKLOG_UNASSIGNABLE });
    }

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
        flow: flow || null,
        sprintId: sprintId || null,
        productDocId: productDocId || null,
        initiativeId: initiativeId || null,
        prdId: prdId || null,
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
      emailNotification(notification);
    }

    res.json(ticket);
  } catch (e) { console.error(e); res.status(500).json({ error: 'Something went wrong. Please try again.' }); }
});

// Get single ticket
// Everything assigned to the signed-in user, across every board they belong to.
//
// Registered before '/:id' on purpose: Express matches in order, so with this
// below it the literal path "assigned" would be read as a ticket id.
router.get('/assigned', authenticate, async (req, res) => {
  try {
    const tickets = await prisma.ticket.findMany({
      where: {
        assigneeId: req.user.id,
        // Only boards they are still a member of, so losing access hides the work.
        column: { board: { members: { some: { userId: req.user.id } } } },
      },
      include: {
        column: {
          select: { id: true, name: true, board: { select: { id: true, name: true, type: true } } },
        },
        sprint: { select: { id: true, title: true, endDate: true } },
        initiative: { select: { id: true, title: true, status: true } },
        prd: { select: { id: true, title: true, status: true } },
        _count: { select: { comments: true } },
      },
      orderBy: [{ updatedAt: 'desc' }],
    });
    res.json(tickets);
  } catch (e) {
    console.error(e);
    res.status(500).json({ error: 'Something went wrong. Please try again.' });
  }
});

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
    const { title, description, columnId, assigneeId, productManagerId, assignedDate, boardId, type, priority, project, epic, flow, sprintId, productDocId, initiativeId, prdId } = req.body;
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
    if (flow !== undefined) data.flow = flow || null;
    if (sprintId !== undefined) data.sprintId = sprintId || null;
    if (productDocId !== undefined) data.productDocId = productDocId || null;
    if (initiativeId !== undefined) data.initiativeId = initiativeId || null;
    if (prdId !== undefined) data.prdId = prdId || null;
    if (columnId) {
      const col = await prisma.column.findUnique({ where: { id: columnId } });
      if (col) { data.columnId = columnId; data.status = col.name; }
    }

    const prevTicket = await prisma.ticket.findUnique({
      where: { id: req.params.id },
      select: { assigneeId: true, sprintId: true, column: { select: { boardId: true } } },
    });
    if (!prevTicket) return res.status(404).json({ error: 'Not found' });

    // The board the ticket will be on *after* this patch, which is the new
    // column's when the patch moves it.
    const targetBoardId = data.columnId
      ? (await prisma.column.findUnique({ where: { id: data.columnId }, select: { boardId: true } }))?.boardId
      : prevTicket.column?.boardId;

    // Clearing an initiative link (null) is always allowed.
    if (initiativeId) {
      const fit = await initiativeFitsBoard(initiativeId, targetBoardId);
      if (!fit.ok) return res.status(fit.status).json({ error: fit.error });
    }

    const movingSprint = sprintId !== undefined && (sprintId || null) !== prevTicket.sprintId;
    if (movingSprint) {
      // Scheduling is an admin's call: deciding which sprint a piece of work
      // lands in is deciding what the team does next. Everyone else can still
      // raise tickets and work them — they just cannot schedule them.
      if (!(await canEditBoard(req, targetBoardId))) {
        return res.status(403).json({ error: 'Only an admin can move a ticket in or out of a sprint' });
      }
      const sprintFit = await sprintFitsBoard(sprintId || null, targetBoardId);
      if (!sprintFit.ok) return res.status(sprintFit.status).json({ error: sprintFit.error });
    }

    const resultingSprintId = sprintId !== undefined ? (sprintId || null) : prevTicket.sprintId;
    if (!resultingSprintId) {
      if (movingSprint) {
        // Pulled back out of a sprint: it is in the backlog again, and nothing
        // in the backlog is assigned. Clearing is deliberate rather than a
        // refusal — the alternative is a ticket nobody scheduled that somebody
        // is still nominally on the hook for.
        data.assigneeId = null;
      } else if (data.assigneeId && data.assigneeId !== prevTicket.assigneeId) {
        return res.status(422).json({ error: BACKLOG_UNASSIGNABLE });
      }
    }

    // Record sprint history if ticket is being moved from one sprint to another
    if (sprintId !== undefined && prevTicket.sprintId && prevTicket.sprintId !== (sprintId || null)) {
      await prisma.sprintHistory.create({ data: { ticketId: req.params.id, sprintId: prevTicket.sprintId } });
    }
    const ticket = await prisma.ticket.update({ where: { id: req.params.id }, data, include: ticketInclude });
    req.io.to(`board:${boardId}`).emit('ticket-updated', ticket);

    // Notify new assignee if assignee changed
    const newAssigneeId = ticket.assigneeId;
    if (newAssigneeId && newAssigneeId !== prevTicket.assigneeId && newAssigneeId !== req.user.id) {
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
      emailNotification(notification);
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

// Duplicate a ticket.
//
// Copies what describes the work — title, description, classification, the
// initiative and doc it points at, its sprint and its people — into the same
// column. Deliberately not copied: comments, which are a conversation about
// the original, and dependencies, which say what *that* ticket waits on.
//
// The copy is created by whoever duplicated it, not by the original's author,
// so "created by" stays true.
//
// One thing the copy may lose: an initiative on another board. A handful of
// tickets linked across boards before 20261104_board_scoping, and those links
// are kept — but copying one would mint a *new* link the rules now forbid. So
// the copy drops it rather than the duplicate failing, which would make legacy
// tickets unduplicable for a reason nobody could act on.
router.post('/:id/duplicate', authenticate, async (req, res) => {
  try {
    const original = await prisma.ticket.findUnique({
      where: { id: req.params.id },
      include: { column: { select: { boardId: true, name: true } } },
    });
    if (!original) return res.status(404).json({ error: 'Not found' });
    if (original.createdById !== req.user.id && req.user.role !== 'admin') {
      return res.status(403).json({ error: 'Only the person who created a ticket can duplicate it' });
    }

    const carriedInitiative = await initiativeFitsBoard(original.initiativeId, original.column.boardId);

    // The copy drops a sprint that has since closed, for the same reason the
    // duplicate drops a cross-board initiative: a copy should not mint a link
    // the rules now forbid, and failing the duplicate outright would make an
    // old ticket uncopyable for a reason nobody can act on.
    //
    // And with no sprint it is a backlog ticket, which carries no assignee.
    const carriedSprint = await sprintFitsBoard(original.sprintId, original.column.boardId);
    const sprintId = carriedSprint.ok ? original.sprintId : null;
    const assigneeId = sprintId ? original.assigneeId : null;

    const copy = await prisma.ticket.create({
      data: {
        title: `${original.title} (copy)`,
        description: original.description,
        status: original.status,
        columnId: original.columnId,
        assigneeId,
        productManagerId: original.productManagerId,
        assignedDate: original.assignedDate,
        createdById: req.user.id,
        type: original.type,
        priority: original.priority,
        project: original.project,
        epic: original.epic,
        flow: original.flow,
        sprintId,
        productDocId: original.productDocId,
        initiativeId: carriedInitiative.ok ? original.initiativeId : null,
        prdId: original.prdId,
      },
      include: ticketInclude,
    });

    const boardId = req.body.boardId || original.column.boardId;
    req.io.to(`board:${boardId}`).emit('ticket-created', copy);

    // The copy carries the assignee across, so they are told about it the same
    // way they would be told about a ticket raised for them from scratch.
    if (copy.assigneeId && copy.assigneeId !== req.user.id) {
      const notification = await prisma.notification.create({
        data: {
          userId: copy.assigneeId,
          type: 'ticket_assigned',
          title: 'You were assigned a ticket',
          body: `"${copy.title}"`,
          ticketId: copy.id,
          boardId,
        },
      });
      req.io.to(`user:${copy.assigneeId}`).emit('notification', notification);
      emailNotification(notification);
    }

    res.json(copy);
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
