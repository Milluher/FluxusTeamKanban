'use client';
import { useState } from 'react';
import api from '@/lib/api';
import { Board, ChangelogEntry, ChangelogItem, ChangelogItemKind } from '@/types';

const KINDS: { value: ChangelogItemKind; label: string }[] = [
  { value: 'added', label: 'Added' },
  { value: 'changed', label: 'Changed' },
  { value: 'fixed', label: 'Fixed' },
  { value: 'removed', label: 'Removed' },
];

interface Props {
  entry: ChangelogEntry | null;
  boards: Board[];
  onClose: () => void;
  onSaved: (entry: ChangelogEntry) => void;
}

export default function ChangelogEntryModal({ entry, boards, onClose, onSaved }: Props) {
  const [version, setVersion] = useState(entry?.version || '');
  const [title, setTitle] = useState(entry?.title || '');
  const [summary, setSummary] = useState(entry?.summary || '');
  const [boardId, setBoardId] = useState(entry?.boardId || '');
  const [items, setItems] = useState<ChangelogItem[]>(
    entry?.items?.length ? entry.items : [{ kind: 'added', text: '' }]
  );
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  const updateItem = (index: number, patch: Partial<ChangelogItem>) => {
    setItems((prev) => prev.map((item, i) => (i === index ? { ...item, ...patch } : item)));
  };

  const addItem = () => {
    setItems((prev) => [...prev, { kind: prev[prev.length - 1]?.kind || 'added', text: '' }]);
  };

  const removeItem = (index: number) => {
    setItems((prev) => (prev.length === 1 ? prev : prev.filter((_, i) => i !== index)));
  };

  const save = async (draft: boolean) => {
    if (!title.trim()) { setError('Title is required'); return; }
    setSaving(true);
    setError('');
    const payload = {
      version: version.trim() || null,
      title: title.trim(),
      summary: summary.trim() || null,
      items: items.filter((i) => i.text.trim()),
      boardId: boardId || null,
      draft,
    };
    try {
      const { data } = entry
        ? await api.patch(`/changelog/${entry.id}`, payload)
        : await api.post('/changelog', payload);
      onSaved(data);
    } catch (e: any) {
      setError(e.response?.data?.error || 'Failed to save entry');
    } finally { setSaving(false); }
  };

  const isDraft = entry ? !entry.publishedAt : true;

  return (
    <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-xl w-full max-w-lg max-h-[90vh] overflow-y-auto">
        <div className="flex items-center justify-between px-6 py-4 border-b border-gray-100 sticky top-0 bg-white rounded-t-xl">
          <h3 className="text-base font-semibold" style={{ color: '#1a1f3c' }}>
            {entry ? 'Edit entry' : 'New changelog entry'}
          </h3>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-600 transition-colors" aria-label="Close">
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
              <path d="M18 6 6 18M6 6l12 12" />
            </svg>
          </button>
        </div>

        <div className="px-6 py-5 space-y-4">
          <div className="flex gap-3">
            <div className="w-28 flex-shrink-0">
              <label className="block text-xs font-semibold text-gray-500 mb-1.5">Version</label>
              <input
                value={version}
                onChange={(e) => setVersion(e.target.value)}
                placeholder="v1.4"
                className="w-full text-sm px-3 py-2 border border-gray-200 rounded-lg focus:outline-none focus:border-gray-400 transition-colors"
              />
            </div>
            <div className="flex-1 min-w-0">
              <label className="block text-xs font-semibold text-gray-500 mb-1.5">Title *</label>
              <input
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                placeholder="Export and payout fixes"
                className="w-full text-sm px-3 py-2 border border-gray-200 rounded-lg focus:outline-none focus:border-gray-400 transition-colors"
              />
            </div>
          </div>

          <div>
            <label className="block text-xs font-semibold text-gray-500 mb-1.5">Project</label>
            <select
              value={boardId}
              onChange={(e) => setBoardId(e.target.value)}
              className="w-full text-sm px-3 py-2 border border-gray-200 rounded-lg bg-white focus:outline-none focus:border-gray-400 transition-colors"
            >
              <option value="">All projects (company-wide)</option>
              {boards.map((b) => (
                <option key={b.id} value={b.id}>{b.name}</option>
              ))}
            </select>
            <p className="text-[11px] text-gray-400 mt-1.5">
              Everyone sees the entry. Items on a project-scoped entry are detailed only to that project&apos;s members.
            </p>
          </div>

          <div>
            <label className="block text-xs font-semibold text-gray-500 mb-1.5">Summary</label>
            <textarea
              value={summary}
              onChange={(e) => setSummary(e.target.value)}
              rows={2}
              placeholder="Optional intro line"
              className="w-full text-sm px-3 py-2 border border-gray-200 rounded-lg resize-none focus:outline-none focus:border-gray-400 transition-colors"
            />
          </div>

          <div>
            <label className="block text-xs font-semibold text-gray-500 mb-1.5">Changes</label>
            <div className="space-y-2">
              {items.map((item, i) => (
                <div key={i} className="flex gap-2">
                  <select
                    value={item.kind}
                    onChange={(e) => updateItem(i, { kind: e.target.value as ChangelogItemKind })}
                    className="text-xs px-2 py-2 border border-gray-200 rounded-lg bg-white w-24 flex-shrink-0 focus:outline-none focus:border-gray-400 transition-colors"
                  >
                    {KINDS.map((k) => (
                      <option key={k.value} value={k.value}>{k.label}</option>
                    ))}
                  </select>
                  <input
                    value={item.text}
                    onChange={(e) => updateItem(i, { text: e.target.value })}
                    placeholder="CSV export on all boards"
                    className="flex-1 min-w-0 text-sm px-3 py-2 border border-gray-200 rounded-lg focus:outline-none focus:border-gray-400 transition-colors"
                  />
                  <button
                    onClick={() => removeItem(i)}
                    disabled={items.length === 1}
                    className="text-gray-300 hover:text-red-500 disabled:opacity-30 disabled:hover:text-gray-300 transition-colors px-1"
                    aria-label="Remove change"
                  >
                    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
                      <path d="M18 6 6 18M6 6l12 12" />
                    </svg>
                  </button>
                </div>
              ))}
            </div>
            <button onClick={addItem} className="text-xs font-medium mt-2 transition-colors" style={{ color: '#e8390e' }}>
              + Add change
            </button>
          </div>

          {error && <p className="text-xs text-red-600">{error}</p>}
        </div>

        <div className="flex items-center justify-end gap-2 px-6 py-4 border-t border-gray-100 sticky bottom-0 bg-white rounded-b-xl">
          <button
            onClick={onClose}
            className="text-sm px-4 py-2 rounded-lg font-medium text-gray-500 hover:bg-gray-50 transition-colors"
          >
            Cancel
          </button>
          {isDraft && (
            <button
              onClick={() => save(true)}
              disabled={saving}
              className="text-sm px-4 py-2 rounded-lg font-medium border border-gray-200 text-gray-600 hover:bg-gray-50 disabled:opacity-50 transition-colors"
            >
              Save draft
            </button>
          )}
          <button
            onClick={() => save(false)}
            disabled={saving}
            className="text-sm px-4 py-2 rounded-lg font-semibold text-white disabled:opacity-50 transition-colors"
            style={{ background: '#e8390e' }}
          >
            {saving ? 'Saving…' : entry && !isDraft ? 'Save changes' : 'Publish'}
          </button>
        </div>
      </div>
    </div>
  );
}
