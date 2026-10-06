'use client';
import { useCallback, useState } from 'react';
import { useRouter } from 'next/navigation';
import {
  DndContext,
  DragEndEvent,
  DragOverlay,
  DragStartEvent,
  PointerSensor,
  closestCenter,
  pointerWithin,
  rectIntersection,
  useDroppable,
  useSensor,
  useSensors,
} from '@dnd-kit/core';
import { SortableContext, verticalListSortingStrategy } from '@dnd-kit/sortable';
import { AssignedTicket, Board } from '@/types';
import { columnStyle } from '@/lib/columnStyle';
import { MyTicketsColumn, myTicketsColumns, targetColumnFor } from '@/lib/myTickets';
import TicketCard from './TicketCard';

interface Props {
  tickets: AssignedTicket[];
  /** The viewer's boards — the source of the columns, and of the column a drop resolves to. */
  boards: Board[];
  loading: boolean;
  onShowBoards: () => void;
  /** Persists a move. Rejects if the server refuses, so the view can say so. */
  onMove: (ticket: AssignedTicket, column: { id: string; name: string }) => Promise<void>;
}

// Droppable ids have to be distinguishable from ticket ids, and a column here is
// identified by name rather than by any one board's column id.
const COLUMN_PREFIX = 'column:';

function TicketColumn({
  column,
  onTicketClick,
}: {
  column: MyTicketsColumn;
  onTicketClick: (ticket: AssignedTicket) => void;
}) {
  const { setNodeRef, isOver } = useDroppable({ id: `${COLUMN_PREFIX}${column.name}` });
  const cfg = columnStyle(column.name);

  return (
    <div className="flex flex-col w-72 flex-shrink-0 board-column-snap">
      <div className="flex items-center gap-2 mb-2.5 px-1">
        <div className="w-2 h-2 rounded-full flex-shrink-0" style={{ background: cfg.dot }} />
        <h2 className="text-sm font-semibold text-gray-700">{column.name}</h2>
        <span
          className="text-xs font-semibold px-2 py-0.5 rounded-full"
          style={{ background: cfg.badgeBg, color: cfg.badgeText }}
        >
          {column.tickets.length}
        </span>
      </div>

      <div
        ref={setNodeRef}
        className="flex-1 rounded-xl p-2.5 transition-all duration-150 min-h-24"
        style={isOver
          ? { background: '#fff7f5', border: '2px dashed #e8390e' }
          : { background: '#ebedf0', border: '2px solid transparent' }}
      >
        <SortableContext items={column.tickets.map((t) => t.id)} strategy={verticalListSortingStrategy}>
          <div className="space-y-2">
            {column.tickets.map((ticket) => (
              <TicketCard
                key={ticket.id}
                ticket={ticket}
                boardName={ticket.column.board.name}
                sprint={ticket.sprint}
                onClick={() => onTicketClick(ticket)}
                columnColor={cfg.dot}
              />
            ))}
          </div>
        </SortableContext>

        {column.tickets.length === 0 && !isOver && (
          <div className="text-center py-8">
            <p className="text-xs text-gray-500">No tickets</p>
          </div>
        )}

        {isOver && (
          <div
            className="rounded-lg border-2 border-dashed h-14 flex items-center justify-center mt-2"
            style={{ borderColor: '#e8390e', background: '#fff7f5' }}
          >
            <span className="text-xs font-medium" style={{ color: '#c73009' }}>Drop here</span>
          </div>
        )}
      </div>
    </div>
  );
}

// Everything assigned to you, as a board of its own: the columns are statuses
// shared across boards, and each card names the board it was created on, since
// that is no longer what groups them.
export default function MyTicketsView({ tickets, boards, loading, onShowBoards, onMove }: Props) {
  const router = useRouter();
  const [dragging, setDragging] = useState<AssignedTicket | null>(null);
  const [notice, setNotice] = useState('');

  const sensors = useSensors(
    // A card is also a link to its ticket, so a press only becomes a drag past 8px.
    useSensor(PointerSensor, { activationConstraint: { distance: 8 } }),
  );

  // Same multi-container strategy a board uses: pointer-within reads columns
  // accurately, the rest are fallbacks for a pointer between them.
  const collisionDetection = useCallback((args: Parameters<typeof closestCenter>[0]) => {
    const pointerHits = pointerWithin(args);
    if (pointerHits.length > 0) return pointerHits;
    const rectHits = rectIntersection(args);
    if (rectHits.length > 0) return rectHits;
    return closestCenter(args);
  }, []);

  const openTicket = (ticket: AssignedTicket) => {
    router.push(`/board/${ticket.column.board.id}?ticket=${ticket.id}`);
  };

  const handleDragStart = (event: DragStartEvent) => {
    setDragging(tickets.find((t) => t.id === event.active.id) ?? null);
  };

  const handleDragEnd = async (event: DragEndEvent) => {
    const ticket = dragging;
    setDragging(null);

    const overId = event.over ? String(event.over.id) : null;
    if (!overId || !ticket) return;

    // Dropped on a column, or on a card already in one.
    const columnName = overId.startsWith(COLUMN_PREFIX)
      ? overId.slice(COLUMN_PREFIX.length)
      : tickets.find((t) => t.id === overId)?.column.name ?? null;

    // Ordering within a column spans boards, so there is nothing to persist.
    if (!columnName || columnName === ticket.column.name) return;

    const target = targetColumnFor(ticket, columnName, boards);
    if (!target) {
      setNotice(
        `${ticket.column.board.name} has no “${columnName}” column, so “${ticket.title}” can’t move there.`
      );
      return;
    }

    setNotice('');
    try {
      await onMove(ticket, target);
    } catch {
      setNotice(`Couldn’t move “${ticket.title}” to ${columnName}. Please try again.`);
    }
  };

  if (loading) {
    return <p className="text-sm text-gray-600 py-10 text-center">Loading your tickets…</p>;
  }

  if (tickets.length === 0) {
    return (
      <div className="bg-white border border-gray-200 rounded-xl py-16 text-center">
        <p className="text-base font-semibold text-gray-700 mb-1">Nothing assigned to you</p>
        <p className="text-sm text-gray-600 mb-5">
          When someone assigns you a ticket it will show up here.
        </p>
        <button
          onClick={onShowBoards}
          className="px-5 py-2.5 rounded-lg text-sm font-semibold text-white"
          style={{ background: '#c73009' }}
        >
          Browse boards
        </button>
      </div>
    );
  }

  const columns = myTicketsColumns(tickets, boards);

  return (
    <div>
      {notice && (
        <p
          role="alert"
          className="mb-3 px-3 py-2 rounded-lg text-sm bg-red-50 text-red-700 border border-red-200"
        >
          {notice}
        </p>
      )}

      <DndContext
        sensors={sensors}
        collisionDetection={collisionDetection}
        onDragStart={handleDragStart}
        onDragEnd={handleDragEnd}
        onDragCancel={() => setDragging(null)}
      >
        <div className="flex gap-4 overflow-x-auto pb-4 board-scroll">
          {columns.map((column) => (
            <TicketColumn key={column.name} column={column} onTicketClick={openTicket} />
          ))}
        </div>

        <DragOverlay>
          {dragging && (
            <TicketCard
              ticket={dragging}
              boardName={dragging.column.board.name}
              onClick={() => {}}
              isDragging
            />
          )}
        </DragOverlay>
      </DndContext>
    </div>
  );
}
