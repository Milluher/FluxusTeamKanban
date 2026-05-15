'use client';
import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import Image from 'next/image';
import api from '@/lib/api';
import { Board, User } from '@/types';
import { avatarUrl } from '@/lib/avatar';
import ProfileModal from '@/components/ProfileModal';
import NotificationBell from '@/components/NotificationBell';
import { useInactivityTimeout } from '@/lib/useInactivityTimeout';

export default function DashboardPage() {
  useInactivityTimeout();
  const [boards, setBoards] = useState<Board[]>([]);
  const [user, setUser] = useState<User | null>(null);
  const [newBoardName, setNewBoardName] = useState('');
  const [newBoardType, setNewBoardType] = useState<'sprint' | 'kanban'>('sprint');
  const [creating, setCreating] = useState(false);
  const [showCreate, setShowCreate] = useState(false);
  const [showProfile, setShowProfile] = useState(false);
  const [deleteBoard, setDeleteBoard] = useState<Board | null>(null);
  const [deletingBoard, setDeletingBoard] = useState(false);
  const router = useRouter();

  useEffect(() => {
    const stored = localStorage.getItem('user');
    if (!stored) { router.push('/'); return; }
    const u = JSON.parse(stored);
    if (u.mustChangePassword) { router.push('/change-password'); return; }
    setUser(u);
    loadBoards();
  }, []);

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
    try {
      await api.delete(`/boards/${deleteBoard.id}`);
      setBoards((prev) => prev.filter((b) => b.id !== deleteBoard.id));
      setDeleteBoard(null);
    } catch (e: any) {
      alert(e.response?.data?.error || 'Failed to delete board');
    } finally { setDeletingBoard(false); }
  };

  const logout = () => {
    localStorage.removeItem('token');
    localStorage.removeItem('user');
    router.push('/');
  };

  return (
    <div className="min-h-screen bg-[#f7f8fa]">
      {/* Top navigation */}
      <nav className="bg-white border-b border-gray-200 px-4 sm:px-6 py-0 flex items-center justify-between sticky top-0 z-10 h-14">
        <div className="flex items-center gap-2.5">
          <Image src="/logo.png" width={28} height={28} alt="Fluxus" className="rounded-md" />
          <span className="font-bold text-base tracking-tight" style={{ color: '#1a1f3c' }}>FluxusTeam</span>
        </div>
        <div className="flex items-center gap-2 sm:gap-4">
          {user && <NotificationBell userId={user.id} />}
          {user?.role === 'admin' && (
            <>
              {/* Mobile: gear icon only */}
              <button
                onClick={() => router.push('/admin')}
                className="sm:hidden w-9 h-9 flex items-center justify-center rounded-lg border transition-all duration-150 min-h-[44px] min-w-[44px]"
                style={{ color: '#e8390e', borderColor: '#e8390e', background: 'white' }}
                title="Admin"
              >
                <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor">
                  <path d="M19.14 12.94c.04-.3.06-.61.06-.94 0-.32-.02-.64-.07-.94l2.03-1.58c.18-.14.23-.41.12-.61l-1.92-3.32c-.12-.22-.37-.29-.59-.22l-2.39.96c-.5-.38-1.03-.7-1.62-.94l-.36-2.54c-.04-.24-.24-.41-.48-.41h-3.84c-.24 0-.43.17-.47.41l-.36 2.54c-.59.24-1.13.57-1.62.94l-2.39-.96c-.22-.08-.47 0-.59.22L2.74 8.87c-.12.21-.08.47.12.61l2.03 1.58c-.05.3-.09.63-.09.94s.02.64.07.94l-2.03 1.58c-.18.14-.23.41-.12.61l1.92 3.32c.12.22.37.29.59.22l2.39-.96c.5.38 1.03.7 1.62.94l.36 2.54c.05.24.24.41.48.41h3.84c.24 0 .44-.17.47-.41l.36-2.54c.59-.24 1.13-.56 1.62-.94l2.39.96c.22.08.47 0 .59-.22l1.92-3.32c.12-.22.07-.47-.12-.61l-2.01-1.58zM12 15.6c-1.98 0-3.6-1.62-3.6-3.6s1.62-3.6 3.6-3.6 3.6 1.62 3.6 3.6-1.62 3.6-3.6 3.6z"/>
                </svg>
              </button>
              {/* Desktop: text button */}
              <button
                onClick={() => router.push('/admin')}
                className="hidden sm:block text-sm px-3 py-1.5 rounded-lg font-medium border transition-all duration-150"
                style={{ color: '#e8390e', borderColor: '#e8390e', background: 'white' }}
                onMouseEnter={(e) => { e.currentTarget.style.background = '#e8390e'; e.currentTarget.style.color = 'white'; }}
                onMouseLeave={(e) => { e.currentTarget.style.background = 'white'; e.currentTarget.style.color = '#e8390e'; }}
              >
                Admin
              </button>
            </>
          )}
          <button
            onClick={() => setShowProfile(true)}
            className="flex items-center gap-2 min-h-[44px] px-1 rounded-lg hover:bg-gray-50 transition-colors"
            title="Profile"
          >
            <img
              src={avatarUrl(user?.name || 'User')}
              className="w-8 h-8 rounded-full flex-shrink-0"
              alt={user?.name || 'User'}
            />
            <span className="hidden sm:block text-sm font-medium text-gray-700">{user?.name}</span>
          </button>
        </div>
      </nav>

      <main className="max-w-6xl mx-auto px-4 sm:px-6 py-6 sm:py-8">
        {/* Page header */}
        <div className="flex items-center justify-between mb-5 sm:mb-7">
          <div>
            <h2 className="text-xl font-bold tracking-tight" style={{ color: '#1a1f3c' }}>Your Boards</h2>
            <p className="text-sm mt-0.5 text-gray-500">
              {boards.length} {boards.length === 1 ? 'board' : 'boards'} in your workspace
            </p>
          </div>
          {user?.role === 'admin' && (<button
            onClick={() => setShowCreate(true)}
            className="flex items-center gap-1.5 px-4 py-2 min-h-[44px] rounded-lg text-sm font-semibold border transition-all duration-150"
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
            <span className="text-base leading-none font-bold">+</span>
            New Board
          </button>)}
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
                <button type="button" onClick={() => setShowCreate(false)} className="w-7 h-7 flex items-center justify-center rounded-lg text-gray-400 bg-gray-100 hover:bg-gray-200 text-lg">×</button>
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
                    className="w-full px-3 py-2.5 text-sm text-gray-900 placeholder-gray-400 outline-none rounded-lg border border-gray-200 transition-all"
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
                          <span style={{ color: active ? '#e8390e' : '#9ca3af' }}>{opt.icon}</span>
                          <span className="text-xs font-bold" style={{ color: active ? '#e8390e' : '#1a1f3c' }}>{opt.label}</span>
                          <span className="text-xs leading-snug" style={{ color: '#9ca3af' }}>{opt.desc}</span>
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
                  style={{ background: '#e8390e' }}
                  onMouseEnter={(e) => { if (!creating) e.currentTarget.style.background = '#c73009'; }}
                  onMouseLeave={(e) => { e.currentTarget.style.background = '#e8390e'; }}
                >
                  {creating ? 'Creating...' : 'Create Board'}
                </button>
              </div>
            </form>
          </div>
        )}

        {/* Boards grid */}
        {(() => {
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
                  <h3 className="font-semibold text-base truncate" style={{ color: '#1a1f3c' }}>{board.name}</h3>
                  <div className="flex items-center gap-1.5 flex-shrink-0">
                    <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${board.type === 'kanban' ? 'bg-purple-50 text-purple-500' : 'bg-orange-50 text-orange-500'}`}>
                      {board.type === 'kanban' ? 'Kanban' : 'Sprint'}
                    </span>
                    {(board as any).userRole !== 'admin' && (
                      <span className="text-xs px-2 py-0.5 rounded-full bg-indigo-50 text-indigo-500 font-medium">Shared</span>
                    )}
                    {user?.role === 'admin' && (
                      <button
                        onClick={(e) => { e.stopPropagation(); setDeleteBoard(board); }}
                        title="Delete board"
                        className="opacity-0 group-hover:opacity-100 w-6 h-6 flex items-center justify-center rounded-md text-gray-400 hover:text-red-500 hover:bg-red-50 transition-all"
                      >
                        <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
                          <polyline points="3 6 5 6 21 6"/><path d="M19 6l-1 14H6L5 6"/><path d="M10 11v6"/><path d="M14 11v6"/><path d="M9 6V4h6v2"/>
                        </svg>
                      </button>
                    )}
                  </div>
                </div>
                <div className="flex items-center gap-4 text-xs text-gray-400">
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
              <p className="text-sm text-gray-400 mb-5">Create your first board to start collaborating</p>
              <button onClick={() => setShowCreate(true)} className="px-5 py-2.5 rounded-lg text-sm font-semibold text-white" style={{ background: '#e8390e' }}>
                Create your first board
              </button>
            </div>
          );

          return (
            <div className="space-y-8">
              {myBoards.length > 0 && (
                <div>
                  <h3 className="text-xs font-semibold uppercase tracking-wider text-gray-400 mb-3">My Boards</h3>
                  <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
                    {myBoards.map((board) => <BoardCard key={board.id} board={board} />)}
                  </div>
                </div>
              )}
              {sharedBoards.length > 0 && (
                <div>
                  <h3 className="text-xs font-semibold uppercase tracking-wider text-gray-400 mb-3">Shared with me</h3>
                  <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
                    {sharedBoards.map((board) => <BoardCard key={board.id} board={board} />)}
                  </div>
                </div>
              )}
            </div>
          );
        })()}
      </main>
      {showProfile && user && (
        <ProfileModal
          user={user}
          onClose={() => setShowProfile(false)}
          onLogout={logout}
        />
      )}

      {deleteBoard && (
        <div className="fixed inset-0 bg-black/40 flex items-end sm:items-center justify-center z-50" onClick={() => setDeleteBoard(null)}>
          <div className="bg-white rounded-t-2xl sm:rounded-xl shadow-xl w-full sm:max-w-sm p-6" onClick={(e) => e.stopPropagation()}>
            <div className="flex items-center justify-between mb-4">
              <h3 className="font-semibold text-red-600">Delete Board</h3>
              <button onClick={() => setDeleteBoard(null)} className="text-gray-400 text-xl w-8 h-8 flex items-center justify-center">×</button>
            </div>
            <p className="text-sm text-gray-600 mb-1">Are you sure you want to delete <strong>{deleteBoard.name}</strong>?</p>
            <p className="text-xs text-gray-400 mb-5">This will permanently delete the board and all its tickets. This cannot be undone.</p>
            <div className="flex gap-2">
              <button onClick={() => setDeleteBoard(null)} className="flex-1 py-2.5 min-h-[44px] rounded-lg text-sm font-medium text-gray-600 border border-gray-200">Cancel</button>
              <button onClick={confirmDeleteBoard} disabled={deletingBoard} className="flex-1 py-2.5 min-h-[44px] rounded-lg text-sm font-semibold text-white bg-red-500 hover:bg-red-600 transition-colors disabled:opacity-50">
                {deletingBoard ? 'Deleting...' : 'Delete Board'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
