'use client';
import { ReactNode, useEffect, useId, useRef, useState } from 'react';

interface Props {
  /** Dialog heading, e.g. "Delete board". */
  title: string;
  /** The exact text the person must type to enable the confirm button. */
  name: string;
  /** What is being removed and what else goes with it. */
  description: ReactNode;
  confirmLabel: string;
  busy?: boolean;
  error?: string | null;
  onCancel: () => void;
  onConfirm: () => void;
}

// Confirmation for deletes that cannot be undone. Nothing in this backend is a
// soft delete and there is no restore endpoint, so typing the name is the only
// thing standing between a stray click and permanent data loss.
export default function ConfirmByName({
  title,
  name,
  description,
  confirmLabel,
  busy = false,
  error = null,
  onCancel,
  onConfirm,
}: Props) {
  const [typed, setTyped] = useState('');
  const inputRef = useRef<HTMLInputElement>(null);
  const headingId = useId();
  const hintId = useId();
  const matches = typed === name;

  useEffect(() => {
    inputRef.current?.focus();
  }, []);

  useEffect(() => {
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onCancel();
    };
    document.addEventListener('keydown', onKeyDown);
    return () => document.removeEventListener('keydown', onKeyDown);
  }, [onCancel]);

  return (
    <div
      className="fixed inset-0 bg-black/40 flex items-end sm:items-center justify-center z-50"
      onClick={onCancel}
    >
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby={headingId}
        className="bg-white rounded-t-2xl sm:rounded-xl shadow-xl w-full sm:max-w-sm p-6"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between mb-4">
          <h3 id={headingId} className="font-semibold text-red-700">{title}</h3>
          <button
            onClick={onCancel}
            aria-label={`Close ${title.toLowerCase()} dialog`}
            className="text-gray-500 text-xl w-8 h-8 flex items-center justify-center"
          >
            ×
          </button>
        </div>

        <div className="text-sm text-gray-600 mb-4">{description}</div>

        <label htmlFor={hintId} className="block text-xs font-semibold text-gray-600 mb-1.5">
          Type <span className="font-bold text-gray-900">{name}</span> to confirm
        </label>
        <input
          id={hintId}
          ref={inputRef}
          value={typed}
          onChange={(e) => setTyped(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === 'Enter' && matches && !busy) onConfirm();
          }}
          autoComplete="off"
          className="w-full px-3 py-2.5 text-sm text-gray-900 placeholder-gray-500 outline-none rounded-lg border border-gray-200 mb-4"
          placeholder={name}
        />

        {error && <p className="text-sm text-red-700 mb-3">{error}</p>}

        <div className="flex gap-2">
          <button
            onClick={onCancel}
            className="flex-1 py-2.5 min-h-[44px] rounded-lg text-sm font-medium text-gray-600 border border-gray-200"
          >
            Cancel
          </button>
          <button
            onClick={onConfirm}
            disabled={!matches || busy}
            className="flex-1 py-2.5 min-h-[44px] rounded-lg text-sm font-semibold text-white transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
            style={{ background: '#b91c1c' }}
          >
            {busy ? 'Deleting…' : confirmLabel}
          </button>
        </div>
      </div>
    </div>
  );
}
