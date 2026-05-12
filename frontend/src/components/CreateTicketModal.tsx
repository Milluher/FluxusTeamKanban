'use client';
import { useState } from 'react';
import api from '@/lib/api';
import { Board, Ticket } from '@/types';

interface Props {
  columnId: string;
  boardId: string;
  board: Board;
  onClose: () => void;
  onCreate: (ticket: Ticket) => void;
}

export default function CreateTicketModal({ columnId, boardId, board, onClose, onCreate }: Props) {
  const [form, setForm] = useState({
    title: '',
    description: '',
    assigneeId: '',
    productManagerId: '',
    assignedDate: '',
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
      });
      onCreate(data);
    } catch (err: any) {
      setError(err.response?.data?.error || 'Failed to create ticket');
    } finally { setSaving(false); }
  };

  const inputStyle = {
    background: 'rgba(255,255,255,0.06)',
    border: '1px solid rgba(255,255,255,0.1)',
    borderRadius: '10px',
    color: 'white',
    outline: 'none',
    width: '100%',
  };

  const focusHandlers = {
    onFocus: (e: React.FocusEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>) => {
      e.currentTarget.style.border = '1px solid rgba(99,102,241,0.6)';
      e.currentTarget.style.boxShadow = '0 0 0 3px rgba(99,102,241,0.12)';
    },
    onBlur: (e: React.FocusEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>) => {
      e.currentTarget.style.border = '1px solid rgba(255,255,255,0.1)';
      e.currentTarget.style.boxShadow = 'none';
    },
  };

  return (
    <div
      className="fixed inset-0 flex items-center justify-center z-50 p-4"
      style={{ background: 'rgba(0,0,0,0.7)', backdropFilter: 'blur(8px)', WebkitBackdropFilter: 'blur(8px)' }}
      onClick={onClose}
    >
      <div
        className="w-full max-w-lg rounded-3xl overflow-hidden"
        style={{
          background: '#131c2e',
          border: '1px solid rgba(255,255,255,0.1)',
          boxShadow: '0 40px 80px rgba(0,0,0,0.6)',
        }}
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="px-7 py-5 flex items-center justify-between"
          style={{ borderBottom: '1px solid rgba(255,255,255,0.08)' }}>
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-xl flex items-center justify-center"
              style={{ background: 'linear-gradient(135deg, #6366f1, #8b5cf6)', boxShadow: '0 4px 12px rgba(99,102,241,0.3)' }}>
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="2.5">
                <line x1="12" y1="5" x2="12" y2="19"/>
                <line x1="5" y1="12" x2="19" y2="12"/>
              </svg>
            </div>
            <div>
              <h2 className="text-base font-bold text-white">Create Ticket</h2>
              <p className="text-xs" style={{ color: 'rgba(255,255,255,0.35)' }}>Add a new task to this column</p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="w-8 h-8 flex items-center justify-center rounded-xl text-lg transition-all duration-200"
            style={{ color: 'rgba(255,255,255,0.4)', background: 'rgba(255,255,255,0.06)' }}
            onMouseEnter={(e) => { e.currentTarget.style.background = 'rgba(255,255,255,0.12)'; e.currentTarget.style.color = 'rgba(255,255,255,0.8)'; }}
            onMouseLeave={(e) => { e.currentTarget.style.background = 'rgba(255,255,255,0.06)'; e.currentTarget.style.color = 'rgba(255,255,255,0.4)'; }}
          >
            ×
          </button>
        </div>

        {/* Form */}
        <form onSubmit={handleSubmit} className="px-7 py-6 space-y-5">
          <div>
            <label className="block text-xs font-semibold uppercase tracking-wider mb-2"
              style={{ color: 'rgba(255,255,255,0.4)' }}>
              Title <span style={{ color: '#f43f5e' }}>*</span>
            </label>
            <input
              autoFocus
              type="text"
              value={form.title}
              onChange={(e) => setForm({ ...form, title: e.target.value })}
              className="px-4 py-3 text-sm placeholder-slate-500 transition-all duration-200"
              style={inputStyle}
              {...focusHandlers}
              placeholder="What needs to be done?"
            />
          </div>

          <div>
            <label className="block text-xs font-semibold uppercase tracking-wider mb-2"
              style={{ color: 'rgba(255,255,255,0.4)' }}>
              Description
            </label>
            <textarea
              value={form.description}
              onChange={(e) => setForm({ ...form, description: e.target.value })}
              rows={3}
              className="px-4 py-3 text-sm placeholder-slate-500 resize-none transition-all duration-200"
              style={inputStyle}
              {...focusHandlers}
              placeholder="Add more context (optional)..."
            />
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-semibold uppercase tracking-wider mb-2"
                style={{ color: 'rgba(255,255,255,0.4)' }}>
                Assignee
              </label>
              <select
                value={form.assigneeId}
                onChange={(e) => setForm({ ...form, assigneeId: e.target.value })}
                className="px-3 py-2.5 text-sm transition-all duration-200"
                style={inputStyle}
                {...focusHandlers}
              >
                <option value="" style={{ background: '#131c2e' }}>Unassigned</option>
                {members.map((u) => <option key={u.id} value={u.id} style={{ background: '#131c2e' }}>{u.name}</option>)}
              </select>
            </div>
            <div>
              <label className="block text-xs font-semibold uppercase tracking-wider mb-2"
                style={{ color: 'rgba(255,255,255,0.4)' }}>
                Product Manager
              </label>
              <select
                value={form.productManagerId}
                onChange={(e) => setForm({ ...form, productManagerId: e.target.value })}
                className="px-3 py-2.5 text-sm transition-all duration-200"
                style={inputStyle}
                {...focusHandlers}
              >
                <option value="" style={{ background: '#131c2e' }}>None</option>
                {members.map((u) => <option key={u.id} value={u.id} style={{ background: '#131c2e' }}>{u.name}</option>)}
              </select>
            </div>
          </div>

          <div>
            <label className="block text-xs font-semibold uppercase tracking-wider mb-2"
              style={{ color: 'rgba(255,255,255,0.4)' }}>
              Assigned Date
            </label>
            <input
              type="date"
              value={form.assignedDate}
              onChange={(e) => setForm({ ...form, assignedDate: e.target.value })}
              className="px-4 py-2.5 text-sm transition-all duration-200"
              style={inputStyle}
              {...focusHandlers}
            />
          </div>

          {error && (
            <div className="rounded-xl px-4 py-3 text-sm font-medium"
              style={{ background: 'rgba(239,68,68,0.12)', border: '1px solid rgba(239,68,68,0.25)', color: '#fca5a5' }}>
              {error}
            </div>
          )}

          <div className="flex gap-3 pt-1">
            <button
              type="submit"
              disabled={saving}
              className="flex-1 py-3 rounded-xl text-sm font-bold text-white transition-all duration-200 disabled:opacity-50"
              style={{
                background: 'linear-gradient(135deg, #6366f1, #8b5cf6)',
                boxShadow: saving ? 'none' : '0 4px 16px rgba(99,102,241,0.35)',
              }}
            >
              {saving ? 'Creating...' : 'Create Ticket'}
            </button>
            <button
              type="button"
              onClick={onClose}
              className="px-5 py-3 rounded-xl text-sm font-semibold transition-all duration-200"
              style={{ color: 'rgba(255,255,255,0.5)', background: 'rgba(255,255,255,0.06)', border: '1px solid rgba(255,255,255,0.1)' }}
              onMouseEnter={(e) => { e.currentTarget.style.background = 'rgba(255,255,255,0.1)'; e.currentTarget.style.color = 'rgba(255,255,255,0.8)'; }}
              onMouseLeave={(e) => { e.currentTarget.style.background = 'rgba(255,255,255,0.06)'; e.currentTarget.style.color = 'rgba(255,255,255,0.5)'; }}
            >
              Cancel
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
