'use client';
import { useState, useEffect, useRef } from 'react';
import api from '@/lib/api';
import { Board, Ticket } from '@/types';
import dynamic from 'next/dynamic';
const RichTextEditor = dynamic(() => import('./RichTextEditor'), { ssr: false });

const TICKET_TYPES = [
  { value: 'mobile', label: 'Mobile', color: 'bg-blue-50 text-blue-600 border-blue-200' },
  { value: 'design', label: 'Design', color: 'bg-pink-50 text-pink-600 border-pink-200' },
  { value: 'product', label: 'Product', color: 'bg-purple-50 text-purple-600 border-purple-200' },
  { value: 'backend', label: 'Backend', color: 'bg-gray-100 text-gray-600 border-gray-200' },
  { value: 'frontend', label: 'Frontend', color: 'bg-green-50 text-green-600 border-green-200' },
];

const PRIORITIES = [
  { value: 'low',    label: 'Low',       style: { color: '#6b7280', background: '#f9fafb', border: '1px solid #d1d5db' } },
  { value: 'medium', label: 'Medium',    style: { color: '#b45309', background: '#fffbeb', border: '1px solid #fcd34d' } },
  { value: 'high',   label: 'High',      style: { color: '#ea580c', background: '#fff7ed', border: '1px solid #fed7aa' } },
  { value: 'urgent', label: 'Urgent 🔥', style: { color: '#dc2626', background: '#fef2f2', border: '1px solid #fecaca' } },
];

interface Props {
  columnId: string;
  boardId: string;
  board: Board;
  onClose: () => void;
  onCreate: (ticket: Ticket) => void;
  sprintId?: string;
  boardType?: string;
}

export default function CreateTicketModal({ columnId, boardId, board, onClose, onCreate, sprintId, boardType = 'sprint' }: Props) {
  const [form, setForm] = useState({
    title: '',
    description: '',
    assigneeId: '',
    productManagerId: '',
    assignedDate: '',
    type: '',
    priority: '',
    project: '',
    epic: '',
  });
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  // Dependency state
  const [selectedDeps, setSelectedDeps] = useState<{ id: string; title: string; status: string }[]>([]);
  const [depSearch, setDepSearch] = useState('');
  const [depResults, setDepResults] = useState<{ id: string; title: string; status: string }[]>([]);
  const [showDepSearch, setShowDepSearch] = useState(false);

  const [projectOptions, setProjectOptions] = useState<string[]>([]);
  const [showProjectDropdown, setShowProjectDropdown] = useState(false);
  const [epicOptions, setEpicOptions] = useState<string[]>([]);
  const [showEpicDropdown, setShowEpicDropdown] = useState(false);

  useEffect(() => {
    const stored = localStorage.getItem(`board-projects-${boardId}`);
    const fromStorage: string[] = stored ? JSON.parse(stored) : [];
    const fromBoard = board.columns.flatMap((c) => c.tickets).map((t) => t.project).filter((p): p is string => !!p);
    setProjectOptions([...new Set([...fromBoard, ...fromStorage])]);

    const storedEpics = localStorage.getItem(`board-epics-${boardId}`);
    const epicsFromStorage: string[] = storedEpics ? JSON.parse(storedEpics) : [];
    const epicsFromBoard = board.columns.flatMap((c) => c.tickets).map((t) => t.epic).filter((p): p is string => !!p);
    setEpicOptions([...new Set([...epicsFromBoard, ...epicsFromStorage])]);
  }, [boardId]);

  const members = board.members.map((m) => m.user);

  const searchDeps = async (q: string) => {
    setDepSearch(q);
    const url = q.trim() ? `/tickets?boardId=${boardId}&q=${q}` : `/tickets?boardId=${boardId}`;
    const { data } = await api.get(url);
    setDepResults(data.filter((t: any) => !selectedDeps.some((d) => d.id === t.id)));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!form.title.trim()) { setError('Title is required'); return; }
    setSaving(true);
    try {
      const { data } = await api.post('/tickets', {
        ...form,
        assigneeId: form.assigneeId || undefined,
        productManagerId: form.productManagerId || undefined,
        assignedDate: form.assignedDate || undefined,
        columnId,
        boardId,
        sprintId: sprintId || undefined,
      });
      // Add selected dependencies
      await Promise.all(
        selectedDeps.map((dep) =>
          api.post(`/tickets/${data.id}/dependencies`, { dependsOnId: dep.id, boardId })
        )
      );
      onCreate(data);
      if (form.project) {
        const stored = localStorage.getItem(`board-projects-${boardId}`);
        const existing: string[] = stored ? JSON.parse(stored) : [];
        if (!existing.includes(form.project)) {
          localStorage.setItem(`board-projects-${boardId}`, JSON.stringify([...existing, form.project]));
        }
      }
      if (form.epic) {
        const stored = localStorage.getItem(`board-epics-${boardId}`);
        const existing: string[] = stored ? JSON.parse(stored) : [];
        if (!existing.includes(form.epic)) {
          localStorage.setItem(`board-epics-${boardId}`, JSON.stringify([...existing, form.epic]));
        }
      }
    } catch (err: any) {
      setError(err.response?.data?.error || 'Failed to create ticket');
    } finally { setSaving(false); }
  };

  const inputStyle: React.CSSProperties = {
    background: 'white',
    border: '1px solid #e5e7eb',
    borderRadius: '8px',
    color: '#111827',
    outline: 'none',
    width: '100%',
  };

  const focusHandlers = {
    onFocus: (e: React.FocusEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>) => {
      e.currentTarget.style.borderColor = '#e8390e';
      e.currentTarget.style.boxShadow = '0 0 0 3px rgba(232,57,14,0.1)';
    },
    onBlur: (e: React.FocusEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>) => {
      e.currentTarget.style.borderColor = '#e5e7eb';
      e.currentTarget.style.boxShadow = 'none';
    },
  };

  return (
    <div
      className="fixed inset-0 flex items-end sm:items-center justify-center z-50"
      style={{ background: 'rgba(0,0,0,0.4)' }}
      onClick={onClose}
    >
      <div
        className="w-full sm:max-w-lg max-h-[92vh] sm:max-h-[90vh] rounded-t-2xl sm:rounded-xl overflow-y-auto bg-white shadow-xl border border-gray-200"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="px-4 sm:px-6 py-4 flex items-center justify-between border-b border-gray-200 sticky top-0 bg-white z-10">
          <h2 className="text-base font-bold" style={{ color: '#1a1f3c' }}>New Ticket</h2>
          <button
            onClick={onClose}
            className="w-7 h-7 flex items-center justify-center rounded-lg text-lg text-gray-400 bg-gray-100 transition-all duration-150 hover:bg-gray-200 hover:text-gray-700"
          >
            ×
          </button>
        </div>

        {/* Form */}
        <form onSubmit={handleSubmit} className="px-4 sm:px-6 py-5 space-y-4">
          <div>
            <label className="block text-xs font-semibold text-gray-500 mb-1.5">
              Title <span className="text-red-500">*</span>
            </label>
            <input
              autoFocus
              type="text"
              value={form.title}
              onChange={(e) => setForm({ ...form, title: e.target.value })}
              className="px-3 py-2.5 text-sm placeholder-gray-400 transition-all duration-150"
              style={inputStyle}
              {...focusHandlers}
              placeholder="What needs to be done?"
            />
          </div>

          <div>
            <label className="block text-xs font-semibold text-gray-500 mb-1.5">
              Description
            </label>
            <RichTextEditor
              content={form.description}
              onChange={(html) => setForm({ ...form, description: html })}
              placeholder="Add more context (optional)..."
              minHeight={100}
            />
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-semibold text-gray-500 mb-1.5">
                Assignee
              </label>
              <select
                value={form.assigneeId}
                onChange={(e) => setForm({ ...form, assigneeId: e.target.value })}
                className="px-3 py-2.5 text-sm transition-all duration-150"
                style={inputStyle}
                {...focusHandlers}
              >
                <option value="">Unassigned</option>
                {members.map((u) => <option key={u.id} value={u.id}>{u.name}</option>)}
              </select>
            </div>
            {boardType !== 'kanban' && (
              <div>
                <label className="block text-xs font-semibold text-gray-500 mb-1.5">
                  Product Manager
                </label>
                <select
                  value={form.productManagerId}
                  onChange={(e) => setForm({ ...form, productManagerId: e.target.value })}
                  className="px-3 py-2.5 text-sm transition-all duration-150"
                  style={inputStyle}
                  {...focusHandlers}
                >
                  <option value="">None</option>
                  {members.map((u) => <option key={u.id} value={u.id}>{u.name}</option>)}
                </select>
              </div>
            )}
          </div>

          <div>
            <label className="block text-xs font-semibold text-gray-500 mb-1.5">
              Assigned Date
            </label>
            <input
              type="date"
              value={form.assignedDate}
              onChange={(e) => setForm({ ...form, assignedDate: e.target.value })}
              className="px-3 py-2.5 text-sm transition-all duration-150"
              style={inputStyle}
              {...focusHandlers}
            />
          </div>

          <div>
            <label className="block text-xs font-semibold text-gray-500 mb-1.5">
              Type
            </label>
            <div className="flex flex-wrap gap-2">
              {TICKET_TYPES.map((t) => (
                <button
                  key={t.value}
                  type="button"
                  onClick={() => setForm({ ...form, type: form.type === t.value ? '' : t.value })}
                  className={`text-xs font-medium px-2.5 py-1 rounded-full border transition-all duration-150 ${t.color} ${form.type === t.value ? 'ring-2 ring-orange-400 ring-offset-1' : ''}`}
                >
                  {t.label}
                </button>
              ))}
            </div>
          </div>

          <div>
            <label className="block text-xs font-semibold text-gray-500 mb-1.5">
              Priority
            </label>
            <div className="flex flex-wrap gap-2">
              {PRIORITIES.map((p) => (
                <button
                  key={p.value}
                  type="button"
                  onClick={() => setForm({ ...form, priority: form.priority === p.value ? '' : p.value })}
                  className={`text-xs font-semibold px-2.5 py-1 rounded-full transition-all duration-150 ${form.priority === p.value ? 'ring-2 ring-offset-1 ring-gray-400' : ''}`}
                  style={p.style}
                >
                  {p.label}
                </button>
              ))}
            </div>
          </div>

          <div>
            <label className="block text-xs font-semibold text-gray-500 mb-1.5">
              Project
            </label>
            <div className="relative">
              <input
                type="text"
                value={form.project}
                onChange={(e) => setForm({ ...form, project: e.target.value })}
                onFocus={(e) => { setShowProjectDropdown(true); focusHandlers.onFocus(e); }}
                onBlur={(e) => { setTimeout(() => setShowProjectDropdown(false), 150); focusHandlers.onBlur(e); }}
                className="px-3 py-2.5 text-sm transition-all duration-150"
                style={inputStyle}
                placeholder="Type or select a project..."
                autoComplete="off"
              />
              {showProjectDropdown && projectOptions.filter((p) =>
                !form.project || p.toLowerCase().includes(form.project.toLowerCase())
              ).length > 0 && (
                <div className="absolute top-full left-0 right-0 mt-1 bg-white border border-gray-200 rounded-lg shadow-lg z-30 max-h-40 overflow-y-auto">
                  {projectOptions
                    .filter((p) => !form.project || p.toLowerCase().includes(form.project.toLowerCase()))
                    .map((p) => (
                      <button
                        key={p}
                        type="button"
                        onMouseDown={(e) => { e.preventDefault(); setForm({ ...form, project: p }); setShowProjectDropdown(false); }}
                        className="w-full text-left px-3 py-2 text-sm text-gray-700 hover:bg-orange-50 first:rounded-t-lg last:rounded-b-lg"
                      >
                        {p}
                      </button>
                    ))}
                </div>
              )}
            </div>
          </div>

          {boardType !== 'kanban' && (
            <div>
              <label className="block text-xs font-semibold text-gray-500 mb-1.5">
                Epic
              </label>
              <div className="relative">
                <input
                  type="text"
                  value={form.epic}
                  onChange={(e) => setForm({ ...form, epic: e.target.value })}
                  onFocus={(e) => { setShowEpicDropdown(true); focusHandlers.onFocus(e); }}
                  onBlur={(e) => { setTimeout(() => setShowEpicDropdown(false), 150); focusHandlers.onBlur(e); }}
                  className="px-3 py-2.5 text-sm transition-all duration-150"
                  style={inputStyle}
                  placeholder="Type or select an epic..."
                  autoComplete="off"
                />
                {showEpicDropdown && epicOptions.filter((p) =>
                  !form.epic || p.toLowerCase().includes(form.epic.toLowerCase())
                ).length > 0 && (
                  <div className="absolute top-full left-0 right-0 mt-1 bg-white border border-gray-200 rounded-lg shadow-lg z-30 max-h-40 overflow-y-auto">
                    {epicOptions
                      .filter((p) => !form.epic || p.toLowerCase().includes(form.epic.toLowerCase()))
                      .map((p) => (
                        <button
                          key={p}
                          type="button"
                          onMouseDown={(e) => { e.preventDefault(); setForm({ ...form, epic: p }); setShowEpicDropdown(false); }}
                          className="w-full text-left px-3 py-2 text-sm text-gray-700 hover:bg-orange-50 first:rounded-t-lg last:rounded-b-lg"
                        >
                          {p}
                        </button>
                      ))}
                  </div>
                )}
              </div>
            </div>
          )}

          {/* Dependencies */}
          <div>
            <div className="flex items-center justify-between mb-2">
              <label className="flex items-center gap-1.5 text-xs font-semibold text-gray-500">
                <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <path d="M10 13a5 5 0 0 0 7.54.54l3-3a5 5 0 0 0-7.07-7.07l-1.72 1.71"/>
                  <path d="M14 11a5 5 0 0 0-7.54-.54l-3 3a5 5 0 0 0 7.07 7.07l1.71-1.71"/>
                </svg>
                Dependencies
                {selectedDeps.length > 0 && (
                  <span className="ml-1 px-1.5 py-0.5 rounded-full text-xs font-bold" style={{ background: '#fff7f5', color: '#e8390e' }}>
                    {selectedDeps.length}
                  </span>
                )}
              </label>
              <button
                type="button"
                onClick={() => {
                  const next = !showDepSearch;
                  setShowDepSearch(next);
                  if (next) { setDepSearch(''); searchDeps(''); }
                  else { setDepSearch(''); setDepResults([]); }
                }}
                className="text-xs font-semibold px-2.5 py-1 rounded-lg border transition-all duration-150"
                style={{ color: '#e8390e', borderColor: '#e8390e', background: 'white' }}
                onMouseEnter={(e) => { e.currentTarget.style.background = '#e8390e'; e.currentTarget.style.color = 'white'; }}
                onMouseLeave={(e) => { e.currentTarget.style.background = 'white'; e.currentTarget.style.color = '#e8390e'; }}
              >
                + Add
              </button>
            </div>

            {showDepSearch && (
              <div className="mb-2 relative">
                <input
                  autoFocus
                  type="text"
                  value={depSearch}
                  onChange={(e) => searchDeps(e.target.value)}
                  placeholder="Search tickets..."
                  className="w-full px-3 py-2.5 text-sm text-gray-800 placeholder-gray-400 transition-all duration-150"
                  style={inputStyle}
                  {...focusHandlers}
                />
                {depResults.length > 0 && (
                  <div className="absolute top-full left-0 right-0 rounded-lg shadow-lg z-30 mt-1 max-h-48 overflow-y-auto bg-white border border-gray-200">
                    {depResults.map((t) => (
                      <button
                        key={t.id}
                        type="button"
                        onClick={() => {
                          setSelectedDeps((prev) => [...prev, t]);
                          setDepResults((prev) => prev.filter((r) => r.id !== t.id));
                          setDepSearch('');
                        }}
                        className="w-full text-left px-4 py-2.5 text-sm flex items-center justify-between transition-all duration-100 first:rounded-t-lg last:rounded-b-lg text-gray-800 hover:bg-gray-50"
                      >
                        <span className="font-medium truncate">{t.title}</span>
                        <span className="text-xs px-2 py-0.5 rounded-full bg-gray-100 text-gray-500 flex-shrink-0 ml-2">{t.status}</span>
                      </button>
                    ))}
                  </div>
                )}
                {depResults.length === 0 && depSearch.length > 0 && (
                  <p className="text-xs text-gray-400 mt-1.5 px-1">No tickets found</p>
                )}
              </div>
            )}

            {selectedDeps.length > 0 && (
              <div className="space-y-1.5">
                {selectedDeps.map((dep) => (
                  <div key={dep.id} className="flex items-center justify-between rounded-lg px-3 py-2 bg-gray-50 border border-gray-100">
                    <div className="flex items-center gap-2 min-w-0">
                      <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="#9ca3af" strokeWidth="2" className="flex-shrink-0">
                        <path d="M10 13a5 5 0 0 0 7.54.54l3-3a5 5 0 0 0-7.07-7.07l-1.72 1.71"/>
                        <path d="M14 11a5 5 0 0 0-7.54-.54l-3 3a5 5 0 0 0 7.07 7.07l1.71-1.71"/>
                      </svg>
                      <span className="text-sm font-medium text-gray-700 truncate">{dep.title}</span>
                      <span className="text-xs px-1.5 py-0.5 rounded-full bg-gray-100 text-gray-500 flex-shrink-0">{dep.status}</span>
                    </div>
                    <button
                      type="button"
                      onClick={() => setSelectedDeps((prev) => prev.filter((d) => d.id !== dep.id))}
                      className="text-xs font-medium ml-2 flex-shrink-0 px-2 py-1 rounded-md text-gray-400 hover:text-red-500 hover:bg-red-50 transition-all duration-150"
                    >
                      Remove
                    </button>
                  </div>
                ))}
              </div>
            )}
          </div>

          {error && (
            <div className="rounded-lg px-3 py-2.5 text-sm font-medium text-red-700 bg-red-50 border border-red-200">
              {error}
            </div>
          )}

          <div className="flex flex-col-reverse sm:flex-row gap-3 pt-1 pb-2 sm:pb-0">
            <button
              type="button"
              onClick={onClose}
              className="w-full sm:w-auto px-5 py-2.5 min-h-[44px] rounded-lg text-sm font-semibold text-gray-600 border border-gray-200 bg-white transition-all duration-150 hover:border-gray-300 hover:text-gray-900"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={saving}
              className="flex-1 py-2.5 min-h-[44px] rounded-lg text-sm font-bold text-white transition-all duration-150 disabled:opacity-50"
              style={{ background: '#e8390e' }}
              onMouseEnter={(e) => { if (!saving) e.currentTarget.style.background = '#c73009'; }}
              onMouseLeave={(e) => { if (!saving) e.currentTarget.style.background = '#e8390e'; }}
            >
              {saving ? 'Creating...' : 'Create Ticket'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
