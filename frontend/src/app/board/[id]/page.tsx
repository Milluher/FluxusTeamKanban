'use client';
import { useEffect, useState, useCallback, useRef } from 'react';
import { useRouter, useParams, useSearchParams } from 'next/navigation';
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
  closestCenter,
  pointerWithin,
  rectIntersection,
  getFirstCollision,
  UniqueIdentifier,
} from '@dnd-kit/core';
import { arrayMove } from '@dnd-kit/sortable';
import api from '@/lib/api';
import socket from '@/lib/socket';
import { Board, Ticket, User, Sprint } from '@/types';
import { formatSprintDates } from '@/lib/formatDate';
import { descriptionText } from '@/lib/richText';
import KanbanColumn from '@/components/KanbanColumn';
import TicketCard from '@/components/TicketCard';
import TicketModal from '@/components/TicketModal';
import CreateTicketModal from '@/components/CreateTicketModal';
import InviteMemberModal from '@/components/InviteMemberModal';
import PresenceTracker, { PresentUser } from '@/components/PresenceTracker';
import BoardInfo from '@/components/BoardInfo';
import AppHeader from '@/components/AppHeader';
import BoardToolbar from '@/components/BoardToolbar';
import Avatar from '@/components/Avatar';
import LastLogin from '@/components/LastLogin';

export default function BoardPage() {
  const params = useParams();
  const boardId = params.id as string;
  const router = useRouter();
  const [presentUsers, setPresentUsers] = useState<PresentUser[]>([]);
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
  const boardRef = useRef<Board | null>(null);
  // Tracks the column a ticket was dragged into — set in handleDragOver, read in handleDragEnd
  const dragTargetColRef = useRef<string | null>(null);

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
  // Defaults to All: opening on Mine made a full sprint look empty to anyone
  // with nothing assigned. The last choice is restored per user per board below.
  const [filterMyTickets, setFilterMyTickets] = useState(false);
  const [mentionedTicketIds, setMentionedTicketIds] = useState<Set<string>>(new Set());

  // Board filter state (type, project, priority)
  const [filterType, setFilterType] = useState('');
  const [filterProject, setFilterProject] = useState('');
  const [filterPriority, setFilterPriority] = useState('');
  const [filterEpic, setFilterEpic] = useState('');
  const [filterFlow, setFilterFlow] = useState('');
  const [search, setSearch] = useState('');

  useInactivityTimeout();
  // Keep boardRef always pointing at latest board so drag handlers can read current state
  useEffect(() => { boardRef.current = board; }, [board]);

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 8 } }),
  );

  // Multi-container collision detection: prefer pointer-within (accurate column detection),
  // fall back to rect intersection, then closest center.
  const collisionDetection = useCallback((args: Parameters<typeof closestCenter>[0]) => {
    const pointerHits = pointerWithin(args);
    if (pointerHits.length > 0) {
      const firstHit = getFirstCollision(pointerHits, 'id');
      if (firstHit != null) return pointerHits;
    }
    const rectHits = rectIntersection(args);
    if (rectHits.length > 0) return rectHits;
    return closestCenter(args);
  }, []);

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

    socket.on('presence-update', ({ boardId: id, users }: { boardId: string; users: PresentUser[] }) => {
      if (id === boardId) setPresentUsers(users);
    });

    // Report whether this tab is in the foreground, so the tracker can tell
    // "working right now" from "left the board open in a background tab".
    const reportActivity = () => {
      socket.emit('board-activity', { boardId, idle: document.visibilityState === 'hidden' });
    };
    document.addEventListener('visibilitychange', reportActivity);
    reportActivity();

    socket.on('member-removed', ({ userId }: { userId: string }) => {
      if (userId === currentUser?.id) { router.push('/dashboard'); return; }
      setBoard((prev) => prev ? { ...prev, members: prev.members.filter((m) => m.user.id !== userId) } : prev);
    });

    return () => {
      document.removeEventListener('visibilitychange', reportActivity);
      socket.off('presence-update');
      setPresentUsers([]);
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
    dragTargetColRef.current = null;
  };

  // Live update during drag — moves ticket between columns as cursor crosses boundaries.
  // All state reads happen inside setBoard's functional updater (receives latest prev, no stale closure).
  const handleDragOver = (event: DragOverEvent) => {
    const { active, over } = event;
    if (!over) return;

    const ticketId = active.id as string;
    const overId = over.id as string;
    if (ticketId === overId) return;

    setBoard((prev) => {
      if (!prev) return prev;

      // Find dragged ticket and its source column in the latest state
      let ticket: Ticket | undefined;
      let sourceColId: string | undefined;
      for (const col of prev.columns) {
        const t = col.tickets.find((t) => t.id === ticketId);
        if (t) { ticket = t; sourceColId = col.id; break; }
      }
      if (!ticket || !sourceColId) return prev;

      // Resolve target column from the latest state
      let targetColId: string | undefined;
      if (prev.columns.some((c) => c.id === overId)) {
        targetColId = overId;
      } else {
        for (const col of prev.columns) {
          if (col.tickets.some((t) => t.id === overId)) { targetColId = col.id; break; }
        }
      }
      if (!targetColId || sourceColId === targetColId) return prev;

      // Track where the ticket landed so handleDragEnd can persist it reliably
      dragTargetColRef.current = targetColId;

      // Find insert position (when hovering over a specific ticket)
      const overTicketIdx = prev.columns
        .find((c) => c.id === targetColId)
        ?.tickets.findIndex((t) => t.id === overId) ?? -1;

      return {
        ...prev,
        columns: prev.columns.map((col) => {
          if (col.id === sourceColId) {
            return { ...col, tickets: col.tickets.filter((t) => t.id !== ticketId) };
          }
          if (col.id === targetColId) {
            const updated = [...col.tickets];
            const insertIdx = overTicketIdx >= 0 ? overTicketIdx : updated.length;
            updated.splice(insertIdx, 0, { ...ticket!, columnId: targetColId });
            return { ...col, tickets: updated };
          }
          return col;
        }),
      };
    });
  };

  const handleDragEnd = async (event: DragEndEvent) => {
    const originalTicket = activeTicket; // snapshot at drag start
    setActiveTicket(null);

    const { active, over } = event;
    const ticketId = active.id as string;
    const crossColTarget = dragTargetColRef.current;
    dragTargetColRef.current = null;

    if (!over || !originalTicket) {
      if (!over && !crossColTarget) loadBoard();
      return;
    }

    if (crossColTarget && crossColTarget !== originalTicket.columnId) {
      // Cross-column: handleDragOver already updated board state, just persist to server
      try {
        await api.patch(`/tickets/${ticketId}/move`, { columnId: crossColTarget, boardId });
      } catch { loadBoard(); }
      return;
    }

    // Same-column reorder
    const overId = over.id as string;
    if (ticketId === overId) return;

    const currentBoard = boardRef.current;
    if (!currentBoard) return;
    const col = currentBoard.columns.find((c) => c.id === originalTicket.columnId);
    if (!col) return;

    const oldIndex = col.tickets.findIndex((t) => t.id === ticketId);
    const newIndex = col.tickets.findIndex((t) => t.id === overId);
    if (oldIndex === -1 || newIndex === -1 || oldIndex === newIndex) return;

    const reordered = arrayMove(col.tickets, oldIndex, newIndex);
    const colId = col.id;
    setBoard((prev) => {
      if (!prev) return prev;
      return {
        ...prev,
        columns: prev.columns.map((c) => c.id === colId ? { ...c, tickets: reordered } : c),
      };
    });
    try {
      await api.patch('/tickets/reorder', { columnId: colId, boardId, ticketIds: reordered.map((t) => t.id) });
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

  // Mine/All is remembered per user per board. localStorage keeps it out of the
  // schema; a missing or unreadable value just leaves the All default in place.
  const filterStorageKey = currentUser ? `fluxus:boardFilter:${currentUser.id}:${boardId}` : null;

  useEffect(() => {
    if (!filterStorageKey) return;
    try {
      const saved = localStorage.getItem(filterStorageKey);
      if (saved === 'mine' || saved === 'all') setFilterMyTickets(saved === 'mine');
    } catch {
      // Storage can be blocked (private browsing); the default stands.
    }
  }, [filterStorageKey]);

  const chooseFilter = (mine: boolean) => {
    setFilterMyTickets(mine);
    if (!filterStorageKey) return;
    try {
      localStorage.setItem(filterStorageKey, mine ? 'mine' : 'all');
    } catch {
      // Not persisting is acceptable; the session still reflects the choice.
    }
  };

  // Opens the existing edit-dates dialog, prefilled. Shared by the pencil icon
  // on a sprint card and the "Set dates" links that replaced the "— → —" placeholder.
  const openDateEditor = (sprint: Sprint) => {
    setEditDatesSprintId(sprint.id);
    setEditDatesForm({
      startDate: sprint.startDate ? sprint.startDate.slice(0, 10) : '',
      endDate: sprint.endDate ? sprint.endDate.slice(0, 10) : '',
    });
  };

  if (loading) return (
    <div className="min-h-screen flex items-center justify-center bg-[#f7f8fa]">
      <div className="flex flex-col items-center gap-3">
        <div
          className="w-8 h-8 rounded-lg animate-pulse"
          style={{ background: '#1a1f3c' }}
        />
        <p className="text-sm text-gray-500">Loading board...</p>
      </div>
    </div>
  );

  if (!board) return null;

  const isAdmin = currentUser?.role === 'admin' || board.members.find(m => m.user.id === currentUser?.id)?.role === 'admin';

  // Unique filter options derived from all board tickets
  const allBoardTickets = board.columns.flatMap((c) => c.tickets);
  const uniqueTypes = [...new Set(allBoardTickets.map((t) => t.type).filter((v): v is string => !!v))].sort();
  const uniqueProjects = [...new Set(allBoardTickets.map((t) => t.project).filter((v): v is string => !!v))].sort();
  const uniqueEpics = [...new Set(allBoardTickets.map((t) => t.epic).filter((v): v is string => !!v))].sort();
  const uniqueFlows = [...new Set(allBoardTickets.map((t) => t.flow).filter((v): v is string => !!v))].sort();
  const priorityOrder = ['low', 'medium', 'high', 'urgent'];
  const uniquePriorities = priorityOrder.filter((p) => allBoardTickets.some((t) => t.priority === p));
  const activeFilterCount = [filterType, filterProject, filterPriority, filterEpic, filterFlow, search.trim()].filter(Boolean).length;

  // Search looks at the title and the text behind the description's HTML, so
  // checklist items are findable even though cards only show a tally.
  const searchQuery = search.trim().toLowerCase();
  const matchesSearch = (t: Ticket) =>
    !searchQuery ||
    t.title.toLowerCase().includes(searchQuery) ||
    descriptionText(t.description).toLowerCase().includes(searchQuery);

  const applyTicketFilters = (tickets: Ticket[]) =>
    tickets.filter((t) =>
      (!filterType || t.type === filterType) &&
      (!filterProject || t.project === filterProject) &&
      (!filterPriority || t.priority === filterPriority) &&
      (!filterEpic || t.epic === filterEpic) &&
      (!filterFlow || t.flow === filterFlow) &&
      matchesSearch(t)
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

  // Kanban board defaults to the user's own work (tickets they're assigned to or created).
  // The "Mine / All" toggle in the filter bar flips filterMyTickets to reveal every ticket.
  const filteredKanbanColumns = board.columns.map((col) => ({
    ...col,
    tickets: applyTicketFilters(
      filterMyTickets
        ? col.tickets.filter(
            (t) => t.assigneeId === currentUser?.id || t.createdById === currentUser?.id
          )
        : col.tickets
    ),
  }));

  // Counts behind the Mine/All toggle, and the "everything is hidden" case.
  // Sprint view counts mentions as yours; kanban counts what you created.
  const countTickets = (cols: { tickets: Ticket[] }[]) =>
    cols.reduce((n, col) => n + col.tickets.length, 0);

  const isMyTicket = (t: Ticket) =>
    activeSprint
      ? t.assigneeId === currentUser?.id || mentionedTicketIds.has(t.id)
      : t.assigneeId === currentUser?.id || t.createdById === currentUser?.id;

  const scopeColumns = activeSprint ? sprintColumns : board.columns;
  const scopeTotal = countTickets(scopeColumns);
  const allCount = countTickets(scopeColumns.map((c) => ({ tickets: applyTicketFilters(c.tickets) })));
  const mineCount = countTickets(
    scopeColumns.map((c) => ({ tickets: applyTicketFilters(c.tickets.filter(isMyTicket)) }))
  );
  const visibleCount = countTickets(activeSprint ? visibleColumns : filteredKanbanColumns);

  // One click back to everything: drop the Mine filter and any attribute filters.
  const clearFilters = () => {
    setFilterType('');
    setFilterProject('');
    setFilterPriority('');
    setFilterEpic('');
    setFilterFlow('');
    setSearch('');
  };

  // One click back to everything: drop the Mine filter and every other filter.
  const showEverything = () => {
    chooseFilter(false);
    clearFilters();
  };

  const toolbar = (
    <BoardToolbar
      mine={filterMyTickets}
      onMineChange={chooseFilter}
      counts={{ mine: mineCount, all: allCount }}
      filters={{ search, type: filterType, project: filterProject, epic: filterEpic, flow: filterFlow, priority: filterPriority }}
      onFilterChange={(patch) => {
        if (patch.search !== undefined) setSearch(patch.search);
        if (patch.type !== undefined) setFilterType(patch.type);
        if (patch.project !== undefined) setFilterProject(patch.project);
        if (patch.epic !== undefined) setFilterEpic(patch.epic);
        if (patch.flow !== undefined) setFilterFlow(patch.flow);
        if (patch.priority !== undefined) setFilterPriority(patch.priority);
      }}
      options={{ types: uniqueTypes, projects: uniqueProjects, epics: uniqueEpics, flows: uniqueFlows, priorities: uniquePriorities }}
      activeFilterCount={activeFilterCount}
      onClearFilters={clearFilters}
      onNewTicket={() => { setCreateColumnId(board.columns[0]?.id ?? ''); setShowCreateModal(true); }}
    />
  );

  // Empty columns are ambiguous — a filter hiding every ticket looks identical to
  // a board with no tickets. Say which it is.
  const filterNotice =
    visibleCount === 0 && scopeTotal > 0 ? (
      <div className="mx-4 sm:mx-6 mt-4 sm:mt-6 flex flex-wrap items-center gap-x-3 gap-y-2 rounded-xl border border-gray-200 bg-white px-4 py-3">
        <span className="text-sm text-gray-600">
          {filterMyTickets && mineCount === 0
            ? `0 of ${allCount} ${allCount === 1 ? 'ticket is' : 'tickets are'} yours`
            : 'No tickets match the current filters'}
        </span>
        <button
          onClick={showEverything}
          className="text-xs font-semibold px-2.5 py-1 rounded-lg transition-all duration-150"
          style={{ color: '#c73009', background: '#fff7f5', border: '1px solid #fbd5c8' }}
        >
          Show all
        </button>
      </div>
    ) : null;

  return (
    <div className="min-h-screen flex flex-col bg-[#f0f2f5]">
      {/* Shared global header; the board name and board-only controls are passed in. */}
      <AppHeader
        user={currentUser}
        breadcrumb={
          <h1 className="font-semibold text-sm truncate max-w-[120px] sm:max-w-none" style={{ color: '#1a1f3c' }}>
            {board.name}
          </h1>
        }
        actions={
          <>
            <PresenceTracker users={presentUsers} currentUserId={currentUser?.id} />
              {/* Member avatars — clickable to show member list */}
              <div className="relative" ref={membersPanelRef}>
                <button
                  onClick={() => setShowMembersPanel((p) => !p)}
                  className="flex -space-x-1.5 cursor-pointer"
                  aria-label="View board members"
                  title="View members"
                >
                  {board.members.slice(0, 3).map((m) => (
                    <Avatar
                      key={m.id}
                      name={m.user.name}
                      className="w-7 h-7 text-[10px] ring-2 ring-white sm:hidden"
                    />
                  ))}
                  {board.members.slice(0, 5).map((m) => (
                    <Avatar
                      key={`d-${m.id}`}
                      name={m.user.name}
                      className="w-7 h-7 text-[10px] ring-2 ring-white hidden sm:inline-flex"
                    />
                  ))}
                </button>

                {showMembersPanel && (
                  <div className="absolute right-0 top-full mt-2 bg-white border border-gray-200 rounded-xl shadow-lg z-20 min-w-[220px] py-2">
                    <p className="text-xs font-semibold text-gray-500 uppercase tracking-wider px-4 pt-1 pb-2">
                      {board.members.length} {board.members.length === 1 ? 'Member' : 'Members'}
                    </p>
                    {board.members.map((m) => {
                      const isCurrentUserBoardAdmin = board.members.find(bm => bm.user.id === currentUser?.id)?.role === 'admin';
                      return (
                        <div key={m.id} className="flex items-center gap-3 px-4 py-2 hover:bg-gray-50 transition-colors group">
                          <Avatar name={m.user.name} className="w-8 h-8 text-xs" />
                          <div className="min-w-0 flex-1">
                            <p className="text-sm font-medium text-gray-800 truncate">{m.user.name}</p>
                            <p className="text-xs text-gray-600">
                              <span className="capitalize">{m.role}</span>
                              <span className="text-gray-300" aria-hidden="true"> · </span>
                              <LastLogin value={m.user.lastLoginAt} />
                            </p>
                          </div>
                          {isCurrentUserBoardAdmin && m.user.id !== currentUser?.id && (
                            <button
                              onClick={() => removeMember(m.user.id)}
                              title="Remove from board"
                              aria-label={`Remove ${m.user.name} from board`}
                              className="opacity-0 group-hover:opacity-100 flex-shrink-0 w-6 h-6 flex items-center justify-center rounded-md text-gray-500 hover:text-red-700 hover:bg-red-50 transition-all"
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
              {/* Invite button — only for system admins or board admins */}
              {isAdmin && (
              <button
                onClick={() => setShowInviteModal(true)}
                className="flex items-center justify-center gap-1.5 text-sm font-semibold px-2.5 sm:px-3 py-1.5 min-h-[44px] rounded-lg border transition-all duration-150"
                style={{
                  color: '#c73009',
                  borderColor: '#e8390e',
                  background: 'white',
                }}
                onMouseEnter={(e) => {
                  e.currentTarget.style.background = '#c73009';
                  e.currentTarget.style.color = 'white';
                }}
                onMouseLeave={(e) => {
                  e.currentTarget.style.background = 'white';
                  e.currentTarget.style.color = '#c73009';
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
          </>
        }
      />

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
          {(() => {
            const dates = formatSprintDates(activeSprint.startDate, activeSprint.endDate);
            if (dates) {
              return (
                <span className="text-xs hidden sm:inline" style={{ color: 'rgba(255,255,255,0.75)' }}>
                  {dates}
                </span>
              );
            }
            // No dates is a gap to fill, not a display bug — offer the fix to
            // whoever can act on it. Editing dates is admin-only.
            return isAdmin ? (
              <button
                onClick={() => openDateEditor(activeSprint)}
                className="text-xs font-medium hidden sm:inline underline decoration-dotted underline-offset-2"
                style={{ color: 'rgba(255,255,255,0.75)' }}
              >
                Set dates
              </button>
            ) : (
              <span className="text-xs hidden sm:inline" style={{ color: 'rgba(255,255,255,0.75)' }}>
                No dates set
              </span>
            );
          })()}
          <div className="ml-auto flex items-center gap-2 sm:gap-3">
            <span className="text-xs font-medium px-2 py-0.5 rounded-full hidden sm:inline" style={{ background: 'rgba(232,57,14,0.2)', color: '#fdba74' }}>
              {activeSprint._count.tickets} tickets
            </span>
            <span className="text-xs font-medium px-2 py-0.5 rounded-full hidden sm:inline" style={{ background: 'rgba(255,255,255,0.1)', color: 'rgba(255,255,255,0.7)' }}>
              {activeSprint._count.members} members
            </span>
          </div>
        </div>
      )}

      {/* One toolbar for both board types, in the same place with the same styling. */}
      {(board.type === 'kanban' || activeSprint) && toolbar}

      {/* Project Overview canvas — sits above the board on kanban + sprint overview.
          Hidden once a sprint is opened so the sprint board takes the full page. */}
      {!activeSprint && <BoardInfo boardId={boardId} isAdmin={isAdmin} currentUser={currentUser} members={board.members} />}

      {/* Main content: Direct Kanban (kanban board), Sprint Overview, or Sprint Ticket View */}
      {board.type === 'kanban' ? (
        /* Direct Kanban Board */
        <div className="flex-1 overflow-x-auto pb-4 board-scroll">
          {filterNotice}
          <DndContext sensors={sensors} collisionDetection={collisionDetection} onDragStart={handleDragStart} onDragOver={handleDragOver} onDragEnd={handleDragEnd}>
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
              <p className="text-sm text-gray-600 mt-0.5">{board.name}</p>
            </div>
            {isAdmin && (
              <button
                onClick={() => setShowCreateSprint((p) => !p)}
                className="flex items-center gap-1.5 text-sm font-semibold px-3 py-2 rounded-lg border transition-all duration-150"
                style={{ color: '#c73009', borderColor: '#e8390e', background: 'white' }}
                onMouseEnter={(e) => { e.currentTarget.style.background = '#c73009'; e.currentTarget.style.color = 'white'; }}
                onMouseLeave={(e) => { e.currentTarget.style.background = 'white'; e.currentTarget.style.color = '#c73009'; }}
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
              <p className="text-sm font-semibold text-gray-700 mb-1">No sprints yet</p>
              <p className="text-xs text-gray-600">
                {isAdmin ? 'Create your first sprint to get started.' : 'An admin needs to create sprints for this board.'}
              </p>
            </div>
          ) : (
            (() => {
              const sprintCols: { key: string; label: string; color: string; bg: string; border: string }[] = [
                { key: 'backlog', label: 'Backlog', color: '#6b7280', bg: '#f9fafb', border: '#e5e7eb' },
                { key: 'active', label: 'Active', color: '#0369a1', bg: '#f0f9ff', border: '#bae6fd' },
                { key: 'completed', label: 'Completed', color: '#15803d', bg: '#f0fdf4', border: '#bbf7d0' },
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
                            onClick={() => { setActiveSprint(sprint); }}
                            className="relative bg-white rounded-xl border border-gray-200 p-4 cursor-pointer transition-all duration-150 hover:shadow-md hover:border-gray-300 group"
                          >
                            {/* Admin actions — edit dates + delete */}
                            {isAdmin && (
                              <div className="absolute top-2.5 right-2.5 flex gap-1 opacity-0 group-hover:opacity-100 transition-all">
                                <button
                                  onClick={(e) => { e.stopPropagation(); openDateEditor(sprint); }}
                                  className="w-6 h-6 flex items-center justify-center rounded-lg text-gray-500 hover:text-blue-700 hover:bg-blue-50 transition-all"
                                  title="Edit dates"
                                  aria-label={`Edit dates for ${sprint.title}`}
                                >
                                  <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                                    <path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"/>
                                    <path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"/>
                                  </svg>
                                </button>
                                <button
                                  onClick={(e) => { e.stopPropagation(); deleteSprint(sprint.id); }}
                                  disabled={deletingSprintId === sprint.id}
                                  className="w-6 h-6 flex items-center justify-center rounded-lg text-gray-500 hover:text-red-700 hover:bg-red-50 disabled:opacity-50 transition-all"
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
                            <h3 className="text-sm font-bold pr-7 mb-1" style={{ color: '#1a1f3c' }}>
                              <button
                                type="button"
                                onClick={(e) => { e.stopPropagation(); setActiveSprint(sprint); }}
                                className="text-left rounded outline-none hover:underline focus-visible:underline"
                              >
                                {sprint.title}
                              </button>
                            </h3>

                            {/* Date range */}
                            {(() => {
                              const dates = formatSprintDates(sprint.startDate, sprint.endDate);
                              if (dates) return <p className="text-xs text-gray-500 mb-3">{dates}</p>;
                              return (
                                <p className="text-xs mb-3">
                                  {isAdmin ? (
                                    <button
                                      onClick={(e) => { e.stopPropagation(); openDateEditor(sprint); }}
                                      className="font-medium underline decoration-dotted underline-offset-2"
                                      style={{ color: '#0369a1' }}
                                    >
                                      Set dates
                                    </button>
                                  ) : (
                                    <span className="text-gray-500">No dates set</span>
                                  )}
                                </p>
                              );
                            })()}

                            {/* Stats */}
                            <div className="flex items-center gap-2 mb-3">
                              <span
                                className="inline-flex items-center gap-1 text-xs font-semibold px-2 py-0.5 rounded-full"
                                style={{ background: '#fff7f5', color: '#c73009', border: '1px solid #fbd5c8' }}
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
                                    style={{ background: '#f0f9ff', color: '#0369a1', border: '1px solid #bae6fd' }}
                                    onMouseEnter={(e) => { e.currentTarget.style.background = '#0369a1'; e.currentTarget.style.color = 'white'; }}
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
                                      style={{ background: '#f0fdf4', color: '#15803d', border: '1px solid #bbf7d0' }}
                                      onMouseEnter={(e) => { e.currentTarget.style.background = '#15803d'; e.currentTarget.style.color = 'white'; }}
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
                                    style={{ background: '#f0f9ff', color: '#0369a1', border: '1px solid #bae6fd' }}
                                    onMouseEnter={(e) => { e.currentTarget.style.background = '#0369a1'; e.currentTarget.style.color = 'white'; }}
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
                            className="rounded-xl border border-dashed p-6 text-center text-xs text-gray-600"
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
          {filterNotice}
          <DndContext
            sensors={sensors}
            collisionDetection={collisionDetection}
            onDragStart={handleDragStart}
            onDragOver={handleDragOver}
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
          onDuplicate={(copy) => {
            // Show the copy and switch to it: duplicating is almost always the
            // first step in editing the new one.
            setBoard((prev) => updateTicketInBoard(prev, copy));
            setSelectedTicket(copy);
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
              <button onClick={() => setEditDatesSprintId(null)} aria-label="Close edit sprint dates" className="text-gray-500 text-xl w-8 h-8 flex items-center justify-center">×</button>
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
                  style={{ background: '#c73009' }}
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
              <button onClick={() => { setShowCreateSprint(false); setSprintForm({ title: '', startDate: '', endDate: '' }); }} aria-label="Close new sprint dialog" className="text-gray-500 text-xl w-8 h-8 flex items-center justify-center">×</button>
            </div>
            <form onSubmit={createSprint} className="space-y-4">
              <div>
                <label className="block text-xs font-semibold text-gray-500 mb-1.5">Sprint Title <span className="text-red-700">*</span></label>
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
                  style={{ background: '#c73009' }}
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
