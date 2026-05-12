'use client';
import { useDroppable } from '@dnd-kit/core';
import { SortableContext, verticalListSortingStrategy } from '@dnd-kit/sortable';
import { Column, Ticket } from '@/types';
import TicketCard from './TicketCard';

interface Props {
  column: Column;
  onTicketClick: (ticket: Ticket) => void;
  onAddTicket: (columnId: string) => void;
  boardId: string;
}

const columnConfig: Record<string, { dot: string; badgeBg: string; badgeText: string }> = {
  'Backlog':     { dot: '#94a3b8', badgeBg: '#f1f5f9', badgeText: '#475569' },
  'To Do':       { dot: '#60a5fa', badgeBg: '#eff6ff', badgeText: '#2563eb' },
  'In Progress': { dot: '#e8390e', badgeBg: '#fff7f5', badgeText: '#c73009' },
  'Review':      { dot: '#a78bfa', badgeBg: '#f5f3ff', badgeText: '#7c3aed' },
  'Done':        { dot: '#34d399', badgeBg: '#ecfdf5', badgeText: '#059669' },
};

const defaultConfig = { dot: '#94a3b8', badgeBg: '#f1f5f9', badgeText: '#475569' };

export default function KanbanColumn({ column, onTicketClick, onAddTicket }: Props) {
  const { setNodeRef, isOver } = useDroppable({ id: column.id });

  const cfg = columnConfig[column.name] || defaultConfig;

  return (
    <div className="flex flex-col w-72 flex-shrink-0">
      {/* Column Header */}
      <div className="flex items-center justify-between mb-2.5 px-1">
        <div className="flex items-center gap-2">
          {/* Colored dot */}
          <div
            className="w-2 h-2 rounded-full flex-shrink-0"
            style={{ background: cfg.dot }}
          />
          <span className="text-sm font-semibold text-gray-700">
            {column.name}
          </span>
          {/* Count badge */}
          <span
            className="text-xs font-semibold px-2 py-0.5 rounded-full"
            style={{
              background: cfg.badgeBg,
              color: cfg.badgeText,
            }}
          >
            {column.tickets.length}
          </span>
        </div>
        <button
          onClick={() => onAddTicket(column.id)}
          className="w-6 h-6 rounded-md flex items-center justify-center text-base leading-none font-medium text-gray-400 transition-all duration-150 hover:bg-gray-100 hover:text-gray-700"
          title="Add ticket"
        >
          +
        </button>
      </div>

      {/* Column Body */}
      <div
        ref={setNodeRef}
        className="flex-1 rounded-xl p-2.5 transition-all duration-150 min-h-24"
        style={isOver ? {
          background: '#fff7f5',
          border: '2px dashed #e8390e',
        } : {
          background: '#ebedf0',
          border: '2px solid transparent',
        }}
      >
        <SortableContext items={column.tickets.map((t) => t.id)} strategy={verticalListSortingStrategy}>
          <div className="space-y-2">
            {column.tickets.map((ticket) => (
              <TicketCard
                key={ticket.id}
                ticket={ticket}
                onClick={() => onTicketClick(ticket)}
                columnColor={cfg.dot}
              />
            ))}
          </div>
        </SortableContext>

        {column.tickets.length === 0 && !isOver && (
          <div className="text-center py-8 flex flex-col items-center gap-2">
            <p className="text-xs text-gray-400">No tickets</p>
          </div>
        )}

        {isOver && (
          <div
            className="rounded-lg border-2 border-dashed h-14 flex items-center justify-center mt-2"
            style={{ borderColor: '#e8390e', background: '#fff7f5' }}
          >
            <span className="text-xs font-medium" style={{ color: '#e8390e' }}>Drop here</span>
          </div>
        )}
      </div>
    </div>
  );
}
