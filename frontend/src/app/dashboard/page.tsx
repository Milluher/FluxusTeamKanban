'use client';
import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import AppHeader from '@/components/AppHeader';
import RowMenu from '@/components/RowMenu';
import ConfirmByName from '@/components/ConfirmByName';
import MyTicketsView from '@/components/MyTicketsView';
import api from '@/lib/api';
import { AssignedTicket, Board, User } from '@/types';
import { useInactivityTimeout } from '@/lib/useInactivityTimeout';

export default function DashboardPage() {
  useInactivityTimeout();
  const [boards, setBoards] = useState<Board[]>([]);
  const [user, setUser] = useState<User | null>(null);
  const [newBoardName, setNewBoardName] = useState('');
  const [newBoardType, setNewBoardType] = useState<'sprint' | 'kanban'>('sprint');
  const [creating, setCreating] = useState(false);
  const [showCreate, setShowCreate] = useState(false);
  const [deleteBoard, setDeleteBoard] = useState<Board | null>(null);
  const [deletingBoard, setDeletingBoard] = useState(false);
  const [deleteMsg, setDeleteMsg] = useState('');
  // Landing view. Defaults to the work you have been given rather than a list of
  // boards; the choice is remembered per person.
  const [view, setView] = useState<'tickets' | 'boards'>('tickets');
  const [myTickets, setMyTickets] = useState<AssignedTicket[]>([]);
  const [loadingTickets, setLoadingTickets] = useState(true);
  const router = useRouter();

  useEffect(() => {
    const stored = localStorage.getItem('user');
    if (!stored) { router.push('/'); return; }
    const u = JSON.parse(stored);
    if (u.mustChangePassword) { router.push('/change-password'); return; }
    setUser(u);
    try {
      const saved = localStorage.getItem(`fluxus:dashboardView:${u.id}`);
      if (saved === 'tickets' || saved === 'boards') setView(saved);
    } catch {
      // Storage can be blocked; the default stands.
    }
    loadBoards();
    loadMyTickets();
  }, []);

  const loadMyTickets = async () => {
    try {
      const { data } = await api.get<AssignedTicket[]>('/tickets/assigned');
      setMyTickets(data);
    } catch {
      // A board list is still useful if this fails; the empty state covers it.
      setMyTickets([]);
    } finally {
      setLoadingTickets(false);
    }
  };

  // "My tickets" is a board of its own, so a card dropped in another column has
  // to be persisted against the column of that *same* name on the ticket's own
  // board — resolved by the view, which has the board list.
  const moveTicket = async (ticket: AssignedTicket, column: { id: string; name: string }) => {
    setMyTickets((prev) =>
      prev.map((t) =>
        t.id === ticket.id
          ? { ...t, columnId: column.id, status: column.name, column: { ...t.column, id: column.id, name: column.name } }
          : t
      )
    );
    try {
      await api.patch(`/tickets/${ticket.id}/move`, {
        columnId: column.id,
        boardId: ticket.column.board.id,
      });
    } catch (e) {
      // Put the card back where it was; the view reports the failure.
      setMyTickets((prev) => prev.map((t) => (t.id === ticket.id ? ticket : t)));
      throw e;
    }
  };

  const chooseView = (next: 'tickets' | 'boards') => {
    setView(next);
    if (!user) return;
    try {
      localStorage.setItem(`fluxus:dashboardView:${user.id}`, next);
    } catch {
      // Not persisting is acceptable.
    }
  };

  const loadBoards = async () => {
    try {
      const { data } = await api.get('/boards');
      setBoards(data);
    } catch { router.push('/'); }
  };

  const createBoard = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newBoardName.trim()) return;
    setCreating(true);
    try {
      const { data } = await api.post('/boards', { name: newBoardName, type: newBoardType });
      setBoards((prev) => [...prev, data]);
      setNewBoardName('');
      setNewBoardType('sprint');
      setShowCreate(false);
    } finally { setCreating(false); }
  };

  const confirmDeleteBoard = async () => {
    if (!deleteBoard) return;
    setDeletingBoard(true);
    setDeleteMsg('');
    try {
      await api.delete(`/boards/${deleteBoard.id}`);
      setBoards((prev) => prev.filter((b) => b.id !== deleteBoard.id));
      setDeleteBoard(null);
    } catch (e: any) {
      setDeleteMsg(e.response?.data?.error || 'Failed to delete board');
    } finally { setDeletingBoard(false); }
  };

  return (
    <div className="min-h-screen bg-[#f7f8fa]">
      <AppHeader user={user} current="boards" />

      <main className="max-w-6xl mx-auto px-4 sm:px-6 py-6 sm:py-8">
        {/* Page header */}
        <div className="flex items-center justify-between mb-5 sm:mb-7">
          <div className="min-w-0">
            <h1 className="text-xl font-bold tracking-tight" style={{ color: '#1a1f3c' }}>
              {view === 'tickets' ? 'Your Tickets' : 'Your Boards'}
            </h1>
            <p className="text-sm mt-0.5 text-gray-600">
              {view === 'tickets'
                ? loadingTickets
                  ? 'Loading your assigned work…'
                  : `${myTickets.length} ${myTickets.length === 1 ? 'ticket' : 'tickets'} assigned to you`
                : `${boards.length} ${boards.length === 1 ? 'board' : 'boards'} in your workspace`}
            </p>
          </div>
          <div className="flex items-center gap-2 sm:gap-3 flex-shrink-0">
            <div className="flex rounded-lg overflow-hidden text-xs font-semibold border border-gray-200">
              <button
                onClick={() => chooseView('tickets')}
                aria-pressed={view === 'tickets'}
                className="px-3 py-1.5 transition-all"
                style={{
                  background: view === 'tickets' ? '#1a1f3c' : 'white',
                  color: view === 'tickets' ? 'white' : '#6b7280',
                }}
              >
                My tickets{!loadingTickets && ` · ${myTickets.length}`}
              </button>
              <button
                onClick={() => chooseView('boards')}
                aria-pressed={view === 'boards'}
                className="px-3 py-1.5 transition-all"
                style={{
                  background: view === 'boards' ? '#1a1f3c' : 'white',
                  color: view === 'boards' ? 'white' : '#6b7280',
                }}
              >
                Boards &middot; {boards.length}
              </button>
            </div>

          {user?.role === 'admin' && view === 'boards' && (<button
            onClick={() => setShowCreate(true)}
            className="flex items-center gap-1.5 px-4 py-2 min-h-[44px] rounded-lg text-sm font-semibold border transition-all duration-150"
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
            <span className="text-base leading-none font-bold">+</span>
            New Board
          </button>)}
          </div>
        </div>

        {/* Create board modal */}
        {showCreate && user?.role === 'admin' && (
          <div className="fixed inset-0 flex items-end sm:items-center justify-center z-50" style={{ background: 'rgba(0,0,0,0.4)' }} onClick={() => setShowCreate(false)}>
            <form
              onSubmit={createBoard}
              className="w-full sm:max-w-sm bg-white rounded-t-2xl sm:rounded-xl shadow-xl border border-gray-200 overflow-hidden"
              onClick={(e) => e.stopPropagation()}
            >
              <div className="px-5 py-4 border-b border-gray-200 flex items-center justify-between">
                <h3 className="font-bold text-base" style={{ color: '#1a1f3c' }}>New Board</h3>
                <button type="button" onClick={() => setShowCreate(false)} aria-label="Close new board dialog" className="w-7 h-7 flex items-center justify-center rounded-lg text-gray-500 bg-gray-100 hover:bg-gray-200 text-lg">×</button>
              </div>
              <div className="px-5 py-5 space-y-4">
                <div>
                  <label className="block text-xs font-semibold text-gray-500 mb-1.5">Board Name</label>
                  <input
                    autoFocus
                    type="text"
                    value={newBoardName}
                    onChange={(e) => setNewBoardName(e.target.value)}
                    placeholder="e.g. Product Roadmap"
                    className="w-full px-3 py-2.5 text-sm text-gray-900 placeholder-gray-500 outline-none rounded-lg border border-gray-200 transition-all"
                    onFocus={(e) => { e.currentTarget.style.borderColor = '#e8390e'; e.currentTarget.style.boxShadow = '0 0 0 3px rgba(232,57,14,0.1)'; }}
                    onBlur={(e) => { e.currentTarget.style.borderColor = '#e5e7eb'; e.currentTarget.style.boxShadow = 'none'; }}
                  />
                </div>

                <div>
                  <label className="block text-xs font-semibold text-gray-500 mb-2">Board Type</label>
                  <div className="grid grid-cols-2 gap-2.5">
                    {([
                      {
                        value: 'sprint',
                        label: 'Sprint Board',
                        desc: 'Manage tickets in sprints with full lifecycle tracking.',
                        icon: (
                          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8">
                            <rect x="3" y="4" width="18" height="18" rx="2"/><line x1="16" y1="2" x2="16" y2="6"/><line x1="8" y1="2" x2="8" y2="6"/><line x1="3" y1="10" x2="21" y2="10"/>
                          </svg>
                        ),
                      },
                      {
                        value: 'kanban',
                        label: 'Kanban Board',
                        desc: 'Simple To Do → In Progress → Done flow, no sprints.',
                        icon: (
                          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8">
                            <rect x="3" y="3" width="5" height="18" rx="1.5"/><rect x="10" y="3" width="5" height="12" rx="1.5"/><rect x="17" y="3" width="5" height="8" rx="1.5"/>
                          </svg>
                        ),
                      },
                    ] as const).map((opt) => {
                      const active = newBoardType === opt.value;
                      return (
                        <button
                          key={opt.value}
                          type="button"
                          onClick={() => setNewBoardType(opt.value)}
                          className="flex flex-col items-start gap-1.5 p-3 rounded-xl border text-left transition-all duration-150"
                          style={{
                            borderColor: active ? '#e8390e' : '#e5e7eb',
                            background: active ? '#fff7f5' : 'white',
                            boxShadow: active ? '0 0 0 2px rgba(232,57,14,0.15)' : 'none',
                          }}
                        >
                          <span style={{ color: active ? '#c73009' : '#6b7280' }}>{opt.icon}</span>
                          <span className="text-xs font-bold" style={{ color: active ? '#c73009' : '#1a1f3c' }}>{opt.label}</span>
                          <span className="text-xs leading-snug" style={{ color: '#6b7280' }}>{opt.desc}</span>
                        </button>
                      );
                    })}
                  </div>
                </div>
              </div>
              <div className="px-5 pb-5 flex gap-2.5">
                <button
                  type="button"
                  onClick={() => setShowCreate(false)}
                  className="flex-1 py-2.5 min-h-[44px] rounded-lg text-sm font-semibold text-gray-600 border border-gray-200 bg-white transition-all hover:text-gray-900"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={creating || !newBoardName.trim()}
                  className="flex-1 py-2.5 min-h-[44px] rounded-lg text-sm font-bold text-white transition-all disabled:opacity-50"
                  style={{ background: '#c73009' }}
                  onMouseEnter={(e) => { if (!creating) e.currentTarget.style.background = '#c73009'; }}
                  onMouseLeave={(e) => { e.currentTarget.style.background = '#c73009'; }}
                >
                  {creating ? 'Creating...' : 'Create Board'}
                </button>
              </div>
            </form>
          </div>
        )}

        {view === 'tickets' && (
          <MyTicketsView
            tickets={myTickets}
            boards={boards}
            loading={loadingTickets}
            onShowBoards={() => chooseView('boards')}
            onMove={moveTicket}
          />
        )}

        {/* Boards grid */}
        {view === 'boards' && (() => {
          const myBoards = boards.filter((b) => (b as any).userRole === 'admin');
          const sharedBoards = boards.filter((b) => (b as any).userRole !== 'admin');

          const BoardCard = ({ board }: { board: typeof boards[0] }) => (
            <div
              className="bg-white border border-gray-200 rounded-xl transition-all duration-150 relative overflow-hidden hover:shadow-sm group"
              onMouseEnter={(e) => { (e.currentTarget as HTMLDivElement).style.borderColor = '#e8390e'; }}
              onMouseLeave={(e) => { (e.currentTarget as HTMLDivElement).style.borderColor = '#e5e7eb'; }}
            >
              <div className="absolute left-0 top-0 bottom-0 w-1 rounded-l-xl" style={{ background: '#e8390e' }} />
              <div
                className="pl-5 pr-5 py-4 sm:py-5 cursor-pointer"
                onClick={() => router.push(`/board/${board.id}`)}
              >
                <div className="flex items-start justify-between gap-2 mb-2">
                  <h3 className="font-semibold text-base truncate min-w-0" style={{ color: '#1a1f3c' }}>
                    <Link
                      href={`/board/${board.id}`}
                      onClick={(e) => e.stopPropagation()}
                      className="block truncate rounded outline-none hover:underline focus-visible:underline"
                    >
                      {board.name}
                    </Link>
                  </h3>
                  <div className="flex items-center gap-1.5 flex-shrink-0">
                    <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${board.type === 'kanban' ? 'bg-purple-50 text-purple-700' : 'bg-orange-50 text-orange-700'}`}>
                      {board.type === 'kanban' ? 'Kanban' : 'Sprint'}
                    </span>
                    {(board as any).userRole !== 'admin' && (
                      <span className="text-xs px-2 py-0.5 rounded-full bg-indigo-50 text-indigo-700 font-medium">Shared</span>
                    )}
                    {user?.role === 'admin' && (
                      <RowMenu
                        label={`Actions for ${board.name}`}
                        items={[{
                          label: 'Delete board',
                          destructive: true,
                          onSelect: () => { setDeleteBoard(board); setDeleteMsg(''); },
                        }]}
                      />
                    )}
                  </div>
                </div>
                <div className="flex items-center gap-4 text-xs text-gray-500">
                  <span className="flex items-center gap-1.5">
                    <svg width="12" height="12" viewBox="0 0 24 24" fill="currentColor">
                      <path d="M12 12c2.7 0 4.8-2.1 4.8-4.8S14.7 2.4 12 2.4 7.2 4.5 7.2 7.2 9.3 12 12 12zm0 2.4c-3.2 0-9.6 1.6-9.6 4.8v2.4h19.2v-2.4c0-3.2-6.4-4.8-9.6-4.8z"/>
                    </svg>
                    {(board as any)._count?.members ?? board.members?.length ?? 0} members
                  </span>
                  <span className="flex items-center gap-1.5">
                    <svg width="12" height="12" viewBox="0 0 24 24" fill="currentColor">
                      <path d="M3 3h18v2H3V3zm0 4h18v2H3V7zm0 4h12v2H3v-2zm0 4h12v2H3v-2z"/>
                    </svg>
                    {board.columns?.length ?? 0} columns
                  </span>
                </div>
              </div>
            </div>
          );

          if (boards.length === 0 && !showCreate) return (
            <div className="text-center py-20">
              <div className="inline-flex items-center justify-center w-14 h-14 rounded-xl mb-4 border border-gray-200" style={{ background: '#f7f8fa' }}>
                <svg width="24" height="24" viewBox="0 0 24 24" fill="none">
                  <rect x="3" y="3" width="8" height="5" rx="1.5" fill="#d1d5db"/>
                  <rect x="3" y="10" width="8" height="11" rx="1.5" fill="#e5e7eb"/>
                  <rect x="13" y="3" width="8" height="11" rx="1.5" fill="#d1d5db"/>
                  <rect x="13" y="16" width="8" height="5" rx="1.5" fill="#e5e7eb"/>
                </svg>
              </div>
              <p className="text-base font-semibold text-gray-700 mb-1">No boards yet</p>
              <p className="text-sm text-gray-500 mb-5">Create your first board to start collaborating</p>
              <button onClick={() => setShowCreate(true)} className="px-5 py-2.5 rounded-lg text-sm font-semibold text-white" style={{ background: '#c73009' }}>
                Create your first board
              </button>
            </div>
          );

          return (
            <div className="space-y-8">
              {myBoards.length > 0 && (
                <div>
                  <h3 className="text-xs font-semibold uppercase tracking-wider text-gray-500 mb-3">My Boards</h3>
                  <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
                    {myBoards.map((board) => <BoardCard key={board.id} board={board} />)}
                  </div>
                </div>
              )}
              {sharedBoards.length > 0 && (
                <div>
                  <h3 className="text-xs font-semibold uppercase tracking-wider text-gray-500 mb-3">Shared with me</h3>
                  <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
                    {sharedBoards.map((board) => <BoardCard key={board.id} board={board} />)}
                  </div>
                </div>
              )}
            </div>
          );
        })()}
      </main>
      {deleteBoard && (
        <ConfirmByName
          title="Delete board"
          name={deleteBoard.name}
          description={
            <>
              This permanently deletes <strong>{deleteBoard.name}</strong> and every ticket on it.
              It cannot be undone.
            </>
          }
          confirmLabel="Delete board"
          busy={deletingBoard}
          error={deleteMsg || null}
          onCancel={() => { setDeleteBoard(null); setDeleteMsg(''); }}
          onConfirm={confirmDeleteBoard}
        />
      )}
    </div>
  );
}
