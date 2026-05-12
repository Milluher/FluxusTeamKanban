'use client';
import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import Image from 'next/image';
import api from '@/lib/api';
import { Board, User } from '@/types';
import { avatarUrl } from '@/lib/avatar';

export default function DashboardPage() {
  const [boards, setBoards] = useState<Board[]>([]);
  const [user, setUser] = useState<User | null>(null);
  const [newBoardName, setNewBoardName] = useState('');
  const [creating, setCreating] = useState(false);
  const [showCreate, setShowCreate] = useState(false);
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
      <nav className="bg-white border-b border-gray-200 px-6 py-0 flex items-center justify-between sticky top-0 z-10 h-14">
        <div className="flex items-center gap-2.5">
          <Image src="/logo.png" width={28} height={28} alt="Fluxus" className="rounded-md" />
          <span className="font-bold text-base tracking-tight" style={{ color: '#1a1f3c' }}>FluxusTeam</span>
        </div>
        <div className="flex items-center gap-4">
          {user?.role === 'admin' && (
            <button
              onClick={() => router.push('/admin')}
              className="text-sm px-3 py-1.5 rounded-lg font-medium border transition-all duration-150"
              style={{ color: '#e8390e', borderColor: '#e8390e', background: 'white' }}
              onMouseEnter={(e) => { e.currentTarget.style.background = '#e8390e'; e.currentTarget.style.color = 'white'; }}
              onMouseLeave={(e) => { e.currentTarget.style.background = 'white'; e.currentTarget.style.color = '#e8390e'; }}
            >
              Admin
            </button>
          )}
          <div className="flex items-center gap-2">
            <img
              src={avatarUrl(user?.name || 'User')}
              className="w-8 h-8 rounded-full flex-shrink-0"
              alt={user?.name || 'User'}
            />
            <span className="text-sm font-medium text-gray-700">{user?.name}</span>
          </div>
          <button
            onClick={logout}
            className="text-sm px-3 py-1.5 rounded-lg font-medium text-gray-500 border border-gray-200 bg-white transition-all duration-150 hover:text-gray-800 hover:border-gray-300"
          >
            Log out
          </button>
        </div>
      </nav>

      <main className="max-w-6xl mx-auto px-6 py-8">
        {/* Page header */}
        <div className="flex items-center justify-between mb-7">
          <div>
            <h2 className="text-xl font-bold tracking-tight" style={{ color: '#1a1f3c' }}>Your Boards</h2>
            <p className="text-sm mt-0.5 text-gray-500">
              {boards.length} {boards.length === 1 ? 'board' : 'boards'} in your workspace
            </p>
          </div>
          <button
            onClick={() => setShowCreate(true)}
            className="flex items-center gap-1.5 px-4 py-2 rounded-lg text-sm font-semibold border transition-all duration-150"
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
            className="bg-white border border-gray-200 rounded-xl p-4 mb-5 flex gap-3 items-center shadow-sm"
            style={{ borderColor: '#e8390e' }}
          >
            <input
              autoFocus
              type="text"
              value={newBoardName}
              onChange={(e) => setNewBoardName(e.target.value)}
              placeholder="Board name..."
              className="flex-1 text-sm text-gray-900 placeholder-gray-400 outline-none bg-transparent"
            />
            <button
              type="submit"
              disabled={creating}
              className="px-4 py-2 rounded-lg text-sm font-semibold text-white transition-all duration-150 disabled:opacity-50"
              style={{ background: '#e8390e' }}
              onMouseEnter={(e) => { if (!creating) e.currentTarget.style.background = '#c73009'; }}
              onMouseLeave={(e) => { if (!creating) e.currentTarget.style.background = '#e8390e'; }}
            >
              {creating ? 'Creating...' : 'Create'}
            </button>
            <button
              type="button"
              onClick={() => setShowCreate(false)}
              className="px-3 py-2 rounded-lg text-sm font-medium text-gray-500 border border-gray-200 bg-white transition-all duration-150 hover:text-gray-800"
            >
              Cancel
            </button>
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

              <div className="pl-5 pr-5 py-5">
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
    </div>
  );
}
