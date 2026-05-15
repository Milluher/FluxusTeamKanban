'use client';
import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import Image from 'next/image';
import api from '@/lib/api';

export default function ForceChangePasswordPage() {
  const router = useRouter();
  const [form, setForm] = useState({ currentPassword: '', newPassword: '', confirmPassword: '' });
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    const stored = localStorage.getItem('user');
    if (!stored) { router.push('/'); return; }
    const u = JSON.parse(stored);
    // If they don't need to change password, send them to dashboard
    if (!u.mustChangePassword) { router.push('/dashboard'); }
  }, []);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    if (form.newPassword !== form.confirmPassword) {
      setError('New passwords do not match');
      return;
    }
    if (form.newPassword.length < 6) {
      setError('Password must be at least 6 characters');
      return;
    }
    setLoading(true);
    try {
      await api.patch('/auth/change-password', {
        currentPassword: form.currentPassword,
        newPassword: form.newPassword,
      });
      // Clear the flag in localStorage
      const stored = localStorage.getItem('user');
      if (stored) {
        const u = JSON.parse(stored);
        localStorage.setItem('user', JSON.stringify({ ...u, mustChangePassword: false }));
      }
      router.push('/dashboard');
    } catch (err: any) {
      setError(err.response?.data?.error || 'Something went wrong');
    } finally {
      setLoading(false);
    }
  };

  const inputBase = "w-full rounded-lg px-4 py-2.5 text-base sm:text-sm text-gray-900 placeholder-gray-400 outline-none border border-gray-200 bg-white transition-all duration-150";

  return (
    <div className="auth-page min-h-screen flex items-center justify-center px-4">
      <style>{`
        .auth-page {
          background-image: url(/auth-bg-mobile.png);
          background-size: cover;
          background-position: center;
          background-repeat: no-repeat;
        }
        @media (min-width: 768px) {
          .auth-page { background-image: url(/auth-bg-desktop.png); }
        }
      `}</style>
      <div className="w-full max-w-sm">

        {/* Card */}
        <div className="bg-white border border-gray-200 rounded-2xl shadow-sm p-8">

          {/* Logo */}
          <div className="flex items-center justify-center gap-2.5 mb-6">
            <Image src="/logo.png" width={36} height={36} alt="Fluxus" className="rounded-lg" />
            <span className="text-lg font-bold tracking-tight" style={{ color: '#1a1f3c' }}>FluxusTeam</span>
          </div>

          {/* Heading */}
          <div className="mb-6 text-center">
            <div className="inline-flex items-center justify-center w-12 h-12 rounded-xl mb-3" style={{ background: '#fff7f5' }}>
              <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="#e8390e" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <rect x="3" y="11" width="18" height="11" rx="2" ry="2"/>
                <path d="M7 11V7a5 5 0 0 1 10 0v4"/>
              </svg>
            </div>
            <h1 className="text-base font-bold" style={{ color: '#1a1f3c' }}>Set a new password</h1>
            <p className="text-sm text-gray-500 mt-1">Your password was reset by an admin. Please set a new one to continue.</p>
          </div>

          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <label className="block text-xs font-semibold text-gray-500 mb-1.5">Temporary password</label>
              <input
                type="password"
                value={form.currentPassword}
                onChange={(e) => setForm({ ...form, currentPassword: e.target.value })}
                className={inputBase}
                onFocus={(e) => { e.currentTarget.style.borderColor = '#e8390e'; e.currentTarget.style.boxShadow = '0 0 0 3px rgba(232,57,14,0.1)'; }}
                onBlur={(e) => { e.currentTarget.style.borderColor = '#e5e7eb'; e.currentTarget.style.boxShadow = 'none'; }}
                placeholder="Enter the password from admin"
                required
              />
            </div>

            <div>
              <label className="block text-xs font-semibold text-gray-500 mb-1.5">New password</label>
              <input
                type="password"
                value={form.newPassword}
                onChange={(e) => setForm({ ...form, newPassword: e.target.value })}
                className={inputBase}
                onFocus={(e) => { e.currentTarget.style.borderColor = '#e8390e'; e.currentTarget.style.boxShadow = '0 0 0 3px rgba(232,57,14,0.1)'; }}
                onBlur={(e) => { e.currentTarget.style.borderColor = '#e5e7eb'; e.currentTarget.style.boxShadow = 'none'; }}
                placeholder="At least 6 characters"
                required
                minLength={6}
              />
            </div>

            <div>
              <label className="block text-xs font-semibold text-gray-500 mb-1.5">Confirm new password</label>
              <input
                type="password"
                value={form.confirmPassword}
                onChange={(e) => setForm({ ...form, confirmPassword: e.target.value })}
                className={inputBase}
                onFocus={(e) => { e.currentTarget.style.borderColor = '#e8390e'; e.currentTarget.style.boxShadow = '0 0 0 3px rgba(232,57,14,0.1)'; }}
                onBlur={(e) => { e.currentTarget.style.borderColor = '#e5e7eb'; e.currentTarget.style.boxShadow = 'none'; }}
                placeholder="Repeat new password"
                required
              />
            </div>

            {error && (
              <div className="rounded-lg px-4 py-3 text-sm font-medium text-red-700 bg-red-50 border border-red-200">
                {error}
              </div>
            )}

            <button
              type="submit"
              disabled={loading}
              className="w-full py-3 sm:py-2.5 min-h-[44px] rounded-lg text-sm font-bold text-white transition-all duration-150 mt-1"
              style={{ background: loading ? '#f0a08a' : '#e8390e', opacity: loading ? 0.8 : 1 }}
              onMouseEnter={(e) => { if (!loading) e.currentTarget.style.background = '#c73009'; }}
              onMouseLeave={(e) => { if (!loading) e.currentTarget.style.background = '#e8390e'; }}
            >
              {loading ? 'Saving...' : 'Set new password'}
            </button>
          </form>
        </div>
      </div>
    </div>
  );
}
