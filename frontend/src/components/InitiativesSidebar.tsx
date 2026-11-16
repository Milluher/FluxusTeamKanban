'use client';
import { useEffect, useState } from 'react';
import Link from 'next/link';
import api from '@/lib/api';
import { Initiative, InitiativeStatus, User } from '@/types';
import { formatTimestamp } from '@/lib/formatDate';
import RowMenu from './RowMenu';
import InitiativeModal from './InitiativeModal';

interface Props {
  user: User;
  /**
   * The board to scope to. Inside a board this is that board, and a new
   * initiative goes to it without being asked. Outside one the panel lists
   * every board's initiatives and the form asks which board it belongs to.
   */
  boardId?: string;
  onClose: () => void;
}

const NAVY = '#1a1f3c';

export const STATUS: Record<InitiativeStatus, { label: string; color: string; bg: string; border: string }> = {
  in_progress: { label: 'In Progress', color: '#c2410c', bg: '#fff7ed', border: '#fed7aa' },
  achieved: { label: 'Achieved', color: '#047857', bg: '#ecfdf5', border: '#a7f3d0' },
};

/**
 * The strategic goals, in a panel rather than on a page of their own.
 *
 * An initiative is the "why" behind the tickets on the board in front of you,
 * so checking one used to mean navigating away from the thing you were trying
 * to connect it to — losing the sprint you had open to go and read what it was
 * for. It sits beside the board now, like the personas and the dictionary.
 *
 * Collapsed to titles and expanded only when one is clicked, for the same
 * reason the personas panel is: this is for checking an initiative mid-task,
 * not for reading all of them at once.
 */
export default function InitiativesSidebar({ user, boardId, onClose }: Props) {
  const [initiatives, setInitiatives] = useState<Initiative[]>([]);
  const [loading, setLoading] = useState(true);
  const [expanded, setExpanded] = useState<string | null>(null);
  const [editing, setEditing] = useState<Initiative | 'new' | null>(null);
  const [savingStatus, setSavingStatus] = useState<string | null>(null);
  const [removing, setRemoving] = useState<string | null>(null);
  const [error, setError] = useState('');

  useEffect(() => {
    let live = true;
    setLoading(true);
    api
      .get<Initiative[]>('/initiatives', { params: boardId ? { boardId } : undefined })
      .then(({ data }) => { if (live) setInitiatives(data); })
      .catch(() => { if (live) setError('Could not load initiatives.'); })
      .finally(() => { if (live) setLoading(false); });
    return () => { live = false; };
  }, [boardId]);

  useEffect(() => {
    // Escape closes the panel — but not while the create/edit modal is up over
    // it, which has its own Escape and its own unsaved text to lose.
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape' && !editing) onClose(); };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [onClose, editing]);

  const canEdit = (initiative: Initiative) =>
    initiative.createdById === user.id || user.role === 'admin';

  const setStatus = async (initiative: Initiative, status: InitiativeStatus) => {
    if (initiative.status === status) return;
    setSavingStatus(initiative.id);
    setError('');
    try {
      const { data } = await api.patch<Initiative>(`/initiatives/${initiative.id}`, { status });
      setInitiatives((prev) => prev.map((i) => (i.id === initiative.id ? data : i)));
    } catch (e: any) {
      setError(e.response?.data?.error || 'Could not change the status.');
    } finally {
      setSavingStatus(null);
    }
  };

  const remove = async (id: string) => {
    setError('');
    try {
      await api.delete(`/initiatives/${id}`);
      setInitiatives((prev) => prev.filter((i) => i.id !== id));
      setRemoving(null);
    } catch (e: any) {
      setError(e.response?.data?.error || 'Could not remove that initiative.');
    }
  };

  const saved = (initiative: Initiative) => {
    setInitiatives((prev) => {
      const exists = prev.some((i) => i.id === initiative.id);
      return exists ? prev.map((i) => (i.id === initiative.id ? initiative : i)) : [initiative, ...prev];
    });
    // A new one opens expanded: you just described it, and the tickets section
    // is what you do next.
    setExpanded(initiative.id);
    setEditing(null);
  };

  return (
    <>
      <aside
        aria-label="Initiatives"
        className="fixed right-0 top-14 bottom-0 w-full sm:w-96 bg-white border-l border-gray-200 flex flex-col z-20"
        style={{ boxShadow: '-8px 0 24px rgba(0,0,0,0.06)' }}
      >
        <div className="px-4 py-3 border-b border-gray-200 flex items-center gap-2 flex-shrink-0">
          <h2 className="font-bold text-base min-w-0 truncate" style={{ color: NAVY }}>
            Initiatives
          </h2>
          {!boardId && (
            <span className="text-xs font-medium text-gray-500 flex-shrink-0">All boards</span>
          )}
          <span className="text-xs font-semibold px-2 py-0.5 rounded-full bg-gray-100 text-gray-600 flex-shrink-0">
            {initiatives.length}
          </span>
          <button
            onClick={onClose}
            aria-label="Close initiatives"
            className="ml-auto w-8 h-8 flex-shrink-0 flex items-center justify-center rounded-lg text-gray-500 bg-gray-100 hover:bg-gray-200 text-lg"
          >
            ×
          </button>
        </div>

        <div className="px-4 py-3 border-b border-gray-100 flex-shrink-0">
          <button
            onClick={() => { setEditing('new'); setError(''); }}
            className="w-full py-2 min-h-[40px] text-sm font-semibold rounded-lg border border-dashed border-gray-300 text-gray-600 hover:border-gray-400 hover:text-gray-900 transition-colors"
          >
            + New initiative
          </button>
        </div>

        {error && (
          <p role="alert" className="mx-4 mt-3 px-3 py-2 rounded-lg text-sm bg-red-50 text-red-700 border border-red-200">
            {error}
          </p>
        )}

        <div className="flex-1 overflow-y-auto px-4 py-3 space-y-2">
          {loading ? (
            <p className="text-sm text-gray-600 py-6 text-center">Loading initiatives…</p>
          ) : initiatives.length === 0 ? (
            <div className="py-10 text-center">
              <p className="text-sm font-semibold text-gray-700 mb-1">No initiatives yet</p>
              <p className="text-xs text-gray-600">
                {/* The brief's own definition. "Initiative" is a word people use
                    loosely, so the panel says what one is here. */}
                A large, coordinated body of work aimed at a specific strategic goal.
                Name the goal, then point tickets at it.
              </p>
            </div>
          ) : (
            initiatives.map((initiative) => {
              const status = STATUS[initiative.status] ?? STATUS.in_progress;
              const isOpen = expanded === initiative.id;
              const mine = canEdit(initiative);

              return (
                <div key={initiative.id} className="rounded-xl border border-gray-200 overflow-hidden">
                  <div className="flex items-center gap-2 px-3 py-2.5">
                    <button
                      type="button"
                      onClick={() => setExpanded(isOpen ? null : initiative.id)}
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
                      <span className="text-sm font-semibold truncate" style={{ color: NAVY }}>
                        {initiative.title}
                      </span>
                    </button>
                    <span
                      className="text-[10px] font-bold px-1.5 py-0.5 rounded-full whitespace-nowrap flex-shrink-0"
                      style={{ background: status.bg, color: status.color, border: `1px solid ${status.border}` }}
                    >
                      {status.label}
                    </span>
                    {mine && (
                      <RowMenu
                        label={`Actions for ${initiative.title}`}
                        items={[
                          { label: 'Edit initiative', onSelect: () => { setEditing(initiative); setError(''); } },
                          {
                            label: 'Remove initiative',
                            destructive: true,
                            onSelect: () => { setRemoving(initiative.id); setError(''); },
                          },
                        ]}
                      />
                    )}
                  </div>

                  {isOpen && (
                    <div className="px-3 pb-3 pt-0.5 border-t border-gray-100 space-y-2.5">
                      <p className="text-sm text-gray-700 whitespace-pre-wrap">{initiative.description}</p>

                      <p className="flex items-center gap-1.5 text-xs text-gray-500 min-w-0">
                        {/* Only outside a board: inside one, every initiative
                            listed is that board's and saying so is noise. */}
                        {!boardId && initiative.board && (
                          <>
                            <Link
                              href={`/board/${initiative.board.id}`}
                              className="font-medium text-gray-600 truncate hover:underline"
                            >
                              {initiative.board.name}
                            </Link>
                            <span className="text-gray-300 flex-shrink-0" aria-hidden="true">·</span>
                          </>
                        )}
                        <span className="truncate">{initiative.createdBy.name}</span>
                        {formatTimestamp(initiative.createdAt) && (
                          <>
                            <span className="text-gray-300 flex-shrink-0" aria-hidden="true">·</span>
                            <span className="whitespace-nowrap flex-shrink-0">
                              {formatTimestamp(initiative.createdAt)}
                            </span>
                          </>
                        )}
                      </p>

                      {mine && (
                        <div
                          className="flex rounded-lg overflow-hidden text-xs font-semibold border border-gray-200 w-fit"
                          role="group"
                          aria-label={`Status of ${initiative.title}`}
                        >
                          {(['in_progress', 'achieved'] as const).map((value) => {
                            const cfg = STATUS[value];
                            const active = initiative.status === value;
                            return (
                              <button
                                key={value}
                                onClick={() => setStatus(initiative, value)}
                                disabled={savingStatus === initiative.id}
                                aria-pressed={active}
                                className="px-2.5 py-1 transition-all disabled:opacity-60"
                                style={{
                                  background: active ? cfg.color : 'white',
                                  color: active ? 'white' : '#6b7280',
                                }}
                              >
                                {cfg.label}
                              </button>
                            );
                          })}
                        </div>
                      )}

                      {/* The work raised to fulfil it — title and status. */}
                      <div className="pt-2 border-t border-gray-100">
                        <h3 className="text-[11px] font-semibold uppercase tracking-wider text-gray-500 mb-1.5">
                          {initiative.tickets.length === 0
                            ? 'No tickets yet'
                            : `${initiative.tickets.length} ${initiative.tickets.length === 1 ? 'ticket' : 'tickets'}`}
                        </h3>
                        {initiative.tickets.length === 0 ? (
                          <p className="text-xs text-gray-500">
                            Set the Initiative field on a ticket to connect it here.
                          </p>
                        ) : (
                          <ul className="space-y-1.5">
                            {initiative.tickets.map((t) => {
                              const elsewhere = t.column.board.id !== initiative.boardId;
                              return (
                                <li key={t.id} className="flex items-center gap-2 min-w-0">
                                  <Link
                                    href={`/board/${t.column.board.id}?ticket=${t.id}`}
                                    className="text-xs text-gray-800 truncate min-w-0 flex-1 hover:underline"
                                  >
                                    {t.title}
                                  </Link>
                                  {elsewhere && (
                                    <span
                                      title={`On ${t.column.board.name}, not ${initiative.board?.name ?? 'this board'}`}
                                      className="text-[10px] font-medium px-1.5 py-0.5 rounded-full whitespace-nowrap flex-shrink-0"
                                      style={{ background: '#fffbeb', color: '#b45309' }}
                                    >
                                      {t.column.board.name}
                                    </span>
                                  )}
                                  <span className="text-[10px] font-medium px-1.5 py-0.5 rounded-full bg-gray-100 text-gray-600 whitespace-nowrap flex-shrink-0">
                                    {t.status}
                                  </span>
                                </li>
                              );
                            })}
                          </ul>
                        )}
                      </div>

                      {removing === initiative.id && (
                        <div className="flex items-center gap-2 rounded-lg bg-red-50 border border-red-200 px-3 py-2">
                          <span className="text-xs font-medium text-red-700 flex-1">
                            Remove it? Its tickets are kept.
                          </span>
                          <button
                            onClick={() => setRemoving(null)}
                            className="text-xs font-semibold text-gray-600 px-2 py-1 rounded hover:text-gray-900"
                          >
                            Cancel
                          </button>
                          <button
                            onClick={() => remove(initiative.id)}
                            className="text-xs font-bold text-white px-2.5 py-1 rounded"
                            style={{ background: '#b91c1c' }}
                          >
                            Remove
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
        <InitiativeModal
          initiative={editing === 'new' ? null : editing}
          boardId={boardId}
          onClose={() => setEditing(null)}
          onSaved={saved}
        />
      )}
    </>
  );
}
