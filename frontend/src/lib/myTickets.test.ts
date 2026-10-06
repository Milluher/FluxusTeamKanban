import { describe, expect, it } from 'vitest';
import { AssignedTicket, Board } from '@/types';
import { myTicketsColumns, targetColumnFor } from './myTickets';

const ticket = (id: string, columnName: string, board: { id: string; name: string }): AssignedTicket =>
  ({
    id,
    title: `Ticket ${id}`,
    columnId: `${board.id}-${columnName}`,
    status: columnName,
    order: 0,
    createdById: 'u1',
    createdAt: '2026-05-15T00:00:00.000Z',
    updatedAt: '2026-05-15T00:00:00.000Z',
    createdBy: { id: 'u1', name: 'Alice' },
    column: { id: `${board.id}-${columnName}`, name: columnName, board: { ...board, type: 'sprint' } },
  } as AssignedTicket);

const board = (id: string, name: string, columns: string[]): Board =>
  ({
    id,
    name,
    type: 'sprint',
    columns: columns.map((c, i) => ({ id: `${id}-${c}`, name: c, order: i, boardId: id, tickets: [] })),
    members: [],
  } as Board);

const sprintBoard = board('b1', 'Lending', ['Backlog', 'To Do', 'In Progress', 'Review', 'Done']);
const kanbanBoard = board('b2', 'Payments', ['To Do', 'In Progress', 'Done']);

describe('myTicketsColumns', () => {
  it('puts the columns in flow order, not the order the boards happen to be in', () => {
    const columns = myTicketsColumns([], [kanbanBoard, sprintBoard]);
    expect(columns.map((c) => c.name)).toEqual(['Backlog', 'To Do', 'In Progress', 'Review', 'Done']);
  });

  it('files each ticket under its own column name, across boards', () => {
    const columns = myTicketsColumns(
      [
        ticket('t1', 'In Progress', { id: 'b1', name: 'Lending' }),
        ticket('t2', 'In Progress', { id: 'b2', name: 'Payments' }),
        ticket('t3', 'Done', { id: 'b1', name: 'Lending' }),
      ],
      [sprintBoard, kanbanBoard]
    );
    const byName = new Map(columns.map((c) => [c.name, c.tickets.map((t) => t.id)]));
    expect(byName.get('In Progress')).toEqual(['t1', 't2']);
    expect(byName.get('Done')).toEqual(['t3']);
    expect(byName.get('To Do')).toEqual([]);
  });

  it('keeps a column with no tickets, so a drag cannot pull the drop target away', () => {
    const columns = myTicketsColumns([ticket('t1', 'To Do', { id: 'b2', name: 'Payments' })], [kanbanBoard]);
    expect(columns.map((c) => c.name)).toEqual(['To Do', 'In Progress', 'Done']);
  });

  it('shows a column a ticket is in even when its board is missing from the list', () => {
    const columns = myTicketsColumns([ticket('t1', 'Review', { id: 'b9', name: 'Gone' })], []);
    expect(columns.map((c) => c.name)).toEqual(['Review']);
    expect(columns[0].tickets.map((t) => t.id)).toEqual(['t1']);
  });

  it('sorts a board-specific column after the canonical ones', () => {
    const columns = myTicketsColumns([], [board('b3', 'Ops', ['Done', 'Blocked', 'To Do'])]);
    expect(columns.map((c) => c.name)).toEqual(['To Do', 'Done', 'Blocked']);
  });
});

describe('targetColumnFor', () => {
  it('resolves a column name to the column on the ticket own board', () => {
    const t = ticket('t1', 'To Do', { id: 'b2', name: 'Payments' });
    expect(targetColumnFor(t, 'In Progress', [sprintBoard, kanbanBoard])).toEqual({
      id: 'b2-In Progress',
      name: 'In Progress',
    });
  });

  it('refuses a column the ticket own board does not have', () => {
    const t = ticket('t1', 'To Do', { id: 'b2', name: 'Payments' });
    expect(targetColumnFor(t, 'Review', [sprintBoard, kanbanBoard])).toBeNull();
  });

  it('refuses when the board is not in the list at all', () => {
    const t = ticket('t1', 'To Do', { id: 'b9', name: 'Gone' });
    expect(targetColumnFor(t, 'To Do', [sprintBoard])).toBeNull();
  });
});
