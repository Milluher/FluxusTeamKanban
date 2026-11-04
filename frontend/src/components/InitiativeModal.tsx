'use client';
import { useState } from 'react';
import api from '@/lib/api';
import { Initiative } from '@/types';
import { useBoards } from '@/lib/useBoards';

interface Props {
  /** The initiative being edited, or null to create one. */
  initiative: Initiative | null;
  /**
   * The board to create on, when the caller already knows it. Left undefined —
   * as it is on the workspace-level `/initiatives` page — the form asks.
   */
  boardId?: string;
  onClose: () => void;
  onSaved: (initiative: Initiative) => void;
}

const inputStyle: React.CSSProperties = {
  border: '1px solid #e5e7eb',
  borderRadius: '8px',
  outline: 'none',
  width: '100%',
};

const inputFocus = {
  onFocus: (e: React.FocusEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>) => {
    e.currentTarget.style.borderColor = '#e8390e';
    e.currentTarget.style.boxShadow = '0 0 0 3px rgba(232,57,14,0.1)';
  },
  onBlur: (e: React.FocusEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>) => {
    e.currentTarget.style.borderColor = '#e5e7eb';
    e.currentTarget.style.boxShadow = 'none';
  },
};

// The two fields the brief names, labelled in its words: an initiative is
// described in prose, not configured, so the form asks questions.
export default function InitiativeModal({ initiative, boardId, onClose, onSaved }: Props) {
  const [title, setTitle] = useState(initiative?.title ?? '');
  const [description, setDescription] = useState(initiative?.description ?? '');
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  // An initiative belongs to a board. Editing one keeps the board it is already
  // on — the picker is a create-time question, so an edit never silently moves
  // work to another board.
  const needsBoard = !initiative && !boardId;
  const { boards } = useBoards(needsBoard);
  const [chosenBoardId, setChosenBoardId] = useState('');
  const targetBoardId = initiative?.boardId || boardId || chosenBoardId;

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!title.trim() || !description.trim()) return;
    if (!initiative && !targetBoardId) return;
    setSaving(true);
    setError('');
    try {
      // Only sent on create: PATCH would accept it, but an edit form that can
      // move a board without saying so is a trap.
      const body = initiative
        ? { title, description }
        : { title, description, boardId: targetBoardId };
      const { data } = initiative
        ? await api.patch<Initiative>(`/initiatives/${initiative.id}`, body)
        : await api.post<Initiative>('/initiatives', body);
      onSaved(data);
    } catch (err: any) {
      setError(err.response?.data?.error || 'Could not save that initiative.');
    } finally {
      setSaving(false);
    }
  };

  return (
    <div
      className="fixed inset-0 flex items-end sm:items-center justify-center z-50"
      style={{ background: 'rgba(0,0,0,0.4)' }}
      onClick={onClose}
    >
      <form
        onSubmit={submit}
        role="dialog"
        aria-modal="true"
        aria-label={initiative ? `Edit ${initiative.title}` : 'New initiative'}
        className="w-full sm:max-w-md bg-white rounded-t-2xl sm:rounded-xl shadow-xl border border-gray-200 overflow-hidden"
        onClick={(e) => e.stopPropagation()}
        onKeyDown={(e) => { if (e.key === 'Escape') onClose(); }}
      >
        <div className="px-5 py-4 border-b border-gray-200 flex items-center justify-between">
          <h3 className="font-bold text-base" style={{ color: '#1a1f3c' }}>
            {initiative ? 'Edit Initiative' : 'New Initiative'}
          </h3>
          <button
            type="button"
            onClick={onClose}
            aria-label="Close initiative dialog"
            className="w-7 h-7 flex items-center justify-center rounded-lg text-gray-500 bg-gray-100 hover:bg-gray-200 text-lg"
          >
            ×
          </button>
        </div>

        <div className="px-5 py-5 space-y-4">
          {needsBoard && (
            <div>
              <label htmlFor="initiative-board" className="block text-xs font-semibold text-gray-500 mb-1.5">
                Which board is it for?
              </label>
              <select
                id="initiative-board"
                value={chosenBoardId}
                onChange={(e) => setChosenBoardId(e.target.value)}
                className="px-3 py-2.5 text-sm text-gray-900 bg-white"
                style={inputStyle}
                {...inputFocus}
              >
                <option value="">Choose a board…</option>
                {boards.map((b) => (
                  <option key={b.id} value={b.id}>{b.name}</option>
                ))}
              </select>
            </div>
          )}

          <div>
            <label htmlFor="initiative-title" className="block text-xs font-semibold text-gray-500 mb-1.5">
              What is this initiative?
            </label>
            <input
              id="initiative-title"
              autoFocus
              type="text"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="e.g. Make onboarding self-serve"
              className="px-3 py-2.5 text-sm text-gray-900 placeholder-gray-500"
              style={inputStyle}
              {...inputFocus}
            />
          </div>

          <div>
            <label htmlFor="initiative-description" className="block text-xs font-semibold text-gray-500 mb-1.5">
              A bit more about it
            </label>
            <textarea
              id="initiative-description"
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="The goal, why it matters, and roughly what it covers…"
              rows={5}
              className="px-3 py-2.5 text-sm text-gray-900 placeholder-gray-500 resize-y"
              style={inputStyle}
              {...inputFocus}
            />
          </div>

          {error && (
            <p role="alert" className="px-3 py-2 rounded-lg text-sm bg-red-50 text-red-700 border border-red-200">
              {error}
            </p>
          )}
        </div>

        <div className="px-5 pb-5 flex gap-2.5">
          <button
            type="button"
            onClick={onClose}
            className="flex-1 py-2.5 min-h-[44px] rounded-lg text-sm font-semibold text-gray-600 border border-gray-200 bg-white hover:text-gray-900"
          >
            Cancel
          </button>
          <button
            type="submit"
            disabled={saving || !title.trim() || !description.trim() || (!initiative && !targetBoardId)}
            className="flex-1 py-2.5 min-h-[44px] rounded-lg text-sm font-bold text-white disabled:opacity-50"
            style={{ background: '#c73009' }}
          >
            {saving ? 'Saving…' : initiative ? 'Save changes' : 'Create Initiative'}
          </button>
        </div>
      </form>
    </div>
  );
}
