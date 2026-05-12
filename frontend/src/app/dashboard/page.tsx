'use client';
import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import api from '@/lib/api';
import { Board, User } from '@/types';

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

  const boardGradients = [
    'from-violet-600/20 to-indigo-600/20',
    'from-cyan-600/20 to-blue-600/20',
    'from-rose-600/20 to-pink-600/20',
    'from-emerald-600/20 to-teal-600/20',
    'from-amber-600/20 to-orange-600/20',
    'from-fuchsia-600/20 to-purple-600/20',
  ];

  const boardBorderColors = [
    'rgba(139,92,246,0.5)',
    'rgba(6,182,212,0.5)',
    'rgba(244,63,94,0.5)',
    'rgba(16,185,129,0.5)',
    'rgba(245,158,11,0.5)',
    'rgba(217,70,239,0.5)',
  ];

  return (
    <div className="min-h-screen" style={{ background: '#0f172a' }}>
      {/* Top navigation */}
      <nav className="border-b px-6 py-4 flex items-center justify-between sticky top-0 z-10"
        style={{
          background: 'rgba(15,23,42,0.8)',
          backdropFilter: 'blur(16px)',
          WebkitBackdropFilter: 'blur(16px)',
          borderColor: 'rgba(255,255,255,0.08)',
        }}>
        <div className="flex items-center gap-3">
          <div className="w-8 h-8 rounded-xl flex items-center justify-center"
            style={{ background: 'linear-gradient(135deg, #6366f1, #8b5cf6)' }}>
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
              <rect x="3" y="3" width="8" height="5" rx="1.5" fill="white" opacity="0.9"/>
              <rect x="3" y="10" width="8" height="11" rx="1.5" fill="white" opacity="0.6"/>
              <rect x="13" y="3" width="8" height="11" rx="1.5" fill="white" opacity="0.9"/>
              <rect x="13" y="16" width="8" height="5" rx="1.5" fill="white" opacity="0.6"/>
            </svg>
          </div>
          <span className="text-white font-bold text-lg tracking-tight">FluxusTeam</span>
        </div>
        <div className="flex items-center gap-4">
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 rounded-full flex items-center justify-center text-xs font-bold text-white"
              style={{ background: 'linear-gradient(135deg, #6366f1, #8b5cf6)' }}>
              {user?.name?.charAt(0).toUpperCase()}
            </div>
            <span className="text-sm font-medium" style={{ color: 'rgba(255,255,255,0.7)' }}>{user?.name}</span>
          </div>
          <button
            onClick={logout}
            className="text-sm px-3 py-1.5 rounded-lg transition-all duration-200 font-medium"
            style={{
              color: 'rgba(255,255,255,0.5)',
              background: 'rgba(255,255,255,0.05)',
              border: '1px solid rgba(255,255,255,0.08)',
            }}
            onMouseEnter={(e) => { e.currentTarget.style.background = 'rgba(255,255,255,0.1)'; e.currentTarget.style.color = 'rgba(255,255,255,0.8)'; }}
            onMouseLeave={(e) => { e.currentTarget.style.background = 'rgba(255,255,255,0.05)'; e.currentTarget.style.color = 'rgba(255,255,255,0.5)'; }}
          >
            Log out
          </button>
        </div>
      </nav>

      <main className="max-w-6xl mx-auto px-6 py-10">
        {/* Page header */}
        <div className="flex items-center justify-between mb-8">
          <div>
            <h2 className="text-2xl font-bold text-white tracking-tight">Your Boards</h2>
            <p className="text-sm mt-1" style={{ color: 'rgba(255,255,255,0.4)' }}>
              {boards.length} {boards.length === 1 ? 'board' : 'boards'} in your workspace
            </p>
          </div>
          <button
            onClick={() => setShowCreate(true)}
            className="flex items-center gap-2 px-4 py-2.5 rounded-xl text-sm font-bold text-white transition-all duration-200"
            style={{
              background: 'linear-gradient(135deg, #6366f1, #8b5cf6)',
              boxShadow: '0 4px 16px rgba(99,102,241,0.35)',
            }}
            onMouseEnter={(e) => { e.currentTarget.style.boxShadow = '0 6px 20px rgba(99,102,241,0.5)'; e.currentTarget.style.transform = 'translateY(-1px)'; }}
            onMouseLeave={(e) => { e.currentTarget.style.boxShadow = '0 4px 16px rgba(99,102,241,0.35)'; e.currentTarget.style.transform = 'translateY(0)'; }}
          >
            <span className="text-base leading-none">+</span>
            New Board
          </button>
        </div>

        {/* Create board inline form */}
        {showCreate && (
          <form onSubmit={createBoard}
            className="rounded-2xl p-5 mb-6 flex gap-3 items-center"
            style={{
              background: 'rgba(255,255,255,0.05)',
              border: '1px solid rgba(99,102,241,0.4)',
              boxShadow: '0 0 0 4px rgba(99,102,241,0.08)',
            }}>
            <div className="w-8 h-8 rounded-lg flex-shrink-0 flex items-center justify-center"
              style={{ background: 'rgba(99,102,241,0.2)', border: '1px solid rgba(99,102,241,0.3)' }}>
              <span className="text-indigo-400 font-bold text-base leading-none">+</span>
            </div>
            <input
              autoFocus
              type="text"
              value={newBoardName}
              onChange={(e) => setNewBoardName(e.target.value)}
              placeholder="Enter board name..."
              className="flex-1 bg-transparent text-sm text-white placeholder-slate-500 outline-none"
            />
            <button
              type="submit"
              disabled={creating}
              className="px-4 py-2 rounded-xl text-sm font-semibold text-white transition-all duration-200 disabled:opacity-50"
              style={{ background: 'linear-gradient(135deg, #6366f1, #8b5cf6)' }}
            >
              {creating ? 'Creating...' : 'Create'}
            </button>
            <button
              type="button"
              onClick={() => setShowCreate(false)}
              className="px-3 py-2 rounded-xl text-sm font-medium transition-all duration-200"
              style={{ color: 'rgba(255,255,255,0.4)', background: 'rgba(255,255,255,0.05)' }}
              onMouseEnter={(e) => { e.currentTarget.style.color = 'rgba(255,255,255,0.7)'; }}
              onMouseLeave={(e) => { e.currentTarget.style.color = 'rgba(255,255,255,0.4)'; }}
            >
              Cancel
            </button>
          </form>
        )}

        {/* Boards grid */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {boards.map((board, i) => (
            <div
              key={board.id}
              onClick={() => router.push(`/board/${board.id}`)}
              className={`rounded-2xl p-6 cursor-pointer transition-all duration-200 group relative overflow-hidden`}
              style={{
                background: 'rgba(255,255,255,0.04)',
                border: `1px solid rgba(255,255,255,0.08)`,
              }}
              onMouseEnter={(e) => {
                e.currentTarget.style.background = 'rgba(255,255,255,0.07)';
                e.currentTarget.style.border = `1px solid ${boardBorderColors[i % boardBorderColors.length]}`;
                e.currentTarget.style.transform = 'translateY(-3px)';
                e.currentTarget.style.boxShadow = `0 12px 32px rgba(0,0,0,0.3), 0 0 0 1px ${boardBorderColors[i % boardBorderColors.length]}`;
              }}
              onMouseLeave={(e) => {
                e.currentTarget.style.background = 'rgba(255,255,255,0.04)';
                e.currentTarget.style.border = '1px solid rgba(255,255,255,0.08)';
                e.currentTarget.style.transform = 'translateY(0)';
                e.currentTarget.style.boxShadow = 'none';
              }}
            >
              {/* Gradient top accent */}
              <div className={`absolute top-0 left-0 right-0 h-1 rounded-t-2xl bg-gradient-to-r ${boardGradients[i % boardGradients.length]}`}
                style={{ background: `linear-gradient(90deg, ${boardBorderColors[i % boardBorderColors.length].replace('0.5', '1')}, transparent)` }} />

              {/* Board icon */}
              <div className="w-10 h-10 rounded-xl mb-4 flex items-center justify-center"
                style={{ background: boardBorderColors[i % boardBorderColors.length].replace('0.5', '0.15'), border: `1px solid ${boardBorderColors[i % boardBorderColors.length]}` }}>
                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
                  <rect x="3" y="3" width="8" height="5" rx="1.5" fill="white" opacity="0.8"/>
                  <rect x="3" y="10" width="8" height="11" rx="1.5" fill="white" opacity="0.5"/>
                  <rect x="13" y="3" width="8" height="11" rx="1.5" fill="white" opacity="0.8"/>
                  <rect x="13" y="16" width="8" height="5" rx="1.5" fill="white" opacity="0.5"/>
                </svg>
              </div>

              <h3 className="font-bold text-white mb-3 text-base">{board.name}</h3>
              <div className="flex items-center gap-4 text-xs font-medium" style={{ color: 'rgba(255,255,255,0.4)' }}>
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

              {/* Arrow indicator */}
              <div className="absolute right-5 top-1/2 -translate-y-1/2 opacity-0 group-hover:opacity-100 transition-all duration-200 translate-x-1 group-hover:translate-x-0"
                style={{ color: 'rgba(255,255,255,0.4)' }}>
                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <path d="M9 18l6-6-6-6"/>
                </svg>
              </div>
            </div>
          ))}

          {boards.length === 0 && !showCreate && (
            <div className="col-span-3 text-center py-24">
              <div className="inline-flex items-center justify-center w-16 h-16 rounded-2xl mb-5"
                style={{ background: 'rgba(99,102,241,0.1)', border: '1px solid rgba(99,102,241,0.2)' }}>
                <svg width="28" height="28" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
                  <rect x="3" y="3" width="8" height="5" rx="1.5" fill="rgba(99,102,241,0.7)"/>
                  <rect x="3" y="10" width="8" height="11" rx="1.5" fill="rgba(99,102,241,0.4)"/>
                  <rect x="13" y="3" width="8" height="11" rx="1.5" fill="rgba(99,102,241,0.7)"/>
                  <rect x="13" y="16" width="8" height="5" rx="1.5" fill="rgba(99,102,241,0.4)"/>
                </svg>
              </div>
              <p className="text-lg font-bold text-white mb-2">No boards yet</p>
              <p className="text-sm mb-6" style={{ color: 'rgba(255,255,255,0.4)' }}>Create your first board to start collaborating</p>
              <button
                onClick={() => setShowCreate(true)}
                className="px-5 py-2.5 rounded-xl text-sm font-bold text-white"
                style={{ background: 'linear-gradient(135deg, #6366f1, #8b5cf6)', boxShadow: '0 4px 16px rgba(99,102,241,0.35)' }}
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
