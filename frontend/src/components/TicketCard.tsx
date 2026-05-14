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

interface Props {
  ticket: Ticket;
  onClick: () => void;
  isDragging?: boolean;
  columnColor?: string;
  activeMemberIds?: Set<string>;
}

export default function TicketCard({ ticket, onClick, isDragging, columnColor = '#e8390e', activeMemberIds }: Props) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging: isSortableDragging } = useSortable({ id: ticket.id });

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
    minHeight: '72px',
    ...(isDragging
      ? {
          transform: 'rotate(1.5deg)',
          boxShadow: '0 8px 24px rgba(0,0,0,0.12)',
          border: '1px solid #e8390e',
        }
      : {}),
  };

  const commentCount = ticket._count?.comments ?? ticket.comments?.length ?? 0;
  const depCount = ticket.dependsOn?.length ?? 0;

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
      <p className="text-sm font-medium text-gray-800 mb-2.5 line-clamp-2 leading-5">
        {ticket.title}
      </p>

      {ticket.type && (
        <div className="mb-2">
          <span className={`text-xs font-medium px-2 py-0.5 rounded-full ${TYPE_STYLES[ticket.type] || 'bg-gray-100 text-gray-600'}`}>
            {ticket.type}
          </span>
        </div>
      )}

      <div className="flex items-center justify-between">
        <div className="flex items-center gap-1.5">
          {ticket.assignee && (() => {
            const inactive = activeMemberIds ? !activeMemberIds.has(ticket.assignee!.id) : false;
            return (
              <img
                src={avatarUrl(ticket.assignee.name)}
                title={`${ticket.assignee.name}${inactive ? ' (inactive)' : ''}`}
                className={`w-6 h-6 rounded-full flex-shrink-0 ${inactive ? 'grayscale opacity-40' : ''}`}
                alt={ticket.assignee.name}
              />
            );
          })()}
          {depCount > 0 && (
            <span
              className="flex items-center gap-1 text-xs font-medium px-1.5 py-0.5 rounded-full text-gray-500"
              title={`${depCount} dependenc${depCount === 1 ? 'y' : 'ies'}`}
              style={{ background: '#f3f4f6' }}
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
  );
}
