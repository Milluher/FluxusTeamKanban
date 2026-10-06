'use client';
import { useCallback, useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import AppHeader from '@/components/AppHeader';
import RowMenu from '@/components/RowMenu';
import InitiativeModal from '@/components/InitiativeModal';
import api from '@/lib/api';
import { Initiative, InitiativeStatus, User } from '@/types';
import { formatTimestamp } from '@/lib/formatDate';
import { useInactivityTimeout } from '@/lib/useInactivityTimeout';

// Straight from the brief. An initiative is a word people use loosely, so the
// page says what one is here rather than leaving it to be inferred.
const WHAT_AN_INITIATIVE_IS =
  'Initiatives are a large, coordinated body of work aimed at a specific strategic goal.';

const STATUS: Record<InitiativeStatus, { label: string; color: string; bg: string; border: string }> = {
  in_progress: { label: 'In Progress', color: '#c2410c', bg: '#fff7ed', border: '#fed7aa' },
  achieved: { label: 'Achieved', color: '#047857', bg: '#ecfdf5', border: '#a7f3d0' },
};

export default function InitiativesPage() {
  useInactivityTimeout();
  const [initiatives, setInitiatives] = useState<Initiative[]>([]);
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);
  const [showCreate, setShowCreate] = useState(false);
  const [editing, setEditing] = useState<Initiative | null>(null);
  const [savingStatus, setSavingStatus] = useState<string | null>(null);
  const [removing, setRemoving] = useState<string | null>(null);
  const [error, setError] = useState('');
  const router = useRouter();

  const load = useCallback(async () => {
    try {
      const { data } = await api.get<Initiative[]>('/initiatives');
      setInitiatives(data);
    } catch {
      // The interceptor handles an expired session; anything else leaves the
      // empty state, which reads correctly.
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
  }, [load, router]);

  const canEdit = (initiative: Initiative) =>
    user != null && (initiative.createdById === user.id || user.role === 'admin');

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
    setShowCreate(false);
    setEditing(null);
  };

  return (
    <div className="min-h-screen bg-[#f7f8fa]">
      <AppHeader user={user} current="initiatives" />

      <main className="max-w-4xl mx-auto px-4 sm:px-6 py-6 sm:py-8">
        <div className="flex items-start justify-between gap-3 mb-5 sm:mb-7">
          <div className="min-w-0">
            <h1 className="text-xl font-bold tracking-tight" style={{ color: '#1a1f3c' }}>
              Initiatives
            </h1>
            <p className="text-sm mt-1 text-gray-600 max-w-xl">{WHAT_AN_INITIATIVE_IS}</p>
          </div>
          <button
            onClick={() => { setShowCreate(true); setError(''); }}
            className="flex items-center gap-1.5 px-4 py-2 min-h-[44px] rounded-lg text-sm font-semibold border transition-all duration-150 flex-shrink-0"
            style={{ color: '#c73009', borderColor: '#e8390e', background: 'white' }}
          >
            <span className="text-base leading-none font-bold">+</span>
            New Initiative
          </button>
        </div>

        {error && (
          <p role="alert" className="mb-4 px-3 py-2 rounded-lg text-sm bg-red-50 text-red-700 border border-red-200">
            {error}
          </p>
        )}

        {loading ? (
          <p className="text-sm text-gray-600 py-10 text-center">Loading initiatives…</p>
        ) : initiatives.length === 0 ? (
          <div className="bg-white border border-gray-200 rounded-xl py-16 text-center">
            <p className="text-base font-semibold text-gray-700 mb-1">No initiatives yet</p>
            <p className="text-sm text-gray-600 mb-5 max-w-sm mx-auto">
              Name the strategic goal, then raise the tickets that get you there.
            </p>
            <button
              onClick={() => setShowCreate(true)}
              className="px-5 py-2.5 rounded-lg text-sm font-semibold text-white"
              style={{ background: '#c73009' }}
            >
              Create the first one
            </button>
          </div>
        ) : (
          <ul className="space-y-4">
            {initiatives.map((initiative) => {
              const status = STATUS[initiative.status] ?? STATUS.in_progress;
              const added = formatTimestamp(initiative.createdAt);
              const mine = canEdit(initiative);

              return (
                <li
                  key={initiative.id}
                  className="bg-white border border-gray-200 rounded-xl overflow-hidden relative"
                >
                  <div className="absolute left-0 top-0 bottom-0 w-1" style={{ background: status.color }} />
                  <div className="pl-5 pr-4 py-4 sm:py-5">
                    <div className="flex items-start gap-2 mb-1.5">
                      <h2 className="font-semibold text-base min-w-0 flex-1" style={{ color: '#1a1f3c' }}>
                        {initiative.title}
                      </h2>
                      {mine ? (
                        <div
                          className="flex rounded-lg overflow-hidden text-xs font-semibold border border-gray-200 flex-shrink-0"
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
                      ) : (
                        <span
                          className="text-xs font-semibold px-2.5 py-1 rounded-full whitespace-nowrap flex-shrink-0"
                          style={{ background: status.bg, color: status.color, border: `1px solid ${status.border}` }}
                        >
                          {status.label}
                        </span>
                      )}
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

                    <p className="text-sm text-gray-700 whitespace-pre-wrap">{initiative.description}</p>

                    <div className="mt-2.5 flex items-center gap-1.5 text-xs text-gray-500">
                      <span className="truncate">{initiative.createdBy.name}</span>
                      {added && (
                        <>
                          <span className="text-gray-300 flex-shrink-0" aria-hidden="true">·</span>
                          <span className="whitespace-nowrap flex-shrink-0">{added}</span>
                        </>
                      )}
                    </div>

                    {/* The work raised to fulfil it — title and status, as specified. */}
                    <div className="mt-3.5 pt-3.5 border-t border-gray-100">
                      <h3 className="text-xs font-semibold uppercase tracking-wider text-gray-500 mb-2">
                        {initiative.tickets.length === 0
                          ? 'No tickets yet'
                          : `${initiative.tickets.length} ${initiative.tickets.length === 1 ? 'ticket' : 'tickets'}`}
                      </h3>
                      {initiative.tickets.length === 0 ? (
                        <p className="text-xs text-gray-500">
                          Set the Initiative property on a ticket to connect it here.
                        </p>
                      ) : (
                        <ul className="space-y-1.5">
                          {initiative.tickets.map((t) => (
                            <li key={t.id} className="flex items-center gap-2 min-w-0">
                              <Link
                                href={`/board/${t.column.board.id}?ticket=${t.id}`}
                                className="text-sm text-gray-800 truncate min-w-0 flex-1 hover:underline"
                              >
                                {t.title}
                              </Link>
                              <span className="text-xs font-medium px-2 py-0.5 rounded-full bg-gray-100 text-gray-600 whitespace-nowrap flex-shrink-0">
                                {t.status}
                              </span>
                            </li>
                          ))}
                        </ul>
                      )}
                    </div>

                    {removing === initiative.id && (
                      <div className="mt-3 flex items-center gap-2 rounded-lg bg-red-50 border border-red-200 px-3 py-2">
                        <span className="text-xs font-medium text-red-700 flex-1">
                          Remove this initiative? Its tickets are kept.
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
                </li>
              );
            })}
          </ul>
        )}
      </main>

      {(showCreate || editing) && (
        <InitiativeModal
          initiative={editing}
          onClose={() => { setShowCreate(false); setEditing(null); }}
          onSaved={saved}
        />
      )}
    </div>
  );
}
