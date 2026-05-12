'use client';
import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import Image from 'next/image';
import api from '@/lib/api';
import { Board, User } from '@/types';
import { avatarUrl } from '@/lib/avatar';
import ProfileModal from '@/components/ProfileModal';

export default function DashboardPage() {
  const [boards, setBoards] = useState<Board[]>([]);
  const [user, setUser] = useState<User | null>(null);
  const [newBoardName, setNewBoardName] = useState('');
  const [creating, setCreating] = useState(false);
  const [showCreate, setShowCreate] = useState(false);
  const [showProfile, setShowProfile] = useState(false);
  const router = useRouter();

  useEffect(() => {
    const stored = localStorage.getItem('user');
    if (!stored) { router.push('/'); return; }
    setUser(JSON.parse(stored));
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
      const { data } = await api.post('/boards', { name: newBoardName });
      setBoards((prev) => [...prev, data]);
      setNewBoardName('');
      setShowCreate(false);
    } finally { setCreating(false); }
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
          <button
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
          </button>
        </div>

        {/* Create board inline form */}
        {showCreate && (
          <form
            onSubmit={createBoard}
            className="bg-white border border-gray-200 rounded-xl p-4 mb-5 flex flex-col sm:flex-row gap-3 items-stretch sm:items-center shadow-sm w-full"
            style={{ borderColor: '#e8390e' }}
          >
            <input
              autoFocus
              type="text"
              value={newBoardName}
              onChange={(e) => setNewBoardName(e.target.value)}
              placeholder="Board name..."
              className="flex-1 text-base sm:text-sm text-gray-900 placeholder-gray-400 outline-none bg-transparent min-h-[44px] px-1"
            />
            <div className="flex gap-2">
              <button
                type="submit"
                disabled={creating}
                className="flex-1 sm:flex-none px-4 py-2.5 min-h-[44px] rounded-lg text-sm font-semibold text-white transition-all duration-150 disabled:opacity-50"
                style={{ background: '#e8390e' }}
                onMouseEnter={(e) => { if (!creating) e.currentTarget.style.background = '#c73009'; }}
                onMouseLeave={(e) => { if (!creating) e.currentTarget.style.background = '#e8390e'; }}
              >
                {creating ? 'Creating...' : 'Create'}
              </button>
              <button
                type="button"
                onClick={() => setShowCreate(false)}
                className="flex-1 sm:flex-none px-3 py-2.5 min-h-[44px] rounded-lg text-sm font-medium text-gray-500 border border-gray-200 bg-white transition-all duration-150 hover:text-gray-800"
              >
                Cancel
              </button>
            </div>
          </form>
        )}

        {/* Boards grid */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {boards.map((board) => (
            <div
              key={board.id}
              onClick={() => router.push(`/board/${board.id}`)}
              className="bg-white border border-gray-200 rounded-xl cursor-pointer transition-all duration-150 group relative overflow-hidden hover:shadow-sm"
              onMouseEnter={(e) => {
                e.currentTarget.style.borderColor = '#e8390e';
              }}
              onMouseLeave={(e) => {
                e.currentTarget.style.borderColor = '#e5e7eb';
              }}
            >
              {/* Left orange bar */}
              <div
                className="absolute left-0 top-0 bottom-0 w-1 rounded-l-xl"
                style={{ background: '#e8390e' }}
              />

              <div className="pl-5 pr-5 py-4 sm:py-5">
                <h3 className="font-semibold text-base mb-2 truncate" style={{ color: '#1a1f3c' }}>
                  {board.name}
                </h3>
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
          ))}

          {boards.length === 0 && !showCreate && (
            <div className="col-span-3 text-center py-20">
              <div
                className="inline-flex items-center justify-center w-14 h-14 rounded-xl mb-4 border border-gray-200"
                style={{ background: '#f7f8fa' }}
              >
                <svg width="24" height="24" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
                  <rect x="3" y="3" width="8" height="5" rx="1.5" fill="#d1d5db"/>
                  <rect x="3" y="10" width="8" height="11" rx="1.5" fill="#e5e7eb"/>
                  <rect x="13" y="3" width="8" height="11" rx="1.5" fill="#d1d5db"/>
                  <rect x="13" y="16" width="8" height="5" rx="1.5" fill="#e5e7eb"/>
                </svg>
              </div>
              <p className="text-base font-semibold text-gray-700 mb-1">No boards yet</p>
              <p className="text-sm text-gray-400 mb-5">Create your first board to start collaborating</p>
              <button
                onClick={() => setShowCreate(true)}
                className="px-5 py-2.5 rounded-lg text-sm font-semibold text-white transition-all duration-150"
                style={{ background: '#e8390e' }}
                onMouseEnter={(e) => { e.currentTarget.style.background = '#c73009'; }}
                onMouseLeave={(e) => { e.currentTarget.style.background = '#e8390e'; }}
              >
                Create your first board
              </button>
            </div>
          )}
        </div>
      </main>
      {showProfile && user && (
        <ProfileModal
          user={user}
          onClose={() => setShowProfile(false)}
          onLogout={logout}
        />
      )}
    </div>
  );
}
