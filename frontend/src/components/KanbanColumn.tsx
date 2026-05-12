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

const columnConfig: Record<string, { color: string; bg: string; dot: string; glow: string }> = {
  'Backlog':      { color: '#94a3b8', bg: 'rgba(148,163,184,0.12)', dot: '#64748b', glow: 'rgba(148,163,184,0.25)' },
  'To Do':        { color: '#60a5fa', bg: 'rgba(96,165,250,0.12)',  dot: '#3b82f6', glow: 'rgba(59,130,246,0.25)' },
  'In Progress':  { color: '#fbbf24', bg: 'rgba(251,191,36,0.12)',  dot: '#f59e0b', glow: 'rgba(245,158,11,0.25)' },
  'Review':       { color: '#c084fc', bg: 'rgba(192,132,252,0.12)', dot: '#a855f7', glow: 'rgba(168,85,247,0.25)' },
  'Done':         { color: '#34d399', bg: 'rgba(52,211,153,0.12)',  dot: '#10b981', glow: 'rgba(16,185,129,0.25)' },
};

const defaultConfig = { color: '#94a3b8', bg: 'rgba(148,163,184,0.1)', dot: '#64748b', glow: 'rgba(148,163,184,0.2)' };

export default function KanbanColumn({ column, onTicketClick, onAddTicket }: Props) {
  const { setNodeRef, isOver } = useDroppable({ id: column.id });

  const cfg = columnConfig[column.name] || defaultConfig;

  return (
    <div className="flex flex-col w-72 flex-shrink-0">
      {/* Column Header */}
      <div className="flex items-center justify-between mb-3 px-1">
        <div className="flex items-center gap-2.5">
          {/* Colored dot */}
          <div className="w-2 h-2 rounded-full flex-shrink-0" style={{ background: cfg.dot, boxShadow: `0 0 6px ${cfg.dot}` }} />
          <span className="text-sm font-bold" style={{ color: cfg.color }}>
            {column.name}
          </span>
          {/* Count badge */}
          <span
            className="text-xs font-bold px-2 py-0.5 rounded-full"
            style={{
              background: cfg.bg,
              color: cfg.color,
              border: `1px solid ${cfg.color}33`,
            }}
          >
            {column.tickets.length}
          </span>
        </div>
        <button
          onClick={() => onAddTicket(column.id)}
          className="w-7 h-7 rounded-lg flex items-center justify-center text-lg leading-none transition-all duration-200 font-medium"
          style={{ color: 'rgba(255,255,255,0.3)', background: 'transparent' }}
          title="Add ticket"
          onMouseEnter={(e) => {
            e.currentTarget.style.background = cfg.bg;
            e.currentTarget.style.color = cfg.color;
          }}
          onMouseLeave={(e) => {
            e.currentTarget.style.background = 'transparent';
            e.currentTarget.style.color = 'rgba(255,255,255,0.3)';
          }}
        >
          +
        </button>
      </div>

      {/* Column Body */}
      <div
        ref={setNodeRef}
        className="flex-1 rounded-2xl p-3 transition-all duration-200 min-h-24"
        style={isOver ? {
          background: cfg.bg,
          border: `2px dashed ${cfg.color}66`,
          boxShadow: `0 0 20px ${cfg.glow}`,
        } : {
          background: 'rgba(255,255,255,0.03)',
          border: '1px solid rgba(255,255,255,0.06)',
        }}
      >
        <SortableContext items={column.tickets.map((t) => t.id)} strategy={verticalListSortingStrategy}>
          <div className="space-y-2.5">
            {column.tickets.map((ticket) => (
              <TicketCard key={ticket.id} ticket={ticket} onClick={() => onTicketClick(ticket)} columnColor={cfg.dot} />
            ))}
          </div>
        </SortableContext>

        {column.tickets.length === 0 && !isOver && (
          <div className="text-center py-8 flex flex-col items-center gap-2">
            <div className="w-8 h-8 rounded-xl flex items-center justify-center"
              style={{ background: cfg.bg, border: `1px dashed ${cfg.color}44` }}>
              <span className="text-lg leading-none" style={{ color: `${cfg.color}66` }}>+</span>
            </div>
            <p className="text-xs font-medium" style={{ color: 'rgba(255,255,255,0.2)' }}>No tickets</p>
          </div>
        )}

        {isOver && (
          <div className="rounded-xl border-2 border-dashed h-16 flex items-center justify-center mt-2"
            style={{ borderColor: `${cfg.color}66`, background: cfg.bg }}>
            <span className="text-xs font-medium" style={{ color: cfg.color }}>Drop here</span>
          </div>
        )}
      </div>
    </div>
  );
}
