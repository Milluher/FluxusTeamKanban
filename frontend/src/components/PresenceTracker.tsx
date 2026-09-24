'use client';
import { useState, useRef, useEffect } from 'react';
import { avatarUrl } from '@/lib/avatar';

export interface PresentUser {
  id: string;
  name: string;
  since: string;
  idle: boolean;
}

interface Props {
  users: PresentUser[];
  currentUserId?: string;
}

function duration(since: string) {
  const mins = Math.floor((Date.now() - new Date(since).getTime()) / 60000);
  if (mins < 1) return 'just arrived';
  if (mins < 60) return `${mins}m on this board`;
  const h = Math.floor(mins / 60);
  return `${h}h on this board`;
}

export default function PresenceTracker({ users, currentUserId }: Props) {
  const [open, setOpen] = useState(false);
  const panelRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handleClick = (e: MouseEvent) => {
      if (panelRef.current && !panelRef.current.contains(e.target as Node)) setOpen(false);
    };
    if (open) document.addEventListener('mousedown', handleClick);
    return () => document.removeEventListener('mousedown', handleClick);
  }, [open]);

  if (users.length === 0) return null;

  const active = users.filter((u) => !u.idle);
  // Active viewers first, then idle — the avatars that fit should be the
  // people actually working right now.
  const ordered = [...active, ...users.filter((u) => u.idle)];
  const shown = ordered.slice(0, 3);
  const overflow = ordered.length - shown.length;

  return (
    <div className="relative" ref={panelRef}>
      <button
        onClick={() => setOpen((p) => !p)}
        className="flex items-center gap-1.5 pl-1.5 pr-2 py-1 rounded-full border border-gray-200 bg-white hover:bg-gray-50 transition-colors"
        title={`${active.length} active on this board`}
        aria-label={`${users.length} people on this board`}
      >
        <span className="relative flex h-1.5 w-1.5 flex-shrink-0 ml-0.5">
          {active.length > 0 && (
            <span className="animate-ping absolute inline-flex h-full w-full rounded-full opacity-70" style={{ background: '#16a34a' }} />
          )}
          <span
            className="relative inline-flex rounded-full h-1.5 w-1.5"
            style={{ background: active.length > 0 ? '#16a34a' : '#d1d5db' }}
          />
        </span>

        <div className="flex -space-x-1.5">
          {shown.map((u) => (
            <img
              key={u.id}
              src={avatarUrl(u.name)}
              className="w-6 h-6 rounded-full ring-2 ring-white flex-shrink-0"
              style={{ opacity: u.idle ? 0.45 : 1 }}
              alt={u.name}
            />
          ))}
        </div>

        {overflow > 0 && <span className="text-xs font-semibold text-gray-500">+{overflow}</span>}
      </button>

      {open && (
        <div className="absolute right-0 top-full mt-2 bg-white border border-gray-200 rounded-xl shadow-lg z-30 min-w-[230px] py-2">
          <p className="text-xs font-semibold text-gray-400 uppercase tracking-wider px-4 pt-1 pb-2">
            {active.length} working now
          </p>
          {ordered.map((u) => (
            <div key={u.id} className="flex items-center gap-2.5 px-4 py-1.5">
              <div className="relative flex-shrink-0">
                <img
                  src={avatarUrl(u.name)}
                  className="w-7 h-7 rounded-full"
                  style={{ opacity: u.idle ? 0.45 : 1 }}
                  alt={u.name}
                />
                <span
                  className="absolute -bottom-0.5 -right-0.5 w-2.5 h-2.5 rounded-full ring-2 ring-white"
                  style={{ background: u.idle ? '#d1d5db' : '#16a34a' }}
                />
              </div>
              <div className="min-w-0">
                <p className="text-sm font-medium truncate" style={{ color: '#1a1f3c' }}>
                  {u.name}{u.id === currentUserId && <span className="text-gray-400 font-normal"> (you)</span>}
                </p>
                <p className="text-[11px] text-gray-400">
                  {u.idle ? 'Tab in background' : duration(u.since)}
                </p>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
