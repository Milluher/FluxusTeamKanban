'use client';
import { useEffect, useState, useRef, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import api from '@/lib/api';
import socket from '@/lib/socket';

interface AppNotification {
  id: string;
  type: string;
  title: string;
  body: string;
  ticketId?: string;
  boardId?: string;
  read: boolean;
  createdAt: string;
}

interface Props {
  userId: string;
}

export default function NotificationBell({ userId }: Props) {
  const [notifications, setNotifications] = useState<AppNotification[]>([]);
  const [open, setOpen] = useState(false);
  const [pushPermission, setPushPermission] = useState<NotificationPermission | 'unsupported'>('unsupported');
  const panelRef = useRef<HTMLDivElement>(null);
  const router = useRouter();

  useEffect(() => {
    if (typeof window !== 'undefined' && 'Notification' in window) {
      setPushPermission(window.Notification.permission);
    }
  }, []);

  const enablePush = async () => {
    if (typeof window === 'undefined' || !('Notification' in window)) return;
    try {
      const result = await window.Notification.requestPermission();
      setPushPermission(result);
    } catch {}
  };

  // Desktop alert for real-time notifications. Only fired when the tab isn't
  // focused — an in-app bell update is enough when the user is already looking.
  const showDesktopNotification = useCallback((n: AppNotification) => {
    if (typeof window === 'undefined' || !('Notification' in window)) return;
    if (window.Notification.permission !== 'granted') return;
    if (document.hasFocus()) return;
    try {
      const body = n.body.replace(/__IMG__[\s\S]*?__IMG__/g, '').replace(/<[^>]*>/g, ' ').trim();
      const desktop = new window.Notification(n.title, {
        body: body.length > 160 ? `${body.slice(0, 160)}\u2026` : body,
        icon: '/logo.png',
        tag: n.id, // prevents duplicates if the same event arrives twice
      });
      desktop.onclick = () => {
        window.focus();
        if (n.boardId && n.ticketId) router.push(`/board/${n.boardId}?ticket=${n.ticketId}`);
        else if (n.boardId) router.push(`/board/${n.boardId}`);
        desktop.close();
      };
    } catch {}
  }, [router]);

  const unread = notifications.filter((n) => !n.read).length;

  const fetchNotifications = useCallback(async () => {
    try {
      const { data } = await api.get('/notifications');
      setNotifications(data);
    } catch {}
  }, []);

  useEffect(() => {
    fetchNotifications();

    // Join personal room for real-time notifications
    socket.connect();
    socket.emit('join-user', userId);

    socket.on('notification', (n: AppNotification) => {
      setNotifications((prev) => [n, ...prev]);
      showDesktopNotification(n);
    });

    return () => {
      socket.emit('leave-user', userId);
      socket.off('notification');
    };
  }, [userId, fetchNotifications, showDesktopNotification]);

  // Close on outside click
  useEffect(() => {
    const handleClick = (e: MouseEvent) => {
      if (panelRef.current && !panelRef.current.contains(e.target as Node)) {
        setOpen(false);
      }
    };
    if (open) document.addEventListener('mousedown', handleClick);
    return () => document.removeEventListener('mousedown', handleClick);
  }, [open]);

  const markAllRead = async () => {
    await api.patch('/notifications/read-all').catch(() => {});
    setNotifications((prev) => prev.map((n) => ({ ...n, read: true })));
  };

  const handleClick = async (n: AppNotification) => {
    if (!n.read) {
      await api.patch(`/notifications/${n.id}/read`).catch(() => {});
      setNotifications((prev) => prev.map((x) => x.id === n.id ? { ...x, read: true } : x));
    }
    setOpen(false);
    if (n.boardId && n.ticketId) router.push(`/board/${n.boardId}?ticket=${n.ticketId}`);
    else if (n.boardId) router.push(`/board/${n.boardId}`);
  };

  const timeAgo = (iso: string) => {
    const diff = Date.now() - new Date(iso).getTime();
    const m = Math.floor(diff / 60000);
    if (m < 1) return 'just now';
    if (m < 60) return `${m}m ago`;
    const h = Math.floor(m / 60);
    if (h < 24) return `${h}h ago`;
    return `${Math.floor(h / 24)}d ago`;
  };

  return (
    <div className="relative" ref={panelRef}>
      <button
        onClick={() => setOpen((p) => !p)}
        className="relative w-9 h-9 flex items-center justify-center rounded-lg hover:bg-gray-100 transition-colors min-h-[44px] min-w-[44px] sm:min-h-0 sm:min-w-0 sm:w-8 sm:h-8"
        aria-label="Notifications"
      >
        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="text-gray-500">
          <path d="M18 8A6 6 0 0 0 6 8c0 7-3 9-3 9h18s-3-2-3-9"/>
          <path d="M13.73 21a2 2 0 0 1-3.46 0"/>
        </svg>
        {unread > 0 && (
          <span
            className="absolute top-0.5 right-0.5 sm:top-0 sm:right-0 min-w-[16px] h-4 px-1 rounded-full text-white text-[10px] font-bold flex items-center justify-center"
            style={{ background: '#e8390e' }}
          >
            {unread > 9 ? '9+' : unread}
          </span>
        )}
      </button>

      {open && (
        <div className="absolute right-0 top-full mt-2 bg-white border border-gray-200 rounded-xl shadow-lg z-30 w-80">
          <div className="flex items-center justify-between px-4 py-3 border-b border-gray-100">
            <span className="text-sm font-semibold" style={{ color: '#1a1f3c' }}>Notifications</span>
            {unread > 0 && (
              <button onClick={markAllRead} className="text-xs text-gray-400 hover:text-gray-600 transition-colors">
                Mark all read
              </button>
            )}
          </div>

          {pushPermission === 'default' && (
            <button
              onClick={enablePush}
              className="w-full flex items-center gap-2 px-4 py-2.5 border-b border-gray-100 hover:bg-gray-50 transition-colors text-left"
            >
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#e8390e" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="flex-shrink-0">
                <path d="M18 8A6 6 0 0 0 6 8c0 7-3 9-3 9h18s-3-2-3-9"/>
                <path d="M13.73 21a2 2 0 0 1-3.46 0"/>
              </svg>
              <span className="text-xs text-gray-600">Enable desktop alerts</span>
            </button>
          )}

          <div className="max-h-80 overflow-y-auto divide-y divide-gray-50">
            {notifications.length === 0 ? (
              <div className="py-8 text-center">
                <p className="text-sm text-gray-400">No notifications yet</p>
              </div>
            ) : (
              notifications.map((n) => (
                <button
                  key={n.id}
                  onClick={() => handleClick(n)}
                  className={`w-full text-left px-4 py-3 hover:bg-gray-50 transition-colors flex gap-3 items-start ${!n.read ? 'bg-orange-50/40' : ''}`}
                >
                  <div
                    className="w-2 h-2 rounded-full flex-shrink-0 mt-1.5"
                    style={{ background: n.read ? '#d1d5db' : '#e8390e' }}
                  />
                  <div className="min-w-0 flex-1">
                    <p className="text-xs font-semibold text-gray-700">{n.title}</p>
                    <p className="text-xs text-gray-500 mt-0.5 truncate">{n.body}</p>
                    <p className="text-[10px] text-gray-400 mt-1">{timeAgo(n.createdAt)}</p>
                  </div>
                </button>
              ))
            )}
          </div>
        </div>
      )}
    </div>
  );
}
