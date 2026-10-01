'use client';
import { useEffect, useRef, useState } from 'react';

export interface RowMenuItem {
  label: string;
  onSelect: () => void;
  /** Renders in red. Use for deletes and other irreversible actions. */
  destructive?: boolean;
}

interface Props {
  /** Accessible name, e.g. "Actions for Product Roadmap". */
  label: string;
  items: RowMenuItem[];
}

// A "⋯" menu for row actions. Destructive actions used to sit permanently in
// reach — a trash icon beside a board's type label, a Delete button on every
// admin row — which made them easy to hit while aiming for something else.
export default function RowMenu({ label, items }: Props) {
  const [open, setOpen] = useState(false);
  const wrapperRef = useRef<HTMLDivElement>(null);
  const buttonRef = useRef<HTMLButtonElement>(null);

  useEffect(() => {
    if (!open) return;

    const onPointerDown = (e: MouseEvent) => {
      if (!wrapperRef.current?.contains(e.target as Node)) setOpen(false);
    };
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        setOpen(false);
        buttonRef.current?.focus();
      }
    };

    document.addEventListener('mousedown', onPointerDown);
    document.addEventListener('keydown', onKeyDown);
    return () => {
      document.removeEventListener('mousedown', onPointerDown);
      document.removeEventListener('keydown', onKeyDown);
    };
  }, [open]);

  return (
    <div className="relative flex-shrink-0" ref={wrapperRef}>
      <button
        ref={buttonRef}
        onClick={(e) => {
          // Rows are often clickable themselves; opening the menu must not also
          // trigger the row.
          e.stopPropagation();
          setOpen((p) => !p);
        }}
        aria-label={label}
        aria-haspopup="menu"
        aria-expanded={open}
        className="w-7 h-7 flex items-center justify-center rounded-md text-gray-500 hover:text-gray-900 hover:bg-gray-100 transition-all"
      >
        <svg width="14" height="14" viewBox="0 0 24 24" fill="currentColor">
          <circle cx="5" cy="12" r="1.8" /><circle cx="12" cy="12" r="1.8" /><circle cx="19" cy="12" r="1.8" />
        </svg>
      </button>

      {open && (
        <div
          role="menu"
          className="absolute right-0 top-full mt-1 bg-white border border-gray-200 rounded-lg shadow-lg z-30 min-w-[160px] py-1"
        >
          {items.map((item) => (
            <button
              key={item.label}
              role="menuitem"
              onClick={(e) => {
                e.stopPropagation();
                setOpen(false);
                item.onSelect();
              }}
              className={`w-full text-left px-3 py-2 text-sm transition-colors ${
                item.destructive ? 'text-red-700 hover:bg-red-50' : 'text-gray-700 hover:bg-gray-50'
              }`}
            >
              {item.label}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
