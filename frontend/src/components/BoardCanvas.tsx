'use client';
import { useEffect, useState, useCallback } from 'react';
import api from '@/lib/api';
import { CanvasProject, CanvasBlock } from '@/types';

interface Props {
  boardId: string;
  isAdmin: boolean;
}

const ACCENT = '#e8390e';
const NAVY = '#1a1f3c';

export default function BoardCanvas({ boardId, isAdmin }: Props) {
  const [projects, setProjects] = useState<CanvasProject[]>([]);
  const [activeId, setActiveId] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [collapsed, setCollapsed] = useState(false);
  // Per-block "add feature" draft text, keyed by block id
  const [featureDrafts, setFeatureDrafts] = useState<Record<string, string>>({});
  const [busy, setBusy] = useState(false);

  const load = useCallback(async () => {
    try {
      const { data } = await api.get<CanvasProject[]>(`/boards/${boardId}/canvas`);
      setProjects(data);
      setActiveId((prev) => (prev && data.some((p) => p.id === prev) ? prev : data[0]?.id ?? null));
    } catch { /* board may simply have no canvas access — leave empty */ }
    finally { setLoading(false); }
  }, [boardId]);

  useEffect(() => { load(); }, [load]);

  const active = projects.find((p) => p.id === activeId) ?? null;

  // --- Project actions ---
  const addProject = async () => {
    const name = window.prompt('New project name')?.trim();
    if (!name) return;
    setBusy(true);
    try {
      const { data } = await api.post<CanvasProject>(`/boards/${boardId}/canvas/projects`, { name });
      setProjects((prev) => [...prev, { ...data, blocks: data.blocks ?? [] }]);
      setActiveId(data.id);
    } finally { setBusy(false); }
  };

  const renameProject = async (project: CanvasProject) => {
    const name = window.prompt('Rename project', project.name)?.trim();
    if (!name || name === project.name) return;
    await api.patch(`/boards/${boardId}/canvas/projects/${project.id}`, { name });
    setProjects((prev) => prev.map((p) => (p.id === project.id ? { ...p, name } : p)));
  };

  const deleteProject = async (project: CanvasProject) => {
    if (!window.confirm(`Delete project "${project.name}" and all its blocks?`)) return;
    await api.delete(`/boards/${boardId}/canvas/projects/${project.id}`);
    setProjects((prev) => {
      const next = prev.filter((p) => p.id !== project.id);
      if (activeId === project.id) setActiveId(next[0]?.id ?? null);
      return next;
    });
  };

  // --- Block actions ---
  const addBlock = async () => {
    if (!active) return;
    const title = window.prompt('Block title (e.g. Security, Payments, Onboarding)')?.trim();
    if (!title) return;
    const { data } = await api.post<CanvasBlock>(`/boards/${boardId}/canvas/projects/${active.id}/blocks`, { title });
    setProjects((prev) => prev.map((p) =>
      p.id === active.id ? { ...p, blocks: [...p.blocks, { ...data, features: data.features ?? [] }] } : p));
  };

  const renameBlock = async (block: CanvasBlock) => {
    const title = window.prompt('Rename block', block.title)?.trim();
    if (!title || title === block.title) return;
    await api.patch(`/boards/${boardId}/canvas/blocks/${block.id}`, { title });
    updateBlock(block.id, (b) => ({ ...b, title }));
  };

  const deleteBlock = async (block: CanvasBlock) => {
    if (!window.confirm(`Remove the "${block.title}" block?`)) return;
    await api.delete(`/boards/${boardId}/canvas/blocks/${block.id}`);
    setProjects((prev) => prev.map((p) =>
      p.id === active?.id ? { ...p, blocks: p.blocks.filter((b) => b.id !== block.id) } : p));
  };

  // --- Feature actions ---
  const addFeature = async (block: CanvasBlock) => {
    const text = (featureDrafts[block.id] ?? '').trim();
    if (!text) return;
    setFeatureDrafts((d) => ({ ...d, [block.id]: '' }));
    const { data } = await api.post(`/boards/${boardId}/canvas/blocks/${block.id}/features`, { text });
    updateBlock(block.id, (b) => ({ ...b, features: [...b.features, data] }));
  };

  const editFeature = async (block: CanvasBlock, featureId: string, current: string) => {
    const text = window.prompt('Edit feature', current)?.trim();
    if (!text || text === current) return;
    await api.patch(`/boards/${boardId}/canvas/features/${featureId}`, { text });
    updateBlock(block.id, (b) => ({ ...b, features: b.features.map((f) => (f.id === featureId ? { ...f, text } : f)) }));
  };

  const deleteFeature = async (block: CanvasBlock, featureId: string) => {
    await api.delete(`/boards/${boardId}/canvas/features/${featureId}`);
    updateBlock(block.id, (b) => ({ ...b, features: b.features.filter((f) => f.id !== featureId) }));
  };

  // Helper: mutate a single block within the active project
  const updateBlock = (blockId: string, fn: (b: CanvasBlock) => CanvasBlock) => {
    setProjects((prev) => prev.map((p) =>
      p.id === active?.id ? { ...p, blocks: p.blocks.map((b) => (b.id === blockId ? fn(b) : b)) } : p));
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
                  onDoubleClick={() => isAdmin && renameProject(p)}
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
                onClick={() => deleteProject(active)}
                className="text-xs font-semibold px-2 py-1 rounded-lg transition-all duration-150 text-gray-400 hover:text-red-500 hover:bg-red-50"
                title="Delete current project"
              >
                Delete
              </button>
            )}
            <button
              onClick={addProject}
              disabled={busy}
              className="flex items-center gap-1 text-xs font-semibold px-2.5 py-1.5 rounded-lg border transition-all duration-150 disabled:opacity-50"
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
            <EmptyState isAdmin={isAdmin} onAdd={addProject} />
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
                      onClick={() => isAdmin && renameBlock(block)}
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
                        onClick={() => deleteBlock(block)}
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
                          fill="none" stroke="#16a34a" strokeWidth="3"
                        >
                          <polyline points="20 6 9 17 4 12" />
                        </svg>
                        <span
                          onClick={() => isAdmin && editFeature(block, f.id, f.text)}
                          className={`text-xs text-gray-700 leading-snug flex-1 ${isAdmin ? 'cursor-pointer hover:text-gray-900' : ''}`}
                          title={isAdmin ? 'Click to edit' : undefined}
                        >
                          {f.text}
                        </span>
                        {isAdmin && (
                          <button
                            onClick={() => deleteFeature(block, f.id)}
                            className="opacity-0 group-hover:opacity-100 flex-shrink-0 w-4 h-4 flex items-center justify-center rounded text-gray-300 hover:text-red-500 transition-all"
                            title="Remove feature"
                          >
                            <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
                              <line x1="18" y1="6" x2="6" y2="18" /><line x1="6" y1="6" x2="18" y2="18" />
                            </svg>
                          </button>
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
                  onClick={addBlock}
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
    </div>
  );
}

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
