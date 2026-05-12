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
    <div
      className="fixed inset-0 flex items-center justify-center z-50 p-4"
      style={{ background: 'rgba(0,0,0,0.4)' }}
      onClick={onClose}
    >
      <div
        className="w-full max-w-md rounded-xl overflow-hidden bg-white shadow-xl border border-gray-200"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="px-6 py-4 flex items-center justify-between border-b border-gray-200">
          <div>
            <h2 className="text-base font-bold" style={{ color: '#1a1f3c' }}>Invite Member</h2>
            <p className="text-xs text-gray-400 mt-0.5">Add a collaborator to this board</p>
          </div>
          <button
            onClick={onClose}
            className="w-7 h-7 flex items-center justify-center rounded-lg text-lg text-gray-400 bg-gray-100 transition-all duration-150 hover:bg-gray-200 hover:text-gray-700"
          >
            ×
          </button>
        </div>

        {/* Form */}
        <div className="px-6 py-5">
          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <label className="block text-xs font-semibold text-gray-500 mb-1.5">
                Email address
              </label>
              <input
                autoFocus
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                className="w-full px-3 py-2.5 text-sm text-gray-800 placeholder-gray-400 transition-all duration-150"
                style={{
                  background: 'white',
                  border: '1px solid #e5e7eb',
                  borderRadius: '8px',
                  outline: 'none',
                }}
                onFocus={(e) => {
                  e.currentTarget.style.borderColor = '#e8390e';
                  e.currentTarget.style.boxShadow = '0 0 0 3px rgba(232,57,14,0.1)';
                }}
                onBlur={(e) => {
                  e.currentTarget.style.borderColor = '#e5e7eb';
                  e.currentTarget.style.boxShadow = 'none';
                }}
                placeholder="colleague@example.com"
                required
              />
            </div>

            {status === 'success' && (
              <div className="rounded-lg px-3 py-2.5 text-sm font-medium flex items-center gap-2 text-green-700 bg-green-50 border border-green-200">
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
                  <path d="M22 11.08V12a10 10 0 1 1-5.93-9.14"/>
                  <polyline points="22 4 12 14.01 9 11.01"/>
                </svg>
                {message}
              </div>
            )}
            {status === 'error' && (
              <div className="rounded-lg px-3 py-2.5 text-sm font-medium flex items-center gap-2 text-red-700 bg-red-50 border border-red-200">
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
                  <circle cx="12" cy="12" r="10"/>
                  <line x1="12" y1="8" x2="12" y2="12"/>
                  <line x1="12" y1="16" x2="12.01" y2="16"/>
                </svg>
                {message}
              </div>
            )}

            <button
              type="submit"
              disabled={status === 'loading'}
              className="w-full py-2.5 rounded-lg text-sm font-bold text-white transition-all duration-150 disabled:opacity-50"
              style={{ background: '#e8390e' }}
              onMouseEnter={(e) => { if (status !== 'loading') e.currentTarget.style.background = '#c73009'; }}
              onMouseLeave={(e) => { e.currentTarget.style.background = '#e8390e'; }}
            >
              {status === 'loading' ? 'Inviting...' : 'Send Invite'}
            </button>
          </form>

          {status === 'success' && (
            <button
              onClick={onClose}
              className="w-full mt-3 py-2.5 rounded-lg text-sm font-semibold text-gray-600 border border-gray-200 bg-white transition-all duration-150 hover:border-gray-300 hover:text-gray-900"
            >
              Done
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
