'use client';
import { useEffect, useState } from 'react';
import api from '@/lib/api';
import { Board, ChangelogEntry, ChangelogItem, ChangelogItemKind, User } from '@/types';
import { formatDay } from '@/lib/formatDate';
import RowMenu from './RowMenu';
import ChangelogEntryModal from './ChangelogEntryModal';

interface Props {
  user: User;
  /**
   * The board to scope to. Inside a board this is that board, and a new entry
   * starts on it. Outside one the panel lists every project the viewer can see.
   */
  boardId?: string;
  onClose: () => void;
}

const NAVY = '#1a1f3c';

const KIND_STYLE: Record<ChangelogItemKind, { label: string; color: string; bg: string }> = {
  added: { label: 'Added', color: '#0f7b46', bg: '#e8f6ee' },
  changed: { label: 'Changed', color: '#1d4ed8', bg: '#e8eefc' },
  fixed: { label: 'Fixed', color: '#b45309', bg: '#fdf1e0' },
  removed: { label: 'Removed', color: '#b91c1c', bg: '#fdeaea' },
};

const KIND_ORDER: ChangelogItemKind[] = ['added', 'changed', 'fixed', 'removed'];

/**
 * Release notes, beside the board rather than on a page of their own.
 *
 * "What changed?" is a question you ask *while* looking at the work — checking
 * whether the thing you are about to raise a ticket for already shipped, or what
 * went out in the sprint you have open. Answering it used to cost you the board.
 *
 * Collapsed to titles and expanded on click, like the other panels: this is for
 * checking one entry, not for reading the whole history.
 */
export default function ChangelogSidebar({ user, boardId, onClose }: Props) {
  const [entries, setEntries] = useState<ChangelogEntry[]>([]);
  const [boards, setBoards] = useState<Board[]>([]);
  const [loading, setLoading] = useState(true);
  const [expanded, setExpanded] = useState<string | null>(null);
  const [editing, setEditing] = useState<ChangelogEntry | 'new' | null>(null);
  const [removing, setRemoving] = useState<string | null>(null);
  const [error, setError] = useState('');

  const isAdmin = user.role === 'admin';

  useEffect(() => {
    let live = true;
    setLoading(true);
    api
      .get<ChangelogEntry[]>('/changelog', { params: boardId ? { boardId } : undefined })
      .then(({ data }) => { if (live) setEntries(data); })
      .catch(() => { if (live) setError('Could not load the changelog.'); })
      .finally(() => { if (live) setLoading(false); });
    return () => { live = false; };
  }, [boardId]);

  // Only an admin can write an entry, and the editor needs the project list —
  // fetched whole rather than narrowed, so the picker can still show the right
  // project by name when the panel was opened inside one.
  useEffect(() => {
    if (!isAdmin) return;
    let live = true;
    api.get<Board[]>('/boards')
      .then(({ data }) => { if (live) setBoards(data); })
      .catch(() => {});
    return () => { live = false; };
  }, [isAdmin]);

  useEffect(() => {
    // Escape closes the panel, but not while the editor is up over it: that
    // form holds a half-written entry nobody wants to retype.
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape' && !editing && !removing) onClose(); };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [onClose, editing, removing]);

  const saved = (entry: ChangelogEntry) => {
    setEntries((prev) => {
      const exists = prev.some((e) => e.id === entry.id);
      const next = exists ? prev.map((e) => (e.id === entry.id ? entry : e)) : [entry, ...prev];
      return next.sort((a, b) => {
        const ad = a.publishedAt || a.createdAt;
        const bd = b.publishedAt || b.createdAt;
        return new Date(bd).getTime() - new Date(ad).getTime();
      });
    });
    setExpanded(entry.id);
    setEditing(null);
  };

  const remove = async (id: string) => {
    setError('');
    try {
      await api.delete(`/changelog/${id}`);
      setEntries((prev) => prev.filter((e) => e.id !== id));
      setRemoving(null);
    } catch (e: any) {
      setError(e.response?.data?.error || 'Could not remove that entry.');
    }
  };

  return (
    <>
      <aside
        aria-label="Changelog"
        className="fixed right-0 top-14 bottom-0 w-full sm:w-96 bg-white border-l border-gray-200 flex flex-col z-20"
        style={{ boxShadow: '-8px 0 24px rgba(0,0,0,0.06)' }}
      >
        <div className="px-4 py-3 border-b border-gray-200 flex items-center gap-2 flex-shrink-0">
          <h2 className="font-bold text-base min-w-0 truncate" style={{ color: NAVY }}>
            Changelog
          </h2>
          {!boardId && (
            <span className="text-xs font-medium text-gray-500 flex-shrink-0">All projects</span>
          )}
          <span className="text-xs font-semibold px-2 py-0.5 rounded-full bg-gray-100 text-gray-600 flex-shrink-0">
            {entries.length}
          </span>
          <button
            onClick={onClose}
            aria-label="Close changelog"
            className="ml-auto w-8 h-8 flex-shrink-0 flex items-center justify-center rounded-lg text-gray-500 bg-gray-100 hover:bg-gray-200 text-lg"
          >
            ×
          </button>
        </div>

        {isAdmin && (
          <div className="px-4 py-3 border-b border-gray-100 flex-shrink-0">
            <button
              onClick={() => { setEditing('new'); setError(''); }}
              className="w-full py-2 min-h-[40px] text-sm font-semibold rounded-lg border border-dashed border-gray-300 text-gray-600 hover:border-gray-400 hover:text-gray-900 transition-colors"
            >
              + New entry
            </button>
          </div>
        )}

        {error && (
          <p role="alert" className="mx-4 mt-3 px-3 py-2 rounded-lg text-sm bg-red-50 text-red-700 border border-red-200">
            {error}
          </p>
        )}

        <div className="flex-1 overflow-y-auto px-4 py-3 space-y-2">
          {loading ? (
            <p className="text-sm text-gray-600 py-6 text-center">Loading the changelog…</p>
          ) : entries.length === 0 ? (
            <div className="py-10 text-center">
              <p className="text-sm font-semibold text-gray-700 mb-1">Nothing released yet</p>
              <p className="text-xs text-gray-600">
                {isAdmin
                  ? 'Write up what shipped, so the next person asking "did that go out?" can answer it here.'
                  : 'Release notes will appear here once an admin writes them.'}
              </p>
            </div>
          ) : (
            entries.map((entry) => {
              const isOpen = expanded === entry.id;
              const grouped = KIND_ORDER
                .map((kind) => ({ kind, items: entry.items.filter((i) => i.kind === kind) }))
                .filter((g) => g.items.length > 0);

              return (
                <div key={entry.id} className="rounded-xl border border-gray-200 overflow-hidden">
                  <div className="flex items-center gap-2 px-3 py-2.5">
                    <button
                      type="button"
                      onClick={() => setExpanded(isOpen ? null : entry.id)}
                      aria-expanded={isOpen}
                      className="min-w-0 flex-1 text-left flex items-center gap-2 rounded outline-none"
                    >
                      <svg
                        className="flex-shrink-0" width="11" height="11" viewBox="0 0 24 24" fill="none"
                        stroke="currentColor" strokeWidth="2.5" aria-hidden="true"
                        style={{ color: '#9ca3af', transform: isOpen ? 'none' : 'rotate(-90deg)', transition: 'transform 150ms' }}
                      >
                        <polyline points="6 9 12 15 18 9" />
                      </svg>
                      {entry.version && (
                        <span
                          className="text-[10px] font-bold px-1.5 py-0.5 rounded-md flex-shrink-0"
                          style={{ background: NAVY, color: 'white' }}
                        >
                          {entry.version}
                        </span>
                      )}
                      <span className="text-sm font-semibold truncate" style={{ color: NAVY }}>
                        {entry.title}
                      </span>
                    </button>
                    {!entry.publishedAt && (
                      <span className="text-[10px] font-bold px-1.5 py-0.5 rounded-md bg-gray-100 text-gray-500 uppercase tracking-wide flex-shrink-0">
                        Draft
                      </span>
                    )}
                    {isAdmin && (
                      <RowMenu
                        label={`Actions for ${entry.title}`}
                        items={[
                          { label: 'Edit entry', onSelect: () => { setEditing(entry); setError(''); } },
                          {
                            label: 'Delete entry',
                            destructive: true,
                            onSelect: () => { setRemoving(entry.id); setError(''); },
                          },
                        ]}
                      />
                    )}
                  </div>

                  {isOpen && (
                    <div className="px-3 pb-3 pt-0.5 border-t border-gray-100 space-y-2.5">
                      <p className="flex items-center gap-1.5 text-xs text-gray-500 flex-wrap">
                        {/* Only outside a board: inside one, every entry listed
                            is that project's and naming it is noise. */}
                        {!boardId && (
                          <span
                            className="px-2 py-0.5 rounded-md font-medium"
                            style={{ background: '#f0f2f5', color: '#4b5563' }}
                          >
                            {entry.board?.name ?? 'Unknown project'}
                          </span>
                        )}
                        <span>{formatDay(entry.publishedAt || entry.createdAt) ?? ''}</span>
                        {entry.author && <span>· {entry.author.name}</span>}
                      </p>

                      {entry.restricted ? (
                        // Listed for anyone who can see the project, spelled out
                        // only for its members — so say that rather than showing
                        // an entry that looks empty.
                        <div className="flex items-center gap-2 px-3 py-2.5 rounded-lg bg-gray-50 border border-gray-100">
                          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#9ca3af" strokeWidth="2" strokeLinecap="round" aria-hidden="true">
                            <rect x="3" y="11" width="18" height="11" rx="2" />
                            <path d="M7 11V7a5 5 0 0 1 10 0v4" />
                          </svg>
                          <span className="text-xs text-gray-500">
                            {entry.itemCount} {entry.itemCount === 1 ? 'update' : 'updates'} — details visible to
                            {' '}{entry.board?.name || 'project'} members
                          </span>
                        </div>
                      ) : (
                        <>
                          {entry.summary && (
                            <p className="text-sm text-gray-600 leading-relaxed whitespace-pre-wrap">
                              {entry.summary}
                            </p>
                          )}
                          {grouped.map(({ kind, items }) => (
                            <div key={kind}>
                              <span
                                className="text-[10px] font-bold px-2 py-0.5 rounded-md uppercase tracking-wide"
                                style={{ background: KIND_STYLE[kind].bg, color: KIND_STYLE[kind].color }}
                              >
                                {KIND_STYLE[kind].label}
                              </span>
                              <ul className="mt-1.5 space-y-1">
                                {items.map((item: ChangelogItem, i: number) => (
                                  <li key={i} className="flex gap-1.5 text-xs text-gray-700 leading-relaxed">
                                    <span className="text-gray-300 flex-shrink-0">•</span>
                                    <span className="min-w-0">{item.text}</span>
                                  </li>
                                ))}
                              </ul>
                            </div>
                          ))}
                        </>
                      )}

                      {removing === entry.id && (
                        <div className="flex items-center gap-2 rounded-lg bg-red-50 border border-red-200 px-3 py-2">
                          <span className="text-xs font-medium text-red-700 flex-1">
                            Delete it? It goes for everyone.
                          </span>
                          <button
                            onClick={() => setRemoving(null)}
                            className="text-xs font-semibold text-gray-600 px-2 py-1 rounded hover:text-gray-900"
                          >
                            Cancel
                          </button>
                          <button
                            onClick={() => remove(entry.id)}
                            className="text-xs font-bold text-white px-2.5 py-1 rounded"
                            style={{ background: '#b91c1c' }}
                          >
                            Delete
                          </button>
                        </div>
                      )}
                    </div>
                  )}
                </div>
              );
            })
          )}
        </div>
      </aside>

      {editing && (
        <ChangelogEntryModal
          entry={editing === 'new' ? null : editing}
          boards={boards}
          defaultBoardId={boardId}
          onClose={() => setEditing(null)}
          onSaved={saved}
        />
      )}
    </>
  );
}
