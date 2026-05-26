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
  MouseSensor,
  TouchSensor,
  useSensor,
  useSensors,
  closestCenter,
} from '@dnd-kit/core';
import { arrayMove } from '@dnd-kit/sortable';
import api from '@/lib/api';
import socket from '@/lib/socket';
import { Board, Ticket, User, Sprint } from '@/types';
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

  // Sprint state
  const [sprints, setSprints] = useState<Sprint[]>([]);
  const [activeSprint, setActiveSprint] = useState<Sprint | null>(null);
  const [showCreateSprint, setShowCreateSprint] = useState(false);
  const [sprintForm, setSprintForm] = useState({ title: '', startDate: '', endDate: '' });
  const [creatingSprintLoading, setCreatingSprintLoading] = useState(false);
  const [deletingSprintId, setDeletingSprintId] = useState<string | null>(null);
  const [editDatesSprintId, setEditDatesSprintId] = useState<string | null>(null);
  const [editDatesForm, setEditDatesForm] = useState({ startDate: '', endDate: '' });
  const [updatingDates, setUpdatingDates] = useState(false);

  // Ticket filter state
  const [filterMyTickets, setFilterMyTickets] = useState(true);
  const [mentionedTicketIds, setMentionedTicketIds] = useState<Set<string>>(new Set());

  // Board filter state (type, project, priority)
  const [filterType, setFilterType] = useState('');
  const [filterProject, setFilterProject] = useState('');
  const [filterPriority, setFilterPriority] = useState('');

  useInactivityTimeout();
  const sensors = useSensors(
    useSensor(MouseSensor, { activationConstraint: { distance: 5 } }),
    useSensor(TouchSensor, { activationConstraint: { delay: 150, tolerance: 5 } }),
    useSensor(PointerSensor, { activationConstraint: { distance: 5 } }),
  );

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
      const [{ data }, { data: sprintData }, { data: notifs }] = await Promise.all([
        api.get(`/boards/${boardId}`),
        api.get(`/boards/${boardId}/sprints`),
        api.get('/notifications'),
      ]);
      setBoard(data);
      setSprints(sprintData);
      const ids = new Set<string>(
        notifs
          .filter((n: any) => n.type === 'comment_mention' && n.ticketId)
          .map((n: any) => n.ticketId as string)
      );
      setMentionedTicketIds(ids);
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
    const ticket = findTicket(event.active.id as string);
    setActiveTicket(ticket || null);
  };

  // Resolve which column an over-id belongs to
  const resolveColumnId = (overId: string): string | null => {
    if (!board) return null;
    // Check if it's a column id
    if (board.columns.some((c) => c.id === overId)) return overId;
    // Check if it's a ticket id
    const overTicket = findTicket(overId);
    if (overTicket) return overTicket.columnId;
    return null;
  };

  // Live update during drag — moves ticket between columns as cursor crosses boundaries
  const handleDragOver = (event: DragOverEvent) => {
    const { active, over } = event;
    if (!over || !board) return;

    const ticketId = active.id as string;
    const overId = over.id as string;
    if (ticketId === overId) return;

    const ticket = findTicket(ticketId);
    if (!ticket) return;

    const targetColumnId = resolveColumnId(overId);
    if (!targetColumnId || ticket.columnId === targetColumnId) return;

    setBoard((prev) => {
      if (!prev) return prev;
      return {
        ...prev,
        columns: prev.columns.map((col) => {
          if (col.id === ticket.columnId) {
            return { ...col, tickets: col.tickets.filter((t) => t.id !== ticketId) };
          }
          if (col.id === targetColumnId) {
            const overTicket = findTicket(overId);
            const insertIdx = overTicket
              ? col.tickets.findIndex((t) => t.id === overId)
              : col.tickets.length;
            const updated = [...col.tickets];
            updated.splice(Math.max(insertIdx, 0), 0, { ...ticket, columnId: targetColumnId });
            return { ...col, tickets: updated };
          }
          return col;
        }),
      };
    });
  };

  const handleDragEnd = async (event: DragEndEvent) => {
    const originalTicket = activeTicket; // snapshot of ticket at drag start
    setActiveTicket(null);

    const { active, over } = event;

    // Dropped outside any valid target — restore
    if (!over || !board || !originalTicket) {
      if (!over) loadBoard();
      return;
    }

    const ticketId = active.id as string;
    const overId = over.id as string;
    if (ticketId === overId) return;

    // Current ticket state (reflects live moves from handleDragOver)
    const currentTicket = findTicket(ticketId);
    if (!currentTicket) return;

    if (originalTicket.columnId === currentTicket.columnId) {
      // Same-column reorder — handleDragOver didn't move it, apply arrayMove now
      const col = board.columns.find((c) => c.id === currentTicket.columnId);
      if (!col) return;
      const oldIndex = col.tickets.findIndex((t) => t.id === ticketId);
      const newIndex = col.tickets.findIndex((t) => t.id === overId);
      if (oldIndex === -1 || newIndex === -1 || oldIndex === newIndex) return;

      const reordered = arrayMove(col.tickets, oldIndex, newIndex);
      setBoard((prev) => {
        if (!prev) return prev;
        return {
          ...prev,
          columns: prev.columns.map((c) =>
            c.id === col.id ? { ...c, tickets: reordered } : c
          ),
        };
      });
      try {
        await api.patch('/tickets/reorder', {
          columnId: col.id,
          boardId,
          ticketIds: reordered.map((t) => t.id),
        });
      } catch { loadBoard(); }
    } else {
      // Cross-column: board state already updated by handleDragOver — just persist
      try {
        await api.patch(`/tickets/${ticketId}/move`, {
          columnId: currentTicket.columnId,
          boardId,
        });
      } catch { loadBoard(); }
    }
  };

  const findTicket = (id: string): Ticket | undefined => {
    if (!board) return undefined;
    for (const col of board.columns) {
      const t = col.tickets.find((t) => t.id === id);
      if (t) return t;
    }
  };

  const createSprint = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!sprintForm.title) return;
    setCreatingSprintLoading(true);
    try {
      const { data } = await api.post(`/boards/${boardId}/sprints`, sprintForm);
      setSprints((prev) => [...prev, data]);
      setSprintForm({ title: '', startDate: '', endDate: '' });
      setShowCreateSprint(false);
    } finally { setCreatingSprintLoading(false); }
  };

  const deleteSprint = async (sprintId: string) => {
    if (!confirm('Delete this sprint? Tickets will remain but will be unassigned from the sprint.')) return;
    setDeletingSprintId(sprintId);
    try {
      await api.delete(`/boards/${boardId}/sprints/${sprintId}`);
      setSprints((prev) => prev.filter((s) => s.id !== sprintId));
      if (activeSprint?.id === sprintId) setActiveSprint(null);
    } finally { setDeletingSprintId(null); }
  };

  const moveSprint = async (sprintId: string, status: string) => {
    try {
      const { data } = await api.patch(`/boards/${boardId}/sprints/${sprintId}`, { status });
      setSprints((prev) => prev.map((s) => s.id === sprintId ? { ...s, status: data.status } : s));
      if (activeSprint?.id === sprintId) setActiveSprint((prev) => prev ? { ...prev, status: data.status } : prev);
    } catch { /* silent — board is still functional */ }
  };

  const updateSprintDates = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editDatesSprintId) return;
    setUpdatingDates(true);
    try {
      const { data } = await api.patch(`/boards/${boardId}/sprints/${editDatesSprintId}`, {
        startDate: editDatesForm.startDate || null,
        endDate: editDatesForm.endDate || null,
      });
      setSprints((prev) => prev.map((s) => s.id === editDatesSprintId ? { ...s, startDate: data.startDate, endDate: data.endDate } : s));
      if (activeSprint?.id === editDatesSprintId) setActiveSprint((prev) => prev ? { ...prev, startDate: data.startDate, endDate: data.endDate } : prev);
      setEditDatesSprintId(null);
    } finally { setUpdatingDates(false); }
  };

  const formatDate = (dateStr: string | null) => {
    if (!dateStr) return '—';
    return new Date(dateStr).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
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

  const isAdmin = currentUser?.role === 'admin' || board.members.find(m => m.user.id === currentUser?.id)?.role === 'admin';

  // Unique filter options derived from all board tickets
  const allBoardTickets = board.columns.flatMap((c) => c.tickets);
  const uniqueTypes = [...new Set(allBoardTickets.map((t) => t.type).filter((v): v is string => !!v))].sort();
  const uniqueProjects = [...new Set(allBoardTickets.map((t) => t.project).filter((v): v is string => !!v))].sort();
  const priorityOrder = ['low', 'medium', 'high', 'urgent'];
  const uniquePriorities = priorityOrder.filter((p) => allBoardTickets.some((t) => t.priority === p));
  const activeFilterCount = [filterType, filterProject, filterPriority].filter(Boolean).length;

  const applyTicketFilters = (tickets: Ticket[]) =>
    tickets.filter((t) =>
      (!filterType || t.type === filterType) &&
      (!filterProject || t.project === filterProject) &&
      (!filterPriority || t.priority === filterPriority)
    );

  const sprintColumns = activeSprint
    ? board.columns.map((col) => ({
        ...col,
        tickets: col.tickets.filter((t) => t.sprintId === activeSprint.id),
      }))
    : board.columns;

  const myTicketsColumns = activeSprint && filterMyTickets
    ? sprintColumns.map((col) => ({
        ...col,
        tickets: col.tickets.filter((t) =>
          t.assigneeId === currentUser?.id || mentionedTicketIds.has(t.id)
        ),
      }))
    : sprintColumns;

  const visibleColumns = myTicketsColumns.map((col) => ({
    ...col,
    tickets: applyTicketFilters(col.tickets),
  }));

  const filteredKanbanColumns = board.columns.map((col) => ({
    ...col,
    tickets: applyTicketFilters(col.tickets),
  }));

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
          {isAdmin && (
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

      {/* Sprint ticket view banner */}
      {activeSprint && board.type !== 'kanban' && (
        <div
          className="flex-shrink-0 flex items-center gap-3 px-4 sm:px-6 py-2.5 border-b border-gray-200"
          style={{ background: '#1a1f3c' }}
        >
          <button
            onClick={() => setActiveSprint(null)}
            className="flex items-center gap-1.5 text-sm font-medium transition-colors"
            style={{ color: 'rgba(255,255,255,0.7)' }}
            onMouseEnter={(e) => { e.currentTarget.style.color = 'white'; }}
            onMouseLeave={(e) => { e.currentTarget.style.color = 'rgba(255,255,255,0.7)'; }}
          >
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
              <path d="M19 12H5M12 5l-7 7 7 7"/>
            </svg>
            <span className="hidden sm:inline">Sprints</span>
          </button>
          <span style={{ color: 'rgba(255,255,255,0.3)' }}>/</span>
          <span className="font-semibold text-sm text-white truncate">{activeSprint.title}</span>
          <span className="text-xs hidden sm:inline" style={{ color: 'rgba(255,255,255,0.5)' }}>
            {formatDate(activeSprint.startDate)} &rarr; {formatDate(activeSprint.endDate)}
          </span>
          <div className="ml-auto flex items-center gap-2 sm:gap-3">
            <span className="text-xs font-medium px-2 py-0.5 rounded-full hidden sm:inline" style={{ background: 'rgba(232,57,14,0.2)', color: '#e8390e' }}>
              {activeSprint._count.tickets} tickets
            </span>
            <span className="text-xs font-medium px-2 py-0.5 rounded-full hidden sm:inline" style={{ background: 'rgba(255,255,255,0.1)', color: 'rgba(255,255,255,0.7)' }}>
              {activeSprint._count.members} members
            </span>
            {/* Filter toggle */}
            <div className="flex rounded-lg overflow-hidden text-xs font-semibold" style={{ border: '1px solid rgba(255,255,255,0.25)' }}>
              <button
                onClick={() => setFilterMyTickets(true)}
                className="px-3 py-1.5 transition-all"
                style={{
                  background: filterMyTickets ? 'white' : 'transparent',
                  color: filterMyTickets ? '#1a1f3c' : 'rgba(255,255,255,0.65)',
                }}
              >
                Mine
              </button>
              <button
                onClick={() => setFilterMyTickets(false)}
                className="px-3 py-1.5 transition-all"
                style={{
                  background: !filterMyTickets ? 'white' : 'transparent',
                  color: !filterMyTickets ? '#1a1f3c' : 'rgba(255,255,255,0.65)',
                }}
              >
                All
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Filter bar — shown in kanban view and sprint ticket view */}
      {(board.type === 'kanban' || activeSprint) && (
        <div className="flex-shrink-0 bg-white border-b border-gray-100 px-4 sm:px-6 py-2 flex items-center gap-2 sm:gap-3 overflow-x-auto">
          {/* Label */}
          <div className="flex items-center gap-1.5 flex-shrink-0 text-xs font-semibold text-gray-400 uppercase tracking-wide">
            <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <polygon points="22 3 2 3 10 12.46 10 19 14 21 14 12.46 22 3"/>
            </svg>
            <span className="hidden sm:inline">Filter</span>
          </div>

          {/* Priority pills */}
          {uniquePriorities.length > 0 && (
            <div className="flex items-center gap-1 flex-shrink-0">
              {uniquePriorities.map((p) => {
                const cfg: Record<string, { label: string; color: string; bg: string; border: string }> = {
                  low:    { label: 'Low',       color: '#6b7280', bg: '#f9fafb', border: '#d1d5db' },
                  medium: { label: 'Medium',    color: '#b45309', bg: '#fffbeb', border: '#fcd34d' },
                  high:   { label: 'High',      color: '#ea580c', bg: '#fff7ed', border: '#fed7aa' },
                  urgent: { label: 'Urgent 🔥', color: '#dc2626', bg: '#fef2f2', border: '#fecaca' },
                };
                const c = cfg[p];
                const active = filterPriority === p;
                return (
                  <button
                    key={p}
                    onClick={() => setFilterPriority(active ? '' : p)}
                    className="text-xs font-semibold px-2 py-0.5 rounded-full transition-all duration-150 flex-shrink-0"
                    style={{
                      color: c.color,
                      background: active ? c.border : c.bg,
                      border: `1px solid ${c.border}`,
                      boxShadow: active ? `0 0 0 2px ${c.border}` : 'none',
                    }}
                  >
                    {c.label}
                  </button>
                );
              })}
            </div>
          )}

          {/* Separator */}
          {uniquePriorities.length > 0 && uniqueTypes.length > 0 && (
            <div className="w-px h-4 bg-gray-200 flex-shrink-0" />
          )}

          {/* Type pills */}
          {uniqueTypes.length > 0 && (
            <div className="flex items-center gap-1 flex-shrink-0">
              {uniqueTypes.map((type) => {
                const typeBg: Record<string, string> = {
                  mobile: '#eff6ff', design: '#fdf2f8', product: '#f5f3ff',
                  backend: '#f3f4f6', frontend: '#f0fdf4',
                };
                const typeColor: Record<string, string> = {
                  mobile: '#2563eb', design: '#db2777', product: '#7c3aed',
                  backend: '#4b5563', frontend: '#16a34a',
                };
                const active = filterType === type;
                return (
                  <button
                    key={type}
                    onClick={() => setFilterType(active ? '' : type)}
                    className="text-xs font-medium px-2 py-0.5 rounded-full transition-all duration-150 capitalize flex-shrink-0"
                    style={{
                      color: typeColor[type] || '#4b5563',
                      background: typeBg[type] || '#f3f4f6',
                      border: `1px solid ${active ? (typeColor[type] || '#4b5563') : 'transparent'}`,
                      boxShadow: active ? `0 0 0 2px ${typeBg[type] || '#f3f4f6'}` : 'none',
                    }}
                  >
                    {type}
                  </button>
                );
              })}
            </div>
          )}

          {/* Separator */}
          {uniqueProjects.length > 0 && (uniquePriorities.length > 0 || uniqueTypes.length > 0) && (
            <div className="w-px h-4 bg-gray-200 flex-shrink-0" />
          )}

          {/* Project select */}
          {uniqueProjects.length > 0 && (
            <select
              value={filterProject}
              onChange={(e) => setFilterProject(e.target.value)}
              className="text-xs font-medium rounded-lg px-2 py-1 flex-shrink-0 outline-none transition-all duration-150"
              style={{
                border: filterProject ? '1px solid #e8390e' : '1px solid #e5e7eb',
                background: filterProject ? '#fff7f5' : 'white',
                color: filterProject ? '#e8390e' : '#6b7280',
              }}
            >
              <option value="">All Projects</option>
              {uniqueProjects.map((p) => <option key={p} value={p}>{p}</option>)}
            </select>
          )}

          {/* Clear filters */}
          {activeFilterCount > 0 && (
            <button
              onClick={() => { setFilterType(''); setFilterProject(''); setFilterPriority(''); }}
              className="ml-auto flex-shrink-0 flex items-center gap-1 text-xs font-semibold px-2.5 py-1 rounded-lg transition-all duration-150"
              style={{ color: '#e8390e', background: '#fff7f5', border: '1px solid #fbd5c8' }}
            >
              <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
                <line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/>
              </svg>
              Clear {activeFilterCount > 1 ? `(${activeFilterCount})` : ''}
            </button>
          )}

          {/* No filterable content placeholder */}
          {uniquePriorities.length === 0 && uniqueTypes.length === 0 && uniqueProjects.length === 0 && (
            <span className="text-xs text-gray-300">No filters available</span>
          )}
        </div>
      )}

      {/* Main content: Direct Kanban (kanban board), Sprint Overview, or Sprint Ticket View */}
      {board.type === 'kanban' ? (
        /* Direct Kanban Board */
        <div className="flex-1 overflow-x-auto pb-4 board-scroll">
          <DndContext sensors={sensors} collisionDetection={closestCenter} onDragStart={handleDragStart} onDragOver={handleDragOver} onDragEnd={handleDragEnd}>
            <div className="flex gap-3 sm:gap-4 h-full px-4 sm:px-6 pt-4 sm:pt-6 pb-6" style={{ minHeight: 'calc(100vh - 120px)' }}>
              {(() => {
                const activeMemberIds = new Set(board.members.map((m) => m.user.id));
                return filteredKanbanColumns.map((col) => (
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
      ) : !activeSprint ? (
        /* Sprint Overview */
        <div className="flex-1 overflow-y-auto px-4 sm:px-6 pt-6 pb-8">
          {/* Header */}
          <div className="flex items-center justify-between mb-6">
            <div>
              <h2 className="text-xl font-bold" style={{ color: '#1a1f3c' }}>Sprints</h2>
              <p className="text-sm text-gray-400 mt-0.5">{board.name}</p>
            </div>
            {isAdmin && (
              <button
                onClick={() => setShowCreateSprint((p) => !p)}
                className="flex items-center gap-1.5 text-sm font-semibold px-3 py-2 rounded-lg border transition-all duration-150"
                style={{ color: '#e8390e', borderColor: '#e8390e', background: 'white' }}
                onMouseEnter={(e) => { e.currentTarget.style.background = '#e8390e'; e.currentTarget.style.color = 'white'; }}
                onMouseLeave={(e) => { e.currentTarget.style.background = 'white'; e.currentTarget.style.color = '#e8390e'; }}
              >
                <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
                  <line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/>
                </svg>
                New Sprint
              </button>
            )}
          </div>


          {/* Sprint status kanban */}
          {sprints.length === 0 && !showCreateSprint ? (
            <div className="flex flex-col items-center justify-center py-24 text-center">
              <div
                className="w-14 h-14 rounded-2xl flex items-center justify-center mb-4"
                style={{ background: '#f0f2f5', border: '1px solid #e5e7eb' }}
              >
                <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="#9ca3af" strokeWidth="1.5">
                  <rect x="3" y="4" width="18" height="18" rx="2" ry="2"/>
                  <line x1="16" y1="2" x2="16" y2="6"/>
                  <line x1="8" y1="2" x2="8" y2="6"/>
                  <line x1="3" y1="10" x2="21" y2="10"/>
                </svg>
              </div>
              <p className="text-sm font-semibold text-gray-500 mb-1">No sprints yet</p>
              <p className="text-xs text-gray-400">
                {isAdmin ? 'Create your first sprint to get started.' : 'An admin needs to create sprints for this board.'}
              </p>
            </div>
          ) : (
            (() => {
              const sprintCols: { key: string; label: string; color: string; bg: string; border: string }[] = [
                { key: 'backlog', label: 'Backlog', color: '#6b7280', bg: '#f9fafb', border: '#e5e7eb' },
                { key: 'active', label: 'Active', color: '#0ea5e9', bg: '#f0f9ff', border: '#bae6fd' },
                { key: 'completed', label: 'Completed', color: '#16a34a', bg: '#f0fdf4', border: '#bbf7d0' },
              ];
              return (
                <div className="flex gap-4 overflow-x-auto pb-2" style={{ minHeight: 200 }}>
                  {sprintCols.map((col) => {
                    const colSprints = sprints.filter((s) => (s.status ?? 'backlog') === col.key);
                    return (
                      <div key={col.key} className="flex-1 min-w-[240px] max-w-sm flex flex-col gap-3">
                        {/* Column header */}
                        <div
                          className="flex items-center gap-2 px-3 py-2 rounded-lg font-semibold text-xs uppercase tracking-wider"
                          style={{ background: col.bg, border: `1px solid ${col.border}`, color: col.color }}
                        >
                          <span
                            className="w-2 h-2 rounded-full flex-shrink-0"
                            style={{ background: col.color }}
                          />
                          {col.label}
                          <span
                            className="ml-auto text-xs font-bold px-1.5 py-0.5 rounded-full"
                            style={{ background: col.border, color: col.color }}
                          >
                            {colSprints.length}
                          </span>
                        </div>

                        {/* Sprint cards */}
                        {colSprints.map((sprint) => (
                          <div
                            key={sprint.id}
                            onClick={() => { setActiveSprint(sprint); setFilterMyTickets(true); }}
                            className="relative bg-white rounded-xl border border-gray-200 p-4 cursor-pointer transition-all duration-150 hover:shadow-md hover:border-gray-300 group"
                          >
                            {/* Admin actions — edit dates + delete */}
                            {isAdmin && (
                              <div className="absolute top-2.5 right-2.5 flex gap-1 opacity-0 group-hover:opacity-100 transition-all">
                                <button
                                  onClick={(e) => { e.stopPropagation(); setEditDatesSprintId(sprint.id); setEditDatesForm({ startDate: sprint.startDate ? sprint.startDate.slice(0, 10) : '', endDate: sprint.endDate ? sprint.endDate.slice(0, 10) : '' }); }}
                                  className="w-6 h-6 flex items-center justify-center rounded-lg text-gray-300 hover:text-blue-500 hover:bg-blue-50 transition-all"
                                  title="Edit dates"
                                >
                                  <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                                    <path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"/>
                                    <path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"/>
                                  </svg>
                                </button>
                                <button
                                  onClick={(e) => { e.stopPropagation(); deleteSprint(sprint.id); }}
                                  disabled={deletingSprintId === sprint.id}
                                  className="w-6 h-6 flex items-center justify-center rounded-lg text-gray-300 hover:text-red-500 hover:bg-red-50 disabled:opacity-50 transition-all"
                                  title="Delete sprint"
                                >
                                  {deletingSprintId === sprint.id ? (
                                    <span className="text-xs">...</span>
                                  ) : (
                                    <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                                      <polyline points="3 6 5 6 21 6"/>
                                      <path d="M19 6l-1 14H6L5 6"/>
                                      <path d="M10 11v6M14 11v6"/>
                                      <path d="M9 6V4h6v2"/>
                                    </svg>
                                  )}
                                </button>
                              </div>
                            )}

                            {/* Title */}
                            <h3 className="text-sm font-bold pr-7 mb-1" style={{ color: '#1a1f3c' }}>{sprint.title}</h3>

                            {/* Date range */}
                            <p className="text-xs text-gray-400 mb-3">
                              {formatDate(sprint.startDate)} &rarr; {formatDate(sprint.endDate)}
                            </p>

                            {/* Stats */}
                            <div className="flex items-center gap-2 mb-3">
                              <span
                                className="inline-flex items-center gap-1 text-xs font-semibold px-2 py-0.5 rounded-full"
                                style={{ background: '#fff7f5', color: '#e8390e', border: '1px solid #fbd5c8' }}
                              >
                                {sprint._count.tickets} {sprint._count.tickets === 1 ? 'ticket' : 'tickets'}
                              </span>
                              <span
                                className="inline-flex items-center gap-1 text-xs font-medium px-2 py-0.5 rounded-full"
                                style={{ background: '#f3f4f6', color: '#6b7280', border: '1px solid #e5e7eb' }}
                              >
                                {sprint._count.members} {sprint._count.members === 1 ? 'member' : 'members'}
                              </span>
                            </div>

                            {/* Move buttons — admin only */}
                            {isAdmin && (
                              <div className="flex gap-1.5 flex-wrap" onClick={(e) => e.stopPropagation()}>
                                {col.key === 'backlog' && (
                                  <button
                                    onClick={() => moveSprint(sprint.id, 'active')}
                                    className="text-xs font-semibold px-2.5 py-1 rounded-lg transition-all"
                                    style={{ background: '#f0f9ff', color: '#0ea5e9', border: '1px solid #bae6fd' }}
                                    onMouseEnter={(e) => { e.currentTarget.style.background = '#0ea5e9'; e.currentTarget.style.color = 'white'; }}
                                    onMouseLeave={(e) => { e.currentTarget.style.background = '#f0f9ff'; e.currentTarget.style.color = '#0ea5e9'; }}
                                  >
                                    Start &rarr;
                                  </button>
                                )}
                                {col.key === 'active' && (
                                  <>
                                    <button
                                      onClick={() => moveSprint(sprint.id, 'backlog')}
                                      className="text-xs font-semibold px-2.5 py-1 rounded-lg transition-all"
                                      style={{ background: '#f9fafb', color: '#6b7280', border: '1px solid #e5e7eb' }}
                                      onMouseEnter={(e) => { e.currentTarget.style.background = '#6b7280'; e.currentTarget.style.color = 'white'; }}
                                      onMouseLeave={(e) => { e.currentTarget.style.background = '#f9fafb'; e.currentTarget.style.color = '#6b7280'; }}
                                    >
                                      &larr; Reset
                                    </button>
                                    <button
                                      onClick={() => moveSprint(sprint.id, 'completed')}
                                      className="text-xs font-semibold px-2.5 py-1 rounded-lg transition-all"
                                      style={{ background: '#f0fdf4', color: '#16a34a', border: '1px solid #bbf7d0' }}
                                      onMouseEnter={(e) => { e.currentTarget.style.background = '#16a34a'; e.currentTarget.style.color = 'white'; }}
                                      onMouseLeave={(e) => { e.currentTarget.style.background = '#f0fdf4'; e.currentTarget.style.color = '#16a34a'; }}
                                    >
                                      Complete ✓
                                    </button>
                                  </>
                                )}
                                {col.key === 'completed' && (
                                  <button
                                    onClick={() => moveSprint(sprint.id, 'active')}
                                    className="text-xs font-semibold px-2.5 py-1 rounded-lg transition-all"
                                    style={{ background: '#f0f9ff', color: '#0ea5e9', border: '1px solid #bae6fd' }}
                                    onMouseEnter={(e) => { e.currentTarget.style.background = '#0ea5e9'; e.currentTarget.style.color = 'white'; }}
                                    onMouseLeave={(e) => { e.currentTarget.style.background = '#f0f9ff'; e.currentTarget.style.color = '#0ea5e9'; }}
                                  >
                                    &larr; Reopen
                                  </button>
                                )}
                              </div>
                            )}
                          </div>
                        ))}

                        {colSprints.length === 0 && (
                          <div
                            className="rounded-xl border border-dashed p-6 text-center text-xs text-gray-400"
                            style={{ borderColor: col.border }}
                          >
                            No {col.label.toLowerCase()} sprints
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>
              );
            })()
          )}
        </div>
      ) : (
        /* Sprint Ticket View (filtered kanban — sprint boards only) */
        <div className="flex-1 overflow-x-auto pb-4 board-scroll">
          <DndContext
            sensors={sensors}
            collisionDetection={closestCenter}
            onDragStart={handleDragStart}
            onDragEnd={handleDragEnd}
          >
            <div className="flex gap-3 sm:gap-4 h-full px-4 sm:px-6 pt-4 sm:pt-6 pb-6" style={{ minHeight: 'calc(100vh - 160px)' }}>
              {(() => {
                const activeMemberIds = new Set(board.members.map((m) => m.user.id));
                return visibleColumns.map((col) => (
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
      )}

      {/* Modals */}
      {selectedTicket && (
        <TicketModal
          ticket={selectedTicket}
          boardId={boardId}
          board={board}
          currentUser={currentUser!}
          sprints={sprints}
          isAdmin={isAdmin}
          boardType={board.type}
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
          sprintId={activeSprint?.id}
          boardType={board.type}
        />
      )}

      {/* Edit Sprint Dates Modal */}
      {editDatesSprintId && isAdmin && (
        <div className="fixed inset-0 bg-black/40 flex items-end sm:items-center justify-center z-50" onClick={() => setEditDatesSprintId(null)}>
          <div className="bg-white w-full sm:max-w-sm rounded-t-2xl sm:rounded-xl shadow-xl p-6" onClick={(e) => e.stopPropagation()}>
            <div className="flex items-center justify-between mb-5">
              <h3 className="font-semibold text-base" style={{ color: '#1a1f3c' }}>Edit Sprint Dates</h3>
              <button onClick={() => setEditDatesSprintId(null)} className="text-gray-400 text-xl w-8 h-8 flex items-center justify-center">×</button>
            </div>
            <form onSubmit={updateSprintDates} className="space-y-4">
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-semibold text-gray-500 mb-1.5">Start Date</label>
                  <input
                    type="date"
                    value={editDatesForm.startDate}
                    onChange={(e) => setEditDatesForm({ ...editDatesForm, startDate: e.target.value })}
                    className="w-full px-3 py-2.5 text-sm rounded-lg border border-gray-200 outline-none"
                    style={{ color: '#111827' }}
                    onFocus={(e) => { e.currentTarget.style.borderColor = '#e8390e'; e.currentTarget.style.boxShadow = '0 0 0 3px rgba(232,57,14,0.1)'; }}
                    onBlur={(e) => { e.currentTarget.style.borderColor = '#e5e7eb'; e.currentTarget.style.boxShadow = 'none'; }}
                  />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-gray-500 mb-1.5">End Date</label>
                  <input
                    type="date"
                    value={editDatesForm.endDate}
                    onChange={(e) => setEditDatesForm({ ...editDatesForm, endDate: e.target.value })}
                    className="w-full px-3 py-2.5 text-sm rounded-lg border border-gray-200 outline-none"
                    style={{ color: '#111827' }}
                    onFocus={(e) => { e.currentTarget.style.borderColor = '#e8390e'; e.currentTarget.style.boxShadow = '0 0 0 3px rgba(232,57,14,0.1)'; }}
                    onBlur={(e) => { e.currentTarget.style.borderColor = '#e5e7eb'; e.currentTarget.style.boxShadow = 'none'; }}
                  />
                </div>
              </div>
              <div className="flex gap-2 pt-1">
                <button type="button" onClick={() => setEditDatesSprintId(null)} className="flex-1 py-2.5 min-h-[44px] rounded-lg text-sm font-medium text-gray-600 border border-gray-200">Cancel</button>
                <button
                  type="submit"
                  disabled={updatingDates}
                  className="flex-1 py-2.5 min-h-[44px] rounded-lg text-sm font-bold text-white disabled:opacity-50"
                  style={{ background: '#e8390e' }}
                >
                  {updatingDates ? 'Saving...' : 'Save Dates'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Create Sprint Modal */}
      {showCreateSprint && isAdmin && (
        <div className="fixed inset-0 bg-black/40 flex items-end sm:items-center justify-center z-50" onClick={() => { setShowCreateSprint(false); setSprintForm({ title: '', startDate: '', endDate: '' }); }}>
          <div className="bg-white w-full sm:max-w-sm rounded-t-2xl sm:rounded-xl shadow-xl p-6" onClick={(e) => e.stopPropagation()}>
            <div className="flex items-center justify-between mb-5">
              <h3 className="font-semibold text-base" style={{ color: '#1a1f3c' }}>New Sprint</h3>
              <button onClick={() => { setShowCreateSprint(false); setSprintForm({ title: '', startDate: '', endDate: '' }); }} className="text-gray-400 text-xl w-8 h-8 flex items-center justify-center">×</button>
            </div>
            <form onSubmit={createSprint} className="space-y-4">
              <div>
                <label className="block text-xs font-semibold text-gray-500 mb-1.5">Sprint Title <span className="text-red-500">*</span></label>
                <input
                  autoFocus
                  type="text"
                  value={sprintForm.title}
                  onChange={(e) => setSprintForm({ ...sprintForm, title: e.target.value })}
                  placeholder="e.g. Sprint 1"
                  className="w-full px-3 py-2.5 text-sm rounded-lg border border-gray-200 outline-none"
                  style={{ color: '#111827' }}
                  onFocus={(e) => { e.currentTarget.style.borderColor = '#e8390e'; e.currentTarget.style.boxShadow = '0 0 0 3px rgba(232,57,14,0.1)'; }}
                  onBlur={(e) => { e.currentTarget.style.borderColor = '#e5e7eb'; e.currentTarget.style.boxShadow = 'none'; }}
                />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-semibold text-gray-500 mb-1.5">Start Date</label>
                  <input
                    type="date"
                    value={sprintForm.startDate}
                    onChange={(e) => setSprintForm({ ...sprintForm, startDate: e.target.value })}
                    className="w-full px-3 py-2.5 text-sm rounded-lg border border-gray-200 outline-none"
                    style={{ color: '#111827' }}
                    onFocus={(e) => { e.currentTarget.style.borderColor = '#e8390e'; e.currentTarget.style.boxShadow = '0 0 0 3px rgba(232,57,14,0.1)'; }}
                    onBlur={(e) => { e.currentTarget.style.borderColor = '#e5e7eb'; e.currentTarget.style.boxShadow = 'none'; }}
                  />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-gray-500 mb-1.5">End Date</label>
                  <input
                    type="date"
                    value={sprintForm.endDate}
                    onChange={(e) => setSprintForm({ ...sprintForm, endDate: e.target.value })}
                    className="w-full px-3 py-2.5 text-sm rounded-lg border border-gray-200 outline-none"
                    style={{ color: '#111827' }}
                    onFocus={(e) => { e.currentTarget.style.borderColor = '#e8390e'; e.currentTarget.style.boxShadow = '0 0 0 3px rgba(232,57,14,0.1)'; }}
                    onBlur={(e) => { e.currentTarget.style.borderColor = '#e5e7eb'; e.currentTarget.style.boxShadow = 'none'; }}
                  />
                </div>
              </div>
              <div className="flex gap-2 pt-1">
                <button type="button" onClick={() => { setShowCreateSprint(false); setSprintForm({ title: '', startDate: '', endDate: '' }); }} className="flex-1 py-2.5 min-h-[44px] rounded-lg text-sm font-medium text-gray-600 border border-gray-200">Cancel</button>
                <button
                  type="submit"
                  disabled={creatingSprintLoading || !sprintForm.title}
                  className="flex-1 py-2.5 min-h-[44px] rounded-lg text-sm font-bold text-white disabled:opacity-50"
                  style={{ background: '#e8390e' }}
                >
                  {creatingSprintLoading ? 'Creating...' : 'Create Sprint'}
                </button>
              </div>
            </form>
          </div>
        </div>
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
