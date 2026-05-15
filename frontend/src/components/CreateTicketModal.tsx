'use client';
import { useState } from 'react';
import api from '@/lib/api';
import { Board, Ticket } from '@/types';

const TICKET_TYPES = [
  { value: 'mobile', label: 'Mobile', color: 'bg-blue-50 text-blue-600 border-blue-200' },
  { value: 'design', label: 'Design', color: 'bg-pink-50 text-pink-600 border-pink-200' },
  { value: 'product', label: 'Product', color: 'bg-purple-50 text-purple-600 border-purple-200' },
  { value: 'backend', label: 'Backend', color: 'bg-gray-100 text-gray-600 border-gray-200' },
  { value: 'frontend', label: 'Frontend', color: 'bg-green-50 text-green-600 border-green-200' },
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
    project: '',
  });
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  const members = board.members.map((m) => m.user);

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
      onCreate(data);
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
            <textarea
              value={form.description}
              onChange={(e) => setForm({ ...form, description: e.target.value })}
              rows={3}
              className="px-3 py-2.5 text-sm placeholder-gray-400 resize-none transition-all duration-150"
              style={inputStyle}
              {...focusHandlers}
              placeholder="Add more context (optional)..."
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
              Project
            </label>
            <input
              type="text"
              value={form.project}
              onChange={(e) => setForm({ ...form, project: e.target.value })}
              className="px-3 py-2.5 text-sm transition-all duration-150"
              style={inputStyle}
              {...focusHandlers}
              placeholder="Project name..."
            />
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
