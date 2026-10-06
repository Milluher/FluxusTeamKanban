'use client';
import { useEffect, useMemo, useRef, useState } from 'react';
import api from '@/lib/api';
import { DictionaryTerm, User } from '@/types';
import { formatTimestamp } from '@/lib/formatDate';
import Avatar from './Avatar';
import RowMenu from './RowMenu';

interface Props {
  user: User;
  onClose: () => void;
}

const inputStyle: React.CSSProperties = {
  border: '1px solid #e5e7eb',
  borderRadius: '8px',
  outline: 'none',
  width: '100%',
};

const inputFocus = {
  onFocus: (e: React.FocusEvent<HTMLInputElement | HTMLTextAreaElement>) => {
    e.currentTarget.style.borderColor = '#e8390e';
    e.currentTarget.style.boxShadow = '0 0 0 3px rgba(232,57,14,0.1)';
  },
  onBlur: (e: React.FocusEvent<HTMLInputElement | HTMLTextAreaElement>) => {
    e.currentTarget.style.borderColor = '#e5e7eb';
    e.currentTarget.style.boxShadow = 'none';
  },
};

/**
 * Alphabetical, ignoring case.
 *
 * The server sorts too, but the order is a stated property of the dictionary,
 * so it is enforced where it is rendered: a term added or renamed in the panel
 * lands in place rather than at the end of the list.
 */
function sorted(list: DictionaryTerm[]): DictionaryTerm[] {
  return [...list].sort((a, b) => a.term.localeCompare(b.term, undefined, { sensitivity: 'base' }));
}

// A panel, not a modal: no backdrop and nothing behind it is blocked, because
// you look a term up *while* doing something else. Terms arrive alphabetically
// from the server.
export default function DictionarySidebar({ user, onClose }: Props) {
  const [terms, setTerms] = useState<DictionaryTerm[]>([]);
  const [loading, setLoading] = useState(true);
  const [query, setQuery] = useState('');
  const [adding, setAdding] = useState(false);
  const [form, setForm] = useState({ term: '', definition: '' });
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [editing, setEditing] = useState<string | null>(null);
  const [editForm, setEditForm] = useState({ term: '', definition: '' });
  const [removing, setRemoving] = useState<string | null>(null);
  const panelRef = useRef<HTMLElement | null>(null);

  useEffect(() => {
    let live = true;
    api
      .get<DictionaryTerm[]>('/dictionary')
      .then(({ data }) => { if (live) setTerms(sorted(data)); })
      .catch(() => { if (live) setError('Could not load the dictionary.'); })
      .finally(() => { if (live) setLoading(false); });
    return () => { live = false; };
  }, []);

  // Escape closes, as it does for the modals.
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose(); };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [onClose]);

  const visible = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return terms;
    return terms.filter(
      (t) => t.term.toLowerCase().includes(q) || t.definition.toLowerCase().includes(q)
    );
  }, [terms, query]);

  const add = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!form.term.trim() || !form.definition.trim()) return;
    setSaving(true);
    setError('');
    try {
      const { data } = await api.post<DictionaryTerm>('/dictionary', form);
      setTerms((prev) => sorted([...prev, data]));
      setForm({ term: '', definition: '' });
      setAdding(false);
    } catch (err: any) {
      setError(err.response?.data?.error || 'Could not add that term.');
    } finally {
      setSaving(false);
    }
  };

  const saveEdit = async (id: string) => {
    if (!editForm.term.trim() || !editForm.definition.trim()) return;
    setSaving(true);
    setError('');
    try {
      const { data } = await api.patch<DictionaryTerm>(`/dictionary/${id}`, editForm);
      setTerms((prev) => sorted(prev.map((t) => (t.id === id ? data : t))));
      setEditing(null);
    } catch (err: any) {
      setError(err.response?.data?.error || 'Could not save that term.');
    } finally {
      setSaving(false);
    }
  };

  const remove = async (id: string) => {
    setError('');
    try {
      await api.delete(`/dictionary/${id}`);
      setTerms((prev) => prev.filter((t) => t.id !== id));
      setRemoving(null);
    } catch (err: any) {
      setError(err.response?.data?.error || 'Could not remove that term.');
    }
  };

  return (
    <aside
      ref={panelRef}
      aria-label="Riverly Dictionary"
      className="fixed right-0 top-14 bottom-0 w-full sm:w-96 bg-white border-l border-gray-200 flex flex-col z-20"
      style={{ boxShadow: '-8px 0 24px rgba(0,0,0,0.06)' }}
    >
      <div className="px-4 py-3 border-b border-gray-200 flex items-center gap-2 flex-shrink-0">
        <h2 className="font-bold text-base min-w-0 truncate" style={{ color: '#1a1f3c' }}>
          Riverly Dictionary
        </h2>
        <span className="text-xs font-semibold px-2 py-0.5 rounded-full bg-gray-100 text-gray-600 flex-shrink-0">
          {terms.length}
        </span>
        <button
          onClick={onClose}
          aria-label="Close dictionary"
          className="ml-auto w-8 h-8 flex-shrink-0 flex items-center justify-center rounded-lg text-gray-500 bg-gray-100 hover:bg-gray-200 text-lg"
        >
          ×
        </button>
      </div>

      <div className="px-4 py-3 border-b border-gray-100 space-y-2.5 flex-shrink-0">
        <input
          type="search"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="Search terms…"
          aria-label="Search terms"
          className="px-3 py-2 text-sm text-gray-900 placeholder-gray-500"
          style={inputStyle}
          {...inputFocus}
        />

        {adding ? (
          <form onSubmit={add} className="space-y-2 pt-0.5">
            <input
              autoFocus
              type="text"
              value={form.term}
              onChange={(e) => setForm({ ...form, term: e.target.value })}
              placeholder="Term, e.g. KYB"
              aria-label="Term"
              className="px-3 py-2 text-sm text-gray-900 placeholder-gray-500"
              style={inputStyle}
              {...inputFocus}
            />
            <textarea
              value={form.definition}
              onChange={(e) => setForm({ ...form, definition: e.target.value })}
              placeholder="What it means…"
              aria-label="Definition"
              rows={3}
              className="px-3 py-2 text-sm text-gray-900 placeholder-gray-500 resize-y"
              style={inputStyle}
              {...inputFocus}
            />
            <div className="flex gap-2">
              <button
                type="button"
                onClick={() => { setAdding(false); setError(''); }}
                className="flex-1 py-2 min-h-[40px] rounded-lg text-sm font-semibold text-gray-600 border border-gray-200 bg-white hover:text-gray-900"
              >
                Cancel
              </button>
              <button
                type="submit"
                disabled={saving || !form.term.trim() || !form.definition.trim()}
                className="flex-1 py-2 min-h-[40px] rounded-lg text-sm font-bold text-white disabled:opacity-50"
                style={{ background: '#c73009' }}
              >
                {saving ? 'Adding…' : 'Add term'}
              </button>
            </div>
          </form>
        ) : (
          <button
            onClick={() => { setAdding(true); setError(''); }}
            className="w-full py-2 min-h-[40px] text-sm font-semibold rounded-lg border border-dashed border-gray-300 text-gray-600 hover:border-gray-400 hover:text-gray-900 transition-colors"
          >
            + Add a term
          </button>
        )}
      </div>

      {error && (
        <p role="alert" className="mx-4 mt-3 px-3 py-2 rounded-lg text-sm bg-red-50 text-red-700 border border-red-200">
          {error}
        </p>
      )}

      <div className="flex-1 overflow-y-auto px-4 py-3">
        {loading ? (
          <p className="text-sm text-gray-600 py-8 text-center">Loading the dictionary…</p>
        ) : terms.length === 0 ? (
          <div className="py-10 text-center">
            <p className="text-sm font-semibold text-gray-700 mb-1">No terms yet</p>
            <p className="text-sm text-gray-600">Add the first one — anyone on the workspace can.</p>
          </div>
        ) : visible.length === 0 ? (
          <p className="text-sm text-gray-600 py-8 text-center">Nothing matches “{query.trim()}”.</p>
        ) : (
          <ul className="space-y-3">
            {visible.map((t) => {
              const mine = t.createdBy.id === user.id || user.role === 'admin';
              const added = formatTimestamp(t.createdAt);

              if (editing === t.id) {
                return (
                  <li key={t.id} className="rounded-xl border border-gray-200 p-3 space-y-2">
                    <input
                      autoFocus
                      type="text"
                      value={editForm.term}
                      onChange={(e) => setEditForm({ ...editForm, term: e.target.value })}
                      aria-label="Term"
                      className="px-3 py-2 text-sm text-gray-900"
                      style={inputStyle}
                      {...inputFocus}
                    />
                    <textarea
                      value={editForm.definition}
                      onChange={(e) => setEditForm({ ...editForm, definition: e.target.value })}
                      aria-label="Definition"
                      rows={3}
                      className="px-3 py-2 text-sm text-gray-900 resize-y"
                      style={inputStyle}
                      {...inputFocus}
                    />
                    <div className="flex gap-2">
                      <button
                        type="button"
                        onClick={() => { setEditing(null); setError(''); }}
                        className="flex-1 py-1.5 min-h-[36px] rounded-lg text-sm font-semibold text-gray-600 border border-gray-200 bg-white"
                      >
                        Cancel
                      </button>
                      <button
                        type="button"
                        onClick={() => saveEdit(t.id)}
                        disabled={saving}
                        className="flex-1 py-1.5 min-h-[36px] rounded-lg text-sm font-bold text-white disabled:opacity-50"
                        style={{ background: '#c73009' }}
                      >
                        {saving ? 'Saving…' : 'Save'}
                      </button>
                    </div>
                  </li>
                );
              }

              return (
                <li key={t.id} className="rounded-xl border border-gray-200 p-3">
                  <div className="flex items-start gap-2">
                    <h3 className="text-sm font-bold min-w-0 flex-1" style={{ color: '#1a1f3c' }}>
                      {t.term}
                    </h3>
                    {mine && (
                      <RowMenu
                        label={`Actions for ${t.term}`}
                        items={[
                          {
                            label: 'Edit term',
                            onSelect: () => {
                              setEditForm({ term: t.term, definition: t.definition });
                              setEditing(t.id);
                              setError('');
                            },
                          },
                          {
                            label: 'Remove term',
                            destructive: true,
                            onSelect: () => { setRemoving(t.id); setError(''); },
                          },
                        ]}
                      />
                    )}
                  </div>

                  <p className="mt-1 text-sm text-gray-700 whitespace-pre-wrap">{t.definition}</p>

                  <div className="mt-2.5 flex items-center gap-1.5 text-xs text-gray-500">
                    <Avatar name={t.createdBy.name} className="w-5 h-5 text-[8px]" decorative />
                    <span className="truncate">{t.createdBy.name}</span>
                    {added && (
                      <>
                        <span className="text-gray-300 flex-shrink-0" aria-hidden="true">·</span>
                        <span className="whitespace-nowrap flex-shrink-0">{added}</span>
                      </>
                    )}
                  </div>

                  {removing === t.id && (
                    <div className="mt-2.5 flex items-center gap-2 rounded-lg bg-red-50 border border-red-200 px-2.5 py-2">
                      <span className="text-xs font-medium text-red-700 flex-1">Remove this term?</span>
                      <button
                        onClick={() => setRemoving(null)}
                        className="text-xs font-semibold text-gray-600 px-2 py-1 rounded hover:text-gray-900"
                      >
                        Cancel
                      </button>
                      <button
                        onClick={() => remove(t.id)}
                        className="text-xs font-bold text-white px-2.5 py-1 rounded"
                        style={{ background: '#b91c1c' }}
                      >
                        Remove
                      </button>
                    </div>
                  )}
                </li>
              );
            })}
          </ul>
        )}
      </div>
    </aside>
  );
}
