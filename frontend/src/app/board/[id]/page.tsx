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
      const { data: sprintData } = await api.get(`/boards/${boardId}/sprints`);
      setSprints(sprintData);
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

  const createSprint = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!sprintForm.title || !sprintForm.startDate || !sprintForm.endDate) return;
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

  const formatDate = (dateStr: string) => {
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

  const sprintColumns = activeSprint
    ? board.columns.map((col) => ({
        ...col,
        tickets: col.tickets.filter((t) => t.sprintId === activeSprint.id),
      }))
    : board.columns;

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
      {activeSprint && (
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
          <div className="ml-auto flex items-center gap-3">
            <span className="text-xs font-medium px-2 py-0.5 rounded-full" style={{ background: 'rgba(232,57,14,0.2)', color: '#e8390e' }}>
              {activeSprint._count.tickets} tickets
            </span>
            <span className="text-xs font-medium px-2 py-0.5 rounded-full" style={{ background: 'rgba(255,255,255,0.1)', color: 'rgba(255,255,255,0.7)' }}>
              {activeSprint._count.members} members
            </span>
          </div>
        </div>
      )}

      {/* Main content: Sprint Overview or Kanban */}
      {!activeSprint ? (
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

          {/* Create Sprint form */}
          {showCreateSprint && isAdmin && (
            <div className="mb-6 bg-white rounded-xl border border-gray-200 p-5 shadow-sm">
              <h3 className="text-sm font-bold mb-4" style={{ color: '#1a1f3c' }}>Create New Sprint</h3>
              <form onSubmit={createSprint} className="space-y-3">
                <div>
                  <label className="block text-xs font-semibold text-gray-500 mb-1.5">Sprint Title <span className="text-red-500">*</span></label>
                  <input
                    autoFocus
                    type="text"
                    value={sprintForm.title}
                    onChange={(e) => setSprintForm({ ...sprintForm, title: e.target.value })}
                    placeholder="e.g. Sprint 1"
                    className="w-full px-3 py-2.5 text-sm rounded-lg border border-gray-200 outline-none transition-all"
                    style={{ color: '#111827' }}
                    onFocus={(e) => { e.currentTarget.style.borderColor = '#e8390e'; e.currentTarget.style.boxShadow = '0 0 0 3px rgba(232,57,14,0.1)'; }}
                    onBlur={(e) => { e.currentTarget.style.borderColor = '#e5e7eb'; e.currentTarget.style.boxShadow = 'none'; }}
                  />
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="block text-xs font-semibold text-gray-500 mb-1.5">Start Date <span className="text-red-500">*</span></label>
                    <input
                      type="date"
                      value={sprintForm.startDate}
                      onChange={(e) => setSprintForm({ ...sprintForm, startDate: e.target.value })}
                      className="w-full px-3 py-2.5 text-sm rounded-lg border border-gray-200 outline-none transition-all"
                      style={{ color: '#111827' }}
                      onFocus={(e) => { e.currentTarget.style.borderColor = '#e8390e'; e.currentTarget.style.boxShadow = '0 0 0 3px rgba(232,57,14,0.1)'; }}
                      onBlur={(e) => { e.currentTarget.style.borderColor = '#e5e7eb'; e.currentTarget.style.boxShadow = 'none'; }}
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-semibold text-gray-500 mb-1.5">End Date <span className="text-red-500">*</span></label>
                    <input
                      type="date"
                      value={sprintForm.endDate}
                      onChange={(e) => setSprintForm({ ...sprintForm, endDate: e.target.value })}
                      className="w-full px-3 py-2.5 text-sm rounded-lg border border-gray-200 outline-none transition-all"
                      style={{ color: '#111827' }}
                      onFocus={(e) => { e.currentTarget.style.borderColor = '#e8390e'; e.currentTarget.style.boxShadow = '0 0 0 3px rgba(232,57,14,0.1)'; }}
                      onBlur={(e) => { e.currentTarget.style.borderColor = '#e5e7eb'; e.currentTarget.style.boxShadow = 'none'; }}
                    />
                  </div>
                </div>
                <div className="flex justify-end gap-2 pt-1">
                  <button
                    type="button"
                    onClick={() => { setShowCreateSprint(false); setSprintForm({ title: '', startDate: '', endDate: '' }); }}
                    className="px-4 py-2 text-sm font-medium text-gray-600 border border-gray-200 rounded-lg bg-white hover:border-gray-300 transition-all"
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    disabled={creatingSprintLoading || !sprintForm.title || !sprintForm.startDate || !sprintForm.endDate}
                    className="px-4 py-2 text-sm font-bold text-white rounded-lg transition-all disabled:opacity-50"
                    style={{ background: '#e8390e' }}
                    onMouseEnter={(e) => { if (!creatingSprintLoading) e.currentTarget.style.background = '#c73009'; }}
                    onMouseLeave={(e) => { e.currentTarget.style.background = '#e8390e'; }}
                  >
                    {creatingSprintLoading ? 'Creating...' : 'Create Sprint'}
                  </button>
                </div>
              </form>
            </div>
          )}

          {/* Sprint grid */}
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
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
              {sprints.map((sprint) => (
                <div
                  key={sprint.id}
                  onClick={() => setActiveSprint(sprint)}
                  className="relative bg-white rounded-xl border border-gray-200 p-5 cursor-pointer transition-all duration-150 hover:shadow-md hover:border-gray-300 group"
                >
                  {/* Delete button — admin only */}
                  {isAdmin && (
                    <button
                      onClick={(e) => { e.stopPropagation(); deleteSprint(sprint.id); }}
                      disabled={deletingSprintId === sprint.id}
                      className="absolute top-3 right-3 w-7 h-7 flex items-center justify-center rounded-lg text-gray-300 opacity-0 group-hover:opacity-100 transition-all hover:text-red-500 hover:bg-red-50 disabled:opacity-50"
                      title="Delete sprint"
                    >
                      {deletingSprintId === sprint.id ? (
                        <span className="text-xs">...</span>
                      ) : (
                        <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                          <polyline points="3 6 5 6 21 6"/>
                          <path d="M19 6l-1 14H6L5 6"/>
                          <path d="M10 11v6M14 11v6"/>
                          <path d="M9 6V4h6v2"/>
                        </svg>
                      )}
                    </button>
                  )}

                  {/* Sprint title */}
                  <h3 className="text-base font-bold pr-8 mb-2" style={{ color: '#1a1f3c' }}>{sprint.title}</h3>

                  {/* Date range */}
                  <p className="text-xs text-gray-400 mb-4">
                    {formatDate(sprint.startDate)} &rarr; {formatDate(sprint.endDate)}
                  </p>

                  {/* Stats */}
                  <div className="flex items-center gap-3">
                    <span
                      className="inline-flex items-center gap-1 text-xs font-semibold px-2.5 py-1 rounded-full"
                      style={{ background: '#fff7f5', color: '#e8390e', border: '1px solid #fbd5c8' }}
                    >
                      <svg width="10" height="10" viewBox="0 0 24 24" fill="currentColor">
                        <path d="M19 3H5c-1.1 0-2 .9-2 2v14c0 1.1.9 2 2 2h14c1.1 0 2-.9 2-2V5c0-1.1-.9-2-2-2zm-7 3c1.93 0 3.5 1.57 3.5 3.5S13.93 13 12 13s-3.5-1.57-3.5-3.5S10.07 6 12 6zm7 13H5v-.23c0-.62.28-1.2.76-1.58C7.47 15.82 9.64 15 12 15s4.53.82 6.24 2.19c.48.38.76.97.76 1.58V19z"/>
                      </svg>
                      {sprint._count.tickets} {sprint._count.tickets === 1 ? 'ticket' : 'tickets'}
                    </span>
                    <span
                      className="inline-flex items-center gap-1 text-xs font-medium px-2.5 py-1 rounded-full"
                      style={{ background: '#f3f4f6', color: '#6b7280', border: '1px solid #e5e7eb' }}
                    >
                      <svg width="10" height="10" viewBox="0 0 24 24" fill="currentColor">
                        <path d="M16 11c1.66 0 2.99-1.34 2.99-3S17.66 5 16 5c-1.66 0-3 1.34-3 3s1.34 3 3 3zm-8 0c1.66 0 2.99-1.34 2.99-3S9.66 5 8 5C6.34 5 5 6.34 5 8s1.34 3 3 3zm0 2c-2.33 0-7 1.17-7 3.5V19h14v-2.5c0-2.33-4.67-3.5-7-3.5zm8 0c-.29 0-.62.02-.97.05 1.16.84 1.97 1.97 1.97 3.45V19h6v-2.5c0-2.33-4.67-3.5-7-3.5z"/>
                      </svg>
                      {sprint._count.members} {sprint._count.members === 1 ? 'member' : 'members'}
                    </span>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      ) : (
        /* Sprint Ticket View (filtered kanban) */
        <div className="flex-1 overflow-x-auto pb-4 board-scroll">
          <DndContext
            sensors={sensors}
            collisionDetection={closestCorners}
            onDragStart={handleDragStart}
            onDragEnd={handleDragEnd}
          >
            <div className="flex gap-3 sm:gap-4 h-full px-4 sm:px-6 pt-4 sm:pt-6 pb-6" style={{ minHeight: 'calc(100vh - 160px)' }}>
              {(() => {
                const activeMemberIds = new Set(board.members.map((m) => m.user.id));
                return sprintColumns.map((col) => (
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
