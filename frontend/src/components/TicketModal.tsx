'use client';
import { useState, useEffect, useRef } from 'react';
import api from '@/lib/api';
import { Ticket, Board, User, Comment, Sprint } from '@/types';
import { avatarUrl } from '@/lib/avatar';

const TICKET_TYPES = [
  { value: 'mobile', label: 'Mobile', color: 'bg-blue-50 text-blue-600 border-blue-200' },
  { value: 'design', label: 'Design', color: 'bg-pink-50 text-pink-600 border-pink-200' },
  { value: 'product', label: 'Product', color: 'bg-purple-50 text-purple-600 border-purple-200' },
  { value: 'backend', label: 'Backend', color: 'bg-gray-100 text-gray-600 border-gray-200' },
  { value: 'frontend', label: 'Frontend', color: 'bg-green-50 text-green-600 border-green-200' },
];

interface Props {
  ticket: Ticket;
  boardId: string;
  board: Board;
  currentUser: User;
  sprints?: Sprint[];
  isAdmin?: boolean;
  boardType?: string;
  onClose: () => void;
  onUpdate: (ticket: Ticket) => void;
  onDelete: (id: string) => void;
}

export default function TicketModal({ ticket, boardId, board, currentUser, sprints = [], isAdmin = false, boardType = 'sprint', onClose, onUpdate, onDelete }: Props) {
  const [editing, setEditing] = useState(false);
  const [form, setForm] = useState({
    title: ticket.title,
    description: ticket.description || '',
    assigneeId: ticket.assigneeId || '',
    productManagerId: ticket.productManagerId || '',
    assignedDate: ticket.assignedDate ? ticket.assignedDate.split('T')[0] : '',
    type: ticket.type || '',
    project: ticket.project || '',
    sprintId: ticket.sprintId || '',
    columnId: ticket.columnId,
  });
  const [projectOptions, setProjectOptions] = useState<string[]>([]);
  const [showProjectDropdown, setShowProjectDropdown] = useState(false);
  const [saving, setSaving] = useState(false);
  const [comment, setComment] = useState('');
  const [submittingComment, setSubmittingComment] = useState(false);
  const [mentionQuery, setMentionQuery] = useState<string | null>(null);
  const [mentionStart, setMentionStart] = useState(-1);
  const commentInputRef = useRef<HTMLInputElement>(null);
  const [depSearch, setDepSearch] = useState('');
  const [depResults, setDepResults] = useState<any[]>([]);
  const [showDepSearch, setShowDepSearch] = useState(false);

  useEffect(() => {
    api.get(`/tickets/${ticket.id}`).then(({ data }) => {
      onUpdate(data);
    }).catch(() => {});
  }, []);

  useEffect(() => {
    const stored = localStorage.getItem(`board-projects-${boardId}`);
    const fromStorage: string[] = stored ? JSON.parse(stored) : [];
    const fromBoard = board.columns
      .flatMap((c) => c.tickets)
      .map((t) => t.project)
      .filter((p): p is string => !!p);
    setProjectOptions([...new Set([...fromBoard, ...fromStorage])]);
  }, [boardId]);

  const members = board.members.map((m) => m.user);
  const activeMemberIds = new Set(members.map((u) => u.id));

  // Include removed-but-still-assigned users in dropdowns
  const assigneeOptions = ticket.assignee && !activeMemberIds.has(ticket.assignee.id)
    ? [...members, ticket.assignee] : members;
  const pmOptions = ticket.productManager && !activeMemberIds.has(ticket.productManager.id)
    ? [...members, ticket.productManager] : members;

  const save = async () => {
    setSaving(true);
    try {
      const { data } = await api.patch(`/tickets/${ticket.id}`, { ...form, boardId });
      onUpdate(data);
      setEditing(false);
      if (form.project) {
        const stored = localStorage.getItem(`board-projects-${boardId}`);
        const existing: string[] = stored ? JSON.parse(stored) : [];
        if (!existing.includes(form.project)) {
          const updated = [...existing, form.project];
          localStorage.setItem(`board-projects-${boardId}`, JSON.stringify(updated));
          setProjectOptions((prev) => [...new Set([...prev, form.project])]);
        }
      }
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

  const handleCommentChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const val = e.target.value;
    setComment(val);
    const cursor = e.target.selectionStart ?? val.length;
    const before = val.slice(0, cursor);
    const lastAt = before.lastIndexOf('@');
    if (lastAt === -1) { setMentionQuery(null); return; }
    const charBefore = lastAt > 0 ? before[lastAt - 1] : ' ';
    if (charBefore !== ' ') { setMentionQuery(null); return; }
    const query = before.slice(lastAt + 1);
    setMentionQuery(query);
    setMentionStart(lastAt);
  };

  const selectMention = (member: User) => {
    const after = comment.slice(mentionStart + 1 + (mentionQuery?.length ?? 0));
    setComment(`${comment.slice(0, mentionStart)}@${member.name} ${after}`);
    setMentionQuery(null);
    setTimeout(() => commentInputRef.current?.focus(), 0);
  };

  const filteredMentions = mentionQuery !== null
    ? members.filter((m) => m.name.toLowerCase().startsWith(mentionQuery.toLowerCase()))
    : [];

  const renderCommentContent = (content: string) => {
    if (members.length === 0) return <>{content}</>;
    const escaped = members.map((m) => m.name.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'));
    const pattern = new RegExp(`@(${escaped.join('|')})`, 'g');
    const parts = content.split(pattern);
    return (
      <>
        {parts.map((part, i) =>
          i % 2 === 1
            ? <span key={i} className="font-semibold" style={{ color: '#e8390e' }}>@{part}</span>
            : <span key={i}>{part}</span>
        )}
      </>
    );
  };

  const inputStyle: React.CSSProperties = {
    background: 'white',
    border: '1px solid #e5e7eb',
    borderRadius: '8px',
    color: '#111827',
    outline: 'none',
    width: '100%',
  };

  const inputFocusHandlers = {
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
        className="w-full sm:max-w-4xl max-h-[92vh] sm:max-h-[90vh] overflow-hidden rounded-t-2xl sm:rounded-xl flex flex-col bg-white shadow-xl border border-gray-200"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-start justify-between px-4 sm:px-6 py-4 flex-shrink-0 border-b border-gray-200 sticky top-0 bg-white z-10">
          <div className="flex-1 mr-4">
            {editing ? (
              <input
                value={form.title}
                onChange={(e) => setForm({ ...form, title: e.target.value })}
                className="w-full text-lg font-bold text-gray-900 outline-none pb-1 bg-white"
                style={{ borderBottom: '2px solid #e8390e' }}
                autoFocus
              />
            ) : (
              <h2 className="text-lg font-bold leading-snug" style={{ color: '#1a1f3c' }}>{ticket.title}</h2>
            )}
            <p className="text-xs mt-1 text-gray-400">
              Created by {ticket.createdBy?.name} &middot; {new Date(ticket.createdAt).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}
            </p>
          </div>
          <div className="flex items-center gap-1.5 sm:gap-2 flex-shrink-0">
            {editing ? (
              <>
                <button
                  onClick={save}
                  disabled={saving}
                  className="px-3 sm:px-4 py-1.5 min-h-[36px] rounded-lg text-sm font-semibold text-white transition-all duration-150 disabled:opacity-50"
                  style={{ background: '#e8390e' }}
                  onMouseEnter={(e) => { if (!saving) e.currentTarget.style.background = '#c73009'; }}
                  onMouseLeave={(e) => { if (!saving) e.currentTarget.style.background = '#e8390e'; }}
                >
                  {saving ? 'Saving...' : 'Save'}
                </button>
                <button
                  onClick={() => setEditing(false)}
                  className="px-3 sm:px-4 py-1.5 min-h-[36px] rounded-lg text-sm font-medium text-gray-600 border border-gray-200 bg-white transition-all duration-150 hover:border-gray-300 hover:text-gray-900"
                >
                  Cancel
                </button>
              </>
            ) : (
              <>
                {/* Mobile: icon buttons */}
                <button
                  onClick={() => setEditing(true)}
                  className="sm:hidden w-9 h-9 min-h-[44px] min-w-[44px] flex items-center justify-center rounded-lg text-gray-600 border border-gray-200 bg-white transition-all duration-150 hover:border-gray-300"
                  title="Edit"
                >
                  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                    <path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"/>
                    <path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"/>
                  </svg>
                </button>
                <button
                  onClick={deleteTicket}
                  className="sm:hidden w-9 h-9 min-h-[44px] min-w-[44px] flex items-center justify-center rounded-lg transition-all duration-150"
                  style={{ color: '#dc2626', background: '#fef2f2', border: '1px solid #fecaca' }}
                  title="Delete"
                >
                  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                    <polyline points="3 6 5 6 21 6"/>
                    <path d="M19 6l-1 14H6L5 6"/>
                    <path d="M10 11v6M14 11v6"/>
                    <path d="M9 6V4h6v2"/>
                  </svg>
                </button>
                {/* Desktop: text buttons */}
                <button
                  onClick={() => setEditing(true)}
                  className="hidden sm:block px-3.5 py-1.5 rounded-lg text-sm font-medium text-gray-600 border border-gray-200 bg-white transition-all duration-150 hover:border-gray-300 hover:text-gray-900"
                >
                  Edit
                </button>
                <button
                  onClick={deleteTicket}
                  className="hidden sm:block px-3.5 py-1.5 rounded-lg text-sm font-medium transition-all duration-150"
                  style={{ color: '#dc2626', background: '#fef2f2', border: '1px solid #fecaca' }}
                  onMouseEnter={(e) => { e.currentTarget.style.background = '#fee2e2'; }}
                  onMouseLeave={(e) => { e.currentTarget.style.background = '#fef2f2'; }}
                >
                  Delete
                </button>
              </>
            )}
            <button
              onClick={onClose}
              className="w-8 h-8 min-h-[44px] min-w-[44px] flex items-center justify-center rounded-lg text-lg text-gray-400 bg-gray-100 transition-all duration-150 hover:bg-gray-200 hover:text-gray-700 ml-1"
            >
              ×
            </button>
          </div>
        </div>

        {/* Body — stacked on mobile, two columns on desktop */}
        <div className="flex flex-col lg:flex-row flex-1 overflow-y-auto lg:overflow-hidden">
          {/* Left: details */}
          <div className="flex-1 overflow-y-auto px-4 sm:px-6 py-5 space-y-5 lg:border-r border-gray-100">

            {/* Metadata grid */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              {[
                {
                  label: 'Assignee',
                  icon: <svg width="12" height="12" viewBox="0 0 24 24" fill="currentColor"><path d="M12 12c2.7 0 4.8-2.1 4.8-4.8S14.7 2.4 12 2.4 7.2 4.5 7.2 7.2 9.3 12 12 12zm0 2.4c-3.2 0-9.6 1.6-9.6 4.8v2.4h19.2v-2.4c0-3.2-6.4-4.8-9.6-4.8z"/></svg>,
                  editEl: (
                    <select
                      value={form.assigneeId}
                      onChange={(e) => setForm({ ...form, assigneeId: e.target.value })}
                      className="mt-1.5 w-full px-2.5 py-2 text-sm"
                      style={inputStyle}
                      {...inputFocusHandlers}
                    >
                      <option value="">Unassigned</option>
                      {assigneeOptions.map((u) => (
                        <option key={u.id} value={u.id}>
                          {u.name}{!activeMemberIds.has(u.id) ? ' (inactive)' : ''}
                        </option>
                      ))}
                    </select>
                  ),
                  viewEl: ticket.assignee ? (() => {
                    const inactive = !activeMemberIds.has(ticket.assignee!.id);
                    return (
                      <div className={`mt-1.5 flex items-center gap-2 ${inactive ? 'opacity-50' : ''}`}>
                        <img src={avatarUrl(ticket.assignee.name)} className={`w-7 h-7 rounded-full ${inactive ? 'grayscale' : ''}`} alt={ticket.assignee.name} />
                        <span className="text-sm font-medium text-gray-800">{ticket.assignee.name}{inactive ? <span className="text-xs text-gray-400 ml-1">(inactive)</span> : ''}</span>
                      </div>
                    );
                  })() : <p className="mt-1.5 text-sm text-gray-400">Unassigned</p>,
                },
                boardType === 'kanban' ? {
                  label: 'Creator',
                  icon: <svg width="12" height="12" viewBox="0 0 24 24" fill="currentColor"><path d="M16 11c1.66 0 2.99-1.34 2.99-3S17.66 5 16 5c-1.66 0-3 1.34-3 3s1.34 3 3 3zm-8 0c1.66 0 2.99-1.34 2.99-3S9.66 5 8 5C6.34 5 5 6.34 5 8s1.34 3 3 3zm0 2c-2.33 0-7 1.17-7 3.5V19h14v-2.5c0-2.33-4.67-3.5-7-3.5zm8 0c-.29 0-.62.02-.97.05 1.16.84 1.97 1.97 1.97 3.45V19h6v-2.5c0-2.33-4.67-3.5-7-3.5z"/></svg>,
                  editEl: null,
                  viewEl: (
                    <div className="mt-1.5 flex items-center gap-2">
                      <img src={avatarUrl(ticket.createdBy.name)} className="w-7 h-7 rounded-full" alt={ticket.createdBy.name} />
                      <span className="text-sm font-medium text-gray-800">{ticket.createdBy.name}</span>
                    </div>
                  ),
                } : {
                  label: 'Product Manager',
                  icon: <svg width="12" height="12" viewBox="0 0 24 24" fill="currentColor"><path d="M16 11c1.66 0 2.99-1.34 2.99-3S17.66 5 16 5c-1.66 0-3 1.34-3 3s1.34 3 3 3zm-8 0c1.66 0 2.99-1.34 2.99-3S9.66 5 8 5C6.34 5 5 6.34 5 8s1.34 3 3 3zm0 2c-2.33 0-7 1.17-7 3.5V19h14v-2.5c0-2.33-4.67-3.5-7-3.5zm8 0c-.29 0-.62.02-.97.05 1.16.84 1.97 1.97 1.97 3.45V19h6v-2.5c0-2.33-4.67-3.5-7-3.5z"/></svg>,
                  editEl: (
                    <select
                      value={form.productManagerId}
                      onChange={(e) => setForm({ ...form, productManagerId: e.target.value })}
                      className="mt-1.5 w-full px-2.5 py-2 text-sm"
                      style={inputStyle}
                      {...inputFocusHandlers}
                    >
                      <option value="">None</option>
                      {pmOptions.map((u) => (
                        <option key={u.id} value={u.id}>
                          {u.name}{!activeMemberIds.has(u.id) ? ' (inactive)' : ''}
                        </option>
                      ))}
                    </select>
                  ),
                  viewEl: ticket.productManager ? (() => {
                    const inactive = !activeMemberIds.has(ticket.productManager!.id);
                    return (
                      <div className={`mt-1.5 flex items-center gap-2 ${inactive ? 'opacity-50' : ''}`}>
                        <img src={avatarUrl(ticket.productManager.name)} className={`w-7 h-7 rounded-full ${inactive ? 'grayscale' : ''}`} alt={ticket.productManager.name} />
                        <span className="text-sm font-medium text-gray-800">{ticket.productManager.name}{inactive ? <span className="text-xs text-gray-400 ml-1">(inactive)</span> : ''}</span>
                      </div>
                    );
                  })() : <p className="mt-1.5 text-sm text-gray-400">None</p>,
                },
                {
                  label: 'Assigned Date',
                  icon: <svg width="12" height="12" viewBox="0 0 24 24" fill="currentColor"><path d="M19 3h-1V1h-2v2H8V1H6v2H5c-1.11 0-1.99.9-1.99 2L3 19c0 1.1.89 2 2 2h14c1.1 0 2-.9 2-2V5c0-1.1-.9-2-2-2zm0 16H5V8h14v11zM7 10h5v5H7z"/></svg>,
                  editEl: (
                    <input
                      type="date"
                      value={form.assignedDate}
                      onChange={(e) => setForm({ ...form, assignedDate: e.target.value })}
                      className="mt-1.5 w-full px-2.5 py-2 text-sm"
                      style={inputStyle}
                      {...inputFocusHandlers}
                    />
                  ),
                  viewEl: <p className="mt-1.5 text-sm text-gray-700">{ticket.assignedDate ? new Date(ticket.assignedDate).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' }) : <span className="text-gray-400">—</span>}</p>,
                },
                {
                  label: 'Status',
                  icon: <svg width="12" height="12" viewBox="0 0 24 24" fill="currentColor"><path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm-2 15l-5-5 1.41-1.41L10 14.17l7.59-7.59L19 8l-9 9z"/></svg>,
                  editEl: (
                    <select
                      value={form.columnId}
                      onChange={(e) => setForm({ ...form, columnId: e.target.value })}
                      className="mt-1.5 w-full px-2.5 py-2 text-sm"
                      style={inputStyle}
                      {...inputFocusHandlers}
                    >
                      {board.columns.map((col) => (
                        <option key={col.id} value={col.id}>{col.name}</option>
                      ))}
                    </select>
                  ),
                  viewEl: (
                    <div className="mt-1.5">
                      <span
                        className="inline-flex text-xs font-semibold px-2.5 py-1 rounded-full"
                        style={{ background: '#fff7f5', color: '#e8390e', border: '1px solid #fbd5c8' }}
                      >
                        {ticket.status}
                      </span>
                    </div>
                  ),
                },
                {
                  label: 'Type',
                  icon: <svg width="12" height="12" viewBox="0 0 24 24" fill="currentColor"><path d="M17.63 5.84C17.27 5.33 16.67 5 16 5L5 5.01C3.9 5.01 3 5.9 3 7v10c0 1.1.9 1.99 2 1.99L16 19c.67 0 1.27-.33 1.63-.84L22 12l-4.37-6.16z"/></svg>,
                  editEl: (
                    <div className="mt-1.5 flex flex-wrap gap-1.5">
                      {TICKET_TYPES.map((t) => (
                        <button
                          key={t.value}
                          type="button"
                          onClick={() => setForm({ ...form, type: form.type === t.value ? '' : t.value })}
                          className={`text-xs font-medium px-2 py-0.5 rounded-full border transition-all duration-150 ${t.color} ${form.type === t.value ? 'ring-2 ring-orange-400 ring-offset-1' : ''}`}
                        >
                          {t.label}
                        </button>
                      ))}
                    </div>
                  ),
                  viewEl: ticket.type ? (
                    <div className="mt-1.5">
                      <span className={`text-xs font-medium px-2 py-0.5 rounded-full ${
                        ticket.type === 'mobile' ? 'bg-blue-50 text-blue-600' :
                        ticket.type === 'design' ? 'bg-pink-50 text-pink-600' :
                        ticket.type === 'product' ? 'bg-purple-50 text-purple-600' :
                        ticket.type === 'backend' ? 'bg-gray-100 text-gray-600' :
                        ticket.type === 'frontend' ? 'bg-green-50 text-green-600' : 'bg-gray-100 text-gray-600'
                      }`}>{ticket.type}</span>
                    </div>
                  ) : <p className="mt-1.5 text-sm text-gray-400">—</p>,
                },
                {
                  label: 'Project',
                  icon: <svg width="12" height="12" viewBox="0 0 24 24" fill="currentColor"><path d="M20 6h-2.18c.07-.44.18-.88.18-1.36C18 2.53 15.47 0 12 0S6 2.53 6 4.64c0 .48.11.92.18 1.36H4c-1.1 0-2 .9-2 2v12c0 1.1.9 2 2 2h16c1.1 0 2-.9 2-2V8c0-1.1-.9-2-2-2zm-8-4c1.59 0 3 1.41 3 2.64 0 .47-.18.88-.45 1.36H9.45C9.18 5.52 9 5.11 9 4.64 9 3.41 10.41 2 12 2zm0 12c-1.1 0-2-.9-2-2s.9-2 2-2 2 .9 2 2-.9 2-2 2z"/></svg>,
                  editEl: (
                    <div className="relative mt-1.5">
                      <input
                        type="text"
                        value={form.project}
                        onChange={(e) => setForm({ ...form, project: e.target.value })}
                        onFocus={() => setShowProjectDropdown(true)}
                        onBlur={() => setTimeout(() => setShowProjectDropdown(false), 150)}
                        className="w-full px-2.5 py-2 text-sm"
                        style={inputStyle}
                        {...inputFocusHandlers}
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
                  ),
                  viewEl: <p className="mt-1.5 text-sm text-gray-700">{ticket.project || <span className="text-gray-400">—</span>}</p>,
                },
                ...(sprints.length > 0 ? [{
                  label: 'Sprint',
                  icon: <svg width="12" height="12" viewBox="0 0 24 24" fill="currentColor"><path d="M19 3H5c-1.1 0-2 .9-2 2v14c0 1.1.9 2 2 2h14c1.1 0 2-.9 2-2V5c0-1.1-.9-2-2-2zm-7 3c1.93 0 3.5 1.57 3.5 3.5S13.93 13 12 13s-3.5-1.57-3.5-3.5S10.07 6 12 6zm7 13H5v-.23c0-.62.28-1.2.76-1.58C7.47 15.82 9.64 15 12 15s4.53.82 6.24 2.19c.48.38.76.97.76 1.58V19z"/></svg>,
                  editEl: isAdmin ? (
                    <select
                      value={form.sprintId}
                      onChange={(e) => setForm({ ...form, sprintId: e.target.value })}
                      className="mt-1.5 w-full px-2.5 py-2 text-sm"
                      style={inputStyle}
                      {...inputFocusHandlers}
                    >
                      <option value="">No sprint</option>
                      {sprints.map((s) => (
                        <option key={s.id} value={s.id}>{s.title}</option>
                      ))}
                    </select>
                  ) : null,
                  viewEl: (() => {
                    const s = sprints.find((s) => s.id === ticket.sprintId);
                    return s
                      ? <span className="mt-1.5 inline-block text-xs font-medium px-2 py-0.5 rounded-full bg-indigo-50 text-indigo-600">{s.title}</span>
                      : <p className="mt-1.5 text-sm text-gray-400">—</p>;
                  })(),
                }] : []),
              ].map(({ label, icon, editEl, viewEl }) => (
                <div key={label} className="rounded-lg p-3 bg-gray-50 border border-gray-100">
                  <label className="flex items-center gap-1.5 text-xs font-semibold text-gray-400 uppercase tracking-wider mb-0.5">
                    <span className="text-gray-300">{icon}</span>
                    {label}
                  </label>
                  {editing && editEl ? editEl : viewEl}
                </div>
              ))}
            </div>

            {/* Description */}
            <div>
              <label className="flex items-center gap-1.5 text-xs font-semibold text-gray-400 uppercase tracking-wider mb-2">
                <svg width="12" height="12" viewBox="0 0 24 24" fill="currentColor" className="text-gray-300">
                  <path d="M14 17H4v2h10v-2zm6-8H4v2h16V9zM4 15h16v-2H4v2zM4 5v2h16V5H4z"/>
                </svg>
                Description
              </label>
              {editing ? (
                <textarea
                  value={form.description}
                  onChange={(e) => setForm({ ...form, description: e.target.value })}
                  rows={10}
                  className="w-full px-3 py-2.5 text-sm resize-y"
                  style={{ ...inputStyle, borderRadius: '8px', minHeight: '160px' }}
                  {...inputFocusHandlers}
                  placeholder="Add a description..."
                />
              ) : (
                <div
                  className="rounded-lg px-3 py-2.5 text-sm leading-relaxed border border-gray-100 bg-gray-50 whitespace-pre-wrap"
                  style={{ color: ticket.description ? '#374151' : '#9ca3af', minHeight: '120px' }}
                >
                  {ticket.description || 'No description provided.'}
                </div>
              )}
            </div>

            {/* Dependencies */}
            <div>
              <div className="flex items-center justify-between mb-2.5">
                <label className="flex items-center gap-1.5 text-xs font-semibold text-gray-400 uppercase tracking-wider">
                  <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="#9ca3af" strokeWidth="2">
                    <path d="M10 13a5 5 0 0 0 7.54.54l3-3a5 5 0 0 0-7.07-7.07l-1.72 1.71"/>
                    <path d="M14 11a5 5 0 0 0-7.54-.54l-3 3a5 5 0 0 0 7.07 7.07l1.71-1.71"/>
                  </svg>
                  Dependencies
                </label>
                <button
                  onClick={() => setShowDepSearch(!showDepSearch)}
                  className="text-xs font-semibold px-2.5 py-1 rounded-lg border transition-all duration-150"
                  style={{ color: '#e8390e', borderColor: '#e8390e', background: 'white' }}
                  onMouseEnter={(e) => { e.currentTarget.style.background = '#e8390e'; e.currentTarget.style.color = 'white'; }}
                  onMouseLeave={(e) => { e.currentTarget.style.background = 'white'; e.currentTarget.style.color = '#e8390e'; }}
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
                    className="w-full px-3 py-2.5 text-sm text-gray-800 placeholder-gray-400"
                    style={inputStyle}
                    {...inputFocusHandlers}
                  />
                  {depResults.length > 0 && (
                    <div className="absolute top-full left-0 right-0 rounded-lg shadow-lg z-10 mt-1 max-h-48 overflow-y-auto bg-white border border-gray-200">
                      {depResults.map((t) => (
                        <button
                          key={t.id}
                          onClick={() => addDep(t.id)}
                          className="w-full text-left px-4 py-2.5 text-sm flex items-center justify-between transition-all duration-100 first:rounded-t-lg last:rounded-b-lg text-gray-800 hover:bg-gray-50"
                        >
                          <span className="font-medium">{t.title}</span>
                          <span className="text-xs px-2 py-0.5 rounded-full bg-gray-100 text-gray-500">{t.status}</span>
                        </button>
                      ))}
                    </div>
                  )}
                </div>
              )}

              <div className="space-y-1.5">
                {(ticket.dependsOn || []).map((dep) => (
                  <div
                    key={dep.id}
                    className="flex items-center justify-between rounded-lg px-3 py-2.5 bg-gray-50 border border-gray-100"
                  >
                    <div className="flex items-center gap-2 flex-1 min-w-0">
                      <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="#9ca3af" strokeWidth="2">
                        <path d="M10 13a5 5 0 0 0 7.54.54l3-3a5 5 0 0 0-7.07-7.07l-1.72 1.71"/>
                        <path d="M14 11a5 5 0 0 0-7.54-.54l-3 3a5 5 0 0 0 7.07 7.07l1.71-1.71"/>
                      </svg>
                      <span className="text-sm font-medium text-gray-700 truncate">{dep.dependsOn.title}</span>
                      <span
                        className="text-xs px-2 py-0.5 rounded-full flex-shrink-0 font-medium"
                        style={dep.dependsOn.status === 'Done'
                          ? { background: '#ecfdf5', color: '#059669', border: '1px solid #a7f3d0' }
                          : { background: '#f3f4f6', color: '#6b7280', border: '1px solid #e5e7eb' }
                        }
                      >
                        {dep.dependsOn.status}
                      </span>
                    </div>
                    <button
                      onClick={() => removeDep(dep.dependsOnId)}
                      className="text-xs font-medium ml-3 flex-shrink-0 px-2 py-1 rounded-md text-gray-400 transition-all duration-150 hover:text-red-500 hover:bg-red-50"
                    >
                      Remove
                    </button>
                  </div>
                ))}
                {(ticket.dependsOn || []).length === 0 && (
                  <p className="text-sm text-gray-400 py-1">No dependencies</p>
                )}
              </div>
            </div>
          </div>

          {/* Right: comments */}
          <div className="lg:w-72 lg:flex-shrink-0 flex flex-col px-4 sm:px-5 py-5 border-t lg:border-t-0 border-gray-100">
            <label className="flex items-center gap-1.5 text-xs font-semibold text-gray-400 uppercase tracking-wider mb-4">
              <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="#9ca3af" strokeWidth="2">
                <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"/>
              </svg>
              Comments
              <span
                className="ml-1 px-1.5 py-0.5 rounded-full text-xs font-bold"
                style={{ background: '#fff7f5', color: '#e8390e' }}
              >
                {(ticket.comments || []).length}
              </span>
            </label>

            {/* Comments list */}
            <div className="flex-1 overflow-y-auto space-y-4 min-h-0 pr-1">
              {(ticket.comments || []).length === 0 && (
                <div className="text-center py-8">
                  <div className="w-9 h-9 rounded-lg mx-auto mb-3 flex items-center justify-center bg-gray-100">
                    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#9ca3af" strokeWidth="1.5">
                      <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"/>
                    </svg>
                  </div>
                  <p className="text-xs text-gray-400">No comments yet</p>
                </div>
              )}
              {(ticket.comments || []).map((c) => {
                const inactive = !activeMemberIds.has(c.authorId);
                return (
                  <div key={c.id} className="flex gap-2.5">
                    <img
                      src={avatarUrl(c.author.name)}
                      className={`w-7 h-7 rounded-full flex-shrink-0 mt-0.5 ${inactive ? 'grayscale opacity-40' : ''}`}
                      alt={c.author.name}
                    />
                    <div className="flex-1 min-w-0">
                      <div className="flex items-baseline gap-2 mb-1">
                        <span className={`text-xs font-semibold ${inactive ? 'text-gray-400' : 'text-gray-800'}`}>
                          {c.author.name}{inactive ? ' (inactive)' : ''}
                        </span>
                        <span className="text-xs text-gray-400">
                          {new Date(c.createdAt).toLocaleString('en-US', { month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit' })}
                        </span>
                      </div>
                      <div className={`rounded-lg px-3 py-2 text-sm leading-relaxed border ${inactive ? 'bg-gray-50 border-gray-100 text-gray-400' : 'bg-gray-50 border-gray-100 text-gray-700'}`}>
                        {renderCommentContent(c.content)}
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>

            {/* Comment input */}
            <form onSubmit={addComment} className="mt-4 flex-shrink-0">
              <div className="flex gap-2 items-end">
                <img
                  src={avatarUrl(currentUser?.name || 'User')}
                  className="w-7 h-7 rounded-full flex-shrink-0"
                  alt={currentUser?.name || 'User'}
                />
                <div className="flex-1 flex flex-col gap-2">
                  <div className="relative">
                    <input
                      ref={commentInputRef}
                      type="text"
                      value={comment}
                      onChange={handleCommentChange}
                      onKeyDown={(e) => { if (e.key === 'Escape') setMentionQuery(null); }}
                      placeholder="Add a comment… type @ to mention"
                      className="w-full px-3 py-2 text-base sm:text-sm text-gray-800 placeholder-gray-400"
                      style={{
                        background: 'white',
                        border: '1px solid #e5e7eb',
                        borderRadius: '8px',
                        outline: 'none',
                      }}
                      onFocus={(e) => {
                        e.currentTarget.style.borderColor = '#e8390e';
                        e.currentTarget.style.boxShadow = '0 0 0 3px rgba(232,57,14,0.1)';
                      }}
                      onBlur={(e) => {
                        e.currentTarget.style.borderColor = '#e5e7eb';
                        e.currentTarget.style.boxShadow = 'none';
                      }}
                    />
                    {mentionQuery !== null && filteredMentions.length > 0 && (
                      <div className="absolute bottom-full left-0 right-0 mb-1 bg-white border border-gray-200 rounded-lg shadow-lg z-20 max-h-36 overflow-y-auto">
                        {filteredMentions.map((m) => (
                          <button
                            key={m.id}
                            type="button"
                            onMouseDown={(e) => { e.preventDefault(); selectMention(m); }}
                            className="w-full flex items-center gap-2 px-3 py-2 text-sm text-gray-700 hover:bg-orange-50 transition-colors text-left"
                          >
                            <img src={avatarUrl(m.name)} className="w-6 h-6 rounded-full flex-shrink-0" alt={m.name} />
                            <span className="font-medium">{m.name}</span>
                          </button>
                        ))}
                      </div>
                    )}
                  </div>
                  <button
                    type="submit"
                    disabled={submittingComment || !comment.trim()}
                    className="self-end px-4 py-1.5 rounded-lg text-xs font-bold text-white transition-all duration-150 disabled:opacity-40"
                    style={{ background: '#e8390e' }}
                    onMouseEnter={(e) => { if (!submittingComment && comment.trim()) e.currentTarget.style.background = '#c73009'; }}
                    onMouseLeave={(e) => { e.currentTarget.style.background = '#e8390e'; }}
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
