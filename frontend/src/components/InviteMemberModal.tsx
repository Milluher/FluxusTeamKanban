'use client';
import { useState } from 'react';
import api from '@/lib/api';

interface Props {
  boardId: string;
  onClose: () => void;
}

export default function InviteMemberModal({ boardId, onClose }: Props) {
  const [inviteUrl, setInviteUrl] = useState('');
  const [loading, setLoading] = useState(false);
  const [copied, setCopied] = useState(false);
  const [error, setError] = useState('');

  const generate = async () => {
    setLoading(true);
    setError('');
    try {
      const { data } = await api.post(`/boards/${boardId}/invitations`);
      setInviteUrl(data.inviteUrl);
    } catch (e: any) {
      setError(e.response?.data?.error || 'Failed to generate link');
    } finally { setLoading(false); }
  };

  const copy = () => {
    navigator.clipboard.writeText(inviteUrl);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <div className="fixed inset-0 bg-black/40 flex items-end sm:items-center justify-center z-50" onClick={onClose}>
      <div className="bg-white rounded-t-2xl sm:rounded-xl shadow-xl w-full sm:max-w-md p-6" onClick={e => e.stopPropagation()}>
        <div className="flex items-center justify-between mb-5">
          <h2 className="text-lg font-semibold" style={{ color: '#1a1f3c' }}>Invite to Board</h2>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-600 text-xl leading-none">×</button>
        </div>

        <p className="text-sm text-gray-500 mb-4">Generate a link that lets anyone join this board. The link expires in 7 days.</p>

        {!inviteUrl ? (
          <button
            onClick={generate}
            disabled={loading}
            className="w-full py-2.5 min-h-[44px] rounded-lg text-sm font-semibold text-white transition-colors disabled:opacity-50"
            style={{ background: '#e8390e' }}
          >
            {loading ? 'Generating...' : 'Generate Invite Link'}
          </button>
        ) : (
          <div className="space-y-3">
            <div className="flex gap-2">
              <input
                readOnly
                value={inviteUrl}
                className="flex-1 border border-gray-200 rounded-lg px-3 py-2 text-base sm:text-sm text-gray-600 bg-gray-50 truncate min-w-0"
              />
              <button
                onClick={copy}
                className="px-4 py-2 min-h-[44px] rounded-lg text-sm font-semibold text-white transition-colors flex-shrink-0"
                style={{ background: copied ? '#16a34a' : '#e8390e' }}
              >
                {copied ? 'Copied!' : 'Copy'}
              </button>
            </div>
            <button onClick={generate} className="text-sm text-gray-400 hover:text-gray-600">Generate new link</button>
          </div>
        )}

        {error && <p className="text-red-500 text-sm mt-3">{error}</p>}
      </div>
    </div>
  );
}
