'use client';
import { useSortable } from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import { Ticket } from '@/types';

interface Props {
  ticket: Ticket;
  onClick: () => void;
  isDragging?: boolean;
}

export default function TicketCard({ ticket, onClick, isDragging }: Props) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging: isSortableDragging } = useSortable({ id: ticket.id });

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isSortableDragging ? 0.4 : 1,
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
      className={`bg-white rounded-lg p-3 shadow-sm border border-gray-200 cursor-pointer hover:shadow-md hover:border-indigo-300 transition-all ${
        isDragging ? 'rotate-2 shadow-lg' : ''
      }`}
    >
      <p className="text-sm font-medium text-gray-900 mb-2 line-clamp-2">{ticket.title}</p>

      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          {ticket.assignee && (
            <div
              title={ticket.assignee.name}
              className="w-6 h-6 rounded-full bg-indigo-500 text-white flex items-center justify-center text-xs font-bold"
            >
              {ticket.assignee.name.charAt(0).toUpperCase()}
            </div>
          )}
          {depCount > 0 && (
            <span className="text-xs text-orange-500 font-medium" title={`${depCount} dependencies`}>
              🔗 {depCount}
            </span>
          )}
        </div>

        {commentCount > 0 && (
          <span className="text-xs text-gray-400 flex items-center gap-1">
            💬 {commentCount}
          </span>
        )}
      </div>
    </div>
  );
}
