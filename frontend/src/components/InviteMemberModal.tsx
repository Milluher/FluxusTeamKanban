'use client';
import { useState } from 'react';
import api from '@/lib/api';

interface Props {
  boardId: string;
  onClose: () => void;
}

export default function InviteMemberModal({ boardId, onClose }: Props) {
  const [email, setEmail] = useState('');
  const [status, setStatus] = useState<'idle' | 'loading' | 'success' | 'error'>('idle');
  const [message, setMessage] = useState('');

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setStatus('loading');
    try {
      await api.post(`/boards/${boardId}/members`, { email });
      setStatus('success');
      setMessage(`${email} has been added to the board.`);
      setEmail('');
    } catch (err: any) {
      setStatus('error');
      setMessage(err.response?.data?.error || 'Failed to add member');
    }
  };

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4" onClick={onClose}>
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-md p-6" onClick={(e) => e.stopPropagation()}>
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-lg font-bold text-gray-900">Invite Member</h2>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-600 text-xl">×</button>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Email address</label>
            <input
              autoFocus
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
              placeholder="colleague@example.com"
              required
            />
          </div>

          {status === 'success' && <p className="text-green-600 text-sm">{message}</p>}
          {status === 'error' && <p className="text-red-500 text-sm">{message}</p>}

          <button
            type="submit"
            disabled={status === 'loading'}
            className="w-full bg-indigo-600 text-white py-2 rounded-lg font-medium hover:bg-indigo-700 disabled:opacity-50 text-sm"
          >
            {status === 'loading' ? 'Inviting...' : 'Invite'}
          </button>
        </form>
      </div>
    </div>
  );
}
