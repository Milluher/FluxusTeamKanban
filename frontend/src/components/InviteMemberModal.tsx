'use client';
import { useState, useEffect, useRef } from 'react';
import api from '@/lib/api';
import { avatarUrl } from '@/lib/avatar';
import { User } from '@/types';

interface Props {
  boardId: string;
  boardMemberIds: string[];
  onClose: () => void;
  onMemberAdded: (member: any) => void;
}

export default function InviteMemberModal({ boardId, boardMemberIds, onClose, onMemberAdded }: Props) {
  const [tab, setTab] = useState<'add' | 'link'>('add');

  // Add existing user state
  const [query, setQuery] = useState('');
  const [allUsers, setAllUsers] = useState<User[]>([]);
  const [adding, setAdding] = useState<string | null>(null);
  const [addedIds, setAddedIds] = useState<string[]>([]);
  const [addError, setAddError] = useState('');

  // Invite link state
  const [inviteUrl, setInviteUrl] = useState('');
  const [generating, setGenerating] = useState(false);
  const [copied, setCopied] = useState(false);
  const [linkError, setLinkError] = useState('');

  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    api.get('/users').then(({ data }) => setAllUsers(data)).catch(() => {});
  }, []);

  useEffect(() => {
    if (tab === 'add') inputRef.current?.focus();
  }, [tab]);

  const nonMembers = allUsers.filter(
    (u) => !boardMemberIds.includes(u.id) && !addedIds.includes(u.id)
  );

  const filtered = query.trim()
    ? nonMembers.filter(
        (u) =>
          u.name.toLowerCase().includes(query.toLowerCase()) ||
          u.email.toLowerCase().includes(query.toLowerCase())
      )
    : nonMembers;

  const addUser = async (user: User) => {
    setAdding(user.id);
    setAddError('');
    try {
      const { data } = await api.post(`/boards/${boardId}/members`, { userId: user.id });
      setAddedIds((prev) => [...prev, user.id]);
      onMemberAdded(data);
    } catch (e: any) {
      setAddError(e.response?.data?.error || 'Failed to add member');
    } finally {
      setAdding(null);
    }
  };

  const generateLink = async () => {
    setGenerating(true);
    setLinkError('');
    try {
      const { data } = await api.post(`/boards/${boardId}/invitations`);
      setInviteUrl(data.inviteUrl);
    } catch (e: any) {
      setLinkError(e.response?.data?.error || 'Failed to generate link');
    } finally { setGenerating(false); }
  };

  const copy = () => {
    navigator.clipboard.writeText(inviteUrl);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <div className="fixed inset-0 bg-black/40 flex items-end sm:items-center justify-center z-50" onClick={onClose}>
      <div
        className="bg-white w-full sm:max-w-md rounded-t-2xl sm:rounded-xl shadow-xl overflow-hidden max-h-[85vh] sm:max-h-[80vh] flex flex-col"
        onClick={e => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-center justify-between px-5 py-4 border-b border-gray-100 flex-shrink-0">
          <h2 className="font-semibold text-base" style={{ color: '#1a1f3c' }}>Add to Board</h2>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-600 text-2xl leading-none w-8 h-8 flex items-center justify-center">×</button>
        </div>

        {/* Tabs */}
        <div className="flex border-b border-gray-100 flex-shrink-0">
          {[
            { key: 'add', label: 'Add Member' },
            { key: 'link', label: 'Invite Link' },
          ].map(({ key, label }) => (
            <button
              key={key}
              onClick={() => setTab(key as 'add' | 'link')}
              className="flex-1 py-3 text-sm font-medium transition-colors relative"
              style={{ color: tab === key ? '#e8390e' : '#6b7280' }}
            >
              {label}
              {tab === key && (
                <span className="absolute bottom-0 left-0 right-0 h-0.5 rounded-full" style={{ background: '#e8390e' }} />
              )}
            </button>
          ))}
        </div>

        {/* Tab content */}
        <div className="flex-1 overflow-y-auto">
          {tab === 'add' ? (
            <div className="p-4 space-y-3">
              {/* Search input */}
              <input
                ref={inputRef}
                type="text"
                value={query}
                onChange={e => setQuery(e.target.value)}
                placeholder="Search by name or email..."
                className="w-full border border-gray-200 rounded-lg px-3 py-2.5 text-base sm:text-sm focus:outline-none focus:border-orange-400"
                onFocus={e => e.currentTarget.style.borderColor = '#e8390e'}
                onBlur={e => e.currentTarget.style.borderColor = '#e5e7eb'}
              />

              {addError && <p className="text-red-500 text-sm">{addError}</p>}

              {/* User list */}
              <div className="space-y-1">
                {filtered.length === 0 && (
                  <p className="text-sm text-gray-400 text-center py-6">
                    {query ? 'No users found' : 'All users are already members'}
                  </p>
                )}
                {filtered.map((user) => (
                  <div
                    key={user.id}
                    className="flex items-center justify-between gap-3 px-3 py-2.5 rounded-lg hover:bg-gray-50 transition-colors"
                  >
                    <div className="flex items-center gap-3 min-w-0">
                      <img src={avatarUrl(user.name)} className="w-9 h-9 rounded-full flex-shrink-0" alt={user.name} />
                      <div className="min-w-0">
                        <p className="text-sm font-medium text-gray-900 truncate">{user.name}</p>
                        <p className="text-xs text-gray-400 truncate">{user.email}</p>
                      </div>
                    </div>
                    <button
                      onClick={() => addUser(user)}
                      disabled={adding === user.id}
                      className="flex-shrink-0 text-xs font-semibold px-3 py-1.5 min-h-[36px] rounded-lg text-white transition-colors disabled:opacity-50"
                      style={{ background: '#e8390e' }}
                    >
                      {adding === user.id ? '...' : 'Add'}
                    </button>
                  </div>
                ))}

                {/* Already added this session */}
                {addedIds.map((id) => {
                  const u = allUsers.find(u => u.id === id);
                  if (!u) return null;
                  return (
                    <div key={id} className="flex items-center justify-between gap-3 px-3 py-2.5 rounded-lg opacity-60">
                      <div className="flex items-center gap-3 min-w-0">
                        <img src={avatarUrl(u.name)} className="w-9 h-9 rounded-full flex-shrink-0" alt={u.name} />
                        <div className="min-w-0">
                          <p className="text-sm font-medium text-gray-900 truncate">{u.name}</p>
                          <p className="text-xs text-gray-400 truncate">{u.email}</p>
                        </div>
                      </div>
                      <span className="text-xs text-green-600 font-medium flex items-center gap-1 flex-shrink-0">
                        <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3">
                          <path d="M20 6L9 17l-5-5"/>
                        </svg>
                        Added
                      </span>
                    </div>
                  );
                })}
              </div>
            </div>
          ) : (
            <div className="p-5 space-y-4">
              <p className="text-sm text-gray-500">Generate a link for anyone outside the platform to join this board. Expires in 7 days.</p>
              {!inviteUrl ? (
                <button
                  onClick={generateLink}
                  disabled={generating}
                  className="w-full py-2.5 min-h-[44px] rounded-lg text-sm font-semibold text-white disabled:opacity-50"
                  style={{ background: '#e8390e' }}
                >
                  {generating ? 'Generating...' : 'Generate Invite Link'}
                </button>
              ) : (
                <div className="space-y-3">
                  <div className="flex gap-2">
                    <input
                      readOnly
                      value={inviteUrl}
                      className="flex-1 border border-gray-200 rounded-lg px-3 py-2 text-sm text-gray-600 bg-gray-50 truncate min-w-0"
                    />
                    <button
                      onClick={copy}
                      className="px-4 py-2 min-h-[44px] rounded-lg text-sm font-semibold text-white flex-shrink-0"
                      style={{ background: copied ? '#16a34a' : '#e8390e' }}
                    >
                      {copied ? 'Copied!' : 'Copy'}
                    </button>
                  </div>
                  <button onClick={generateLink} className="text-sm text-gray-400 hover:text-gray-600">
                    Generate new link
                  </button>
                </div>
              )}
              {linkError && <p className="text-red-500 text-sm">{linkError}</p>}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
