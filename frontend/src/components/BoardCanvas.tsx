'use client';
import { useEffect, useState, useCallback } from 'react';
import api from '@/lib/api';
import socket from '@/lib/socket';
import { CanvasProject, CanvasBlock, CanvasFeature } from '@/types';

interface Props {
  boardId: string;
  isAdmin: boolean;
}

const ACCENT = '#e8390e';
const NAVY = '#1a1f3c';

// Modal state machine — text prompts and destructive confirms
type ModalState =
  | { kind: 'add-project' }
  | { kind: 'rename-project'; project: CanvasProject }
  | { kind: 'add-block' }
  | { kind: 'rename-block'; block: CanvasBlock }
  | { kind: 'edit-feature'; block: CanvasBlock; feature: CanvasFeature }
  | { kind: 'delete-project'; project: CanvasProject }
  | { kind: 'delete-block'; block: CanvasBlock }
  | null;

export default function BoardCanvas({ boardId, isAdmin }: Props) {
  const [projects, setProjects] = useState<CanvasProject[]>([]);
  const [activeId, setActiveId] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [collapsed, setCollapsed] = useState(false);
  // Per-block "add feature" draft text, keyed by block id
  const [featureDrafts, setFeatureDrafts] = useState<Record<string, string>>({});
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

  // Real-time: refetch when anyone changes this board's canvas
  useEffect(() => {
    const onChanged = (payload: { boardId?: string }) => {
      if (payload?.boardId === boardId) load();
    };
    socket.on('canvas-changed', onChanged);
    return () => { socket.off('canvas-changed', onChanged); };
  }, [boardId, load]);

  const active = projects.find((p) => p.id === activeId) ?? null;

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

  // Feature add/delete stay inline (no modal)
  const addFeature = async (block: CanvasBlock) => {
    const text = (featureDrafts[block.id] ?? '').trim();
    if (!text) return;
    setFeatureDrafts((d) => ({ ...d, [block.id]: '' }));
    const { data } = await api.post(`/boards/${boardId}/canvas/blocks/${block.id}/features`, { text });
    updateBlock(block.id, (b) => ({ ...b, features: [...b.features, data] }));
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
          onClick={() => setCollapsed((c) => !c)}
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
                className="text-xs font-semibold px-2 py-1 rounded-lg transition-all duration-150 text-gray-400 hover:text-red-500 hover:bg-red-50"
                title="Delete current project"
              >
                Delete
              </button>
            )}
            <button
              onClick={() => openModal({ kind: 'add-project' })}
              className="flex items-center gap-1 text-xs font-semibold px-2.5 py-1.5 rounded-lg border transition-all duration-150"
              style={{ color: ACCENT, borderColor: ACCENT, background: 'white' }}
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
          ) : !active ? null : active.blocks.length === 0 && !isAdmin ? (
            <p className="text-xs text-gray-400 py-6 text-center">No overview blocks yet for this project.</p>
          ) : (
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
                    <span className="w-1.5 h-1.5 rounded-full flex-shrink-0" style={{ background: ACCENT }} />
                    <h4
                      onClick={() => isAdmin && openModal({ kind: 'rename-block', block }, block.title)}
                      title={isAdmin ? 'Click to rename' : undefined}
                      className={`text-xs font-bold uppercase tracking-wide truncate ${isAdmin ? 'cursor-pointer' : ''}`}
                      style={{ color: NAVY }}
                    >
                      {block.title}
                    </h4>
                    <span className="ml-auto text-[10px] font-semibold text-gray-400 flex-shrink-0">
                      {block.features.length}
                    </span>
                    {isAdmin && (
                      <button
                        onClick={() => openModal({ kind: 'delete-block', block })}
                        className="flex-shrink-0 w-5 h-5 flex items-center justify-center rounded text-gray-300 hover:text-red-500 hover:bg-red-50 transition-all"
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
                      <p className="text-[11px] text-gray-300 px-1 py-2">No features listed.</p>
                    )}
                    {block.features.map((f) => (
                      <div key={f.id} className="flex items-start gap-2 group">
                        <svg
                          className="flex-shrink-0 mt-0.5" width="12" height="12" viewBox="0 0 24 24"
                          fill="none" stroke={f.active ? '#16a34a' : '#d1d5db'} strokeWidth="3"
                        >
                          <polyline points="20 6 9 17 4 12" />
                        </svg>
                        <span
                          onClick={() => isAdmin && openModal({ kind: 'edit-feature', block, feature: f }, f.text)}
                          className={`text-xs leading-snug flex-1 ${f.active ? 'text-gray-700' : 'line-through text-gray-400'} ${isAdmin ? 'cursor-pointer hover:text-gray-900' : ''}`}
                          title={isAdmin ? 'Click to edit' : undefined}
                        >
                          {f.text}
                        </span>
                        {isAdmin && (
                          <div className="flex items-center gap-0.5 flex-shrink-0">
                            <button
                              onClick={() => toggleFeature(block, f)}
                              className={`${f.active ? 'opacity-0 group-hover:opacity-100' : 'opacity-100'} w-4 h-4 flex items-center justify-center rounded transition-all ${f.active ? 'text-gray-300 hover:text-amber-600' : 'text-amber-600 hover:text-green-600'}`}
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
                              className="opacity-0 group-hover:opacity-100 w-4 h-4 flex items-center justify-center rounded text-gray-300 hover:text-red-500 transition-all"
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

                    {/* Add feature (admin) */}
                    {isAdmin && (
                      <input
                        value={featureDrafts[block.id] ?? ''}
                        onChange={(e) => setFeatureDrafts((d) => ({ ...d, [block.id]: e.target.value }))}
                        onKeyDown={(e) => { if (e.key === 'Enter') addFeature(block); }}
                        onBlur={() => addFeature(block)}
                        placeholder="+ Add feature"
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
                  className="rounded-xl border border-dashed border-gray-300 flex flex-col items-center justify-center gap-1.5 py-8 text-gray-400 hover:border-gray-400 hover:text-gray-600 hover:bg-gray-50 transition-all min-h-[120px]"
                >
                  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                    <line x1="12" y1="5" x2="12" y2="19" /><line x1="5" y1="12" x2="19" y2="12" />
                  </svg>
                  <span className="text-xs font-semibold">Add block</span>
                </button>
              )}
            </div>
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
              <button onClick={closeModal} className="text-gray-400 text-xl w-8 h-8 flex items-center justify-center">×</button>
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
                  className="w-full px-3 py-2.5 text-sm rounded-lg border border-gray-200 outline-none"
                  style={{ color: '#111827' }}
                  onFocus={(e) => { e.currentTarget.style.borderColor = ACCENT; e.currentTarget.style.boxShadow = '0 0 0 3px rgba(232,57,14,0.1)'; }}
                  onBlur={(e) => { e.currentTarget.style.borderColor = '#e5e7eb'; e.currentTarget.style.boxShadow = 'none'; }}
                />
                <div className="flex gap-2">
                  <button type="button" onClick={closeModal} disabled={modalBusy} className="flex-1 py-2.5 min-h-[44px] rounded-lg text-sm font-medium text-gray-600 border border-gray-200 disabled:opacity-50">Cancel</button>
                  <button
                    type="submit"
                    disabled={modalBusy || !modalInput.trim()}
                    className="flex-1 py-2.5 min-h-[44px] rounded-lg text-sm font-bold text-white disabled:opacity-50"
                    style={{ background: ACCENT }}
                  >
                    {modalBusy ? 'Saving...' : 'Save'}
                  </button>
                </div>
              </form>
            )}
          </div>
        </div>
      )}
    </div>
  );
}

const MODAL_TITLES: Record<NonNullable<ModalState>['kind'], string> = {
  'add-project': 'New Project',
  'rename-project': 'Rename Project',
  'add-block': 'New Block',
  'rename-block': 'Rename Block',
  'edit-feature': 'Edit Feature',
  'delete-project': 'Delete Project',
  'delete-block': 'Remove Block',
};

const MODAL_PLACEHOLDERS: Record<NonNullable<ModalState>['kind'], string> = {
  'add-project': 'e.g. Mobile App',
  'rename-project': 'Project name',
  'add-block': 'e.g. Security, Payments, Onboarding',
  'rename-block': 'Block title',
  'edit-feature': 'Feature description',
  'delete-project': '',
  'delete-block': '',
};

function EmptyState({ isAdmin, onAdd }: { isAdmin: boolean; onAdd: () => void }) {
  return (
    <div className="flex flex-col items-center justify-center py-8 text-center">
      <p className="text-sm font-semibold text-gray-500 mb-1">No project overview yet</p>
      <p className="text-xs text-gray-400 mb-3">
        {isAdmin
          ? 'Add a project, then create blocks (e.g. Security) to show its available features.'
          : 'An admin needs to set up the project overview.'}
      </p>
      {isAdmin && (
        <button
          onClick={onAdd}
          className="flex items-center gap-1.5 text-sm font-semibold px-3 py-2 rounded-lg border transition-all duration-150"
          style={{ color: ACCENT, borderColor: ACCENT, background: 'white' }}
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
