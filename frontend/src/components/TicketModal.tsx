'use client';
import { useState, useEffect, useRef } from 'react';
import api from '@/lib/api';
import { Ticket, Board, User, Comment, Sprint, ProductFile } from '@/types';
import ProductFileViewer from './ProductFileViewer';
import RichTextView from './RichTextView';
import { formatDay, formatTimestamp } from '@/lib/formatDate';
import RowMenu from './RowMenu';
import ConfirmByName from './ConfirmByName';
import dynamic from 'next/dynamic';
import Avatar from './Avatar';
const RichTextEditor = dynamic(() => import('./RichTextEditor'), { ssr: false });

const TICKET_TYPES = [
  { value: 'mobile', label: 'Mobile', color: 'bg-blue-50 text-blue-600 border-blue-200' },
  { value: 'design', label: 'Design', color: 'bg-pink-50 text-pink-700 border-pink-200' },
  { value: 'product', label: 'Product', color: 'bg-purple-50 text-purple-600 border-purple-200' },
  { value: 'backend', label: 'Backend', color: 'bg-gray-100 text-gray-600 border-gray-200' },
  { value: 'frontend', label: 'Frontend', color: 'bg-green-50 text-green-700 border-green-200' },
];

const PRIORITIES = [
  { value: 'low',    label: 'Low',       style: { color: '#6b7280', background: '#f9fafb', border: '1px solid #d1d5db' } },
  { value: 'medium', label: 'Medium',    style: { color: '#b45309', background: '#fffbeb', border: '1px solid #fcd34d' } },
  { value: 'high',   label: 'High',      style: { color: '#c2410c', background: '#fff7ed', border: '1px solid #fed7aa' } },
  { value: 'urgent', label: 'Urgent 🔥', style: { color: '#b91c1c', background: '#fef2f2', border: '1px solid #fecaca' } },
];

// The fields the review names as optional. When empty they are a row of boxes
// reading "—", so they hide behind "+ Add field" until someone wants them.
const OPTIONAL_FIELDS = [
  { name: 'type', label: 'Type' },
  { name: 'priority', label: 'Priority' },
  { name: 'epic', label: 'Epic' },
  { name: 'flow', label: 'Flow' },
  { name: 'assignedDate', label: 'Assigned Date' },
] as const;

/** The editable shape of a ticket. */
function formFromTicket(t: Ticket) {
  return {
    title: t.title,
    description: t.description || '',
    assigneeId: t.assigneeId || '',
    productManagerId: t.productManagerId || '',
    assignedDate: t.assignedDate ? t.assignedDate.split('T')[0] : '',
    type: t.type || '',
    priority: t.priority || '',
    project: t.project || '',
    epic: t.epic || '',
    flow: t.flow || '',
    sprintId: t.sprintId || '',
    productDocId: t.productDocId || '',
    columnId: t.columnId,
  };
}

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

interface MentionOption {
  id: string;
  name: string;
  group?: boolean;
}

export default function TicketModal({ ticket, boardId, board, currentUser, sprints = [], isAdmin = false, boardType = 'sprint', onClose, onUpdate, onDelete }: Props) {
  const [form, setForm] = useState(() => formFromTicket(ticket));
  // Inline editing: one field at a time, saved on blur or Enter, abandoned on
  // Escape. Replaces an Edit mode that made changing one value a three-click job.
  const [editingField, setEditingField] = useState<string | null>(null);
  const [savingField, setSavingField] = useState<string | null>(null);
  const [fieldMsg, setFieldMsg] = useState('');
  // Optional fields the viewer asked to see even though they are empty.
  const [revealed, setRevealed] = useState<string[]>([]);
  const [showAddField, setShowAddField] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [deleteMsg, setDeleteMsg] = useState('');
  const dialogRef = useRef<HTMLDivElement>(null);

  const isFieldEmpty = (name: string) => {
    const value = (ticket as unknown as Record<string, unknown>)[name];
    return value === null || value === undefined || value === '';
  };

  // The ticket prop is replaced by the mount-time refetch and by board updates.
  // Without this the working copy would keep the values it was first given, and
  // editing a field later could save stale data back. An edit in progress is left
  // alone so nothing is typed over.
  useEffect(() => {
    if (editingField) return;
    setForm(formFromTicket(ticket));
  }, [ticket, editingField]);

  // The modal keeps focus inside it, closes on Escape, and hands focus back to
  // the element that opened it — normally the card that was clicked.
  useEffect(() => {
    const opener = document.activeElement as HTMLElement | null;
    const dialog = dialogRef.current;
    dialog?.focus();

    const focusable = () =>
      Array.from(
        dialog?.querySelectorAll<HTMLElement>(
          'a[href], button:not([disabled]), input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])'
        ) ?? []
      ).filter((el) => el.offsetParent !== null);

    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        // A field being edited swallows Escape first; this closes the modal.
        onClose();
        return;
      }
      if (e.key !== 'Tab') return;

      const items = focusable();
      if (items.length === 0) return;
      const first = items[0];
      const last = items[items.length - 1];

      if (e.shiftKey && document.activeElement === first) {
        e.preventDefault();
        last.focus();
      } else if (!e.shiftKey && document.activeElement === last) {
        e.preventDefault();
        first.focus();
      }
    };

    document.addEventListener('keydown', onKeyDown);
    return () => {
      document.removeEventListener('keydown', onKeyDown);
      opener?.focus?.();
    };
  }, [onClose]);

  const hiddenFields = OPTIONAL_FIELDS.filter(
    (f) => isFieldEmpty(f.name) && !revealed.includes(f.name)
  );

  const [productFiles, setProductFiles] = useState<ProductFile[]>([]);
  const [viewingFile, setViewingFile] = useState<ProductFile | null>(null);
  const [projectOptions, setProjectOptions] = useState<string[]>([]);
  const [showProjectDropdown, setShowProjectDropdown] = useState(false);
  const [epicOptions, setEpicOptions] = useState<string[]>([]);
  const [showEpicDropdown, setShowEpicDropdown] = useState(false);
  const [flowOptions, setFlowOptions] = useState<string[]>([]);
  const [showFlowDropdown, setShowFlowDropdown] = useState(false);
  const [comment, setComment] = useState('');
  const [commentImages, setCommentImages] = useState<string[]>([]);
  const [submittingComment, setSubmittingComment] = useState(false);
  const [mentionQuery, setMentionQuery] = useState<string | null>(null);
  const [mentionStart, setMentionStart] = useState(-1);
  const commentInputRef = useRef<HTMLInputElement>(null);
  const commentImageInputRef = useRef<HTMLInputElement>(null);
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
    const fromBoard = board.columns.flatMap((c) => c.tickets).map((t) => t.project).filter((p): p is string => !!p);
    setProjectOptions([...new Set([...fromBoard, ...fromStorage])]);

    const storedEpics = localStorage.getItem(`board-epics-${boardId}`);
    const epicsFromStorage: string[] = storedEpics ? JSON.parse(storedEpics) : [];
    const epicsFromBoard = board.columns.flatMap((c) => c.tickets).map((t) => t.epic).filter((p): p is string => !!p);
    setEpicOptions([...new Set([...epicsFromBoard, ...epicsFromStorage])]);

    const storedFlows = localStorage.getItem(`board-flows-${boardId}`);
    const flowsFromStorage: string[] = storedFlows ? JSON.parse(storedFlows) : [];
    const flowsFromBoard = board.columns.flatMap((c) => c.tickets).map((t) => t.flow).filter((p): p is string => !!p);
    setFlowOptions([...new Set([...flowsFromBoard, ...flowsFromStorage])]);
  }, [boardId]);

  // Product files available for the "Product Doc" reference
  useEffect(() => {
    api.get<ProductFile[]>(`/boards/${boardId}/product-files`)
      .then(({ data }) => setProductFiles(data))
      .catch(() => {});
  }, [boardId]);

  const members = board.members.map((m) => m.user);
  const activeMemberIds = new Set(members.map((u) => u.id));

  // Include removed-but-still-assigned users in dropdowns
  const assigneeOptions = ticket.assignee && !activeMemberIds.has(ticket.assignee.id)
    ? [...members, ticket.assignee] : members;
  const pmOptions = ticket.productManager && !activeMemberIds.has(ticket.productManager.id)
    ? [...members, ticket.productManager] : members;

  const saveField = async (name: string, value: unknown) => {
    setFieldMsg('');
    setSavingField(name);
    try {
      const { data } = await api.patch(`/tickets/${ticket.id}`, { [name]: value, boardId });
      onUpdate(data);
      if (name === 'project') rememberOption('projects', String(value ?? ''));
      if (name === 'epic') rememberOption('epics', String(value ?? ''));
      if (name === 'flow') rememberOption('flows', String(value ?? ''));
      setEditingField(null);
    } catch (e: any) {
      setFieldMsg(e.response?.data?.error || 'Could not save that change');
    } finally {
      setSavingField(null);
    }
  };

  /** Commits the field being edited, or does nothing if its value is unchanged. */
  const commitField = (name: string) => {
    if (!name) return;
    const next = (form as Record<string, unknown>)[name];
    const current = (ticket as unknown as Record<string, unknown>)[name];
    const unchanged =
      next === current ||
      (next === '' && (current === null || current === undefined)) ||
      (name === 'assignedDate' && typeof current === 'string' && current.split('T')[0] === next);

    if (unchanged) {
      setEditingField(null);
      return;
    }
    void saveField(name, next === '' ? null : next);
  };

  /** Abandons the edit, putting the form back to what the ticket says. */
  const cancelField = (name: string) => {
    setForm((prev) => ({
      ...prev,
      [name]: (ticket as unknown as Record<string, string | null>)[name] ?? '',
    }));
    setEditingField(null);
    setFieldMsg('');
  };

  // Project, Epic and Flow are free text. The values people type are kept so they
  // show up as options next time — behaviour the old bulk save owned.
  const rememberOption = (kind: 'projects' | 'epics' | 'flows', value: string) => {
    if (!value) return;
    const key = `board-${kind}-${boardId}`;
    const setOptions = {
      projects: setProjectOptions,
      epics: setEpicOptions,
      flows: setFlowOptions,
    }[kind];

    try {
      const stored = localStorage.getItem(key);
      const existing: string[] = stored ? JSON.parse(stored) : [];
      if (!existing.includes(value)) {
        localStorage.setItem(key, JSON.stringify([...existing, value]));
      }
    } catch {
      // Storage can be blocked; the option still shows for this session.
    }
    setOptions((prev) => [...new Set([...prev, value])]);
  };

  const deleteTicket = async () => {
    setDeleting(true);
    setDeleteMsg('');
    try {
      await api.delete(`/tickets/${ticket.id}?boardId=${boardId}`);
      onDelete(ticket.id);
    } catch (e: any) {
      setDeleteMsg(e.response?.data?.error || 'Failed to delete ticket');
    } finally {
      setDeleting(false);
    }
  };

  const addComment = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!comment.trim() && commentImages.length === 0) return;
    setSubmittingComment(true);
    try {
      const imageTags = commentImages.map((src) => `__IMG__${src}__IMG__`).join('');
      const fullContent = comment.trim() + (imageTags ? '\n' + imageTags : '');
      const { data } = await api.post('/comments', { content: fullContent, ticketId: ticket.id, boardId });
      onUpdate({ ...ticket, comments: [...(ticket.comments || []), data] });
      setComment('');
      setCommentImages([]);
    } finally { setSubmittingComment(false); }
  };

  const searchDeps = async (q: string) => {
    setDepSearch(q);
    const url = q.trim() ? `/tickets?boardId=${boardId}&q=${q}` : `/tickets?boardId=${boardId}`;
    const { data } = await api.get(url);
    const existingDepIds = new Set((ticket.dependsOn || []).map((d) => d.dependsOnId));
    setDepResults(data.filter((t: any) => t.id !== ticket.id && !existingDepIds.has(t.id)));
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

  const selectMention = (option: MentionOption) => {
    const after = comment.slice(mentionStart + 1 + (mentionQuery?.length ?? 0));
    setComment(`${comment.slice(0, mentionStart)}@${option.name} ${after}`);
    setMentionQuery(null);
    setTimeout(() => commentInputRef.current?.focus(), 0);
  };

  // "@all" notifies every member of the board; the backend also accepts
  // "@board" and "@everyone" as synonyms.
  const mentionOptions: MentionOption[] = [
    { id: '__all__', name: 'all', group: true },
    ...members.map((m) => ({ id: m.id, name: m.name })),
  ];

  const filteredMentions = mentionQuery !== null
    ? mentionOptions.filter((m) => m.name.toLowerCase().startsWith(mentionQuery.toLowerCase()))
    : [];

  const renderCommentContent = (content: string) => {
    // Split out embedded images first
    const imgPattern = /__IMG__([\s\S]*?)__IMG__/g;
    const segments: Array<{ type: 'text' | 'image'; value: string }> = [];
    let lastIndex = 0;
    let match: RegExpExecArray | null;
    while ((match = imgPattern.exec(content)) !== null) {
      if (match.index > lastIndex) {
        segments.push({ type: 'text', value: content.slice(lastIndex, match.index) });
      }
      segments.push({ type: 'image', value: match[1] });
      lastIndex = match.index + match[0].length;
    }
    if (lastIndex < content.length) {
      segments.push({ type: 'text', value: content.slice(lastIndex) });
    }

    const renderText = (text: string, keyPrefix: string) => {
      if (members.length === 0) return <span key={keyPrefix}>{text.replace(/^\n/, '')}</span>;
      const escaped = members.map((m) => m.name.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'));
      const pattern = new RegExp(`@(${[...escaped, 'all', 'board', 'everyone'].join('|')})`, 'g');
      const parts = text.replace(/^\n/, '').split(pattern);
      return (
        <span key={keyPrefix}>
          {parts.map((part, i) =>
            i % 2 === 1
              ? <span key={i} className="font-semibold" style={{ color: '#c73009' }}>@{part}</span>
              : <span key={i}>{part}</span>
          )}
        </span>
      );
    };

    return (
      <span className="flex flex-col gap-2">
        {segments.map((seg, i) =>
          seg.type === 'image'
            ? <img key={i} src={seg.value} alt="attachment" className="max-w-full rounded-lg border border-gray-200" style={{ maxHeight: '300px', objectFit: 'contain' }} />
            : renderText(seg.value, String(i))
        )}
      </span>
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
    <>
    <div
      className="fixed inset-0 flex items-end sm:items-center justify-center z-50"
      style={{ background: 'rgba(0,0,0,0.4)' }}
      onClick={onClose}
    >
      <div
        ref={dialogRef}
        role="dialog"
        aria-modal="true"
        aria-label={`Ticket: ${ticket.title}`}
        tabIndex={-1}
        className="w-full sm:max-w-4xl max-h-[92vh] sm:max-h-[90vh] overflow-hidden rounded-t-2xl sm:rounded-xl flex flex-col bg-white shadow-xl border border-gray-200 outline-none"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-start justify-between px-4 sm:px-6 py-4 flex-shrink-0 border-b border-gray-200 sticky top-0 bg-white z-10">
          <div className="flex-1 mr-4">
            {editingField === 'title' ? (
              <input
                value={form.title}
                onChange={(e) => setForm({ ...form, title: e.target.value })}
                onBlur={() => commitField('title')}
                onKeyDown={(e) => {
                  if (e.key === 'Escape') { e.stopPropagation(); cancelField('title'); }
                  if (e.key === 'Enter') { e.preventDefault(); commitField('title'); }
                }}
                className="w-full text-lg font-bold text-gray-900 outline-none pb-1 bg-white"
                style={{ borderBottom: '2px solid #e8390e' }}
                autoFocus
              />
            ) : (
              <button
                type="button"
                onClick={() => { setFieldMsg(''); setEditingField('title'); }}
                aria-label="Edit title"
                className="w-full text-left rounded outline-none focus-visible:ring-2 focus-visible:ring-gray-400"
              >
                <h2 className="text-lg font-bold leading-snug" style={{ color: '#1a1f3c' }}>{ticket.title}</h2>
              </button>
            )}
            <p className="text-xs mt-1 text-gray-500">
              Created by {ticket.createdBy?.name} &middot; {formatDay(ticket.createdAt)}
            </p>
          </div>
          <div className="flex items-center gap-1.5 sm:gap-2 flex-shrink-0">
            {/* Delete used to sit here beside Edit, shaded red, one click from
                losing the ticket. There is no Edit mode any more — values are
                edited in place — and delete is behind the menu. */}
            <RowMenu
              label={`Actions for ${ticket.title}`}
              items={[{ label: 'Delete ticket', destructive: true, onSelect: () => setConfirmDelete(true) }]}
            />
            <button
              onClick={onClose}
              aria-label="Close ticket"
              className="w-8 h-8 min-h-[44px] min-w-[44px] flex items-center justify-center rounded-lg text-lg text-gray-500 bg-gray-100 transition-all duration-150 hover:bg-gray-200 hover:text-gray-700 ml-1"
            >
              ×
            </button>
          </div>
        </div>

        {/* Body — stacked on mobile, two columns on desktop */}
        <div className="flex flex-col lg:flex-row flex-1 overflow-y-auto lg:overflow-hidden">
          {/* Left: details */}
          <div className="flex-1 overflow-y-auto px-4 sm:px-6 py-5 space-y-5 lg:border-r border-gray-100">

            {/* Description first: it is what people actually read. */}
            <div>
              <div className="flex items-center gap-2 mb-2">
                <label className="flex items-center gap-1.5 text-xs font-semibold text-gray-500 uppercase tracking-wider">
                  <svg width="12" height="12" viewBox="0 0 24 24" fill="currentColor" className="text-gray-500">
                    <path d="M14 17H4v2h10v-2zm6-8H4v2h16V9zM4 15h16v-2H4v2zM4 5v2h16V5H4z"/>
                  </svg>
                  Description
                </label>
                {editingField === 'description' ? (
                  <div className="ml-auto flex items-center gap-1.5">
                    <button
                      type="button"
                      onClick={() => commitField('description')}
                      disabled={savingField === 'description'}
                      className="px-2.5 py-1 rounded-lg text-xs font-semibold text-white disabled:opacity-50"
                      style={{ background: '#c73009' }}
                    >
                      {savingField === 'description' ? 'Saving…' : 'Save'}
                    </button>
                    <button
                      type="button"
                      onClick={() => cancelField('description')}
                      className="px-2.5 py-1 rounded-lg text-xs font-medium text-gray-600 border border-gray-200"
                    >
                      Cancel
                    </button>
                  </div>
                ) : (
                  <button
                    type="button"
                    onClick={() => { setFieldMsg(''); setEditingField('description'); }}
                    className="ml-auto text-xs font-semibold text-gray-600 hover:text-gray-900 transition-colors"
                  >
                    Edit
                  </button>
                )}
              </div>

              {editingField === 'description' ? (
                <div onKeyDown={(e) => { if (e.key === 'Escape') { e.stopPropagation(); cancelField('description'); } }}>
                  <RichTextEditor
                    content={form.description}
                    onChange={(html) => setForm({ ...form, description: html })}
                    placeholder="Add a description..."
                    minHeight={160}
                  />
                </div>
              ) : ticket.description ? (
                <RichTextView
                  html={ticket.description}
                  className="rounded-lg px-3 py-2.5 text-sm leading-relaxed border border-gray-100 bg-gray-50"
                  style={{ color: '#374151', minHeight: '120px' }}
                />
              ) : (
                <button
                  type="button"
                  onClick={() => setEditingField('description')}
                  className="w-full text-left rounded-lg px-3 py-2.5 text-sm leading-relaxed border border-gray-100 bg-gray-50 hover:border-gray-300 transition-colors"
                  style={{ color: '#6b7280', minHeight: '120px' }}
                >
                  No description yet — click to add one.
                </button>
              )}
            </div>

            {/* Metadata grid */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              {[
                {
                  label: 'Assignee',
                  name: 'assigneeId',
                  optional: false,
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
                        <Avatar name={ticket.assignee.name} className="w-7 h-7 text-[10px]" inactive={inactive} />
                        <span className="text-sm font-medium text-gray-800">{ticket.assignee.name}{inactive ? <span className="text-xs text-gray-500 ml-1">(inactive)</span> : ''}</span>
                      </div>
                    );
                  })() : <p className="mt-1.5 text-sm text-gray-500">Unassigned</p>,
                },
                boardType === 'kanban' ? {
                  label: 'Creator',
                  name: '',
                  optional: false,
                  icon: <svg width="12" height="12" viewBox="0 0 24 24" fill="currentColor"><path d="M16 11c1.66 0 2.99-1.34 2.99-3S17.66 5 16 5c-1.66 0-3 1.34-3 3s1.34 3 3 3zm-8 0c1.66 0 2.99-1.34 2.99-3S9.66 5 8 5C6.34 5 5 6.34 5 8s1.34 3 3 3zm0 2c-2.33 0-7 1.17-7 3.5V19h14v-2.5c0-2.33-4.67-3.5-7-3.5zm8 0c-.29 0-.62.02-.97.05 1.16.84 1.97 1.97 1.97 3.45V19h6v-2.5c0-2.33-4.67-3.5-7-3.5z"/></svg>,
                  editEl: null,
                  viewEl: (
                    <div className="mt-1.5 flex items-center gap-2">
                      <Avatar name={ticket.createdBy.name} className="w-7 h-7 text-[10px]" />
                      <span className="text-sm font-medium text-gray-800">{ticket.createdBy.name}</span>
                    </div>
                  ),
                } : {
                  label: 'Product Manager',
                  name: 'productManagerId',
                  optional: false,
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
                        <Avatar name={ticket.productManager.name} className="w-7 h-7 text-[10px]" inactive={inactive} />
                        <span className="text-sm font-medium text-gray-800">{ticket.productManager.name}{inactive ? <span className="text-xs text-gray-500 ml-1">(inactive)</span> : ''}</span>
                      </div>
                    );
                  })() : <p className="mt-1.5 text-sm text-gray-500">None</p>,
                },
                {
                  label: 'Assigned Date',
                  name: 'assignedDate',
                  optional: true,
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
                  viewEl: <p className="mt-1.5 text-sm text-gray-700">{formatDay(ticket.assignedDate) ?? <span className="text-gray-500">—</span>}</p>,
                },
                {
                  // Read-only: the board is where the ticket was created, and
                  // moving a ticket between boards is not a thing you can do.
                  // Worth stating all the same — "My tickets" mixes boards, so
                  // you can arrive here without knowing which one you are on.
                  label: 'Board',
                  name: '',
                  optional: false,
                  icon: <svg width="12" height="12" viewBox="0 0 24 24" fill="currentColor"><path d="M3 3h6v12H3V3zm8 0h6v8h-6V3zm8 0h2v18h-2V3zM3 17h6v4H3v-4zm8-4h6v8h-6v-8z"/></svg>,
                  editEl: null,
                  viewEl: (
                    <div className="mt-1.5 flex items-center gap-2 min-w-0">
                      <span className="text-sm font-medium text-gray-800 truncate">{board.name}</span>
                      <span
                        className={`text-xs px-2 py-0.5 rounded-full font-medium whitespace-nowrap flex-shrink-0 ${
                          board.type === 'kanban' ? 'bg-purple-50 text-purple-700' : 'bg-orange-50 text-orange-700'
                        }`}
                      >
                        {board.type === 'kanban' ? 'Kanban' : 'Sprint'}
                      </span>
                    </div>
                  ),
                },
                {
                  label: 'Status',
                  name: 'columnId',
                  optional: false,
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
                        style={{ background: '#fff7f5', color: '#c73009', border: '1px solid #fbd5c8' }}
                      >
                        {ticket.status}
                      </span>
                    </div>
                  ),
                },
                {
                  label: 'Type',
                  name: 'type',
                  optional: true,
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
                        ticket.type === 'design' ? 'bg-pink-50 text-pink-700' :
                        ticket.type === 'product' ? 'bg-purple-50 text-purple-600' :
                        ticket.type === 'backend' ? 'bg-gray-100 text-gray-600' :
                        ticket.type === 'frontend' ? 'bg-green-50 text-green-700' : 'bg-gray-100 text-gray-600'
                      }`}>{ticket.type}</span>
                    </div>
                  ) : <p className="mt-1.5 text-sm text-gray-500">—</p>,
                },
                {
                  label: 'Priority',
                  name: 'priority',
                  optional: true,
                  icon: <svg width="12" height="12" viewBox="0 0 24 24" fill="currentColor"><path d="M12 2L4 7v10l8 5 8-5V7l-8-5zm0 2.18L18 8v8l-6 3.75L6 16V8l6-3.82z"/></svg>,
                  editEl: (
                    <div className="mt-1.5 flex flex-wrap gap-1.5">
                      {PRIORITIES.map((p) => (
                        <button
                          key={p.value}
                          type="button"
                          onClick={() => setForm({ ...form, priority: form.priority === p.value ? '' : p.value })}
                          className={`text-xs font-semibold px-2 py-0.5 rounded-full transition-all duration-150 ${form.priority === p.value ? 'ring-2 ring-offset-1 ring-gray-400' : ''}`}
                          style={p.style}
                        >
                          {p.label}
                        </button>
                      ))}
                    </div>
                  ),
                  viewEl: (() => {
                    const pcfg = ticket.priority ? PRIORITIES.find((p) => p.value === ticket.priority) : null;
                    return pcfg ? (
                      <div className="mt-1.5">
                        <span className="text-xs font-semibold px-2 py-0.5 rounded-full" style={pcfg.style}>{pcfg.label}</span>
                      </div>
                    ) : <p className="mt-1.5 text-sm text-gray-500">—</p>;
                  })(),
                },
                {
                  label: 'Project',
                  name: 'project',
                  optional: false,
                  icon: <svg width="12" height="12" viewBox="0 0 24 24" fill="currentColor"><path d="M20 6h-2.18c.07-.44.18-.88.18-1.36C18 2.53 15.47 0 12 0S6 2.53 6 4.64c0 .48.11.92.18 1.36H4c-1.1 0-2 .9-2 2v12c0 1.1.9 2 2 2h16c1.1 0 2-.9 2-2V8c0-1.1-.9-2-2-2zm-8-4c1.59 0 3 1.41 3 2.64 0 .47-.18.88-.45 1.36H9.45C9.18 5.52 9 5.11 9 4.64 9 3.41 10.41 2 12 2zm0 12c-1.1 0-2-.9-2-2s.9-2 2-2 2 .9 2 2-.9 2-2 2z"/></svg>,
                  editEl: (
                    <div className="relative mt-1.5">
                      <input
                        type="text"
                        value={form.project}
                        onChange={(e) => setForm({ ...form, project: e.target.value })}
                        onFocus={(e) => { setShowProjectDropdown(true); inputFocusHandlers.onFocus(e); }}
                        onBlur={(e) => { setTimeout(() => setShowProjectDropdown(false), 150); inputFocusHandlers.onBlur(e); }}
                        className="w-full px-2.5 py-2 text-sm"
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
                  ),
                  viewEl: <p className="mt-1.5 text-sm text-gray-700">{ticket.project || <span className="text-gray-500">—</span>}</p>,
                },
                ...(boardType !== 'kanban' ? [{
                  label: 'Epic',
                  name: 'epic',
                  optional: true,
                  icon: <svg width="12" height="12" viewBox="0 0 24 24" fill="currentColor"><path d="M11.99 2C6.47 2 2 6.48 2 12s4.47 10 9.99 10C17.52 22 22 17.52 22 12S17.52 2 11.99 2zm4.24 16L12 15.45 7.77 18l1.12-4.81-3.73-3.23 4.92-.42L12 5l1.92 4.53 4.92.42-3.73 3.23L16.23 18z"/></svg>,
                  editEl: (
                    <div className="relative mt-1.5">
                      <input
                        type="text"
                        value={form.epic}
                        onChange={(e) => setForm({ ...form, epic: e.target.value })}
                        onFocus={(e) => { setShowEpicDropdown(true); inputFocusHandlers.onFocus(e); }}
                        onBlur={(e) => { setTimeout(() => setShowEpicDropdown(false), 150); inputFocusHandlers.onBlur(e); }}
                        className="w-full px-2.5 py-2 text-sm"
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
                  ),
                  viewEl: ticket.epic
                    ? <span className="mt-1.5 inline-block text-xs font-semibold px-2 py-0.5 rounded-full bg-amber-50 text-amber-700 border border-amber-200">{ticket.epic}</span>
                    : <p className="mt-1.5 text-sm text-gray-500">—</p>,
                }] : []),
                {
                  label: 'Flow',
                  name: 'flow',
                  optional: true,
                  icon: <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M5 12h14M12 5l7 7-7 7"/></svg>,
                  editEl: (
                    <div className="relative mt-1.5">
                      <input
                        type="text"
                        value={form.flow}
                        onChange={(e) => setForm({ ...form, flow: e.target.value })}
                        onFocus={(e) => { setShowFlowDropdown(true); inputFocusHandlers.onFocus(e); }}
                        onBlur={(e) => { setTimeout(() => setShowFlowDropdown(false), 150); inputFocusHandlers.onBlur(e); }}
                        className="w-full px-2.5 py-2 text-sm"
                        style={inputStyle}
                        placeholder="Type or select a flow..."
                        autoComplete="off"
                      />
                      {showFlowDropdown && flowOptions.filter((p) =>
                        !form.flow || p.toLowerCase().includes(form.flow.toLowerCase())
                      ).length > 0 && (
                        <div className="absolute top-full left-0 right-0 mt-1 bg-white border border-gray-200 rounded-lg shadow-lg z-30 max-h-40 overflow-y-auto">
                          {flowOptions
                            .filter((p) => !form.flow || p.toLowerCase().includes(form.flow.toLowerCase()))
                            .map((p) => (
                              <button
                                key={p}
                                type="button"
                                onMouseDown={(e) => { e.preventDefault(); setForm({ ...form, flow: p }); setShowFlowDropdown(false); }}
                                className="w-full text-left px-3 py-2 text-sm text-gray-700 hover:bg-orange-50 first:rounded-t-lg last:rounded-b-lg"
                              >
                                {p}
                              </button>
                            ))}
                        </div>
                      )}
                    </div>
                  ),
                  viewEl: ticket.flow
                    ? <span className="mt-1.5 inline-block text-xs font-semibold px-2 py-0.5 rounded-full bg-teal-50 text-teal-700 border border-teal-200">{ticket.flow}</span>
                    : <p className="mt-1.5 text-sm text-gray-500">—</p>,
                },
                ...((productFiles.length > 0 || ticket.productDoc) ? [{
                  label: 'Product Doc',
                  name: 'productDocId',
                  optional: false,
                  icon: <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><polyline points="14 2 14 8 20 8"/></svg>,
                  editEl: isAdmin ? (
                    <select
                      value={form.productDocId}
                      onChange={(e) => setForm({ ...form, productDocId: e.target.value })}
                      className="mt-1.5 w-full px-2.5 py-2 text-sm"
                      style={inputStyle}
                      {...inputFocusHandlers}
                    >
                      <option value="">None</option>
                      {productFiles.map((f) => (
                        <option key={f.id} value={f.id}>{f.title}</option>
                      ))}
                    </select>
                  ) : null,
                  viewEl: (() => {
                    const f = productFiles.find((pf) => pf.id === ticket.productDocId) || (ticket.productDoc ? { ...ticket.productDoc, boardId, order: 0 } as ProductFile : null);
                    return f ? (
                      <button
                        type="button"
                        onClick={() => setViewingFile(f)}
                        className="mt-1.5 inline-flex items-center gap-1.5 text-xs font-semibold px-2.5 py-1 rounded-full border transition-all duration-150 max-w-full"
                        style={{ color: '#c73009', background: '#fff7f5', borderColor: '#fbd5c8' }}
                        title="Open product doc"
                      >
                        <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="flex-shrink-0"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><polyline points="14 2 14 8 20 8"/></svg>
                        <span className="truncate">{f.title}</span>
                      </button>
                    ) : <p className="mt-1.5 text-sm text-gray-500">—</p>;
                  })(),
                }] : []),
                ...(sprints.length > 0 ? [{
                  label: 'Sprint',
                  name: 'sprintId',
                  optional: false,
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
                    const isOriginal = !(ticket.sprintHistories?.length);
                    return s ? (
                      <div className="mt-1.5 flex flex-wrap items-center gap-1.5">
                        <span className="inline-block text-xs font-medium px-2 py-0.5 rounded-full bg-indigo-50 text-indigo-600">{s.title}</span>
                        {isOriginal && <span className="inline-block text-xs font-medium px-2 py-0.5 rounded-full bg-gray-100 text-gray-500">Original Sprint</span>}
                      </div>
                    ) : <p className="mt-1.5 text-sm text-gray-500">—</p>;
                  })(),
                }] : []),
              ]
                .filter((f): f is NonNullable<typeof f> => Boolean(f))
                // Empty optional fields are a row of "—" boxes that say nothing.
                // They move behind "+ Add field" until asked for.
                .filter((f) => !f.optional || !isFieldEmpty(f.name) || revealed.includes(f.name))
                .map(({ label, icon, editEl, viewEl, name }) => {
                  const isEditing = editingField === name;
                  const canEdit = Boolean(editEl) && Boolean(name);

                  return (
                    <div key={label} className="rounded-lg p-3 bg-gray-50 border border-gray-100">
                      <label className="flex items-center gap-1.5 text-xs font-semibold text-gray-500 uppercase tracking-wider mb-0.5">
                        <span className="text-gray-500">{icon}</span>
                        {label}
                        {savingField === name && <span className="ml-auto text-xs font-normal normal-case text-gray-500">Saving…</span>}
                      </label>

                      {isEditing ? (
                        <div
                          // Blur commits, but only when focus leaves the field
                          // entirely — a <select> moving focus internally should not save.
                          onBlur={(e) => {
                            if (!e.currentTarget.contains(e.relatedTarget as Node | null)) commitField(name);
                          }}
                          onKeyDown={(e) => {
                            if (e.key === 'Escape') {
                              e.stopPropagation();
                              cancelField(name);
                            }
                            if (e.key === 'Enter' && !e.shiftKey) {
                              e.preventDefault();
                              commitField(name);
                            }
                          }}
                        >
                          {editEl}
                        </div>
                      ) : canEdit ? (
                        <button
                          type="button"
                          onClick={() => { setFieldMsg(''); setEditingField(name); }}
                          aria-label={`Edit ${label}`}
                          className="w-full text-left rounded outline-none focus-visible:ring-2 focus-visible:ring-gray-400"
                        >
                          {viewEl}
                        </button>
                      ) : (
                        viewEl
                      )}
                    </div>
                  );
                })}
            </div>

            {fieldMsg && <p role="alert" className="text-sm text-red-700">{fieldMsg}</p>}

            {hiddenFields.length > 0 && (
              <div className="relative">
                <button
                  type="button"
                  onClick={() => setShowAddField((p) => !p)}
                  aria-haspopup="menu"
                  aria-expanded={showAddField}
                  className="flex items-center gap-1 text-xs font-semibold text-gray-600 hover:text-gray-900 transition-colors"
                >
                  <span className="text-sm leading-none font-bold">+</span>
                  Add field
                </button>
                {showAddField && (
                  <div role="menu" className="absolute left-0 top-full mt-1 bg-white border border-gray-200 rounded-lg shadow-lg z-20 min-w-[160px] py-1">
                    {hiddenFields.map((f) => (
                      <button
                        key={f.name}
                        role="menuitem"
                        onClick={() => {
                          setRevealed((prev) => [...prev, f.name]);
                          setShowAddField(false);
                          setEditingField(f.name);
                        }}
                        className="w-full text-left px-3 py-2 text-sm text-gray-700 hover:bg-gray-50"
                      >
                        {f.label}
                      </button>
                    ))}
                  </div>
                )}
              </div>
            )}


            {/* Sprint History (sprint boards only) */}
            {boardType !== 'kanban' && ticket.sprintId && (
              <div>
                <label className="flex items-center gap-1.5 text-xs font-semibold text-gray-500 uppercase tracking-wider mb-2">
                  <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="#9ca3af" strokeWidth="2">
                    <polyline points="12 8 12 12 14 14"/>
                    <path d="M3.05 11a9 9 0 1 0 .5-2.67"/>
                    <polyline points="3 4 3 11 10 11"/>
                  </svg>
                  Sprint History
                </label>
                {(ticket.sprintHistories?.length ?? 0) === 0 ? (
                  <p className="text-xs text-gray-500 py-1">Original Sprint — this ticket has not been moved between sprints.</p>
                ) : (
                  <div className="space-y-1.5">
                    {ticket.sprintHistories!.map((h) => (
                      <div key={h.id} className="flex items-center gap-2 rounded-lg px-3 py-2 bg-gray-50 border border-gray-100">
                        <span className="w-1.5 h-1.5 rounded-full bg-indigo-300 flex-shrink-0" />
                        <span className="text-xs font-medium text-gray-700">{h.sprint.title}</span>
                        <span className="text-xs text-gray-500 ml-auto">{formatDay(h.addedAt)}</span>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            )}

            {/* Dependencies */}
            <div>
              <div className="flex items-center justify-between mb-2.5">
                <label className="flex items-center gap-1.5 text-xs font-semibold text-gray-500 uppercase tracking-wider">
                  <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="#9ca3af" strokeWidth="2">
                    <path d="M10 13a5 5 0 0 0 7.54.54l3-3a5 5 0 0 0-7.07-7.07l-1.72 1.71"/>
                    <path d="M14 11a5 5 0 0 0-7.54-.54l-3 3a5 5 0 0 0 7.07 7.07l1.71-1.71"/>
                  </svg>
                  Dependencies
                </label>
                <button
                  onClick={() => {
                    const next = !showDepSearch;
                    setShowDepSearch(next);
                    if (next) { setDepSearch(''); searchDeps(''); }
                    else { setDepSearch(''); setDepResults([]); }
                  }}
                  className="text-xs font-semibold px-2.5 py-1 rounded-lg border transition-all duration-150"
                  style={{ color: '#c73009', borderColor: '#e8390e', background: 'white' }}
                  onMouseEnter={(e) => { e.currentTarget.style.background = '#c73009'; e.currentTarget.style.color = 'white'; }}
                  onMouseLeave={(e) => { e.currentTarget.style.background = 'white'; e.currentTarget.style.color = '#c73009'; }}
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
                    className="w-full px-3 py-2.5 text-sm text-gray-800 placeholder-gray-500"
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
                          ? { background: '#ecfdf5', color: '#047857', border: '1px solid #a7f3d0' }
                          : { background: '#f3f4f6', color: '#6b7280', border: '1px solid #e5e7eb' }
                        }
                      >
                        {dep.dependsOn.status}
                      </span>
                    </div>
                    <button
                      onClick={() => removeDep(dep.dependsOnId)}
                      className="text-xs font-medium ml-3 flex-shrink-0 px-2 py-1 rounded-md text-gray-500 transition-all duration-150 hover:text-red-700 hover:bg-red-50"
                    >
                      Remove
                    </button>
                  </div>
                ))}
                {(ticket.dependsOn || []).length === 0 && (
                  <p className="text-sm text-gray-500 py-1">No dependencies</p>
                )}
              </div>
            </div>
          </div>

          {/* Right: comments */}
          <div className="lg:w-72 lg:flex-shrink-0 flex flex-col px-4 sm:px-5 py-5 border-t lg:border-t-0 border-gray-100">
            <label className="flex items-center gap-1.5 text-xs font-semibold text-gray-500 uppercase tracking-wider mb-4">
              <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="#9ca3af" strokeWidth="2">
                <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"/>
              </svg>
              Comments
              <span
                className="ml-1 px-1.5 py-0.5 rounded-full text-xs font-bold"
                style={{ background: '#fff7f5', color: '#c73009' }}
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
                  <p className="text-xs text-gray-500">No comments yet</p>
                </div>
              )}
              {(ticket.comments || []).map((c) => {
                const inactive = !activeMemberIds.has(c.authorId);
                return (
                  <div key={c.id} className="flex gap-2.5">
                    <Avatar
                      name={c.author.name}
                      className="w-7 h-7 text-[10px] mt-0.5"
                      inactive={inactive}
                    />
                    <div className="flex-1 min-w-0">
                      <div className="flex items-baseline gap-2 mb-1">
                        <span className={`text-xs font-semibold ${inactive ? 'text-gray-500' : 'text-gray-800'}`}>
                          {c.author.name}{inactive ? ' (inactive)' : ''}
                        </span>
                        <span className="text-xs text-gray-500">
                          {formatTimestamp(c.createdAt)}
                        </span>
                      </div>
                      <div className={`rounded-lg px-3 py-2 text-sm leading-relaxed border ${inactive ? 'bg-gray-50 border-gray-100 text-gray-500' : 'bg-gray-50 border-gray-100 text-gray-700'}`}>
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
                <Avatar name={currentUser?.name || 'User'} className="w-7 h-7 text-[10px]" decorative />
                <div className="flex-1 flex flex-col gap-2">
                  {/* Image previews */}
                  {commentImages.length > 0 && (
                    <div className="flex flex-wrap gap-2">
                      {commentImages.map((src, i) => (
                        <div key={i} className="relative group">
                          <img src={src} alt="preview" className="w-16 h-16 object-cover rounded-lg border border-gray-200" />
                          <button
                            type="button"
                            onClick={() => setCommentImages((imgs) => imgs.filter((_, j) => j !== i))}
                            aria-label={`Remove attached image ${i + 1}`}
                            className="absolute -top-1 -right-1 w-4 h-4 rounded-full bg-red-500 text-white text-xs flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity"
                          >
                            ×
                          </button>
                        </div>
                      ))}
                    </div>
                  )}
                  <div className="relative">
                    <input
                      ref={commentInputRef}
                      type="text"
                      value={comment}
                      onChange={handleCommentChange}
                      onKeyDown={(e) => { if (e.key === 'Escape') setMentionQuery(null); }}
                      placeholder="Add a comment… type @ to mention"
                      className="w-full px-3 py-2 pr-9 text-base sm:text-sm text-gray-800 placeholder-gray-500"
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
                    {/* Image attach button */}
                    <button
                      type="button"
                      onClick={() => commentImageInputRef.current?.click()}
                      aria-label="Attach image to comment"
                      title="Attach image"
                      className="absolute right-2 top-1/2 -translate-y-1/2 text-gray-500 hover:text-gray-600 transition-colors"
                    >
                      <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                        <rect x="3" y="3" width="18" height="18" rx="2" ry="2"/>
                        <circle cx="8.5" cy="8.5" r="1.5"/>
                        <polyline points="21 15 16 10 5 21"/>
                      </svg>
                    </button>
                    <input
                      ref={commentImageInputRef}
                      type="file"
                      accept="image/*"
                      className="hidden"
                      onChange={(e) => {
                        const file = e.target.files?.[0];
                        if (!file) return;
                        const reader = new FileReader();
                        reader.onload = () => setCommentImages((imgs) => [...imgs, reader.result as string]);
                        reader.readAsDataURL(file);
                        e.target.value = '';
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
                            {m.group ? (
                              <span className="w-6 h-6 rounded-full flex-shrink-0 flex items-center justify-center bg-gray-100">
                                <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="#6b7280" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                                  <path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"/>
                                  <circle cx="9" cy="7" r="4"/>
                                  <path d="M23 21v-2a4 4 0 0 0-3-3.87M16 3.13a4 4 0 0 1 0 7.75"/>
                                </svg>
                              </span>
                            ) : (
                              <Avatar name={m.name} className="w-6 h-6 text-[9px]" />
                            )}
                            <span className="font-medium">{m.name}</span>
                            {m.group && <span className="text-xs text-gray-500">Notify the whole board</span>}
                          </button>
                        ))}
                      </div>
                    )}
                  </div>
                  <button
                    type="submit"
                    disabled={submittingComment || (!comment.trim() && commentImages.length === 0)}
                    className="self-end px-4 py-1.5 rounded-lg text-xs font-bold text-white transition-all duration-150 disabled:opacity-40"
                    style={{ background: '#c73009' }}
                    onMouseEnter={(e) => { if (!submittingComment && (comment.trim() || commentImages.length > 0)) e.currentTarget.style.background = '#c73009'; }}
                    onMouseLeave={(e) => { e.currentTarget.style.background = '#c73009'; }}
                  >
                    {submittingComment ? 'Posting...' : 'Post'}
                  </button>
                </div>
              </div>
            </form>
          </div>
        </div>
      </div>
      {viewingFile && <ProductFileViewer file={viewingFile} onClose={() => setViewingFile(null)} />}
    </div>

    {confirmDelete && (
      <ConfirmByName
        title="Delete ticket"
        name={ticket.title}
        description={
          <>
            This permanently deletes <strong>{ticket.title}</strong> and its comments.
            It cannot be undone.
          </>
        }
        confirmLabel="Delete ticket"
        busy={deleting}
        error={deleteMsg || null}
        onCancel={() => { setConfirmDelete(false); setDeleteMsg(''); }}
        onConfirm={deleteTicket}
      />
    )}
    </>
  );
}