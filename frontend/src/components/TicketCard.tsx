'use client';
import { useSortable } from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import { Ticket } from '@/types';
import { avatarUrl } from '@/lib/avatar';

const TYPE_STYLES: Record<string, string> = {
  mobile: 'bg-blue-50 text-blue-600',
  design: 'bg-pink-50 text-pink-600',
  product: 'bg-purple-50 text-purple-600',
  backend: 'bg-gray-100 text-gray-600',
  frontend: 'bg-green-50 text-green-600',
};

const PRIORITY_CONFIG: Record<string, { label: string; color: string; bg: string; border: string }> = {
  low:    { label: 'Low',       color: '#6b7280', bg: '#f9fafb', border: '#d1d5db' },
  medium: { label: 'Medium',    color: '#b45309', bg: '#fffbeb', border: '#fcd34d' },
  high:   { label: 'High',      color: '#ea580c', bg: '#fff7ed', border: '#fed7aa' },
  urgent: { label: 'Urgent 🔥', color: '#dc2626', bg: '#fef2f2', border: '#fecaca' },
};

interface Props {
  ticket: Ticket;
  onClick: () => void;
  isDragging?: boolean;
  columnColor?: string;
  activeMemberIds?: Set<string>;
}

export default function TicketCard({ ticket, onClick, isDragging, columnColor = '#e8390e', activeMemberIds }: Props) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging: isSortableDragging } = useSortable({ id: ticket.id });

  const priorityCfg = ticket.priority ? PRIORITY_CONFIG[ticket.priority] : null;

  const style: React.CSSProperties = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isSortableDragging ? 0.35 : 1,
    background: 'white',
    border: '1px solid #e5e7eb',
    borderRadius: '10px',
    padding: '12px',
    cursor: 'pointer',
    position: 'relative',
    ...(priorityCfg && !isDragging ? { borderLeft: `3px solid ${priorityCfg.border}` } : {}),
    ...(isDragging
      ? {
          transform: 'rotate(1.5deg)',
          boxShadow: '0 8px 24px rgba(0,0,0,0.12)',
          border: '1px solid #e8390e',
        }
      : {}),
  };

  const commentCount = ticket._count?.comments ?? ticket.comments?.length ?? 0;

  return (
    <div
      ref={setNodeRef}
      style={style}
      {...attributes}
      {...listeners}
      onClick={onClick}
      onMouseEnter={(e) => {
        if (!isSortableDragging) {
          const el = e.currentTarget as HTMLDivElement;
          el.style.borderColor = '#e8390e';
          el.style.boxShadow = '0 2px 8px rgba(0,0,0,0.06)';
        }
      }}
      onMouseLeave={(e) => {
        if (!isSortableDragging) {
          const el = e.currentTarget as HTMLDivElement;
          el.style.borderColor = '#e5e7eb';
          el.style.boxShadow = 'none';
        }
      }}
    >
      {/* Title */}
      <p className="text-sm font-semibold text-gray-800 mb-2 line-clamp-2 leading-5">
        {ticket.title}
      </p>

      {/* Description — up to 3 lines */}
      {ticket.description && (
        <p className="text-xs text-gray-400 leading-relaxed mb-2.5 line-clamp-3">
          {ticket.description}
        </p>
      )}

      {/* Epic + Project */}
      {(ticket.epic || ticket.project) && (
        <div className="mb-2.5 flex flex-wrap gap-1">
          {ticket.epic && (
            <span className="text-xs font-semibold px-2 py-0.5 rounded-full bg-amber-50 text-amber-600 border border-amber-200">
              {ticket.epic}
            </span>
          )}
          {ticket.project && (
            <span className="text-xs font-medium px-2 py-0.5 rounded-full bg-indigo-50 text-indigo-500">
              {ticket.project}
            </span>
          )}
        </div>
      )}

      {/* Footer: assignee + type + comment count */}
      <div className="flex items-center justify-between gap-2 mt-1">
        {ticket.assignee ? (() => {
          const inactive = activeMemberIds ? !activeMemberIds.has(ticket.assignee!.id) : false;
          return (
            <div className={`flex items-center gap-1.5 min-w-0 ${inactive ? 'opacity-40' : ''}`}>
              <img
                src={avatarUrl(ticket.assignee.name)}
                className={`w-5 h-5 rounded-full flex-shrink-0 ${inactive ? 'grayscale' : ''}`}
                alt={ticket.assignee.name}
              />
              <span className="text-xs text-gray-500 truncate max-w-[90px]">{ticket.assignee.name}</span>
            </div>
          );
        })() : (
          <span className="text-xs text-gray-300">Unassigned</span>
        )}

        <div className="flex items-center gap-1.5 flex-shrink-0">
          {priorityCfg && (
            <span
              className="text-xs font-semibold px-1.5 py-0.5 rounded-full"
              style={{ background: priorityCfg.bg, color: priorityCfg.color, border: `1px solid ${priorityCfg.border}` }}
            >
              {priorityCfg.label}
            </span>
          )}
          {ticket.type && (
            <span className={`text-xs font-medium px-1.5 py-0.5 rounded-full ${TYPE_STYLES[ticket.type] || 'bg-gray-100 text-gray-600'}`}>
              {ticket.type}
            </span>
          )}
          {commentCount > 0 && (
            <span
              className="flex items-center gap-1 text-xs font-medium px-1.5 py-0.5 rounded-full text-gray-400"
              style={{ background: '#f3f4f6' }}
            >
              <svg width="9" height="9" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
                <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"/>
              </svg>
              {commentCount}
            </span>
          )}
        </div>
      </div>
    </div>
  );
}
