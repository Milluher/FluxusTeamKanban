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

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4" onClick={onClose}>
      <div
        className="bg-white rounded-2xl shadow-2xl w-full max-w-2xl max-h-[90vh] overflow-y-auto"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-start justify-between p-6 border-b border-gray-100">
          {editing ? (
            <input
              value={form.title}
              onChange={(e) => setForm({ ...form, title: e.target.value })}
              className="flex-1 text-xl font-bold border-b-2 border-indigo-500 outline-none pb-1 mr-4"
              autoFocus
            />
          ) : (
            <h2 className="text-xl font-bold text-gray-900 flex-1 mr-4">{ticket.title}</h2>
          )}
          <div className="flex items-center gap-2 flex-shrink-0">
            {editing ? (
              <>
                <button onClick={save} disabled={saving} className="bg-indigo-600 text-white px-3 py-1.5 rounded-lg text-sm font-medium hover:bg-indigo-700 disabled:opacity-50">
                  {saving ? 'Saving...' : 'Save'}
                </button>
                <button onClick={() => setEditing(false)} className="text-gray-500 hover:text-gray-700 px-3 py-1.5 rounded-lg text-sm">Cancel</button>
              </>
            ) : (
              <>
                <button onClick={() => setEditing(true)} className="text-sm text-indigo-600 hover:text-indigo-800 px-3 py-1.5 rounded-lg hover:bg-indigo-50">Edit</button>
                <button onClick={deleteTicket} className="text-sm text-red-500 hover:text-red-700 px-3 py-1.5 rounded-lg hover:bg-red-50">Delete</button>
              </>
            )}
            <button onClick={onClose} className="text-gray-400 hover:text-gray-600 text-xl ml-2">×</button>
          </div>
        </div>

        <div className="p-6 space-y-6">
          {/* Metadata Grid */}
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="text-xs font-semibold text-gray-500 uppercase tracking-wide">Assignee</label>
              {editing ? (
                <select
                  value={form.assigneeId}
                  onChange={(e) => setForm({ ...form, assigneeId: e.target.value })}
                  className="mt-1 w-full border border-gray-300 rounded-lg px-2 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
                >
                  <option value="">Unassigned</option>
                  {members.map((u) => <option key={u.id} value={u.id}>{u.name}</option>)}
                </select>
              ) : (
                <p className="mt-1 text-sm text-gray-900">{ticket.assignee?.name || <span className="text-gray-400">Unassigned</span>}</p>
              )}
            </div>
            <div>
              <label className="text-xs font-semibold text-gray-500 uppercase tracking-wide">Product Manager</label>
              {editing ? (
                <select
                  value={form.productManagerId}
                  onChange={(e) => setForm({ ...form, productManagerId: e.target.value })}
                  className="mt-1 w-full border border-gray-300 rounded-lg px-2 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
                >
                  <option value="">None</option>
                  {members.map((u) => <option key={u.id} value={u.id}>{u.name}</option>)}
                </select>
              ) : (
                <p className="mt-1 text-sm text-gray-900">{ticket.productManager?.name || <span className="text-gray-400">None</span>}</p>
              )}
            </div>
            <div>
              <label className="text-xs font-semibold text-gray-500 uppercase tracking-wide">Assigned Date</label>
              {editing ? (
                <input
                  type="date"
                  value={form.assignedDate}
                  onChange={(e) => setForm({ ...form, assignedDate: e.target.value })}
                  className="mt-1 w-full border border-gray-300 rounded-lg px-2 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
                />
              ) : (
                <p className="mt-1 text-sm text-gray-900">{ticket.assignedDate ? new Date(ticket.assignedDate).toLocaleDateString() : <span className="text-gray-400">—</span>}</p>
              )}
            </div>
            <div>
              <label className="text-xs font-semibold text-gray-500 uppercase tracking-wide">Status</label>
              <p className="mt-1 text-sm text-gray-900">{ticket.status}</p>
            </div>
            <div>
              <label className="text-xs font-semibold text-gray-500 uppercase tracking-wide">Created By</label>
              <p className="mt-1 text-sm text-gray-900">{ticket.createdBy?.name}</p>
            </div>
            <div>
              <label className="text-xs font-semibold text-gray-500 uppercase tracking-wide">Created At</label>
              <p className="mt-1 text-sm text-gray-900">{new Date(ticket.createdAt).toLocaleDateString()}</p>
            </div>
          </div>

          {/* Description */}
          <div>
            <label className="text-xs font-semibold text-gray-500 uppercase tracking-wide">Description</label>
            {editing ? (
              <textarea
                value={form.description}
                onChange={(e) => setForm({ ...form, description: e.target.value })}
                rows={4}
                className="mt-1 w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500 resize-none"
                placeholder="Add a description..."
              />
            ) : (
              <p className="mt-1 text-sm text-gray-700 whitespace-pre-wrap">
                {ticket.description || <span className="text-gray-400">No description</span>}
              </p>
            )}
          </div>

          {/* Dependencies */}
          <div>
            <div className="flex items-center justify-between mb-2">
              <label className="text-xs font-semibold text-gray-500 uppercase tracking-wide">Dependencies</label>
              <button
                onClick={() => setShowDepSearch(!showDepSearch)}
                className="text-xs text-indigo-600 hover:text-indigo-800"
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
                  className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
                />
                {depResults.length > 0 && (
                  <div className="absolute top-full left-0 right-0 bg-white border border-gray-200 rounded-lg shadow-lg z-10 mt-1 max-h-48 overflow-y-auto">
                    {depResults.map((t) => (
                      <button
                        key={t.id}
                        onClick={() => addDep(t.id)}
                        className="w-full text-left px-3 py-2 text-sm hover:bg-gray-50 flex items-center justify-between"
                      >
                        <span>{t.title}</span>
                        <span className="text-xs text-gray-400">{t.status}</span>
                      </button>
                    ))}
                  </div>
                )}
              </div>
            )}

            <div className="space-y-2">
              {(ticket.dependsOn || []).map((dep) => (
                <div key={dep.id} className="flex items-center justify-between bg-orange-50 border border-orange-200 rounded-lg px-3 py-2">
                  <div>
                    <span className="text-sm text-gray-800">{dep.dependsOn.title}</span>
                    <span className={`ml-2 text-xs px-2 py-0.5 rounded-full ${dep.dependsOn.status === 'Done' ? 'bg-green-100 text-green-700' : 'bg-gray-100 text-gray-600'}`}>
                      {dep.dependsOn.status}
                    </span>
                  </div>
                  <button onClick={() => removeDep(dep.dependsOnId)} className="text-gray-400 hover:text-red-500 text-xs">Remove</button>
                </div>
              ))}
              {(ticket.dependsOn || []).length === 0 && (
                <p className="text-sm text-gray-400">No dependencies</p>
              )}
            </div>
          </div>

          {/* Comments */}
          <div>
            <label className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-3 block">
              Comments ({(ticket.comments || []).length})
            </label>

            <div className="space-y-3 mb-4 max-h-48 overflow-y-auto">
              {(ticket.comments || []).map((c) => (
                <div key={c.id} className="flex gap-3">
                  <div className="w-7 h-7 rounded-full bg-indigo-500 text-white flex items-center justify-center text-xs font-bold flex-shrink-0">
                    {c.author.name.charAt(0).toUpperCase()}
                  </div>
                  <div className="flex-1 bg-gray-50 rounded-lg px-3 py-2">
                    <div className="flex items-center gap-2 mb-1">
                      <span className="text-xs font-semibold text-gray-900">{c.author.name}</span>
                      <span className="text-xs text-gray-400">{new Date(c.createdAt).toLocaleString()}</span>
                    </div>
                    <p className="text-sm text-gray-700">{c.content}</p>
                  </div>
                </div>
              ))}
              {(ticket.comments || []).length === 0 && (
                <p className="text-sm text-gray-400">No comments yet</p>
              )}
            </div>

            <form onSubmit={addComment} className="flex gap-2">
              <input
                type="text"
                value={comment}
                onChange={(e) => setComment(e.target.value)}
                placeholder="Add a comment..."
                className="flex-1 border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
              />
              <button
                type="submit"
                disabled={submittingComment || !comment.trim()}
                className="bg-indigo-600 text-white px-4 py-2 rounded-lg text-sm font-medium hover:bg-indigo-700 disabled:opacity-50"
              >
                Post
              </button>
            </form>
          </div>
        </div>
      </div>
    </div>
  );
}
