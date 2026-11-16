'use client';
import { useEffect, useState, useCallback } from 'react';
import api from '@/lib/api';
import socket from '@/lib/socket';
import { CanvasProject, CanvasBlock, CanvasFeature, Prd, User } from '@/types';
import { prdBadge } from '@/lib/prdBadge';
import PrdBuilderModal from './PrdBuilderModal';

interface Props {
  /** Reports how many items this section has, once loaded. */
  onCountChange?: (count: number) => void;
  boardId: string;
  isAdmin: boolean;
  /** Needed to decide who may write to a PRD. */
  currentUser?: User | null;
  /** Board members, for choosing who a PRD's admin blocks belong to. */
  members?: { user: User }[];
}

const ACCENT = '#e8390e';
// Brand red is 4.18:1 — below AA as text or behind white text.
const ACCENT_TEXT = '#c73009';
const NAVY = '#1a1f3c';

// Modal state machine — text prompts and destructive confirms
type ModalState =
  | { kind: 'add-project' }
  | { kind: 'rename-project'; project: CanvasProject }
  | { kind: 'add-product' }
  | { kind: 'add-block' }
  | { kind: 'rename-block'; block: CanvasBlock }
  | { kind: 'edit-feature'; block: CanvasBlock; feature: CanvasFeature }
  | { kind: 'delete-project'; project: CanvasProject }
  | { kind: 'delete-block'; block: CanvasBlock }
  | null;

export default function BoardCanvas({ boardId, isAdmin, onCountChange, currentUser, members }: Props) {
  const [projects, setProjects] = useState<CanvasProject[]>([]);
  const [activeId, setActiveId] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [collapsed, setCollapsed] = useState(false);

  // Collapsed state is remembered per board.
  const collapseKey = `fluxus:overviewCollapsed:${boardId}`;
  useEffect(() => {
    try {
      const saved = localStorage.getItem(collapseKey);
      if (saved === '1' || saved === '0') setCollapsed(saved === '1');
    } catch {
      // Storage can be blocked; the expanded default stands.
    }
  }, [collapseKey]);

  const toggleCollapsed = () => {
    setCollapsed((current) => {
      const next = !current;
      try {
        localStorage.setItem(collapseKey, next ? '1' : '0');
      } catch {
        // Not persisting is acceptable.
      }
      return next;
    });
  };

  useEffect(() => {
    if (!loading) onCountChange?.(projects.length);
  }, [loading, projects.length, onCountChange]);
  // Per-block "add feature" draft text, keyed by block id
  const [featureDrafts, setFeatureDrafts] = useState<Record<string, string>>({});
  // PRDs for this board, so a feature can show whether its document exists and
  // how far along it is.
  const [prds, setPrds] = useState<Prd[]>([]);
  const [openPrd, setOpenPrd] = useState<Prd | null>(null);
  const [modal, setModal] = useState<ModalState>(null);
  const [modalInput, setModalInput] = useState('');
  const [modalBusy, setModalBusy] = useState(false);

  const load = useCallback(async () => {
    try {
      const { data } = await api.get<CanvasProject[]>(`/boards/${boardId}/canvas`);
      setProjects(data);
      setActiveId((prev) => (prev && data.some((p) => p.id === prev) ? prev : data[0]?.id ?? null));
    } catch { /* board may simply have no canvas access — leave empty */ }
    finally { setLoading(false); }
  }, [boardId]);

  useEffect(() => { load(); }, [load]);

  const loadPrds = useCallback(async () => {
    try {
      const { data } = await api.get<Prd[]>('/prds', { params: { boardId } });
      setPrds(data);
    } catch { /* a member without board access simply sees none */ }
  }, [boardId]);

  useEffect(() => { loadPrds(); }, [loadPrds]);

  // Real-time: refetch when anyone changes this board's canvas
  useEffect(() => {
    const onChanged = (payload: { boardId?: string }) => {
      if (payload?.boardId === boardId) load();
    };
    socket.on('canvas-changed', onChanged);
    return () => { socket.off('canvas-changed', onChanged); };
  }, [boardId, load]);

  const active = projects.find((p) => p.id === activeId) ?? null;

  // This project's products, newest first — the order `GET /prds` returns is by
  // last edit, which jumps a card around the grid every time somebody types in
  // it. A list you are picking from should hold still.
  const products = active
    ? prds
        .filter((p) => p.canvasProjectId === active.id)
        .sort((a, b) => a.createdAt.localeCompare(b.createdAt))
    : [];

  // Helper: mutate a single block within the active project
  const updateBlock = (blockId: string, fn: (b: CanvasBlock) => CanvasBlock) => {
    setProjects((prev) => prev.map((p) =>
      p.id === active?.id ? { ...p, blocks: p.blocks.map((b) => (b.id === blockId ? fn(b) : b)) } : p));
  };

  // --- Mutations (optimistic; sockets reconcile other viewers) ---
  const doAddProject = async (name: string) => {
    const { data } = await api.post<CanvasProject>(`/boards/${boardId}/canvas/projects`, { name });
    setProjects((prev) => [...prev, { ...data, blocks: data.blocks ?? [] }]);
    setActiveId(data.id);
  };

  const doRenameProject = async (project: CanvasProject, name: string) => {
    await api.patch(`/boards/${boardId}/canvas/projects/${project.id}`, { name });
    setProjects((prev) => prev.map((p) => (p.id === project.id ? { ...p, name } : p)));
  };

  const doDeleteProject = async (project: CanvasProject) => {
    await api.delete(`/boards/${boardId}/canvas/projects/${project.id}`);
    setProjects((prev) => {
      const next = prev.filter((p) => p.id !== project.id);
      if (activeId === project.id) setActiveId(next[0]?.id ?? null);
      return next;
    });
  };

  const doAddBlock = async (title: string) => {
    if (!active) return;
    const { data } = await api.post<CanvasBlock>(`/boards/${boardId}/canvas/projects/${active.id}/blocks`, { title });
    setProjects((prev) => prev.map((p) =>
      p.id === active.id ? { ...p, blocks: [...p.blocks, { ...data, features: data.features ?? [] }] } : p));
  };

  const doRenameBlock = async (block: CanvasBlock, title: string) => {
    await api.patch(`/boards/${boardId}/canvas/blocks/${block.id}`, { title });
    updateBlock(block.id, (b) => ({ ...b, title }));
  };

  const doDeleteBlock = async (block: CanvasBlock) => {
    await api.delete(`/boards/${boardId}/canvas/blocks/${block.id}`);
    setProjects((prev) => prev.map((p) =>
      p.id === active?.id ? { ...p, blocks: p.blocks.filter((b) => b.id !== block.id) } : p));
  };

  const doEditFeature = async (block: CanvasBlock, featureId: string, text: string) => {
    await api.patch(`/boards/${boardId}/canvas/features/${featureId}`, { text });
    updateBlock(block.id, (b) => ({ ...b, features: b.features.map((f) => (f.id === featureId ? { ...f, text } : f)) }));
  };

  /**
   * Adds a feature to a block. Nothing more than that.
   *
   * A feature used to start a PRD. That put the document at the wrong level: a
   * block is a heading and its features are the bullet points under it — a
   * sentence each — while a PRD has scope, personas, approvers and sign-off.
   * Writing one per bullet point meant the builder opened over trivia. A
   * document now belongs to a *product*, added alongside the blocks.
   */
  const addFeature = async (block: CanvasBlock, text: string) => {
    const trimmed = text.trim();
    if (!trimmed) return;
    setFeatureDrafts((d) => ({ ...d, [block.id]: '' }));
    const { data } = await api.post<CanvasFeature>(
      `/boards/${boardId}/canvas/blocks/${block.id}/features`,
      { text: trimmed }
    );
    updateBlock(block.id, (b) => ({ ...b, features: [...b.features, data] }));
  };

  /**
   * Starts a product: a PRD attached to this project, opened for writing.
   *
   * The name is the document's title, which is all a draft needs — "required"
   * is a condition of publishing, and the builder opens on the rest.
   */
  const doAddProduct = async (name: string) => {
    if (!active) return;
    const { data: prd } = await api.post<Prd>('/prds', {
      boardId,
      canvasProjectId: active.id,
      title: name,
    });
    setPrds((prev) => [prd, ...prev]);
    setOpenPrd(prd);
  };

  const deleteFeature = async (block: CanvasBlock, featureId: string) => {
    await api.delete(`/boards/${boardId}/canvas/features/${featureId}`);
    updateBlock(block.id, (b) => ({ ...b, features: b.features.filter((f) => f.id !== featureId) }));
  };

  // Toggle a feature between active and struck-out (inactive)
  const toggleFeature = async (block: CanvasBlock, feature: CanvasFeature) => {
    const active = !feature.active;
    updateBlock(block.id, (b) => ({ ...b, features: b.features.map((f) => (f.id === feature.id ? { ...f, active } : f)) }));
    try {
      await api.patch(`/boards/${boardId}/canvas/features/${feature.id}`, { active });
    } catch {
      updateBlock(block.id, (b) => ({ ...b, features: b.features.map((f) => (f.id === feature.id ? { ...f, active: feature.active } : f)) }));
    }
  };

  // --- Modal helpers ---
  const openModal = (m: ModalState, initial = '') => { setModal(m); setModalInput(initial); };
  const closeModal = () => { if (!modalBusy) { setModal(null); setModalInput(''); } };

  const isConfirmModal = modal?.kind === 'delete-project' || modal?.kind === 'delete-block';

  const submitModal = async () => {
    if (!modal) return;
    const value = modalInput.trim();
    if (!isConfirmModal && !value) return;
    setModalBusy(true);
    try {
      switch (modal.kind) {
        case 'add-project': await doAddProject(value); break;
        case 'rename-project': await doRenameProject(modal.project, value); break;
        case 'add-product': await doAddProduct(value); break;
        case 'add-block': await doAddBlock(value); break;
        case 'rename-block': await doRenameBlock(modal.block, value); break;
        case 'edit-feature': await doEditFeature(modal.block, modal.feature.id, value); break;
        case 'delete-project': await doDeleteProject(modal.project); break;
        case 'delete-block': await doDeleteBlock(modal.block); break;
      }
      setModal(null);
      setModalInput('');
    } finally { setModalBusy(false); }
  };

  // Hide the section entirely for non-admins when there's nothing to show
  if (loading) return null;
  if (projects.length === 0 && !isAdmin) return null;

  return (
    <div className="flex-shrink-0 bg-white border-b border-gray-200">
      {/* Header */}
      <div className="flex items-center gap-2 sm:gap-3 px-4 sm:px-6 py-2.5">
        <button
          onClick={toggleCollapsed}
          className="flex items-center gap-1.5 text-sm font-bold transition-colors"
          style={{ color: NAVY }}
          aria-label={collapsed ? 'Expand overview' : 'Collapse overview'}
        >
          <svg
            width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"
            style={{ transform: collapsed ? 'rotate(-90deg)' : 'none', transition: 'transform 150ms' }}
          >
            <polyline points="6 9 12 15 18 9" />
          </svg>
          Project Overview
        </button>

        {/* Project switcher */}
        {projects.length > 0 && (
          <div className="flex items-center gap-1.5 overflow-x-auto flex-1 min-w-0">
            {projects.map((p) => {
              const isActive = p.id === activeId;
              return (
                <button
                  key={p.id}
                  onClick={() => setActiveId(p.id)}
                  onDoubleClick={() => isAdmin && openModal({ kind: 'rename-project', project: p }, p.name)}
                  title={isAdmin ? 'Double-click to rename' : undefined}
                  className="text-xs font-semibold px-3 py-1 rounded-full whitespace-nowrap transition-all duration-150 flex-shrink-0"
                  style={{
                    background: isActive ? NAVY : '#f3f4f6',
                    color: isActive ? 'white' : '#6b7280',
                    border: `1px solid ${isActive ? NAVY : '#e5e7eb'}`,
                  }}
                >
                  {p.name}
                </button>
              );
            })}
          </div>
        )}

        {/* Admin controls */}
        {isAdmin && (
          <div className="flex items-center gap-1.5 flex-shrink-0 ml-auto">
            {active && (
              <button
                onClick={() => openModal({ kind: 'delete-project', project: active })}
                className="text-xs font-semibold px-2 py-1 rounded-lg transition-all duration-150 text-gray-500 hover:text-red-700 hover:bg-red-50"
                title="Delete current project"
              >
                Delete
              </button>
            )}
            <button
              onClick={() => openModal({ kind: 'add-project' })}
              className="flex items-center gap-1 text-xs font-semibold px-2.5 py-1.5 rounded-lg border transition-all duration-150"
              style={{ color: ACCENT_TEXT, borderColor: ACCENT, background: 'white' }}
            >
              <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
                <line x1="12" y1="5" x2="12" y2="19" /><line x1="5" y1="12" x2="19" y2="12" />
              </svg>
              Project
            </button>
          </div>
        )}
      </div>

      {/* Canvas body */}
      {!collapsed && (
        <div className="px-4 sm:px-6 pb-4">
          {projects.length === 0 ? (
            <EmptyState isAdmin={isAdmin} onAdd={() => openModal({ kind: 'add-project' })} />
          ) : !active ? null : active.blocks.length === 0 && products.length === 0 && !isAdmin ? (
            <p className="text-xs text-gray-500 py-6 text-center">Nothing in this project's overview yet.</p>
          ) : (
            <>
            {/* Products — the documents. Their own row above the blocks, and
                labelled, because a product and a block are different kinds of
                thing: one is a PRD, the other is a heading with a list under it.
                Each gets its own labelled "add", so the choice is made by
                clicking where the thing will appear rather than by picking an
                option out of a menu that has to explain itself. */}
            {(products.length > 0 || isAdmin) && (
              <div className="mb-4">
                <div className="flex items-baseline gap-2 mb-2">
                  <h4 className="text-xs font-bold uppercase tracking-wide" style={{ color: NAVY }}>
                    Products
                  </h4>
                  <span className="text-[11px] text-gray-500">each one has a PRD</span>
                </div>
                <div className="grid gap-2 grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
                  {products.map((prd) => {
                    const badge = prdBadge(prd);
                    return (
                      <button
                        key={prd.id}
                        type="button"
                        onClick={() => setOpenPrd(prd)}
                        aria-label={`Open the PRD for ${prd.title}`}
                        className="text-left rounded-xl border border-gray-200 bg-white px-3 py-2.5 hover:border-gray-300 hover:shadow-sm transition-all"
                      >
                        <span className="flex items-center gap-1.5 min-w-0">
                          <svg
                            className="flex-shrink-0" width="12" height="12" viewBox="0 0 24 24"
                            fill="none" stroke={ACCENT_TEXT} strokeWidth="2"
                          >
                            <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" />
                            <polyline points="14 2 14 8 20 8" />
                          </svg>
                          <span className="text-xs font-bold truncate" style={{ color: NAVY }}>
                            {prd.title}
                          </span>
                        </span>
                        <span
                          className="inline-block mt-1.5 text-[10px] font-bold px-1.5 py-0.5 rounded-full border"
                          style={{ background: badge.bg, color: badge.fg, borderColor: badge.bd }}
                        >
                          {badge.label}
                        </span>
                      </button>
                    );
                  })}
                  {isAdmin && (
                    <button
                      onClick={() => openModal({ kind: 'add-product' })}
                      className="rounded-xl border border-dashed border-gray-300 flex items-center justify-center gap-1.5 py-4 text-gray-500 hover:border-gray-400 hover:text-gray-600 hover:bg-gray-50 transition-all"
                    >
                      <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                        <line x1="12" y1="5" x2="12" y2="19" /><line x1="5" y1="12" x2="19" y2="12" />
                      </svg>
                      <span className="text-xs font-semibold">Product</span>
                    </button>
                  )}
                </div>
              </div>
            )}

            {(active.blocks.length > 0 || isAdmin) && (
              <div className="flex items-baseline gap-2 mb-2">
                <h4 className="text-xs font-bold uppercase tracking-wide" style={{ color: NAVY }}>
                  Blocks
                </h4>
                <span className="text-[11px] text-gray-500">the features this project covers</span>
              </div>
            )}
            <div className="grid gap-3 grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
              {active.blocks.map((block) => (
                <div
                  key={block.id}
                  className="rounded-xl border border-gray-200 bg-[#fafbfc] flex flex-col overflow-hidden"
                >
                  {/* Block header */}
                  <div
                    className="flex items-center gap-2 px-3 py-2 border-b border-gray-200"
                    style={{ background: '#f0f2f5' }}
                  >
                    <span className="w-1.5 h-1.5 rounded-full flex-shrink-0" style={{ background: ACCENT_TEXT }} />
                    <h4
                      onClick={() => isAdmin && openModal({ kind: 'rename-block', block }, block.title)}
                      title={isAdmin ? 'Click to rename' : undefined}
                      className={`text-xs font-bold uppercase tracking-wide truncate ${isAdmin ? 'cursor-pointer' : ''}`}
                      style={{ color: NAVY }}
                    >
                      {block.title}
                    </h4>
                    <span className="ml-auto text-[10px] font-semibold text-gray-500 flex-shrink-0">
                      {block.features.length}
                    </span>
                    {isAdmin && (
                      <button
                        onClick={() => openModal({ kind: 'delete-block', block })}
                        aria-label={`Remove section ${block.title}`}
                        className="flex-shrink-0 w-5 h-5 flex items-center justify-center rounded text-gray-500 hover:text-red-700 hover:bg-red-50 transition-all"
                        title="Remove block"
                      >
                        <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
                          <line x1="18" y1="6" x2="6" y2="18" /><line x1="6" y1="6" x2="18" y2="18" />
                        </svg>
                      </button>
                    )}
                  </div>

                  {/* Features */}
                  <div className="flex-1 p-2.5 space-y-1.5">
                    {block.features.length === 0 && (
                      <p className="text-[11px] text-gray-500 px-1 py-2">No features listed.</p>
                    )}
                    {block.features.map((f) => (
                      <div key={f.id} className="flex items-start gap-2 group">
                        <svg
                          className="flex-shrink-0 mt-0.5" width="12" height="12" viewBox="0 0 24 24"
                          fill="none" stroke={f.active ? '#16a34a' : '#d1d5db'} strokeWidth="3"
                        >
                          <polyline points="20 6 9 17 4 12" />
                        </svg>
                        {(() => {
                          const featureText = `text-xs leading-snug flex-1 ${f.active ? 'text-gray-700' : 'line-through text-gray-500'}`;
                          // Only admins can edit, so only they get a control.
                          return isAdmin ? (
                            <button
                              type="button"
                              onClick={() => openModal({ kind: 'edit-feature', block, feature: f }, f.text)}
                              className={`${featureText} text-left cursor-pointer hover:text-gray-900 rounded outline-none focus-visible:underline`}
                              title="Click to edit"
                              aria-label={`Edit feature: ${f.text}`}
                            >
                              {f.text}
                            </button>
                          ) : (
                            <span className={featureText}>{f.text}</span>
                          );
                        })()}
                        {(() => {
                          // A feature no longer has a document of its own, so
                          // there is nothing to offer here — except on the
                          // features that were given one under the old
                          // arrangement. Those keep their way in: the document
                          // exists and is still the thinking behind this line.
                          const prd = prds.find((p) => p.canvasFeatureId === f.id);
                          if (!prd) return null;
                          const badge = prdBadge(prd);
                          return (
                            <button
                              type="button"
                              onClick={() => setOpenPrd(prd)}
                              title={`PRD — ${badge.label}`}
                              aria-label={`Open the PRD for ${f.text}`}
                              className="flex-shrink-0 text-[10px] font-bold px-1.5 py-0.5 rounded-full border transition-colors"
                              style={{ background: badge.bg, color: badge.fg, borderColor: badge.bd }}
                            >
                              PRD
                            </button>
                          );
                        })()}
                        {isAdmin && (
                          <div className="flex items-center gap-0.5 flex-shrink-0">
                            <button
                              onClick={() => toggleFeature(block, f)}
                              className={`${f.active ? 'opacity-0 group-hover:opacity-100' : 'opacity-100'} w-4 h-4 flex items-center justify-center rounded transition-all ${f.active ? 'text-gray-500 hover:text-amber-700' : 'text-amber-700 hover:text-green-700'}`}
                              title={f.active ? 'Mark as no longer active' : 'Mark as active again'}
                            >
                              {f.active ? (
                                <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
                                  <circle cx="12" cy="12" r="9" /><line x1="5.6" y1="5.6" x2="18.4" y2="18.4" />
                                </svg>
                              ) : (
                                <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
                                  <path d="M3 12a9 9 0 1 0 3-6.7" /><polyline points="3 4 3 9 8 9" />
                                </svg>
                              )}
                            </button>
                            <button
                              onClick={() => deleteFeature(block, f.id)}
                              aria-label={`Remove feature ${f.text}`}
                              className="opacity-0 group-hover:opacity-100 w-4 h-4 flex items-center justify-center rounded text-gray-500 hover:text-red-700 transition-all"
                              title="Remove feature"
                            >
                              <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
                                <line x1="18" y1="6" x2="6" y2="18" /><line x1="6" y1="6" x2="18" y2="18" />
                              </svg>
                            </button>
                          </div>
                        )}
                      </div>
                    ))}

                    {/* Add feature (admin). A feature is one line on the
                        canvas, so adding one is one keystroke — Enter commits
                        it, and leaving the field commits it too rather than
                        discarding what was typed. */}
                    {isAdmin && (
                      <input
                        value={featureDrafts[block.id] ?? ''}
                        onChange={(e) => setFeatureDrafts((d) => ({ ...d, [block.id]: e.target.value }))}
                        onKeyDown={(e) => { if (e.key === 'Enter') addFeature(block, featureDrafts[block.id] ?? ''); }}
                        onBlur={() => addFeature(block, featureDrafts[block.id] ?? '')}
                        placeholder="+ Add feature"
                        aria-label={`Add a feature to ${block.title}`}
                        className="w-full text-xs px-2 py-1 mt-1 rounded-md border border-transparent hover:border-gray-200 focus:border-gray-300 outline-none bg-transparent focus:bg-white transition-all"
                        style={{ color: '#111827' }}
                      />
                    )}
                  </div>
                </div>
              ))}

              {/* Add block card (admin) */}
              {isAdmin && (
                <button
                  onClick={() => openModal({ kind: 'add-block' })}
                  className="rounded-xl border border-dashed border-gray-300 flex flex-col items-center justify-center gap-1.5 py-8 text-gray-500 hover:border-gray-400 hover:text-gray-600 hover:bg-gray-50 transition-all min-h-[120px]"
                >
                  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                    <line x1="12" y1="5" x2="12" y2="19" /><line x1="5" y1="12" x2="19" y2="12" />
                  </svg>
                  <span className="text-xs font-semibold">Block</span>
                </button>
              )}
            </div>
            </>
          )}
        </div>
      )}

      {/* Modals */}
      {modal && (
        <div
          className="fixed inset-0 bg-black/40 flex items-end sm:items-center justify-center z-50"
          onClick={closeModal}
        >
          <div
            className="bg-white w-full sm:max-w-sm rounded-t-2xl sm:rounded-xl shadow-xl p-6"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center justify-between mb-5">
              <h3 className="font-semibold text-base" style={{ color: NAVY }}>{MODAL_TITLES[modal.kind]}</h3>
              <button onClick={closeModal} aria-label={`Close ${MODAL_TITLES[modal.kind]}`} className="text-gray-500 text-xl w-8 h-8 flex items-center justify-center">×</button>
            </div>

            {isConfirmModal ? (
              <>
                <p className="text-sm text-gray-600 mb-5">
                  {modal.kind === 'delete-project'
                    ? <>Delete <span className="font-semibold">{modal.project.name}</span> and all of its blocks and features? This cannot be undone.</>
                    : <>Remove the <span className="font-semibold">{(modal as { block: CanvasBlock }).block.title}</span> block and its features?</>}
                </p>
                <div className="flex gap-2">
                  <button type="button" onClick={closeModal} disabled={modalBusy} className="flex-1 py-2.5 min-h-[44px] rounded-lg text-sm font-medium text-gray-600 border border-gray-200 disabled:opacity-50">Cancel</button>
                  <button
                    type="button"
                    onClick={submitModal}
                    disabled={modalBusy}
                    className="flex-1 py-2.5 min-h-[44px] rounded-lg text-sm font-bold text-white disabled:opacity-50"
                    style={{ background: '#dc2626' }}
                  >
                    {modalBusy ? 'Deleting...' : 'Delete'}
                  </button>
                </div>
              </>
            ) : (
              <form onSubmit={(e) => { e.preventDefault(); submitModal(); }} className="space-y-4">
                <input
                  autoFocus
                  type="text"
                  value={modalInput}
                  onChange={(e) => setModalInput(e.target.value)}
                  placeholder={MODAL_PLACEHOLDERS[modal.kind]}
                  aria-label={MODAL_TITLES[modal.kind]}
                  className="w-full px-3 py-2.5 text-sm rounded-lg border border-gray-200 outline-none"
                  style={{ color: '#111827' }}
                  onFocus={(e) => { e.currentTarget.style.borderColor = ACCENT; e.currentTarget.style.boxShadow = '0 0 0 3px rgba(232,57,14,0.1)'; }}
                  onBlur={(e) => { e.currentTarget.style.borderColor = '#e5e7eb'; e.currentTarget.style.boxShadow = 'none'; }}
                />

                {/* Says what the button is about to do. Creating a product opens
                    the builder, which is a bigger jump than the other prompts
                    here make, and a modal that silently becomes a long form is
                    disorientating. */}
                {modal.kind === 'add-product' && (
                  <p className="text-xs leading-relaxed text-gray-600">
                    A product is the thing a PRD is written about. Naming it opens the
                    builder, where you can fill in as much as you like now and the rest later.
                  </p>
                )}

                <div className="flex gap-2">
                  <button type="button" onClick={closeModal} disabled={modalBusy} className="flex-1 py-2.5 min-h-[44px] rounded-lg text-sm font-medium text-gray-600 border border-gray-200 disabled:opacity-50">Cancel</button>
                  <button
                    type="submit"
                    disabled={modalBusy || !modalInput.trim()}
                    className="flex-1 py-2.5 min-h-[44px] rounded-lg text-sm font-bold text-white disabled:opacity-50"
                    style={{ background: ACCENT_TEXT }}
                  >
                    {modalBusy
                      ? 'Saving...'
                      : modal.kind === 'add-product'
                      ? 'Create & open PRD'
                      : 'Save'}
                  </button>
                </div>
              </form>
            )}
          </div>
        </div>
      )}
      {openPrd && (
        <PrdBuilderModal
          prd={openPrd}
          currentUser={currentUser ?? null}
          members={members ?? []}
          canEdit={Boolean(
            currentUser && (openPrd.createdById === currentUser.id || currentUser.role === 'admin')
          )}
          onClose={() => setOpenPrd(null)}
          onSaved={(saved) => {
            setPrds((prev) => prev.map((p) => (p.id === saved.id ? saved : p)));
            setOpenPrd(saved);
          }}
          onDeleted={(id) => {
            setPrds((prev) => prev.filter((p) => p.id !== id));
            setOpenPrd(null);
          }}
        />
      )}
    </div>
  );
}

const MODAL_TITLES: Record<NonNullable<ModalState>['kind'], string> = {
  'add-project': 'New Project',
  'rename-project': 'Rename Project',
  'add-block': 'New Block',
  'add-product': 'New Product',
  'rename-block': 'Rename Block',
  'edit-feature': 'Edit Feature',
  'delete-project': 'Delete Project',
  'delete-block': 'Remove Block',
};

const MODAL_PLACEHOLDERS: Record<NonNullable<ModalState>['kind'], string> = {
  'add-project': 'e.g. Mobile App',
  'rename-project': 'Project name',
  'add-block': 'e.g. Security, Payments, Onboarding',
  'add-product': 'e.g. Checkout 2.0',
  'rename-block': 'Block title',
  'edit-feature': 'Feature description',
  'delete-project': '',
  'delete-block': '',
};

function EmptyState({ isAdmin, onAdd }: { isAdmin: boolean; onAdd: () => void }) {
  return (
    <div className="flex flex-col items-center justify-center py-8 text-center">
      <p className="text-sm font-semibold text-gray-500 mb-1">No project overview yet</p>
      <p className="text-xs text-gray-500 mb-3">
        {isAdmin
          ? 'Add a project, then fill it with products (each with a PRD) and blocks (a heading with its features listed under it).'
          : 'An admin needs to set up the project overview.'}
      </p>
      {isAdmin && (
        <button
          onClick={onAdd}
          className="flex items-center gap-1.5 text-sm font-semibold px-3 py-2 rounded-lg border transition-all duration-150"
          style={{ color: ACCENT_TEXT, borderColor: ACCENT, background: 'white' }}
        >
          <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
            <line x1="12" y1="5" x2="12" y2="19" /><line x1="5" y1="12" x2="19" y2="12" />
          </svg>
          Add Project
        </button>
      )}
    </div>
  );
}
