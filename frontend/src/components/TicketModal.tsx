'use client';
import { useState, useEffect } from 'react';
import api from '@/lib/api';
import { Ticket, Board, User, Comment } from '@/types';

interface Props {
  ticket: Ticket;
  boardId: string;
  board: Board;
  currentUser: User;
  onClose: () => void;
  onUpdate: (ticket: Ticket) => void;
  onDelete: (id: string) => void;
}

export default function TicketModal({ ticket, boardId, board, currentUser, onClose, onUpdate, onDelete }: Props) {
  const [editing, setEditing] = useState(false);
  const [form, setForm] = useState({
    title: ticket.title,
    description: ticket.description || '',
    assigneeId: ticket.assigneeId || '',
    productManagerId: ticket.productManagerId || '',
    assignedDate: ticket.assignedDate ? ticket.assignedDate.split('T')[0] : '',
  });
  const [saving, setSaving] = useState(false);
  const [comment, setComment] = useState('');
  const [submittingComment, setSubmittingComment] = useState(false);
  const [depSearch, setDepSearch] = useState('');
  const [depResults, setDepResults] = useState<any[]>([]);
  const [showDepSearch, setShowDepSearch] = useState(false);

  const members = board.members.map((m) => m.user);

  const save = async () => {
    setSaving(true);
    try {
      const { data } = await api.patch(`/tickets/${ticket.id}`, { ...form, boardId });
      onUpdate(data);
      setEditing(false);
    } finally { setSaving(false); }
  };

  const deleteTicket = async () => {
    if (!confirm('Delete this ticket?')) return;
    await api.delete(`/tickets/${ticket.id}?boardId=${boardId}`);
    onDelete(ticket.id);
  };

  const addComment = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!comment.trim()) return;
    setSubmittingComment(true);
    try {
      const { data } = await api.post('/comments', { content: comment, ticketId: ticket.id, boardId });
      onUpdate({ ...ticket, comments: [...(ticket.comments || []), data] });
      setComment('');
    } finally { setSubmittingComment(false); }
  };

  const searchDeps = async (q: string) => {
    setDepSearch(q);
    if (q.length < 2) { setDepResults([]); return; }
    const { data } = await api.get(`/tickets?boardId=${boardId}&q=${q}`);
    setDepResults(data.filter((t: any) => t.id !== ticket.id));
  };

  const addDep = async (depId: string) => {
    await api.post(`/tickets/${ticket.id}/dependencies`, { dependsOnId: depId, boardId });
    const { data } = await api.get(`/tickets/${ticket.id}`);
    onUpdate(data);
    setDepSearch('');
    setDepResults([]);
    setShowDepSearch(false);
  };

  const removeDep = async (depId: string) => {
    await api.delete(`/tickets/${ticket.id}/dependencies/${depId}?boardId=${boardId}`);
    const { data } = await api.get(`/tickets/${ticket.id}`);
    onUpdate(data);
  };

  const getUserName = (id: string) => members.find((u) => u.id === id)?.name || 'Unknown';

  const avatarColors = ['#6366f1','#8b5cf6','#06b6d4','#10b981','#f43f5e','#f59e0b'];
  const getAvatarColor = (name: string) => avatarColors[name.charCodeAt(0) % avatarColors.length];

  const inputStyle = {
    background: 'rgba(255,255,255,0.06)',
    border: '1px solid rgba(255,255,255,0.1)',
    borderRadius: '10px',
    color: 'white',
    outline: 'none',
  };

  const inputFocusHandlers = {
    onFocus: (e: React.FocusEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>) => {
      e.currentTarget.style.border = '1px solid rgba(99,102,241,0.6)';
      e.currentTarget.style.boxShadow = '0 0 0 3px rgba(99,102,241,0.15)';
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
        className="w-full max-w-4xl max-h-[92vh] overflow-hidden rounded-3xl flex flex-col"
        style={{
          background: '#131c2e',
          border: '1px solid rgba(255,255,255,0.1)',
          boxShadow: '0 40px 80px rgba(0,0,0,0.7)',
        }}
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-start justify-between px-7 py-5 flex-shrink-0"
          style={{ borderBottom: '1px solid rgba(255,255,255,0.08)' }}>
          <div className="flex-1 mr-4">
            {editing ? (
              <input
                value={form.title}
                onChange={(e) => setForm({ ...form, title: e.target.value })}
                className="w-full text-xl font-bold bg-transparent text-white outline-none pb-1"
                style={{ borderBottom: '2px solid #6366f1' }}
                autoFocus
              />
            ) : (
              <h2 className="text-xl font-bold text-white leading-snug">{ticket.title}</h2>
            )}
            <p className="text-xs mt-1 font-medium" style={{ color: 'rgba(255,255,255,0.35)' }}>
              Created by {ticket.createdBy?.name} &middot; {new Date(ticket.createdAt).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}
            </p>
          </div>
          <div className="flex items-center gap-2 flex-shrink-0">
            {editing ? (
              <>
                <button
                  onClick={save}
                  disabled={saving}
                  className="px-4 py-2 rounded-xl text-sm font-bold text-white transition-all duration-200 disabled:opacity-50"
                  style={{ background: 'linear-gradient(135deg, #6366f1, #8b5cf6)', boxShadow: '0 4px 12px rgba(99,102,241,0.3)' }}
                >
                  {saving ? 'Saving...' : 'Save changes'}
                </button>
                <button
                  onClick={() => setEditing(false)}
                  className="px-4 py-2 rounded-xl text-sm font-medium transition-all duration-200"
                  style={{ color: 'rgba(255,255,255,0.5)', background: 'rgba(255,255,255,0.06)', border: '1px solid rgba(255,255,255,0.1)' }}
                >
                  Cancel
                </button>
              </>
            ) : (
              <>
                <button
                  onClick={() => setEditing(true)}
                  className="px-3.5 py-2 rounded-xl text-sm font-semibold transition-all duration-200"
                  style={{ color: '#a5b4fc', background: 'rgba(99,102,241,0.12)', border: '1px solid rgba(99,102,241,0.25)' }}
                  onMouseEnter={(e) => { e.currentTarget.style.background = 'rgba(99,102,241,0.22)'; }}
                  onMouseLeave={(e) => { e.currentTarget.style.background = 'rgba(99,102,241,0.12)'; }}
                >
                  Edit
                </button>
                <button
                  onClick={deleteTicket}
                  className="px-3.5 py-2 rounded-xl text-sm font-semibold transition-all duration-200"
                  style={{ color: '#fca5a5', background: 'rgba(239,68,68,0.1)', border: '1px solid rgba(239,68,68,0.2)' }}
                  onMouseEnter={(e) => { e.currentTarget.style.background = 'rgba(239,68,68,0.2)'; }}
                  onMouseLeave={(e) => { e.currentTarget.style.background = 'rgba(239,68,68,0.1)'; }}
                >
                  Delete
                </button>
              </>
            )}
            <button
              onClick={onClose}
              className="w-9 h-9 flex items-center justify-center rounded-xl text-lg transition-all duration-200 ml-1"
              style={{ color: 'rgba(255,255,255,0.4)', background: 'rgba(255,255,255,0.06)' }}
              onMouseEnter={(e) => { e.currentTarget.style.background = 'rgba(255,255,255,0.12)'; e.currentTarget.style.color = 'rgba(255,255,255,0.8)'; }}
              onMouseLeave={(e) => { e.currentTarget.style.background = 'rgba(255,255,255,0.06)'; e.currentTarget.style.color = 'rgba(255,255,255,0.4)'; }}
            >
              ×
            </button>
          </div>
        </div>

        {/* Body — two column layout */}
        <div className="flex flex-1 overflow-hidden">
          {/* Left: details */}
          <div className="flex-1 overflow-y-auto px-7 py-5 space-y-6"
            style={{ borderRight: '1px solid rgba(255,255,255,0.06)' }}>

            {/* Metadata grid */}
            <div className="grid grid-cols-2 gap-4">
              {[
                {
                  label: 'Assignee',
                  icon: <svg width="13" height="13" viewBox="0 0 24 24" fill="currentColor"><path d="M12 12c2.7 0 4.8-2.1 4.8-4.8S14.7 2.4 12 2.4 7.2 4.5 7.2 7.2 9.3 12 12 12zm0 2.4c-3.2 0-9.6 1.6-9.6 4.8v2.4h19.2v-2.4c0-3.2-6.4-4.8-9.6-4.8z"/></svg>,
                  editEl: (
                    <select
                      value={form.assigneeId}
                      onChange={(e) => setForm({ ...form, assigneeId: e.target.value })}
                      className="mt-1.5 w-full px-3 py-2 text-sm"
                      style={inputStyle}
                      {...inputFocusHandlers}
                    >
                      <option value="" style={{ background: '#131c2e' }}>Unassigned</option>
                      {members.map((u) => <option key={u.id} value={u.id} style={{ background: '#131c2e' }}>{u.name}</option>)}
                    </select>
                  ),
                  viewEl: ticket.assignee ? (
                    <div className="mt-1.5 flex items-center gap-2">
                      <div className="w-6 h-6 rounded-full flex items-center justify-center text-xs font-bold text-white"
                        style={{ background: getAvatarColor(ticket.assignee.name) }}>
                        {ticket.assignee.name.charAt(0).toUpperCase()}
                      </div>
                      <span className="text-sm font-medium text-white">{ticket.assignee.name}</span>
                    </div>
                  ) : <p className="mt-1.5 text-sm" style={{ color: 'rgba(255,255,255,0.3)' }}>Unassigned</p>,
                },
                {
                  label: 'Product Manager',
                  icon: <svg width="13" height="13" viewBox="0 0 24 24" fill="currentColor"><path d="M16 11c1.66 0 2.99-1.34 2.99-3S17.66 5 16 5c-1.66 0-3 1.34-3 3s1.34 3 3 3zm-8 0c1.66 0 2.99-1.34 2.99-3S9.66 5 8 5C6.34 5 5 6.34 5 8s1.34 3 3 3zm0 2c-2.33 0-7 1.17-7 3.5V19h14v-2.5c0-2.33-4.67-3.5-7-3.5zm8 0c-.29 0-.62.02-.97.05 1.16.84 1.97 1.97 1.97 3.45V19h6v-2.5c0-2.33-4.67-3.5-7-3.5z"/></svg>,
                  editEl: (
                    <select
                      value={form.productManagerId}
                      onChange={(e) => setForm({ ...form, productManagerId: e.target.value })}
                      className="mt-1.5 w-full px-3 py-2 text-sm"
                      style={inputStyle}
                      {...inputFocusHandlers}
                    >
                      <option value="" style={{ background: '#131c2e' }}>None</option>
                      {members.map((u) => <option key={u.id} value={u.id} style={{ background: '#131c2e' }}>{u.name}</option>)}
                    </select>
                  ),
                  viewEl: ticket.productManager ? (
                    <div className="mt-1.5 flex items-center gap-2">
                      <div className="w-6 h-6 rounded-full flex items-center justify-center text-xs font-bold text-white"
                        style={{ background: getAvatarColor(ticket.productManager.name) }}>
                        {ticket.productManager.name.charAt(0).toUpperCase()}
                      </div>
                      <span className="text-sm font-medium text-white">{ticket.productManager.name}</span>
                    </div>
                  ) : <p className="mt-1.5 text-sm" style={{ color: 'rgba(255,255,255,0.3)' }}>None</p>,
                },
                {
                  label: 'Assigned Date',
                  icon: <svg width="13" height="13" viewBox="0 0 24 24" fill="currentColor"><path d="M19 3h-1V1h-2v2H8V1H6v2H5c-1.11 0-1.99.9-1.99 2L3 19c0 1.1.89 2 2 2h14c1.1 0 2-.9 2-2V5c0-1.1-.9-2-2-2zm0 16H5V8h14v11zM7 10h5v5H7z"/></svg>,
                  editEl: (
                    <input
                      type="date"
                      value={form.assignedDate}
                      onChange={(e) => setForm({ ...form, assignedDate: e.target.value })}
                      className="mt-1.5 w-full px-3 py-2 text-sm"
                      style={inputStyle}
                      {...inputFocusHandlers}
                    />
                  ),
                  viewEl: <p className="mt-1.5 text-sm text-white">{ticket.assignedDate ? new Date(ticket.assignedDate).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' }) : <span style={{ color: 'rgba(255,255,255,0.3)' }}>—</span>}</p>,
                },
                {
                  label: 'Status',
                  icon: <svg width="13" height="13" viewBox="0 0 24 24" fill="currentColor"><path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm-2 15l-5-5 1.41-1.41L10 14.17l7.59-7.59L19 8l-9 9z"/></svg>,
                  editEl: null,
                  viewEl: (
                    <div className="mt-1.5">
                      <span className="inline-flex text-xs font-semibold px-2.5 py-1 rounded-full"
                        style={{ background: 'rgba(99,102,241,0.15)', color: '#a5b4fc', border: '1px solid rgba(99,102,241,0.25)' }}>
                        {ticket.status}
                      </span>
                    </div>
                  ),
                },
              ].map(({ label, icon, editEl, viewEl }) => (
                <div key={label} className="rounded-xl p-3"
                  style={{ background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.06)' }}>
                  <label className="flex items-center gap-1.5 text-xs font-semibold uppercase tracking-wider mb-1"
                    style={{ color: 'rgba(255,255,255,0.35)' }}>
                    <span style={{ color: 'rgba(255,255,255,0.25)' }}>{icon}</span>
                    {label}
                  </label>
                  {editing && editEl ? editEl : viewEl}
                </div>
              ))}
            </div>

            {/* Description */}
            <div>
              <label className="flex items-center gap-1.5 text-xs font-semibold uppercase tracking-wider mb-2"
                style={{ color: 'rgba(255,255,255,0.35)' }}>
                <svg width="13" height="13" viewBox="0 0 24 24" fill="currentColor" style={{ color: 'rgba(255,255,255,0.25)' }}>
                  <path d="M14 17H4v2h10v-2zm6-8H4v2h16V9zM4 15h16v-2H4v2zM4 5v2h16V5H4z"/>
                </svg>
                Description
              </label>
              {editing ? (
                <textarea
                  value={form.description}
                  onChange={(e) => setForm({ ...form, description: e.target.value })}
                  rows={4}
                  className="w-full px-4 py-3 text-sm resize-none"
                  style={{ ...inputStyle, borderRadius: '12px' }}
                  {...inputFocusHandlers}
                  placeholder="Add a description..."
                />
              ) : (
                <div className="rounded-xl px-4 py-3 text-sm leading-relaxed"
                  style={{ background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.06)', color: ticket.description ? 'rgba(255,255,255,0.75)' : 'rgba(255,255,255,0.25)' }}>
                  {ticket.description || 'No description provided.'}
                </div>
              )}
            </div>

            {/* Dependencies */}
            <div>
              <div className="flex items-center justify-between mb-3">
                <label className="flex items-center gap-1.5 text-xs font-semibold uppercase tracking-wider"
                  style={{ color: 'rgba(255,255,255,0.35)' }}>
                  <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="rgba(255,255,255,0.25)" strokeWidth="2" style={{ color: 'rgba(255,255,255,0.25)' }}>
                    <path d="M10 13a5 5 0 0 0 7.54.54l3-3a5 5 0 0 0-7.07-7.07l-1.72 1.71"/>
                    <path d="M14 11a5 5 0 0 0-7.54-.54l-3 3a5 5 0 0 0 7.07 7.07l1.71-1.71"/>
                  </svg>
                  Dependencies
                </label>
                <button
                  onClick={() => setShowDepSearch(!showDepSearch)}
                  className="text-xs font-semibold px-2.5 py-1 rounded-lg transition-all duration-200"
                  style={{ color: '#a5b4fc', background: 'rgba(99,102,241,0.12)', border: '1px solid rgba(99,102,241,0.2)' }}
                  onMouseEnter={(e) => { e.currentTarget.style.background = 'rgba(99,102,241,0.22)'; }}
                  onMouseLeave={(e) => { e.currentTarget.style.background = 'rgba(99,102,241,0.12)'; }}
                >
                  + Add
                </button>
              </div>

              {showDepSearch && (
                <div className="mb-3 relative">
                  <input
                    autoFocus
                    type="text"
                    value={depSearch}
                    onChange={(e) => searchDeps(e.target.value)}
                    placeholder="Search tickets..."
                    className="w-full px-4 py-2.5 text-sm text-white placeholder-slate-500"
                    style={inputStyle}
                    {...inputFocusHandlers}
                  />
                  {depResults.length > 0 && (
                    <div className="absolute top-full left-0 right-0 rounded-xl shadow-2xl z-10 mt-1 max-h-48 overflow-y-auto"
                      style={{ background: '#1e2a3d', border: '1px solid rgba(255,255,255,0.12)' }}>
                      {depResults.map((t) => (
                        <button
                          key={t.id}
                          onClick={() => addDep(t.id)}
                          className="w-full text-left px-4 py-2.5 text-sm flex items-center justify-between transition-all duration-150 first:rounded-t-xl last:rounded-b-xl"
                          style={{ color: 'rgba(255,255,255,0.8)' }}
                          onMouseEnter={(e) => { e.currentTarget.style.background = 'rgba(99,102,241,0.15)'; }}
                          onMouseLeave={(e) => { e.currentTarget.style.background = 'transparent'; }}
                        >
                          <span className="font-medium">{t.title}</span>
                          <span className="text-xs px-2 py-0.5 rounded-full" style={{ background: 'rgba(255,255,255,0.08)', color: 'rgba(255,255,255,0.4)' }}>{t.status}</span>
                        </button>
                      ))}
                    </div>
                  )}
                </div>
              )}

              <div className="space-y-2">
                {(ticket.dependsOn || []).map((dep) => (
                  <div key={dep.id}
                    className="flex items-center justify-between rounded-xl px-3.5 py-2.5"
                    style={{ background: 'rgba(245,158,11,0.08)', border: '1px solid rgba(245,158,11,0.2)' }}>
                    <div className="flex items-center gap-2 flex-1 min-w-0">
                      <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="#fbbf24" strokeWidth="2">
                        <path d="M10 13a5 5 0 0 0 7.54.54l3-3a5 5 0 0 0-7.07-7.07l-1.72 1.71"/>
                        <path d="M14 11a5 5 0 0 0-7.54-.54l-3 3a5 5 0 0 0 7.07 7.07l1.71-1.71"/>
                      </svg>
                      <span className="text-sm font-medium text-white truncate">{dep.dependsOn.title}</span>
                      <span className={`text-xs px-2 py-0.5 rounded-full flex-shrink-0 font-semibold ${dep.dependsOn.status === 'Done' ? '' : ''}`}
                        style={dep.dependsOn.status === 'Done'
                          ? { background: 'rgba(16,185,129,0.15)', color: '#34d399', border: '1px solid rgba(16,185,129,0.25)' }
                          : { background: 'rgba(255,255,255,0.08)', color: 'rgba(255,255,255,0.5)', border: '1px solid rgba(255,255,255,0.12)' }
                        }>
                        {dep.dependsOn.status}
                      </span>
                    </div>
                    <button
                      onClick={() => removeDep(dep.dependsOnId)}
                      className="text-xs font-medium ml-3 flex-shrink-0 transition-all duration-200 px-2 py-1 rounded-lg"
                      style={{ color: 'rgba(255,255,255,0.3)', background: 'transparent' }}
                      onMouseEnter={(e) => { e.currentTarget.style.color = '#fca5a5'; e.currentTarget.style.background = 'rgba(239,68,68,0.12)'; }}
                      onMouseLeave={(e) => { e.currentTarget.style.color = 'rgba(255,255,255,0.3)'; e.currentTarget.style.background = 'transparent'; }}
                    >
                      Remove
                    </button>
                  </div>
                ))}
                {(ticket.dependsOn || []).length === 0 && (
                  <p className="text-sm py-2" style={{ color: 'rgba(255,255,255,0.25)' }}>No dependencies</p>
                )}
              </div>
            </div>
          </div>

          {/* Right: comments */}
          <div className="w-80 flex-shrink-0 flex flex-col px-5 py-5">
            <label className="flex items-center gap-1.5 text-xs font-semibold uppercase tracking-wider mb-4"
              style={{ color: 'rgba(255,255,255,0.35)' }}>
              <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="rgba(255,255,255,0.25)" strokeWidth="2">
                <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"/>
              </svg>
              Comments
              <span className="ml-1 px-1.5 py-0.5 rounded-full text-xs font-bold"
                style={{ background: 'rgba(99,102,241,0.15)', color: '#a5b4fc' }}>
                {(ticket.comments || []).length}
              </span>
            </label>

            {/* Comments list */}
            <div className="flex-1 overflow-y-auto space-y-4 min-h-0 pr-1">
              {(ticket.comments || []).length === 0 && (
                <div className="text-center py-8">
                  <div className="w-10 h-10 rounded-xl mx-auto mb-3 flex items-center justify-center"
                    style={{ background: 'rgba(99,102,241,0.1)', border: '1px solid rgba(99,102,241,0.2)' }}>
                    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#a5b4fc" strokeWidth="1.5">
                      <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"/>
                    </svg>
                  </div>
                  <p className="text-xs font-medium" style={{ color: 'rgba(255,255,255,0.25)' }}>No comments yet</p>
                </div>
              )}
              {(ticket.comments || []).map((c) => (
                <div key={c.id} className="flex gap-3">
                  <div
                    className="w-7 h-7 rounded-full flex items-center justify-center text-xs font-bold text-white flex-shrink-0 mt-0.5"
                    style={{ background: getAvatarColor(c.author.name) }}
                  >
                    {c.author.name.charAt(0).toUpperCase()}
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-baseline gap-2 mb-1.5">
                      <span className="text-xs font-bold text-white">{c.author.name}</span>
                      <span className="text-xs" style={{ color: 'rgba(255,255,255,0.3)' }}>
                        {new Date(c.createdAt).toLocaleString('en-US', { month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit' })}
                      </span>
                    </div>
                    <div className="rounded-xl px-3.5 py-2.5 text-sm leading-relaxed"
                      style={{ background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.08)', color: 'rgba(255,255,255,0.75)' }}>
                      {c.content}
                    </div>
                  </div>
                </div>
              ))}
            </div>

            {/* Comment input */}
            <form onSubmit={addComment} className="mt-4 flex-shrink-0">
              <div className="flex gap-2 items-end">
                <div className="w-7 h-7 rounded-full flex items-center justify-center text-xs font-bold text-white flex-shrink-0"
                  style={{ background: getAvatarColor(currentUser?.name || 'U') }}>
                  {currentUser?.name?.charAt(0).toUpperCase() || 'U'}
                </div>
                <div className="flex-1 flex flex-col gap-2">
                  <input
                    type="text"
                    value={comment}
                    onChange={(e) => setComment(e.target.value)}
                    placeholder="Add a comment..."
                    className="w-full px-3.5 py-2.5 text-sm text-white placeholder-slate-500"
                    style={{ ...inputStyle, borderRadius: '12px' }}
                    {...inputFocusHandlers}
                  />
                  <button
                    type="submit"
                    disabled={submittingComment || !comment.trim()}
                    className="self-end px-4 py-2 rounded-xl text-xs font-bold text-white transition-all duration-200 disabled:opacity-40"
                    style={{ background: 'linear-gradient(135deg, #6366f1, #8b5cf6)' }}
                  >
                    {submittingComment ? 'Posting...' : 'Post'}
                  </button>
                </div>
              </div>
            </form>
          </div>
        </div>
      </div>
    </div>
  );
}
