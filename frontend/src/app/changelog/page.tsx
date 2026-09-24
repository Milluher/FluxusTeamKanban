'use client';
import { useEffect, useState, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import Image from 'next/image';
import api from '@/lib/api';
import { Board, User, ChangelogEntry, ChangelogItem, ChangelogItemKind } from '@/types';
import { avatarUrl } from '@/lib/avatar';
import NotificationBell from '@/components/NotificationBell';
import ChangelogEntryModal from '@/components/ChangelogEntryModal';
import { useInactivityTimeout } from '@/lib/useInactivityTimeout';

const KIND_STYLE: Record<ChangelogItemKind, { label: string; color: string; bg: string }> = {
  added: { label: 'Added', color: '#0f7b46', bg: '#e8f6ee' },
  changed: { label: 'Changed', color: '#1d4ed8', bg: '#e8eefc' },
  fixed: { label: 'Fixed', color: '#b45309', bg: '#fdf1e0' },
  removed: { label: 'Removed', color: '#b91c1c', bg: '#fdeaea' },
};

const KIND_ORDER: ChangelogItemKind[] = ['added', 'changed', 'fixed', 'removed'];

function formatDate(iso?: string | null) {
  if (!iso) return '';
  return new Date(iso).toLocaleDateString(undefined, { day: 'numeric', month: 'short', year: 'numeric' });
}

export default function ChangelogPage() {
  useInactivityTimeout();
  const [entries, setEntries] = useState<ChangelogEntry[]>([]);
  const [boards, setBoards] = useState<Board[]>([]);
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);
  const [editing, setEditing] = useState<ChangelogEntry | null>(null);
  const [showEditor, setShowEditor] = useState(false);
  const [deleteTarget, setDeleteTarget] = useState<ChangelogEntry | null>(null);
  const [deleting, setDeleting] = useState(false);
  const router = useRouter();

  const isAdmin = user?.role === 'admin';

  const load = useCallback(async () => {
    try {
      const { data } = await api.get('/changelog');
      setEntries(data);
    } catch {
      /* interceptor handles auth failures */
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    const stored = localStorage.getItem('user');
    if (!stored) { router.push('/'); return; }
    const u = JSON.parse(stored);
    if (u.mustChangePassword) { router.push('/change-password'); return; }
    setUser(u);
    load();
    if (u.role === 'admin') {
      api.get('/boards').then(({ data }) => setBoards(data)).catch(() => {});
    }
  }, [load, router]);

  const openNew = () => { setEditing(null); setShowEditor(true); };
  const openEdit = (entry: ChangelogEntry) => { setEditing(entry); setShowEditor(true); };

  const handleSaved = (saved: ChangelogEntry) => {
    setEntries((prev) => {
      const exists = prev.some((e) => e.id === saved.id);
      const next = exists ? prev.map((e) => (e.id === saved.id ? saved : e)) : [saved, ...prev];
      return next.sort((a, b) => {
        const ad = a.publishedAt || a.createdAt;
        const bd = b.publishedAt || b.createdAt;
        return new Date(bd).getTime() - new Date(ad).getTime();
      });
    });
    setShowEditor(false);
    setEditing(null);
  };

  const confirmDelete = async () => {
    if (!deleteTarget) return;
    setDeleting(true);
    try {
      await api.delete(`/changelog/${deleteTarget.id}`);
      setEntries((prev) => prev.filter((e) => e.id !== deleteTarget.id));
      setDeleteTarget(null);
    } finally { setDeleting(false); }
  };

  return (
    <div className="min-h-screen bg-[#f7f8fa]">
      <nav className="bg-white border-b border-gray-200 px-4 sm:px-6 py-0 flex items-center justify-between sticky top-0 z-10 h-14">
        <button onClick={() => router.push('/dashboard')} className="flex items-center gap-2.5" title="Back to boards">
          <Image src="/logo.png" width={28} height={28} alt="Fluxus" className="rounded-md" />
          <span className="font-bold text-base tracking-tight" style={{ color: '#1a1f3c' }}>FluxusTeam</span>
        </button>
        <div className="flex items-center gap-2 sm:gap-4">
          <button
            onClick={() => router.push('/dashboard')}
            className="text-sm px-3 py-1.5 rounded-lg font-medium text-gray-500 hover:text-gray-800 hover:bg-gray-50 transition-colors"
          >
            Boards
          </button>
          {user && <NotificationBell userId={user.id} />}
          {user && (
            <img src={avatarUrl(user.name)} className="w-8 h-8 rounded-full flex-shrink-0" alt={user.name} />
          )}
        </div>
      </nav>

      <div className="max-w-3xl mx-auto px-4 sm:px-6 py-8">
        <div className="flex items-start justify-between gap-4 mb-6">
          <div>
            <h1 className="text-2xl font-bold tracking-tight" style={{ color: '#1a1f3c' }}>Changelog</h1>
            <p className="text-sm text-gray-500 mt-1">Release notes across every project.</p>
          </div>
          {isAdmin && (
            <button
              onClick={openNew}
              className="text-sm px-4 py-2 rounded-lg font-semibold text-white transition-all duration-150 flex-shrink-0"
              style={{ background: '#e8390e' }}
              onMouseEnter={(e) => { e.currentTarget.style.background = '#c73009'; }}
              onMouseLeave={(e) => { e.currentTarget.style.background = '#e8390e'; }}
            >
              + New entry
            </button>
          )}
        </div>

        {loading ? (
          <div className="py-16 text-center text-sm text-gray-400">Loading…</div>
        ) : entries.length === 0 ? (
          <div className="bg-white border border-gray-200 rounded-xl py-16 text-center">
            <p className="text-sm text-gray-400">No changelog entries yet</p>
            {isAdmin && (
              <button onClick={openNew} className="text-sm mt-3 font-medium" style={{ color: '#e8390e' }}>
                Write the first one
              </button>
            )}
          </div>
        ) : (
          <div className="space-y-4">
            {entries.map((entry) => {
              const grouped = KIND_ORDER
                .map((kind) => ({ kind, items: entry.items.filter((i) => i.kind === kind) }))
                .filter((g) => g.items.length > 0);

              return (
                <article key={entry.id} className="bg-white border border-gray-200 rounded-xl p-5">
                  <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0">
                      <div className="flex items-center gap-2 flex-wrap">
                        {entry.version && (
                          <span
                            className="text-xs font-bold px-2 py-0.5 rounded-md"
                            style={{ background: '#1a1f3c', color: 'white' }}
                          >
                            {entry.version}
                          </span>
                        )}
                        <h2 className="text-base font-semibold truncate" style={{ color: '#1a1f3c' }}>{entry.title}</h2>
                        {!entry.publishedAt && (
                          <span className="text-[10px] font-bold px-2 py-0.5 rounded-md bg-gray-100 text-gray-500 uppercase tracking-wide">
                            Draft
                          </span>
                        )}
                      </div>
                      <div className="flex items-center gap-2 mt-1.5 text-xs text-gray-400 flex-wrap">
                        <span
                          className="px-2 py-0.5 rounded-md font-medium"
                          style={{ background: '#f0f2f5', color: '#4b5563' }}
                        >
                          {entry.board ? entry.board.name : 'All projects'}
                        </span>
                        <span>{formatDate(entry.publishedAt || entry.createdAt)}</span>
                        {entry.author && <span>· {entry.author.name}</span>}
                      </div>
                    </div>

                    {isAdmin && (
                      <div className="flex items-center gap-1 flex-shrink-0">
                        <button
                          onClick={() => openEdit(entry)}
                          className="text-xs px-2 py-1 rounded-md text-gray-400 hover:text-gray-700 hover:bg-gray-50 transition-colors"
                        >
                          Edit
                        </button>
                        <button
                          onClick={() => setDeleteTarget(entry)}
                          className="text-xs px-2 py-1 rounded-md text-gray-400 hover:text-red-600 hover:bg-red-50 transition-colors"
                        >
                          Delete
                        </button>
                      </div>
                    )}
                  </div>

                  {entry.restricted ? (
                    <div className="mt-4 flex items-center gap-2 px-3 py-2.5 rounded-lg bg-gray-50 border border-gray-100">
                      <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#9ca3af" strokeWidth="2" strokeLinecap="round">
                        <rect x="3" y="11" width="18" height="11" rx="2" />
                        <path d="M7 11V7a5 5 0 0 1 10 0v4" />
                      </svg>
                      <span className="text-xs text-gray-500">
                        {entry.itemCount} {entry.itemCount === 1 ? 'update' : 'updates'} — details visible to
                        {' '}{entry.board?.name || 'board'} members
                      </span>
                    </div>
                  ) : (
                    <>
                      {entry.summary && (
                        <p className="text-sm text-gray-600 mt-3 leading-relaxed whitespace-pre-wrap">{entry.summary}</p>
                      )}
                      {grouped.map(({ kind, items }) => (
                        <div key={kind} className="mt-4">
                          <span
                            className="text-[10px] font-bold px-2 py-0.5 rounded-md uppercase tracking-wide"
                            style={{ background: KIND_STYLE[kind].bg, color: KIND_STYLE[kind].color }}
                          >
                            {KIND_STYLE[kind].label}
                          </span>
                          <ul className="mt-2 space-y-1.5">
                            {items.map((item: ChangelogItem, i: number) => (
                              <li key={i} className="flex gap-2 text-sm text-gray-700 leading-relaxed">
                                <span className="text-gray-300 flex-shrink-0">•</span>
                                <span className="min-w-0">{item.text}</span>
                              </li>
                            ))}
                          </ul>
                        </div>
                      ))}
                    </>
                  )}
                </article>
              );
            })}
          </div>
        )}
      </div>

      {showEditor && (
        <ChangelogEntryModal
          entry={editing}
          boards={boards}
          onClose={() => { setShowEditor(false); setEditing(null); }}
          onSaved={handleSaved}
        />
      )}

      {deleteTarget && (
        <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-xl p-6 w-full max-w-sm">
            <h3 className="text-base font-semibold" style={{ color: '#1a1f3c' }}>Delete entry?</h3>
            <p className="text-sm text-gray-500 mt-2">
              &ldquo;{deleteTarget.title}&rdquo; will be removed for everyone. This can&apos;t be undone.
            </p>
            <div className="flex gap-2 mt-5 justify-end">
              <button
                onClick={() => setDeleteTarget(null)}
                className="text-sm px-4 py-2 rounded-lg font-medium text-gray-500 hover:bg-gray-50 transition-colors"
              >
                Cancel
              </button>
              <button
                onClick={confirmDelete}
                disabled={deleting}
                className="text-sm px-4 py-2 rounded-lg font-semibold text-white disabled:opacity-50 transition-colors"
                style={{ background: '#e8390e' }}
              >
                {deleting ? 'Deleting…' : 'Delete'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
