'use client';
import { useState } from 'react';
import api from '@/lib/api';
import { avatarUrl } from '@/lib/avatar';
import { User } from '@/types';

interface Props {
  user: User;
  onClose: () => void;
  onLogout: () => void;
}

export default function ProfileModal({ user, onClose, onLogout }: Props) {
  const [form, setForm] = useState({ currentPassword: '', newPassword: '', confirmPassword: '' });
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setMessage(null);
    if (form.newPassword !== form.confirmPassword) {
      setMessage({ type: 'error', text: 'New passwords do not match' });
      return;
    }
    setSaving(true);
    try {
      await api.patch('/auth/change-password', {
        currentPassword: form.currentPassword,
        newPassword: form.newPassword,
      });
      setMessage({ type: 'success', text: 'Password changed successfully' });
      setForm({ currentPassword: '', newPassword: '', confirmPassword: '' });
    } catch (err: any) {
      setMessage({ type: 'error', text: err.response?.data?.error || 'Failed to change password' });
    } finally {
      setSaving(false);
    }
  };

  return (
    <div
      className="fixed inset-0 bg-black/40 flex items-end sm:items-center justify-center z-50 p-0 sm:p-4"
      onClick={onClose}
    >
      <div
        className="bg-white w-full sm:max-w-md rounded-t-2xl sm:rounded-xl shadow-xl overflow-y-auto max-h-[92vh] sm:max-h-[90vh]"
        onClick={e => e.stopPropagation()}
      >
        {/* Header */}
        <div className="sticky top-0 bg-white z-10 flex items-center justify-between px-5 py-4 border-b border-gray-100">
          <h2 className="font-semibold text-base" style={{ color: '#1a1f3c' }}>My Profile</h2>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-600 text-2xl leading-none w-8 h-8 flex items-center justify-center">×</button>
        </div>

        <div className="px-5 py-5 space-y-6">
          {/* Avatar + Info */}
          <div className="flex items-center gap-4">
            <img
              src={avatarUrl(user.name)}
              alt={user.name}
              className="w-16 h-16 rounded-full flex-shrink-0"
            />
            <div>
              <p className="font-semibold text-base" style={{ color: '#1a1f3c' }}>{user.name}</p>
              <p className="text-sm text-gray-500">{user.email}</p>
              <span className={`mt-1 inline-block text-xs px-2 py-0.5 rounded-full font-medium ${user.role === 'admin' ? 'bg-orange-50 text-orange-600' : 'bg-gray-100 text-gray-500'}`}>
                {user.role}
              </span>
            </div>
          </div>

          {/* Divider */}
          <div className="border-t border-gray-100" />

          {/* Change Password */}
          <div>
            <h3 className="text-sm font-semibold text-gray-700 mb-4">Change Password</h3>
            <form onSubmit={handleSubmit} className="space-y-3">
              <div>
                <label className="block text-xs font-medium text-gray-500 mb-1">Current Password</label>
                <input
                  type="password"
                  value={form.currentPassword}
                  onChange={e => setForm({ ...form, currentPassword: e.target.value })}
                  className="w-full border border-gray-300 rounded-lg px-3 py-2.5 text-base sm:text-sm focus:outline-none focus:ring-2 focus:border-transparent"
                  style={{ '--tw-ring-color': '#e8390e' } as any}
                  onFocus={e => e.currentTarget.style.borderColor = '#e8390e'}
                  onBlur={e => e.currentTarget.style.borderColor = '#d1d5db'}
                  placeholder="Enter current password"
                  required
                />
              </div>
              <div>
                <label className="block text-xs font-medium text-gray-500 mb-1">New Password</label>
                <input
                  type="password"
                  value={form.newPassword}
                  onChange={e => setForm({ ...form, newPassword: e.target.value })}
                  className="w-full border border-gray-300 rounded-lg px-3 py-2.5 text-base sm:text-sm focus:outline-none"
                  onFocus={e => e.currentTarget.style.borderColor = '#e8390e'}
                  onBlur={e => e.currentTarget.style.borderColor = '#d1d5db'}
                  placeholder="At least 6 characters"
                  required
                  minLength={6}
                />
              </div>
              <div>
                <label className="block text-xs font-medium text-gray-500 mb-1">Confirm New Password</label>
                <input
                  type="password"
                  value={form.confirmPassword}
                  onChange={e => setForm({ ...form, confirmPassword: e.target.value })}
                  className="w-full border border-gray-300 rounded-lg px-3 py-2.5 text-base sm:text-sm focus:outline-none"
                  onFocus={e => e.currentTarget.style.borderColor = '#e8390e'}
                  onBlur={e => e.currentTarget.style.borderColor = '#d1d5db'}
                  placeholder="Repeat new password"
                  required
                />
              </div>

              {message && (
                <p className={`text-sm ${message.type === 'success' ? 'text-green-600' : 'text-red-500'}`}>
                  {message.text}
                </p>
              )}

              <button
                type="submit"
                disabled={saving}
                className="w-full py-2.5 min-h-[44px] rounded-lg text-sm font-semibold text-white transition-colors disabled:opacity-50"
                style={{ background: '#e8390e' }}
              >
                {saving ? 'Saving...' : 'Update Password'}
              </button>
            </form>
          </div>

          {/* Divider */}
          <div className="border-t border-gray-100" />

          {/* Logout */}
          <button
            onClick={onLogout}
            className="w-full py-2.5 min-h-[44px] rounded-lg text-sm font-medium text-gray-600 border border-gray-200 hover:border-gray-300 hover:text-gray-800 transition-colors"
          >
            Log out
          </button>
        </div>
      </div>
    </div>
  );
}
