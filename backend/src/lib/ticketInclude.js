/**
 * The shape of a ticket as the frontend expects it.
 *
 * Shared, because a ticket does not only come from the tickets route any more:
 * publishing a PRD raises tickets too, and a socket payload built from a
 * narrower selection would reach the board missing the fields it renders.
 */
const ticketInclude = {
  assignee: { select: { id: true, name: true, email: true } },
  productManager: { select: { id: true, name: true, email: true } },
  productDoc: { select: { id: true, title: true, url: true } },
  initiative: { select: { id: true, title: true, status: true } },
  prd: { select: { id: true, title: true, status: true } },
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

module.exports = { ticketInclude };
