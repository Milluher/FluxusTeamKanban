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

const columnColors: Record<string, string> = {
  'Backlog': 'bg-gray-100 text-gray-600',
  'To Do': 'bg-blue-100 text-blue-700',
  'In Progress': 'bg-yellow-100 text-yellow-700',
  'Review': 'bg-purple-100 text-purple-700',
  'Done': 'bg-green-100 text-green-700',
};

export default function KanbanColumn({ column, onTicketClick, onAddTicket }: Props) {
  const { setNodeRef, isOver } = useDroppable({ id: column.id });

  const colorClass = columnColors[column.name] || 'bg-gray-100 text-gray-600';

  return (
    <div className="flex flex-col w-72 flex-shrink-0">
      {/* Column Header */}
      <div className="flex items-center justify-between mb-3 px-1">
        <div className="flex items-center gap-2">
          <span className={`text-xs font-semibold px-2 py-0.5 rounded-full ${colorClass}`}>
            {column.name}
          </span>
          <span className="text-xs text-gray-400 font-medium">{column.tickets.length}</span>
        </div>
        <button
          onClick={() => onAddTicket(column.id)}
          className="text-gray-400 hover:text-gray-600 hover:bg-gray-200 rounded p-1 transition-colors text-lg leading-none"
          title="Add ticket"
        >
          +
        </button>
      </div>

      {/* Column Body */}
      <div
        ref={setNodeRef}
        className={`flex-1 rounded-xl p-2 transition-colors min-h-24 ${
          isOver ? 'bg-indigo-50 border-2 border-indigo-300 border-dashed' : 'bg-gray-200/50'
        }`}
      >
        <SortableContext items={column.tickets.map((t) => t.id)} strategy={verticalListSortingStrategy}>
          <div className="space-y-2">
            {column.tickets.map((ticket) => (
              <TicketCard key={ticket.id} ticket={ticket} onClick={() => onTicketClick(ticket)} />
            ))}
          </div>
        </SortableContext>

        {column.tickets.length === 0 && !isOver && (
          <div className="text-center py-6 text-gray-400 text-sm">No tickets</div>
        )}
      </div>
    </div>
  );
}
