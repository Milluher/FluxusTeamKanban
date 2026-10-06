import { AssignedTicket, Board } from '@/types';

// "My tickets" is one board built out of many. The tickets on it come from
// every board the viewer belongs to, so the columns cannot be any single
// board's columns — they are the column *names*, which the two board types
// share: sprint boards run Backlog → Done, kanban boards a subset of it.
export const CANONICAL_COLUMNS = ['Backlog', 'To Do', 'In Progress', 'Review', 'Done'];

export interface MyTicketsColumn {
  name: string;
  tickets: AssignedTicket[];
}

/** Canonical names first, in flow order; anything a board renamed or added after. */
function byFlowOrder(a: string, b: string): number {
  const ia = CANONICAL_COLUMNS.indexOf(a);
  const ib = CANONICAL_COLUMNS.indexOf(b);
  if (ia !== -1 && ib !== -1) return ia - ib;
  if (ia !== -1) return -1;
  if (ib !== -1) return 1;
  return a.localeCompare(b);
}

/**
 * The columns of the "My tickets" board.
 *
 * Drawn from the viewer's boards rather than from their tickets, so a column
 * does not vanish the moment its last ticket is dragged out — which would pull
 * the drop target out from under the drag. Ticket column names are folded in
 * too, covering a ticket whose board is missing from `boards`.
 */
export function myTicketsColumns(tickets: AssignedTicket[], boards: Board[]): MyTicketsColumn[] {
  const names = new Set<string>();
  for (const board of boards) {
    for (const col of board.columns ?? []) names.add(col.name);
  }
  for (const t of tickets) names.add(t.column.name);

  const columns = Array.from(names)
    .sort(byFlowOrder)
    .map((name) => ({ name, tickets: [] as AssignedTicket[] }));

  const byName = new Map(columns.map((c) => [c.name, c]));
  // Server order is most-recently-updated first; keep it inside each column.
  for (const t of tickets) byName.get(t.column.name)?.tickets.push(t);

  return columns;
}

/**
 * The real column a drop lands on: same name, but on the ticket's *own* board,
 * since that is the only column its columnId can point at.
 *
 * Null when that board has no such column — a kanban board has no "Review", so
 * a ticket living on one cannot be dropped there.
 */
export function targetColumnFor(
  ticket: AssignedTicket,
  columnName: string,
  boards: Board[]
): { id: string; name: string } | null {
  const board = boards.find((b) => b.id === ticket.column.board.id);
  const column = (board?.columns ?? []).find((c) => c.name === columnName);
  return column ? { id: column.id, name: column.name } : null;
}
