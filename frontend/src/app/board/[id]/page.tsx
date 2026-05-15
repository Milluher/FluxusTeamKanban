'use client';
import { useEffect, useState, useCallback, useRef } from 'react';
import { useRouter, useParams, useSearchParams } from 'next/navigation';
import Image from 'next/image';
import { useInactivityTimeout } from '@/lib/useInactivityTimeout';
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
import { avatarUrl } from '@/lib/avatar';
import KanbanColumn from '@/components/KanbanColumn';
import TicketCard from '@/components/TicketCard';
import TicketModal from '@/components/TicketModal';
import CreateTicketModal from '@/components/CreateTicketModal';
import InviteMemberModal from '@/components/InviteMemberModal';
import NotificationBell from '@/components/NotificationBell';

export default function BoardPage() {
  const params = useParams();
  const boardId = params.id as string;
  const router = useRouter();
  const searchParams = useSearchParams();

  const [board, setBoard] = useState<Board | null>(null);
  const [currentUser, setCurrentUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);
  const [activeTicket, setActiveTicket] = useState<Ticket | null>(null);
  const [selectedTicket, setSelectedTicket] = useState<Ticket | null>(null);
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [createColumnId, setCreateColumnId] = useState<string>('');
  const [showInviteModal, setShowInviteModal] = useState(false);
  const [showMembersPanel, setShowMembersPanel] = useState(false);
  const membersPanelRef = useRef<HTMLDivElement>(null);

  useInactivityTimeout();
  const sensors = useSensors(useSensor(PointerSensor, { activationConstraint: { distance: 5 } }));

  useEffect(() => {
    const stored = localStorage.getItem('user');
    if (!stored) { router.push('/'); return; }
    const u = JSON.parse(stored);
    if (u.mustChangePassword) { router.push('/change-password'); return; }
    setCurrentUser(u);
    loadBoard();
  }, [boardId]);

  useEffect(() => {
    const handleOutsideClick = (e: MouseEvent) => {
      if (membersPanelRef.current && !membersPanelRef.current.contains(e.target as Node)) {
        setShowMembersPanel(false);
      }
    };
    if (showMembersPanel) document.addEventListener('mousedown', handleOutsideClick);
    return () => document.removeEventListener('mousedown', handleOutsideClick);
  }, [showMembersPanel]);

  // Open ticket from URL param (e.g. from notification click)
  useEffect(() => {
    if (!board) return;
    const ticketId = searchParams.get('ticket');
    if (!ticketId) return;
    const ticket = board.columns.flatMap((c) => c.tickets).find((t) => t.id === ticketId);
    if (ticket) setSelectedTicket(ticket);
  }, [board?.id, searchParams]);

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

    socket.on('member-removed', ({ userId }: { userId: string }) => {
      if (userId === currentUser?.id) { router.push('/dashboard'); return; }
      setBoard((prev) => prev ? { ...prev, members: prev.members.filter((m) => m.user.id !== userId) } : prev);
    });

    return () => {
      socket.emit('leave-board', boardId);
      socket.off('ticket-created');
      socket.off('ticket-updated');
      socket.off('ticket-moved');
      socket.off('ticket-deleted');
      socket.off('comment-added');
      socket.off('member-removed');
      socket.disconnect();
    };
  }, [board?.id]);

  const removeMember = async (userId: string) => {
    try {
      await api.delete(`/boards/${boardId}/members/${userId}`);
      setBoard((prev) => prev ? { ...prev, members: prev.members.filter((m) => m.user.id !== userId) } : prev);
    } catch { /* handled by socket */ }
  };

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
    <div className="min-h-screen flex items-center justify-center bg-[#f7f8fa]">
      <div className="flex flex-col items-center gap-3">
        <div
          className="w-8 h-8 rounded-lg animate-pulse"
          style={{ background: '#1a1f3c' }}
        />
        <p className="text-sm text-gray-400">Loading board...</p>
      </div>
    </div>
  );

  if (!board) return null;

  return (
    <div className="min-h-screen flex flex-col bg-[#f0f2f5]">
      {/* Navbar */}
      <nav className="bg-white border-b border-gray-200 px-4 sm:px-6 flex items-center justify-between flex-shrink-0 sticky top-0 z-10 h-14">
        <div className="flex items-center gap-2 sm:gap-3 min-w-0">
          {/* Logo */}
          <Image src="/logo.png" width={26} height={26} alt="Fluxus" className="rounded-md flex-shrink-0" />

          {/* Back link — arrow only on mobile, arrow + text on desktop */}
          <button
            onClick={() => router.push('/dashboard')}
            className="flex items-center gap-1 text-sm font-medium text-gray-400 transition-all duration-150 hover:text-gray-800 min-h-[44px] flex-shrink-0"
          >
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
              <path d="M19 12H5M12 5l-7 7 7 7"/>
            </svg>
            <span className="hidden sm:inline">Back</span>
          </button>

          <span className="text-gray-300 hidden sm:inline">/</span>

          <h1 className="font-semibold text-sm truncate max-w-[120px] sm:max-w-none" style={{ color: '#1a1f3c' }}>{board.name}</h1>
        </div>

        <div className="flex items-center gap-2 sm:gap-3 flex-shrink-0">
          {/* Member avatars — clickable to show member list */}
          <div className="relative" ref={membersPanelRef}>
            <button
              onClick={() => setShowMembersPanel((p) => !p)}
              className="flex -space-x-1.5 cursor-pointer"
              aria-label="View board members"
              title="View members"
            >
              {board.members.slice(0, 3).map((m) => (
                <img
                  key={m.id}
                  src={avatarUrl(m.user.name)}
                  className="w-7 h-7 rounded-full ring-2 ring-white flex-shrink-0 sm:hidden"
                  alt={m.user.name}
                />
              ))}
              {board.members.slice(0, 5).map((m) => (
                <img
                  key={`d-${m.id}`}
                  src={avatarUrl(m.user.name)}
                  className="w-7 h-7 rounded-full ring-2 ring-white flex-shrink-0 hidden sm:block"
                  alt={m.user.name}
                />
              ))}
            </button>

            {showMembersPanel && (
              <div className="absolute right-0 top-full mt-2 bg-white border border-gray-200 rounded-xl shadow-lg z-20 min-w-[220px] py-2">
                <p className="text-xs font-semibold text-gray-400 uppercase tracking-wider px-4 pt-1 pb-2">
                  {board.members.length} {board.members.length === 1 ? 'Member' : 'Members'}
                </p>
                {board.members.map((m) => {
                  const isCurrentUserBoardAdmin = board.members.find(bm => bm.user.id === currentUser?.id)?.role === 'admin';
                  return (
                    <div key={m.id} className="flex items-center gap-3 px-4 py-2 hover:bg-gray-50 transition-colors group">
                      <img src={avatarUrl(m.user.name)} className="w-8 h-8 rounded-full flex-shrink-0" alt={m.user.name} />
                      <div className="min-w-0 flex-1">
                        <p className="text-sm font-medium text-gray-800 truncate">{m.user.name}</p>
                        <p className="text-xs text-gray-400 capitalize">{m.role}</p>
                      </div>
                      {isCurrentUserBoardAdmin && m.user.id !== currentUser?.id && (
                        <button
                          onClick={() => removeMember(m.user.id)}
                          title="Remove from board"
                          className="opacity-0 group-hover:opacity-100 flex-shrink-0 w-6 h-6 flex items-center justify-center rounded-md text-gray-400 hover:text-red-500 hover:bg-red-50 transition-all"
                        >
                          <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
                            <line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/>
                          </svg>
                        </button>
                      )}
                    </div>
                  );
                })}
              </div>
            )}
          </div>

          {currentUser && <NotificationBell userId={currentUser.id} />}

          {/* Invite button — only for system admins or board admins */}
          {(currentUser?.role === 'admin' || board.members.find(m => m.user.id === currentUser?.id)?.role === 'admin') && (
          <button
            onClick={() => setShowInviteModal(true)}
            className="flex items-center justify-center gap-1.5 text-sm font-semibold px-2.5 sm:px-3 py-1.5 min-h-[44px] rounded-lg border transition-all duration-150"
            style={{
              color: '#e8390e',
              borderColor: '#e8390e',
              background: 'white',
            }}
            onMouseEnter={(e) => {
              e.currentTarget.style.background = '#e8390e';
              e.currentTarget.style.color = 'white';
            }}
            onMouseLeave={(e) => {
              e.currentTarget.style.background = 'white';
              e.currentTarget.style.color = '#e8390e';
            }}
          >
            <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
              <path d="M16 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"/>
              <circle cx="8.5" cy="7" r="4"/>
              <line x1="20" y1="8" x2="20" y2="14"/>
              <line x1="23" y1="11" x2="17" y2="11"/>
            </svg>
            <span className="hidden sm:inline">Invite</span>
          </button>
          )}
        </div>
      </nav>

      {/* Board */}
      <div className="flex-1 overflow-x-auto pb-4 board-scroll">
        <DndContext
          sensors={sensors}
          collisionDetection={closestCorners}
          onDragStart={handleDragStart}
          onDragEnd={handleDragEnd}
        >
          <div className="flex gap-3 sm:gap-4 h-full px-4 sm:px-6 pt-4 sm:pt-6 pb-6" style={{ minHeight: 'calc(100vh - 120px)' }}>
            {(() => {
              const activeMemberIds = new Set(board.members.map((m) => m.user.id));
              return board.columns.map((col) => (
                <KanbanColumn
                  key={col.id}
                  column={col}
                  onTicketClick={(ticket) => setSelectedTicket(ticket)}
                  onAddTicket={(columnId) => { setCreateColumnId(columnId); setShowCreateModal(true); }}
                  boardId={boardId}
                  activeMemberIds={activeMemberIds}
                />
              ));
            })()}
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
          boardMemberIds={board.members.map(m => m.user.id)}
          onClose={() => setShowInviteModal(false)}
          onMemberAdded={(member) => {
            setBoard((prev) => prev ? { ...prev, members: [...prev.members, member] } : prev);
          }}
        />
      )}
    </div>
  );
}
