'use client';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import api from '@/lib/api';
import { Persona, Prd, PrdAdminBlock, PrdClassification, User } from '@/types';
import { PRD_CLASSIFICATIONS, PRD_SECTIONS, missingBeforePublish, sectionsFilled } from '@/lib/prdSections';
import { approvalCount, approvalState, approverShortfall, isWritable } from '@/lib/prdApproval';
import { canExportPrd, downloadPrdPdf } from '@/lib/prdPdf';
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
  const [newApproverId, setNewApproverId] = useState('');
  const [decisionNote, setDecisionNote] = useState('');
  const [deciding, setDeciding] = useState(false);
  const [exporting, setExporting] = useState(false);
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
  // A published PRD reopens when an approver asks for changes, so the author
  // can actually act on the feedback. Mirrors the server.
  const writable = isWritable(prd);
  const editable = canEdit && writable;
  const state = approvalState(prd);
  const counts = approvalCount(prd);
  const shortfall = approverShortfall(prd);
  const myApproval = prd.approvers.find((a) => a.userId === currentUser?.id);

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

  const addApprover = async () => {
    if (!newApproverId) return;
    setBlockBusy('approver');
    setError('');
    try {
      const { data } = await api.post<Prd>(`/prds/${prd.id}/approvers`, { userId: newApproverId });
      setNewApproverId('');
      onSaved(data);
    } catch (e: any) {
      setError(e.response?.data?.error || 'Could not add that approver.');
    } finally {
      setBlockBusy(null);
    }
  };

  const removeApprover = async (approverId: string) => {
    setBlockBusy(approverId);
    setError('');
    try {
      const { data } = await api.delete<Prd>(`/prds/approvers/${approverId}`);
      onSaved(data);
    } catch (e: any) {
      setError(e.response?.data?.error || 'Could not remove that approver.');
    } finally {
      setBlockBusy(null);
    }
  };

  const decide = async (status: 'approved' | 'changes_requested') => {
    if (!myApproval) return;
    setDeciding(true);
    setError('');
    try {
      const { data } = await api.post<Prd>(`/prds/approvers/${myApproval.id}/decision`, {
        status,
        note: decisionNote,
      });
      setDecisionNote('');
      onSaved(data);
    } catch (e: any) {
      setError(e.response?.data?.error || 'Could not record your decision.');
    } finally {
      setDeciding(false);
    }
  };

  // §19: its creator, or a workspace admin. Available whatever state it is in —
  // a draft worth circulating is worth exporting.
  const canExport = canExportPrd(prd, currentUser);

  const exportPdf = async () => {
    setExporting(true);
    setError('');
    try {
      await downloadPrdPdf(prd);
    } catch {
      setError('Could not build the PDF.');
    } finally {
      setExporting(false);
    }
  };

  const publish = async () => {
    if (missing.length || shortfall) { setShowMissing(true); return; }
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
              {(() => {
                const badge =
                  !published ? { label: 'Draft', bg: '#fffbeb', fg: '#b45309', bd: '#fcd34d' }
                  : state === 'approved' ? { label: 'Approved', bg: '#ecfdf5', fg: '#047857', bd: '#a7f3d0' }
                  : state === 'changes_requested' ? { label: 'Changes requested', bg: '#fef2f2', fg: '#b91c1c', bd: '#fecaca' }
                  : state === 'pending' ? { label: `${counts.approved} of ${counts.total} approved`, bg: '#eff6ff', fg: '#1d4ed8', bd: '#bfdbfe' }
                  : { label: 'Published', bg: '#ecfdf5', fg: '#047857', bd: '#a7f3d0' };
                return (
                  <span
                    className="text-xs font-semibold px-2 py-0.5 rounded-full whitespace-nowrap flex-shrink-0"
                    style={{ background: badge.bg, color: badge.fg, border: `1px solid ${badge.bd}` }}
                  >
                    {badge.label}
                  </span>
                );
              })()}
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

          {published && canEdit && !writable && (
            <p className="px-3 py-2 rounded-lg text-sm bg-gray-50 text-gray-600 border border-gray-200">
              This PRD is published, so its sections are no longer editable.
            </p>
          )}

          {published && canEdit && writable && (
            <p className="px-3 py-2 rounded-lg text-sm bg-amber-50 text-amber-800 border border-amber-200">
              An approver asked for changes, so the sections are editable again. The tasks already
              raised stay where they are.
            </p>
          )}

          {showMissing && (missing.length > 0 || shortfall) && (
            <div role="alert" className="px-3 py-2 rounded-lg text-sm bg-amber-50 text-amber-800 border border-amber-200">
              <p className="font-semibold mb-1">Not ready to publish</p>
              <ul className="list-disc list-inside space-y-0.5">
                {missing.map((s) => (
                  <li key={s.name}>§{s.number} {s.label}</li>
                ))}
                {shortfall && <li>{shortfall}</li>}
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


          {/* §17 Approval */}
          <div className="pt-1">
            <span className="block text-xs font-semibold text-gray-500 mb-1">§17 Approval</span>
            <p className="text-xs text-gray-500 mb-2.5">
              At least two people must sign this off. They are asked, and see it on their board,
              when the PRD is published — not before.
            </p>

            <div className="space-y-2">
              {prd.approvers.length === 0 && (
                <p className="text-xs text-gray-500">Nobody named yet.</p>
              )}

              {prd.approvers.map((approver) => {
                const cfg =
                  approver.status === 'approved'
                    ? { label: 'Approved', bg: '#ecfdf5', fg: '#047857' }
                    : approver.status === 'changes_requested'
                    ? { label: 'Changes requested', bg: '#fef2f2', fg: '#b91c1c' }
                    : { label: 'Pending', bg: '#f3f4f6', fg: '#6b7280' };
                return (
                  <div key={approver.id} className="rounded-lg border border-gray-200 px-3 py-2">
                    <div className="flex items-center gap-2">
                      <span className="text-sm font-medium text-gray-800 min-w-0 truncate">
                        {approver.user.name}
                      </span>
                      <span
                        className="text-[10px] font-bold px-1.5 py-0.5 rounded-full flex-shrink-0 whitespace-nowrap"
                        style={{ background: cfg.bg, color: cfg.fg }}
                      >
                        {cfg.label}
                      </span>
                      {approver.decidedAt && (
                        <span className="text-xs text-gray-500 flex-shrink-0 whitespace-nowrap">
                          {formatTimestamp(approver.decidedAt)}
                        </span>
                      )}
                      {canEdit && !published && (
                        <button
                          type="button"
                          onClick={() => removeApprover(approver.id)}
                          disabled={blockBusy === approver.id}
                          aria-label={`Remove ${approver.user.name} as an approver`}
                          className="ml-auto text-xs font-semibold text-gray-500 hover:text-red-700 transition-colors disabled:opacity-50"
                        >
                          Remove
                        </button>
                      )}
                    </div>
                    {approver.note && (
                      <p className="mt-1 text-sm text-gray-700 whitespace-pre-wrap">{approver.note}</p>
                    )}
                  </div>
                );
              })}

              {canEdit && !published && (
                <div className="rounded-lg border border-dashed border-gray-300 p-3 flex flex-col sm:flex-row gap-2">
                  <select
                    value={newApproverId}
                    onChange={(e) => setNewApproverId(e.target.value)}
                    aria-label="Approver"
                    className="px-3 py-2 text-sm text-gray-900 sm:flex-1"
                    style={inputStyle}
                    {...inputFocus}
                  >
                    <option value="">Ask someone to approve…</option>
                    {members
                      .filter((m) => !prd.approvers.some((a) => a.userId === m.user.id))
                      .map((m) => (
                        <option key={m.user.id} value={m.user.id}>{m.user.name}</option>
                      ))}
                  </select>
                  <button
                    type="button"
                    onClick={addApprover}
                    disabled={blockBusy === 'approver' || !newApproverId}
                    className="px-4 py-2 min-h-[40px] rounded-lg text-sm font-bold text-white disabled:opacity-50 flex-shrink-0"
                    style={{ background: '#c73009' }}
                  >
                    {blockBusy === 'approver' ? 'Adding…' : 'Add approver'}
                  </button>
                </div>
              )}

              {shortfall && !published && (
                <p className="text-xs text-amber-800">{shortfall}</p>
              )}

              {/* The approver's own decision. Only once published — there is
                  nothing to sign off on a draft. */}
              {myApproval && published && (
                <div className="rounded-xl border p-3" style={{ borderColor: '#fbd5c8', background: '#fff7f5' }}>
                  <p className="text-xs font-semibold text-gray-700 mb-2">
                    {myApproval.status === 'pending'
                      ? 'You were asked to approve this PRD'
                      : `You ${myApproval.status === 'approved' ? 'approved this' : 'asked for changes'}`}
                  </p>
                  <textarea
                    value={decisionNote}
                    onChange={(e) => setDecisionNote(e.target.value)}
                    rows={2}
                    aria-label="Decision note"
                    placeholder="A note, if it helps (optional)"
                    className="px-3 py-2 text-sm text-gray-900 placeholder-gray-500 resize-y mb-2"
                    style={inputStyle}
                    {...inputFocus}
                  />
                  <div className="flex gap-2">
                    <button
                      type="button"
                      onClick={() => decide('changes_requested')}
                      disabled={deciding}
                      className="flex-1 py-2 min-h-[40px] rounded-lg text-sm font-semibold border bg-white disabled:opacity-50"
                      style={{ color: '#b91c1c', borderColor: '#fecaca' }}
                    >
                      Request changes
                    </button>
                    <button
                      type="button"
                      onClick={() => decide('approved')}
                      disabled={deciding}
                      className="flex-1 py-2 min-h-[40px] rounded-lg text-sm font-bold text-white disabled:opacity-50"
                      style={{ background: '#047857' }}
                    >
                      Approve
                    </button>
                  </div>
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
          {canEdit && writable && (
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
                {canExport && (
                  <button
                    type="button"
                    onClick={exportPdf}
                    disabled={exporting}
                    className="px-4 py-2 min-h-[44px] rounded-lg text-sm font-semibold text-gray-600 border border-gray-200 bg-white hover:text-gray-900 disabled:opacity-50"
                  >
                    {exporting ? 'Building…' : 'Export PDF'}
                  </button>
                )}
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
          {(!canEdit || !writable) && (
            <>
              <div className="flex-1" />
              {canExport && (
                <button
                  type="button"
                  onClick={exportPdf}
                  disabled={exporting}
                  className="px-4 py-2 min-h-[44px] rounded-lg text-sm font-semibold text-gray-600 border border-gray-200 bg-white hover:text-gray-900 disabled:opacity-50"
                >
                  {exporting ? 'Building…' : 'Export PDF'}
                </button>
              )}
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
