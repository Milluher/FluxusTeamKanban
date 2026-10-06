'use client';
import { useState } from 'react';
import api from '@/lib/api';
import { Initiative } from '@/types';

interface Props {
  /** The initiative being edited, or null to create one. */
  initiative: Initiative | null;
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
  onFocus: (e: React.FocusEvent<HTMLInputElement | HTMLTextAreaElement>) => {
    e.currentTarget.style.borderColor = '#e8390e';
    e.currentTarget.style.boxShadow = '0 0 0 3px rgba(232,57,14,0.1)';
  },
  onBlur: (e: React.FocusEvent<HTMLInputElement | HTMLTextAreaElement>) => {
    e.currentTarget.style.borderColor = '#e5e7eb';
    e.currentTarget.style.boxShadow = 'none';
  },
};

// The two fields the brief names, labelled in its words: an initiative is
// described in prose, not configured, so the form asks questions.
export default function InitiativeModal({ initiative, onClose, onSaved }: Props) {
  const [title, setTitle] = useState(initiative?.title ?? '');
  const [description, setDescription] = useState(initiative?.description ?? '');
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!title.trim() || !description.trim()) return;
    setSaving(true);
    setError('');
    try {
      const body = { title, description };
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
            disabled={saving || !title.trim() || !description.trim()}
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
