'use client';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import api from '@/lib/api';
import { Persona, Prd, PrdAdminBlock, PrdClassification, User } from '@/types';
import { PRD_CLASSIFICATIONS, PRD_SECTIONS, missingBeforePublish, sectionsFilled } from '@/lib/prdSections';
import { formatTimestamp } from '@/lib/formatDate';

interface Props {
  prd: Prd;
  /** True when the viewer may write to it — its author, or a system admin. */
  canEdit: boolean;
  /** Who is reading. An assignee may answer their own admin block. */
  currentUser?: User | null;
  /** Board members, for choosing who an admin block belongs to. */
  members?: { user: User }[];
  onClose: () => void;
  onSaved: (prd: Prd) => void;
  onDeleted?: (id: string) => void;
}

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

/** How long after the last keystroke the draft is sent. */
const AUTOSAVE_MS = 900;

type Draft = Record<string, string>;

function draftFrom(prd: Prd): Draft {
  const draft: Draft = {
    title: prd.title,
    version: prd.version ?? '',
    classification: prd.classification ?? '',
  };
  for (const section of PRD_SECTIONS) {
    const value = prd[section.name];
    draft[section.name] = typeof value === 'string' ? value : '';
  }
  return draft;
}

// The PRD Builder. A draft is saved to the server as it is written rather than
// on a Save button, because the brief asks that an incomplete PRD can be left
// and picked up later — and because losing a document this long would be
// unforgivable. "Required" is checked when publishing, never while writing.
export default function PrdBuilderModal({
  prd,
  canEdit,
  currentUser,
  members = [],
  onClose,
  onSaved,
  onDeleted,
}: Props) {
  const [draft, setDraft] = useState<Draft>(() => draftFrom(prd));
  const [personaIds, setPersonaIds] = useState<string[]>(() => prd.personas.map((p) => p.personaId));
  const [personas, setPersonas] = useState<Persona[]>([]);
  const [saveState, setSaveState] = useState<'idle' | 'saving' | 'saved' | 'error'>('idle');
  const [publishing, setPublishing] = useState(false);
  const [error, setError] = useState('');
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [showMissing, setShowMissing] = useState(false);
  const [newBlock, setNewBlock] = useState({ role: '', assigneeId: '' });
  const [blockBusy, setBlockBusy] = useState<string | null>(null);
  // The assignee's two answers, held locally so typing is not a round trip.
  const [answers, setAnswers] = useState<Record<string, { dataNeeded: string; actionsNeeded: string }>>(() =>
    Object.fromEntries(
      prd.adminBlocks.map((b) => [b.id, { dataNeeded: b.dataNeeded ?? '', actionsNeeded: b.actionsNeeded ?? '' }])
    )
  );

  // What has actually been sent, so the autosave can tell a real edit from a
  // re-render and from the server's own echo.
  const savedRef = useRef<string>(JSON.stringify({ draft: draftFrom(prd), personaIds: prd.personas.map((p) => p.personaId) }));
  const published = prd.status === 'published';
  const editable = canEdit && !published;

  useEffect(() => {
    api.get<Persona[]>('/personas').then(({ data }) => setPersonas(data)).catch(() => {});
  }, []);

  // New blocks get an entry; existing ones keep whatever is being typed.
  useEffect(() => {
    setAnswers((prev) => {
      const next = { ...prev };
      for (const b of prd.adminBlocks) {
        if (!next[b.id]) next[b.id] = { dataNeeded: b.dataNeeded ?? '', actionsNeeded: b.actionsNeeded ?? '' };
      }
      return next;
    });
  }, [prd.adminBlocks]);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose(); };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [onClose]);

  const save = useCallback(async () => {
    const payload = { ...draft, personaIds };
    const signature = JSON.stringify({ draft, personaIds });
    setSaveState('saving');
    try {
      const { data } = await api.patch<Prd>(`/prds/${prd.id}`, payload);
      savedRef.current = signature;
      setSaveState('saved');
      setError('');
      onSaved(data);
    } catch (e: any) {
      setSaveState('error');
      setError(e.response?.data?.error || 'Could not save the draft.');
    }
  }, [draft, personaIds, prd.id, onSaved]);

  // Debounced autosave. Skipped entirely when nothing has changed since the
  // last successful send, so opening a PRD does not rewrite it.
  useEffect(() => {
    if (!editable) return;
    const signature = JSON.stringify({ draft, personaIds });
    if (signature === savedRef.current) return;
    const timer = setTimeout(() => { void save(); }, AUTOSAVE_MS);
    return () => clearTimeout(timer);
  }, [draft, personaIds, editable, save]);

  const missing = useMemo(
    () => missingBeforePublish(draft as unknown as Partial<Prd>),
    [draft]
  );
  const filled = sectionsFilled(draft as unknown as Partial<Prd>);

  const set = (field: string, value: string) => setDraft((d) => ({ ...d, [field]: value }));

  const togglePersona = (id: string) =>
    setPersonaIds((ids) => (ids.includes(id) ? ids.filter((i) => i !== id) : [...ids, id]));

  const addBlock = async () => {
    if (!newBlock.role.trim() || !newBlock.assigneeId) return;
    setBlockBusy('new');
    setError('');
    try {
      const { data } = await api.post<Prd>(`/prds/${prd.id}/admin-blocks`, newBlock);
      setNewBlock({ role: '', assigneeId: '' });
      onSaved(data);
    } catch (e: any) {
      setError(e.response?.data?.error || 'Could not add that block.');
    } finally {
      setBlockBusy(null);
    }
  };

  const removeBlock = async (blockId: string) => {
    setBlockBusy(blockId);
    setError('');
    try {
      const { data } = await api.delete<Prd>(`/prds/admin-blocks/${blockId}`);
      onSaved(data);
    } catch (e: any) {
      setError(e.response?.data?.error || 'Could not remove that block.');
    } finally {
      setBlockBusy(null);
    }
  };

  // The assignee's answers save on blur rather than on a debounce: they are two
  // long-form fields filled in one sitting, not a document written over days.
  const saveAnswers = async (block: PrdAdminBlock) => {
    const local = answers[block.id];
    if (!local) return;
    if (local.dataNeeded === (block.dataNeeded ?? '') && local.actionsNeeded === (block.actionsNeeded ?? '')) return;
    setBlockBusy(block.id);
    setError('');
    try {
      const { data } = await api.patch<Prd>(`/prds/admin-blocks/${block.id}`, local);
      onSaved(data);
    } catch (e: any) {
      setError(e.response?.data?.error || 'Could not save your answers.');
    } finally {
      setBlockBusy(null);
    }
  };

  const publish = async () => {
    if (missing.length) { setShowMissing(true); return; }
    setPublishing(true);
    setError('');
    try {
      // Flush anything unsent first: publishing validates what the server has,
      // not what is on screen.
      const signature = JSON.stringify({ draft, personaIds });
      if (signature !== savedRef.current) await save();
      const { data } = await api.post<Prd>(`/prds/${prd.id}/publish`);
      onSaved(data);
    } catch (e: any) {
      setError(e.response?.data?.error || 'Could not publish this PRD.');
    } finally {
      setPublishing(false);
    }
  };

  const remove = async () => {
    setError('');
    try {
      await api.delete(`/prds/${prd.id}`);
      onDeleted?.(prd.id);
      onClose();
    } catch (e: any) {
      setError(e.response?.data?.error || 'Could not remove this PRD.');
    }
  };

  const saveLabel =
    saveState === 'saving' ? 'Saving…'
    : saveState === 'error' ? 'Not saved'
    : saveState === 'saved' ? 'Draft saved'
    : null;

  return (
    <div
      className="fixed inset-0 flex items-end sm:items-center justify-center z-50 p-0 sm:p-6"
      style={{ background: 'rgba(0,0,0,0.45)' }}
      onClick={onClose}
    >
      <div
        role="dialog"
        aria-modal="true"
        aria-label={`PRD: ${prd.title}`}
        className="w-full sm:max-w-3xl bg-white rounded-t-2xl sm:rounded-xl shadow-xl border border-gray-200 flex flex-col max-h-full sm:max-h-[90vh]"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="px-5 py-4 border-b border-gray-200 flex items-start gap-3 flex-shrink-0">
          <div className="min-w-0 flex-1">
            <div className="flex items-center gap-2 mb-0.5">
              <h2 className="font-bold text-base min-w-0 truncate" style={{ color: '#1a1f3c' }}>
                {draft.title || 'Untitled PRD'}
              </h2>
              <span
                className="text-xs font-semibold px-2 py-0.5 rounded-full whitespace-nowrap flex-shrink-0"
                style={published
                  ? { background: '#ecfdf5', color: '#047857', border: '1px solid #a7f3d0' }
                  : { background: '#fffbeb', color: '#b45309', border: '1px solid #fcd34d' }}
              >
                {published ? 'Published' : 'Draft'}
              </span>
            </div>
            <p className="text-xs text-gray-500">
              {prd.board.name}
              {prd.canvasFeature ? ` · ${prd.canvasFeature.text}` : ''}
              {' · '}
              {published && prd.publishedAt
                ? `published ${formatTimestamp(prd.publishedAt)}`
                : `${filled} of ${PRD_SECTIONS.length} sections written`}
            </p>
          </div>
          {saveLabel && (
            <span
              role="status"
              className={`text-xs font-medium whitespace-nowrap flex-shrink-0 mt-1 ${
                saveState === 'error' ? 'text-red-700' : 'text-gray-500'
              }`}
            >
              {saveLabel}
            </span>
          )}
          <button
            type="button"
            onClick={onClose}
            aria-label="Close PRD"
            className="w-8 h-8 flex-shrink-0 flex items-center justify-center rounded-lg text-gray-500 bg-gray-100 hover:bg-gray-200 text-lg"
          >
            ×
          </button>
        </div>

        {/* Body */}
        <div className="flex-1 overflow-y-auto px-5 py-5 space-y-5">
          {error && (
            <p role="alert" className="px-3 py-2 rounded-lg text-sm bg-red-50 text-red-700 border border-red-200">
              {error}
            </p>
          )}

          {published && canEdit && (
            <p className="px-3 py-2 rounded-lg text-sm bg-gray-50 text-gray-600 border border-gray-200">
              This PRD is published, so its sections are no longer editable.
            </p>
          )}

          {showMissing && missing.length > 0 && (
            <div role="alert" className="px-3 py-2 rounded-lg text-sm bg-amber-50 text-amber-800 border border-amber-200">
              <p className="font-semibold mb-1">Not ready to publish</p>
              <ul className="list-disc list-inside space-y-0.5">
                {missing.map((s) => (
                  <li key={s.name}>§{s.number} {s.label}</li>
                ))}
              </ul>
            </div>
          )}

          {/* Title, version, classification */}
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            <div className="sm:col-span-2">
              <label htmlFor="prd-title" className="block text-xs font-semibold text-gray-500 mb-1.5">
                Title
              </label>
              <input
                id="prd-title"
                type="text"
                value={draft.title}
                disabled={!editable}
                onChange={(e) => set('title', e.target.value)}
                className="px-3 py-2 text-sm text-gray-900 disabled:bg-gray-50"
                style={inputStyle}
                {...inputFocus}
              />
            </div>
            <div>
              <label htmlFor="prd-version" className="block text-xs font-semibold text-gray-500 mb-1.5">
                §1 Version
              </label>
              <input
                id="prd-version"
                type="text"
                value={draft.version}
                disabled={!editable}
                onChange={(e) => set('version', e.target.value)}
                placeholder="e.g. 0.1"
                className="px-3 py-2 text-sm text-gray-900 placeholder-gray-500 disabled:bg-gray-50"
                style={inputStyle}
                {...inputFocus}
              />
            </div>
          </div>

          {/* Sections */}
          {PRD_SECTIONS.map((s) => (
            <div key={s.name}>
              <label htmlFor={`prd-${s.name}`} className="block text-xs font-semibold text-gray-500 mb-1">
                §{s.number} {s.label}
                {s.required && <span className="text-red-700"> *</span>}
              </label>
              {s.hint && <p className="text-xs text-gray-500 mb-1.5">{s.hint}</p>}
              <textarea
                id={`prd-${s.name}`}
                value={draft[s.name]}
                disabled={!editable}
                onChange={(e) => set(s.name, e.target.value)}
                rows={s.rows}
                className="px-3 py-2 text-sm text-gray-900 resize-y disabled:bg-gray-50"
                style={inputStyle}
                {...inputFocus}
              />
            </div>
          ))}

          {/* §10 Target Personas */}
          <div>
            <span className="block text-xs font-semibold text-gray-500 mb-1">§10 Target Personas</span>
            <p className="text-xs text-gray-500 mb-1.5">Who this is for. Pick as many as apply.</p>
            {personas.length === 0 ? (
              <p className="text-xs text-gray-500">
                No personas exist yet — an admin adds them from the Personas panel.
              </p>
            ) : (
              <div className="flex flex-wrap gap-1.5" role="group" aria-label="Target personas">
                {personas.map((persona) => {
                  const picked = personaIds.includes(persona.id);
                  return (
                    <button
                      key={persona.id}
                      type="button"
                      disabled={!editable}
                      aria-pressed={picked}
                      onClick={() => togglePersona(persona.id)}
                      className="text-xs font-semibold px-2.5 py-1 rounded-full border transition-colors disabled:opacity-70"
                      style={picked
                        ? { background: '#fff7f5', color: '#c73009', borderColor: '#fbd5c8' }
                        : { background: 'white', color: '#6b7280', borderColor: '#e5e7eb' }}
                    >
                      {persona.name}
                    </button>
                  );
                })}
              </div>
            )}
          </div>

          {/* §11 Classification */}
          <div>
            <label htmlFor="prd-classification" className="block text-xs font-semibold text-gray-500 mb-1.5">
              §11 Classification
            </label>
            <select
              id="prd-classification"
              value={draft.classification}
              disabled={!editable}
              onChange={(e) => set('classification', e.target.value as PrdClassification | '')}
              className="px-3 py-2 text-sm text-gray-900 disabled:bg-gray-50"
              style={inputStyle}
              {...inputFocus}
            >
              <option value="">Not set</option>
              {PRD_CLASSIFICATIONS.map((c) => (
                <option key={c.value} value={c.value}>{c.label}</option>
              ))}
            </select>
          </div>


          {/* §16 Administrative */}
          <div className="pt-1">
            <span className="block text-xs font-semibold text-gray-500 mb-1">§16 Administrative</span>
            <p className="text-xs text-gray-500 mb-2.5">
              Blocks of the PRD owned by individual board members. You set the role and the person;
              they answer the two questions. Each becomes a task on their board when this PRD is published.
            </p>

            <div className="space-y-2.5">
              {prd.adminBlocks.length === 0 && (
                <p className="text-xs text-gray-500">No admin blocks yet.</p>
              )}

              {prd.adminBlocks.map((block) => {
                const mine = currentUser?.id === block.assigneeId;
                const local = answers[block.id] ?? { dataNeeded: '', actionsNeeded: '' };
                return (
                  <div key={block.id} className="rounded-xl border border-gray-200 p-3">
                    <div className="flex items-center gap-2 mb-2">
                      <span className="text-sm font-bold min-w-0 truncate" style={{ color: '#1a1f3c' }}>
                        {block.role}
                      </span>
                      <span className="text-xs text-gray-500 truncate">{block.assignee.name}</span>
                      {mine && (
                        <span className="text-[10px] font-bold px-1.5 py-0.5 rounded-full bg-amber-50 text-amber-800 flex-shrink-0">
                          Yours
                        </span>
                      )}
                      {block.ticket && (
                        <span className="text-[10px] font-medium px-1.5 py-0.5 rounded-full bg-gray-100 text-gray-600 flex-shrink-0 whitespace-nowrap">
                          {block.ticket.status}
                        </span>
                      )}
                      {editable && (
                        <button
                          type="button"
                          onClick={() => removeBlock(block.id)}
                          disabled={blockBusy === block.id}
                          aria-label={`Remove the ${block.role} block`}
                          className="ml-auto text-xs font-semibold text-gray-500 hover:text-red-700 transition-colors disabled:opacity-50"
                        >
                          Remove
                        </button>
                      )}
                    </div>

                    {/* Only the assignee may answer; everyone who can read the
                        PRD sees the answers, which is what the brief asks for. */}
                    <div className="space-y-2">
                      <div>
                        <label
                          htmlFor={`block-${block.id}-data`}
                          className="block text-xs font-semibold text-gray-500 mb-1"
                        >
                          Data you need
                        </label>
                        <textarea
                          id={`block-${block.id}-data`}
                          value={local.dataNeeded}
                          disabled={!mine}
                          onChange={(e) =>
                            setAnswers((prev) => ({ ...prev, [block.id]: { ...local, dataNeeded: e.target.value } }))
                          }
                          rows={3}
                          placeholder={mine ? 'What you need in order to do your part…' : 'Not filled in yet'}
                          className="px-3 py-2 text-sm text-gray-900 placeholder-gray-500 resize-y disabled:bg-gray-50"
                          style={inputStyle}
                          {...inputFocus}
                          onBlur={(e) => { inputFocus.onBlur(e); void saveAnswers(block); }}
                        />
                      </div>
                      <div>
                        <label
                          htmlFor={`block-${block.id}-actions`}
                          className="block text-xs font-semibold text-gray-500 mb-1"
                        >
                          Actions you need to take with this product
                        </label>
                        <textarea
                          id={`block-${block.id}-actions`}
                          value={local.actionsNeeded}
                          disabled={!mine}
                          onChange={(e) =>
                            setAnswers((prev) => ({ ...prev, [block.id]: { ...local, actionsNeeded: e.target.value } }))
                          }
                          rows={3}
                          placeholder={mine ? 'What you will do…' : 'Not filled in yet'}
                          className="px-3 py-2 text-sm text-gray-900 placeholder-gray-500 resize-y disabled:bg-gray-50"
                          style={inputStyle}
                          {...inputFocus}
                          onBlur={(e) => { inputFocus.onBlur(e); void saveAnswers(block); }}
                        />
                      </div>
                    </div>
                  </div>
                );
              })}

              {editable && (
                <div className="rounded-xl border border-dashed border-gray-300 p-3 flex flex-col sm:flex-row gap-2">
                  <input
                    type="text"
                    value={newBlock.role}
                    onChange={(e) => setNewBlock({ ...newBlock, role: e.target.value })}
                    placeholder="Role, e.g. Compliance"
                    aria-label="Block role"
                    className="px-3 py-2 text-sm text-gray-900 placeholder-gray-500 sm:flex-1"
                    style={inputStyle}
                    {...inputFocus}
                  />
                  <select
                    value={newBlock.assigneeId}
                    onChange={(e) => setNewBlock({ ...newBlock, assigneeId: e.target.value })}
                    aria-label="Block assignee"
                    className="px-3 py-2 text-sm text-gray-900 sm:flex-1"
                    style={inputStyle}
                    {...inputFocus}
                  >
                    <option value="">Assign to…</option>
                    {members.map((m) => (
                      <option key={m.user.id} value={m.user.id}>{m.user.name}</option>
                    ))}
                  </select>
                  <button
                    type="button"
                    onClick={addBlock}
                    disabled={blockBusy === 'new' || !newBlock.role.trim() || !newBlock.assigneeId}
                    className="px-4 py-2 min-h-[40px] rounded-lg text-sm font-bold text-white disabled:opacity-50 flex-shrink-0"
                    style={{ background: '#c73009' }}
                  >
                    {blockBusy === 'new' ? 'Adding…' : 'Add block'}
                  </button>
                </div>
              )}
            </div>
          </div>

          <p className="text-xs text-gray-500 pt-1">
            Started by {prd.createdBy.name} · {formatTimestamp(prd.createdAt)}
          </p>
        </div>

        {/* Footer */}
        <div className="px-5 py-4 border-t border-gray-200 flex items-center gap-2.5 flex-shrink-0">
          {canEdit && !published && (
            confirmDelete ? (
              <>
                <span className="text-xs font-medium text-red-700 flex-1">Remove this PRD?</span>
                <button
                  type="button"
                  onClick={() => setConfirmDelete(false)}
                  className="text-xs font-semibold text-gray-600 px-2.5 py-1.5 rounded hover:text-gray-900"
                >
                  Cancel
                </button>
                <button
                  type="button"
                  onClick={remove}
                  className="text-xs font-bold text-white px-3 py-1.5 rounded"
                  style={{ background: '#b91c1c' }}
                >
                  Remove
                </button>
              </>
            ) : (
              <>
                <button
                  type="button"
                  onClick={() => setConfirmDelete(true)}
                  className="text-sm font-semibold text-gray-500 hover:text-red-700 transition-colors"
                >
                  Remove
                </button>
                <div className="flex-1" />
                <button
                  type="button"
                  onClick={onClose}
                  className="px-4 py-2 min-h-[44px] rounded-lg text-sm font-semibold text-gray-600 border border-gray-200 bg-white hover:text-gray-900"
                >
                  Close
                </button>
                <button
                  type="button"
                  onClick={publish}
                  disabled={publishing}
                  title={missing.length ? `${missing.length} required section(s) still blank` : 'Publish this PRD'}
                  className="px-4 py-2 min-h-[44px] rounded-lg text-sm font-bold text-white disabled:opacity-50"
                  style={{ background: '#c73009' }}
                >
                  {publishing ? 'Publishing…' : 'Publish'}
                </button>
              </>
            )
          )}
          {(!canEdit || published) && (
            <>
              <div className="flex-1" />
              <button
                type="button"
                onClick={onClose}
                className="px-4 py-2 min-h-[44px] rounded-lg text-sm font-semibold text-gray-600 border border-gray-200 bg-white hover:text-gray-900"
              >
                Close
              </button>
            </>
          )}
        </div>
      </div>
    </div>
  );
}
