'use client';
import { useEffect, useState } from 'react';
import api from '@/lib/api';
import { Persona, TechComfort, User } from '@/types';
import { formatTimestamp } from '@/lib/formatDate';
import RowMenu from './RowMenu';

interface Props {
  user: User;
  onClose: () => void;
}

/** The template, in the order a persona reads best. */
const ATTRIBUTES: { key: keyof Persona; label: string; rows: number }[] = [
  { key: 'segment', label: 'Segment', rows: 1 },
  { key: 'description', label: 'Description', rows: 3 },
  { key: 'goals', label: 'Goals', rows: 3 },
  { key: 'painPoints', label: 'Pain points', rows: 3 },
  { key: 'behaviours', label: 'Behaviours', rows: 3 },
];

const TECH_COMFORT: { value: TechComfort; label: string; color: string; bg: string }[] = [
  { value: 'low', label: 'Low tech comfort', color: '#b45309', bg: '#fffbeb' },
  { value: 'medium', label: 'Medium tech comfort', color: '#1d4ed8', bg: '#eff6ff' },
  { value: 'high', label: 'High tech comfort', color: '#047857', bg: '#ecfdf5' },
];

const inputStyle: React.CSSProperties = {
  border: '1px solid #e5e7eb',
  borderRadius: '8px',
  outline: 'none',
  width: '100%',
};

const inputFocus = {
  onFocus: (e: React.FocusEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>) => {
    e.currentTarget.style.borderColor = '#e8390e';
    e.currentTarget.style.boxShadow = '0 0 0 3px rgba(232,57,14,0.1)';
  },
  onBlur: (e: React.FocusEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>) => {
    e.currentTarget.style.borderColor = '#e5e7eb';
    e.currentTarget.style.boxShadow = 'none';
  },
};

type Draft = {
  name: string;
  segment: string;
  description: string;
  goals: string;
  painPoints: string;
  behaviours: string;
  techComfort: string;
};

const emptyDraft: Draft = {
  name: '', segment: '', description: '', goals: '', painPoints: '', behaviours: '', techComfort: '',
};

const draftFrom = (p: Persona): Draft => ({
  name: p.name,
  segment: p.segment ?? '',
  description: p.description ?? '',
  goals: p.goals ?? '',
  painPoints: p.painPoints ?? '',
  behaviours: p.behaviours ?? '',
  techComfort: p.techComfort ?? '',
});

// Who we build for, reachable from the workspace and from inside every board.
// Collapsed to a list of names and expanded only when one is clicked: the panel
// is for checking a persona mid-task, not for reading all of them at once.
export default function PersonasPanel({ user, onClose }: Props) {
  const [personas, setPersonas] = useState<Persona[]>([]);
  const [loading, setLoading] = useState(true);
  const [expanded, setExpanded] = useState<string | null>(null);
  const [editing, setEditing] = useState<string | 'new' | null>(null);
  const [draft, setDraft] = useState<Draft>(emptyDraft);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [removing, setRemoving] = useState<string | null>(null);

  const isAdmin = user.role === 'admin';

  useEffect(() => {
    let live = true;
    api
      .get<Persona[]>('/personas')
      .then(({ data }) => { if (live) setPersonas(data); })
      .catch(() => { if (live) setError('Could not load personas.'); })
      .finally(() => { if (live) setLoading(false); });
    return () => { live = false; };
  }, []);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose(); };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [onClose]);

  const sorted = (list: Persona[]) =>
    [...list].sort((a, b) => a.name.localeCompare(b.name, undefined, { sensitivity: 'base' }));

  const save = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!draft.name.trim()) return;
    setSaving(true);
    setError('');
    try {
      if (editing === 'new') {
        const { data } = await api.post<Persona>('/personas', draft);
        setPersonas((prev) => sorted([...prev, data]));
      } else if (editing) {
        const { data } = await api.patch<Persona>(`/personas/${editing}`, draft);
        setPersonas((prev) => sorted(prev.map((p) => (p.id === editing ? data : p))));
      }
      setEditing(null);
      setDraft(emptyDraft);
    } catch (err: any) {
      setError(err.response?.data?.error || 'Could not save that persona.');
    } finally {
      setSaving(false);
    }
  };

  const remove = async (id: string) => {
    setError('');
    try {
      await api.delete(`/personas/${id}`);
      setPersonas((prev) => prev.filter((p) => p.id !== id));
      setRemoving(null);
    } catch (err: any) {
      setError(err.response?.data?.error || 'Could not remove that persona.');
    }
  };

  const form = (
    <form onSubmit={save} className="space-y-2.5 rounded-xl border border-gray-200 p-3">
      <input
        autoFocus
        type="text"
        value={draft.name}
        onChange={(e) => setDraft({ ...draft, name: e.target.value })}
        placeholder="Name, e.g. Smallholder farmer"
        aria-label="Name"
        className="px-3 py-2 text-sm text-gray-900 placeholder-gray-500"
        style={inputStyle}
        {...inputFocus}
      />
      {ATTRIBUTES.map(({ key, label, rows }) =>
        rows === 1 ? (
          <input
            key={key}
            type="text"
            value={draft[key as keyof Draft]}
            onChange={(e) => setDraft({ ...draft, [key]: e.target.value })}
            placeholder={label}
            aria-label={label}
            className="px-3 py-2 text-sm text-gray-900 placeholder-gray-500"
            style={inputStyle}
            {...inputFocus}
          />
        ) : (
          <textarea
            key={key}
            value={draft[key as keyof Draft]}
            onChange={(e) => setDraft({ ...draft, [key]: e.target.value })}
            placeholder={label}
            aria-label={label}
            rows={rows}
            className="px-3 py-2 text-sm text-gray-900 placeholder-gray-500 resize-y"
            style={inputStyle}
            {...inputFocus}
          />
        )
      )}
      <select
        value={draft.techComfort}
        onChange={(e) => setDraft({ ...draft, techComfort: e.target.value })}
        aria-label="Tech comfort"
        className="px-3 py-2 text-sm text-gray-900"
        style={inputStyle}
        {...inputFocus}
      >
        <option value="">Tech comfort — not set</option>
        {TECH_COMFORT.map((t) => (
          <option key={t.value} value={t.value}>{t.label}</option>
        ))}
      </select>

      <div className="flex gap-2">
        <button
          type="button"
          onClick={() => { setEditing(null); setDraft(emptyDraft); setError(''); }}
          className="flex-1 py-2 min-h-[40px] rounded-lg text-sm font-semibold text-gray-600 border border-gray-200 bg-white hover:text-gray-900"
        >
          Cancel
        </button>
        <button
          type="submit"
          disabled={saving || !draft.name.trim()}
          className="flex-1 py-2 min-h-[40px] rounded-lg text-sm font-bold text-white disabled:opacity-50"
          style={{ background: '#c73009' }}
        >
          {saving ? 'Saving…' : editing === 'new' ? 'Add persona' : 'Save changes'}
        </button>
      </div>
    </form>
  );

  return (
    <aside
      aria-label="Personas"
      className="fixed right-0 top-14 bottom-0 w-full sm:w-96 bg-white border-l border-gray-200 flex flex-col z-20"
      style={{ boxShadow: '-8px 0 24px rgba(0,0,0,0.06)' }}
    >
      <div className="px-4 py-3 border-b border-gray-200 flex items-center gap-2 flex-shrink-0">
        <h2 className="font-bold text-base min-w-0 truncate" style={{ color: '#1a1f3c' }}>
          Personas
        </h2>
        <span className="text-xs font-semibold px-2 py-0.5 rounded-full bg-gray-100 text-gray-600 flex-shrink-0">
          {personas.length}
        </span>
        <button
          onClick={onClose}
          aria-label="Close personas"
          className="ml-auto w-8 h-8 flex-shrink-0 flex items-center justify-center rounded-lg text-gray-500 bg-gray-100 hover:bg-gray-200 text-lg"
        >
          ×
        </button>
      </div>

      {isAdmin && editing !== 'new' && (
        <div className="px-4 py-3 border-b border-gray-100 flex-shrink-0">
          <button
            onClick={() => { setEditing('new'); setDraft(emptyDraft); setError(''); }}
            className="w-full py-2 min-h-[40px] text-sm font-semibold rounded-lg border border-dashed border-gray-300 text-gray-600 hover:border-gray-400 hover:text-gray-900 transition-colors"
          >
            + New persona
          </button>
        </div>
      )}

      {error && (
        <p role="alert" className="mx-4 mt-3 px-3 py-2 rounded-lg text-sm bg-red-50 text-red-700 border border-red-200">
          {error}
        </p>
      )}

      <div className="flex-1 overflow-y-auto px-4 py-3 space-y-2.5">
        {editing === 'new' && form}

        {loading ? (
          <p className="text-sm text-gray-600 py-8 text-center">Loading personas…</p>
        ) : personas.length === 0 && editing !== 'new' ? (
          <div className="py-10 text-center">
            <p className="text-sm font-semibold text-gray-700 mb-1">No personas yet</p>
            <p className="text-sm text-gray-600">
              {isAdmin
                ? 'Add the categories of user you build for.'
                : 'An admin adds the categories of user you build for.'}
            </p>
          </div>
        ) : (
          personas.map((persona) => {
            if (editing === persona.id) return <div key={persona.id}>{form}</div>;

            const isOpen = expanded === persona.id;
            const comfort = TECH_COMFORT.find((t) => t.value === persona.techComfort);
            const filled = ATTRIBUTES.filter(({ key }) => persona[key]);
            const added = formatTimestamp(persona.createdAt);

            return (
              <div key={persona.id} className="rounded-xl border border-gray-200 overflow-hidden">
                <div className="flex items-center">
                  {/* Expanded only when clicked, as specified. */}
                  <button
                    onClick={() => setExpanded(isOpen ? null : persona.id)}
                    aria-expanded={isOpen}
                    className="flex-1 min-w-0 text-left px-3 py-2.5 hover:bg-gray-50 transition-colors"
                  >
                    <div className="flex items-center gap-2 min-w-0">
                      <svg
                        width="10"
                        height="10"
                        viewBox="0 0 24 24"
                        fill="none"
                        stroke="currentColor"
                        strokeWidth="3"
                        className="flex-shrink-0 text-gray-400 transition-transform"
                        style={{ transform: isOpen ? 'rotate(90deg)' : 'none' }}
                        aria-hidden="true"
                      >
                        <path d="M9 18l6-6-6-6" />
                      </svg>
                      <span className="text-sm font-bold min-w-0 truncate" style={{ color: '#1a1f3c' }}>
                        {persona.name}
                      </span>
                      {persona.segment && (
                        <span className="text-xs text-gray-500 truncate flex-shrink min-w-0">{persona.segment}</span>
                      )}
                    </div>
                  </button>
                  {isAdmin && (
                    <div className="pr-2 flex-shrink-0">
                      <RowMenu
                        label={`Actions for ${persona.name}`}
                        items={[
                          {
                            label: 'Edit persona',
                            onSelect: () => { setDraft(draftFrom(persona)); setEditing(persona.id); setError(''); },
                          },
                          {
                            label: 'Remove persona',
                            destructive: true,
                            onSelect: () => { setRemoving(persona.id); setError(''); },
                          },
                        ]}
                      />
                    </div>
                  )}
                </div>

                {isOpen && (
                  <div className="px-3 pb-3 pt-1 border-t border-gray-100 space-y-2.5">
                    {comfort && (
                      <span
                        className="inline-flex text-xs font-semibold px-2 py-0.5 rounded-full"
                        style={{ background: comfort.bg, color: comfort.color }}
                      >
                        {comfort.label}
                      </span>
                    )}
                    {filled.length === 0 && !comfort ? (
                      <p className="text-xs text-gray-500">
                        Nothing recorded yet beyond the name.
                      </p>
                    ) : (
                      filled.map(({ key, label }) => (
                        <div key={key}>
                          <h4 className="text-xs font-semibold uppercase tracking-wider text-gray-500 mb-0.5">
                            {label}
                          </h4>
                          <p className="text-sm text-gray-700 whitespace-pre-wrap">{persona[key] as string}</p>
                        </div>
                      ))
                    )}
                    <p className="text-xs text-gray-500 pt-0.5">
                      Added by {persona.createdBy.name}{added ? ` · ${added}` : ''}
                    </p>
                  </div>
                )}

                {removing === persona.id && (
                  <div className="mx-3 mb-3 flex items-center gap-2 rounded-lg bg-red-50 border border-red-200 px-2.5 py-2">
                    <span className="text-xs font-medium text-red-700 flex-1">Remove this persona?</span>
                    <button
                      onClick={() => setRemoving(null)}
                      className="text-xs font-semibold text-gray-600 px-2 py-1 rounded hover:text-gray-900"
                    >
                      Cancel
                    </button>
                    <button
                      onClick={() => remove(persona.id)}
                      className="text-xs font-bold text-white px-2.5 py-1 rounded"
                      style={{ background: '#b91c1c' }}
                    >
                      Remove
                    </button>
                  </div>
                )}
              </div>
            );
          })
        )}
      </div>
    </aside>
  );
}
