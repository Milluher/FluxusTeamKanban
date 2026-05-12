'use client';
import { useEffect, useState, useCallback } from 'react';
import { useRouter, useParams } from 'next/navigation';
import {
  DndContext,
  DragEndEvent,
  DragOverEvent,
  DragOverlay,
  DragStartEvent,
  PointerSensor,
  useSensor,
  useSensors,
  closestCorners,
} from '@dnd-kit/core';
import api from '@/lib/api';
import socket from '@/lib/socket';
import { Board, Ticket, User } from '@/types';
import KanbanColumn from '@/components/KanbanColumn';
import TicketCard from '@/components/TicketCard';
import TicketModal from '@/components/TicketModal';
import CreateTicketModal from '@/components/CreateTicketModal';
import InviteMemberModal from '@/components/InviteMemberModal';

export default function BoardPage() {
  const params = useParams();
  const boardId = params.id as string;
  const router = useRouter();

  const [board, setBoard] = useState<Board | null>(null);
  const [currentUser, setCurrentUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);
  const [activeTicket, setActiveTicket] = useState<Ticket | null>(null);
  const [selectedTicket, setSelectedTicket] = useState<Ticket | null>(null);
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [createColumnId, setCreateColumnId] = useState<string>('');
  const [showInviteModal, setShowInviteModal] = useState(false);

  const sensors = useSensors(useSensor(PointerSensor, { activationConstraint: { distance: 5 } }));

  useEffect(() => {
    const stored = localStorage.getItem('user');
    if (!stored) { router.push('/'); return; }
    setCurrentUser(JSON.parse(stored));
    loadBoard();
  }, [boardId]);

  useEffect(() => {
    if (!board) return;
    socket.connect();
    socket.emit('join-board', boardId);

    socket.on('ticket-created', (ticket: Ticket) => {
      setBoard((prev) => {
        if (!prev) return prev;
        return {
          ...prev,
          columns: prev.columns.map((col) =>
            col.id === ticket.columnId ? { ...col, tickets: [...col.tickets, ticket] } : col
          ),
        };
      });
    });

    socket.on('ticket-updated', (ticket: Ticket) => {
      setBoard((prev) => updateTicketInBoard(prev, ticket));
      setSelectedTicket((prev) => prev?.id === ticket.id ? ticket : prev);
    });

    socket.on('ticket-moved', (ticket: Ticket) => {
      setBoard((prev) => moveTicketInBoard(prev, ticket));
    });

    socket.on('ticket-deleted', (ticketId: string) => {
      setBoard((prev) => {
        if (!prev) return prev;
        return {
          ...prev,
          columns: prev.columns.map((col) => ({
            ...col,
            tickets: col.tickets.filter((t) => t.id !== ticketId),
          })),
        };
      });
      setSelectedTicket((prev) => prev?.id === ticketId ? null : prev);
    });

    socket.on('comment-added', ({ ticketId, comment }: any) => {
      setSelectedTicket((prev) => {
        if (!prev || prev.id !== ticketId) return prev;
        return { ...prev, comments: [...(prev.comments || []), comment] };
      });
    });

    return () => {
      socket.emit('leave-board', boardId);
      socket.off('ticket-created');
      socket.off('ticket-updated');
      socket.off('ticket-moved');
      socket.off('ticket-deleted');
      socket.off('comment-added');
      socket.disconnect();
    };
  }, [board?.id]);

  const loadBoard = async () => {
    try {
      const { data } = await api.get(`/boards/${boardId}`);
      setBoard(data);
    } catch { router.push('/dashboard'); }
    finally { setLoading(false); }
  };

  const updateTicketInBoard = (prev: Board | null, ticket: Ticket): Board | null => {
    if (!prev) return prev;
    return {
      ...prev,
      columns: prev.columns.map((col) => ({
        ...col,
        tickets: col.id === ticket.columnId
          ? col.tickets.some((t) => t.id === ticket.id)
            ? col.tickets.map((t) => t.id === ticket.id ? ticket : t)
            : [...col.tickets, ticket]
          : col.tickets.filter((t) => t.id !== ticket.id),
      })),
    };
  };

  const moveTicketInBoard = (prev: Board | null, ticket: Ticket): Board | null => {
    return updateTicketInBoard(prev, ticket);
  };

  const handleDragStart = (event: DragStartEvent) => {
    const { active } = event;
    const ticket = findTicket(active.id as string);
    setActiveTicket(ticket || null);
  };

  const handleDragEnd = async (event: DragEndEvent) => {
    setActiveTicket(null);
    const { active, over } = event;
    if (!over || !board) return;

    const ticketId = active.id as string;
    const overId = over.id as string;

    // Determine target column
    let targetColumnId = overId;
    // Check if over a ticket
    const overTicket = findTicket(overId);
    if (overTicket) targetColumnId = overTicket.columnId;

    const ticket = findTicket(ticketId);
    if (!ticket || ticket.columnId === targetColumnId) return;

    // Optimistic update
    setBoard((prev) => {
      if (!prev) return prev;
      return {
        ...prev,
        columns: prev.columns.map((col) => {
          if (col.id === ticket.columnId) return { ...col, tickets: col.tickets.filter((t) => t.id !== ticketId) };
          if (col.id === targetColumnId) return { ...col, tickets: [...col.tickets, { ...ticket, columnId: targetColumnId }] };
          return col;
        }),
      };
    });

    try {
      await api.patch(`/tickets/${ticketId}/move`, { columnId: targetColumnId, boardId });
    } catch { loadBoard(); }
  };

  const findTicket = (id: string): Ticket | undefined => {
    if (!board) return undefined;
    for (const col of board.columns) {
      const t = col.tickets.find((t) => t.id === id);
      if (t) return t;
    }
  };

  if (loading) return (
    <div className="min-h-screen flex items-center justify-center" style={{ background: '#0f172a' }}>
      <div className="flex flex-col items-center gap-4">
        <div className="w-10 h-10 rounded-xl animate-pulse"
          style={{ background: 'linear-gradient(135deg, #6366f1, #8b5cf6)' }} />
        <p className="text-sm font-medium" style={{ color: 'rgba(255,255,255,0.4)' }}>Loading board...</p>
      </div>
    </div>
  );

  if (!board) return null;

  return (
    <div className="min-h-screen flex flex-col" style={{ background: '#0f172a' }}>
      {/* Navbar */}
      <nav className="px-6 py-3.5 flex items-center justify-between flex-shrink-0 sticky top-0 z-10"
        style={{
          background: 'rgba(15,23,42,0.85)',
          backdropFilter: 'blur(16px)',
          WebkitBackdropFilter: 'blur(16px)',
          borderBottom: '1px solid rgba(255,255,255,0.08)',
        }}>
        <div className="flex items-center gap-3">
          <button
            onClick={() => router.push('/dashboard')}
            className="flex items-center gap-1.5 text-sm font-medium transition-all duration-200 px-2.5 py-1.5 rounded-lg"
            style={{ color: 'rgba(255,255,255,0.4)', background: 'rgba(255,255,255,0.04)' }}
            onMouseEnter={(e) => { e.currentTarget.style.color = 'rgba(255,255,255,0.7)'; e.currentTarget.style.background = 'rgba(255,255,255,0.08)'; }}
            onMouseLeave={(e) => { e.currentTarget.style.color = 'rgba(255,255,255,0.4)'; e.currentTarget.style.background = 'rgba(255,255,255,0.04)'; }}
          >
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
              <path d="M19 12H5M12 5l-7 7 7 7"/>
            </svg>
            Boards
          </button>
          <span style={{ color: 'rgba(255,255,255,0.15)' }}>/</span>
          <div className="flex items-center gap-2">
            <div className="w-6 h-6 rounded-md flex items-center justify-center"
              style={{ background: 'linear-gradient(135deg, #6366f1, #8b5cf6)' }}>
              <svg width="12" height="12" viewBox="0 0 24 24" fill="none">
                <rect x="3" y="3" width="8" height="5" rx="1.5" fill="white"/>
                <rect x="13" y="3" width="8" height="11" rx="1.5" fill="white" opacity="0.7"/>
              </svg>
            </div>
            <h1 className="font-bold text-white text-sm">{board.name}</h1>
          </div>
        </div>
        <div className="flex items-center gap-3">
          <div className="flex -space-x-2">
            {board.members.slice(0, 5).map((m, i) => {
              const colors = ['#6366f1','#8b5cf6','#06b6d4','#10b981','#f43f5e'];
              return (
                <div
                  key={m.id}
                  title={m.user.name}
                  className="w-8 h-8 rounded-full flex items-center justify-center text-xs font-bold text-white ring-2"
                  style={{
                    background: colors[i % colors.length],
                    boxShadow: '0 0 0 2px #0f172a',
                  }}
                >
                  {m.user.name.charAt(0).toUpperCase()}
                </div>
              );
            })}
          </div>
          <button
            onClick={() => setShowInviteModal(true)}
            className="flex items-center gap-1.5 text-sm font-semibold px-3.5 py-1.5 rounded-xl transition-all duration-200"
            style={{
              background: 'rgba(99,102,241,0.15)',
              color: '#a5b4fc',
              border: '1px solid rgba(99,102,241,0.3)',
            }}
            onMouseEnter={(e) => { e.currentTarget.style.background = 'rgba(99,102,241,0.25)'; e.currentTarget.style.border = '1px solid rgba(99,102,241,0.5)'; }}
            onMouseLeave={(e) => { e.currentTarget.style.background = 'rgba(99,102,241,0.15)'; e.currentTarget.style.border = '1px solid rgba(99,102,241,0.3)'; }}
          >
            <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
              <path d="M16 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"/>
              <circle cx="8.5" cy="7" r="4"/>
              <line x1="20" y1="8" x2="20" y2="14"/>
              <line x1="23" y1="11" x2="17" y2="11"/>
            </svg>
            Invite
          </button>
        </div>
      </nav>

      {/* Board */}
      <div className="flex-1 overflow-x-auto p-6">
        <DndContext
          sensors={sensors}
          collisionDetection={closestCorners}
          onDragStart={handleDragStart}
          onDragEnd={handleDragEnd}
        >
          <div className="flex gap-5 h-full" style={{ minHeight: 'calc(100vh - 120px)' }}>
            {board.columns.map((col) => (
              <KanbanColumn
                key={col.id}
                column={col}
                onTicketClick={(ticket) => setSelectedTicket(ticket)}
                onAddTicket={(columnId) => { setCreateColumnId(columnId); setShowCreateModal(true); }}
                boardId={boardId}
              />
            ))}
          </div>
          <DragOverlay>
            {activeTicket && <TicketCard ticket={activeTicket} onClick={() => {}} isDragging />}
          </DragOverlay>
        </DndContext>
      </div>

      {/* Modals */}
      {selectedTicket && (
        <TicketModal
          ticket={selectedTicket}
          boardId={boardId}
          board={board}
          currentUser={currentUser!}
          onClose={() => setSelectedTicket(null)}
          onUpdate={(updated) => {
            setBoard((prev) => updateTicketInBoard(prev, updated));
            setSelectedTicket(updated);
          }}
          onDelete={(id) => {
            setBoard((prev) => {
              if (!prev) return prev;
              return { ...prev, columns: prev.columns.map((col) => ({ ...col, tickets: col.tickets.filter((t) => t.id !== id) })) };
            });
            setSelectedTicket(null);
          }}
        />
      )}

      {showCreateModal && (
        <CreateTicketModal
          columnId={createColumnId}
          boardId={boardId}
          board={board}
          onClose={() => setShowCreateModal(false)}
          onCreate={(ticket) => {
            setBoard((prev) => updateTicketInBoard(prev, ticket));
            setShowCreateModal(false);
          }}
        />
      )}

      {showInviteModal && (
        <InviteMemberModal
          boardId={boardId}
          onClose={() => setShowInviteModal(false)}
        />
      )}
    </div>
  );
}
