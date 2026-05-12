'use client';
import { useSortable } from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import { Ticket } from '@/types';

interface Props {
  ticket: Ticket;
  onClick: () => void;
  isDragging?: boolean;
  columnColor?: string;
}

export default function TicketCard({ ticket, onClick, isDragging, columnColor = '#6366f1' }: Props) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging: isSortableDragging } = useSortable({ id: ticket.id });

  const style: React.CSSProperties = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isSortableDragging ? 0.3 : 1,
    background: 'rgba(255,255,255,0.06)',
    border: '1px solid rgba(255,255,255,0.08)',
    borderLeft: `3px solid ${columnColor}`,
    borderRadius: '12px',
    padding: '14px',
    cursor: 'pointer',
    position: 'relative',
    ...(isDragging
      ? { transform: 'rotate(2deg)', boxShadow: `0 20px 40px rgba(0,0,0,0.5), 0 0 20px ${columnColor}44` }
      : {}),
  };

  const commentCount = ticket._count?.comments ?? ticket.comments?.length ?? 0;
  const depCount = ticket.dependsOn?.length ?? 0;

  const avatarColors = ['#6366f1', '#8b5cf6', '#06b6d4', '#10b981', '#f43f5e', '#f59e0b'];
  const getAvatarColor = (name: string) => avatarColors[name.charCodeAt(0) % avatarColors.length];

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
          el.style.background = 'rgba(255,255,255,0.1)';
          el.style.transform = CSS.Transform.toString(transform) + ' translateY(-2px)';
          el.style.boxShadow = `0 8px 24px rgba(0,0,0,0.3), 0 0 0 1px rgba(255,255,255,0.12)`;
        }
      }}
      onMouseLeave={(e) => {
        if (!isSortableDragging) {
          const el = e.currentTarget as HTMLDivElement;
          el.style.background = 'rgba(255,255,255,0.06)';
          el.style.transform = CSS.Transform.toString(transform) || '';
          el.style.boxShadow = 'none';
        }
      }}
    >
      <p className="text-sm font-semibold text-white mb-3 line-clamp-2 leading-snug pr-1">
        {ticket.title}
      </p>

      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          {ticket.assignee && (
            <div
              title={ticket.assignee.name}
              className="w-6 h-6 rounded-full flex items-center justify-center text-xs font-bold text-white"
              style={{
                background: getAvatarColor(ticket.assignee.name),
                boxShadow: '0 0 0 2px rgba(15,23,42,0.8)',
              }}
            >
              {ticket.assignee.name.charAt(0).toUpperCase()}
            </div>
          )}
          {depCount > 0 && (
            <span
              className="flex items-center gap-1 text-xs font-semibold px-2 py-0.5 rounded-full"
              title={`${depCount} dependenc${depCount === 1 ? 'y' : 'ies'}`}
              style={{
                background: 'rgba(245,158,11,0.15)',
                color: '#fbbf24',
                border: '1px solid rgba(245,158,11,0.25)',
              }}
            >
              <svg width="9" height="9" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
                <path d="M10 13a5 5 0 0 0 7.54.54l3-3a5 5 0 0 0-7.07-7.07l-1.72 1.71"/>
                <path d="M14 11a5 5 0 0 0-7.54-.54l-3 3a5 5 0 0 0 7.07 7.07l1.71-1.71"/>
              </svg>
              {depCount}
            </span>
          )}
        </div>

        {commentCount > 0 && (
          <span
            className="flex items-center gap-1 text-xs font-medium px-2 py-0.5 rounded-full"
            style={{
              background: 'rgba(99,102,241,0.12)',
              color: 'rgba(165,180,252,0.9)',
              border: '1px solid rgba(99,102,241,0.2)',
            }}
          >
            <svg width="9" height="9" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
              <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"/>
            </svg>
            {commentCount}
          </span>
        )}
      </div>
    </div>
  );
}
