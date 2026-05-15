'use client';
import { useState, useEffect } from 'react';
import { useRouter, useParams } from 'next/navigation';
import Image from 'next/image';
import api from '@/lib/api';

export default function ResetPasswordPage() {
  const router = useRouter();
  const { token } = useParams();
  const [form, setForm] = useState({ newPassword: '', confirmPassword: '' });
  const [error, setError] = useState('');
  const [success, setSuccess] = useState(false);
  const [loading, setLoading] = useState(false);

  // If already logged in, log out first so they go through proper login after reset
  useEffect(() => {
    localStorage.removeItem('token');
    localStorage.removeItem('user');
  }, []);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    if (form.newPassword !== form.confirmPassword) {
      setError('Passwords do not match');
      return;
    }
    if (form.newPassword.length < 6) {
      setError('Password must be at least 6 characters');
      return;
    }
    setLoading(true);
    try {
      await api.post(`/auth/reset-password/${token}`, { newPassword: form.newPassword });
      setSuccess(true);
      setTimeout(() => router.push('/'), 3000);
    } catch (err: any) {
      setError(err.response?.data?.error || 'Something went wrong');
    } finally {
      setLoading(false);
    }
  };

  const inputBase = "w-full rounded-lg px-4 py-2.5 text-base sm:text-sm text-gray-900 placeholder-gray-400 outline-none border border-gray-200 bg-white transition-all duration-150";

  return (
    <div className="min-h-screen flex items-center justify-center bg-[#f7f8fa] px-4">
      <div className="w-full max-w-sm">
        <div className="bg-white border border-gray-200 rounded-2xl shadow-sm p-8">
          <div className="flex items-center justify-center gap-2.5 mb-6">
            <Image src="/logo.png" width={36} height={36} alt="Fluxus" className="rounded-lg" />
            <span className="text-lg font-bold tracking-tight" style={{ color: '#1a1f3c' }}>FluxusTeam</span>
          </div>

          {success ? (
            <div className="text-center">
              <div className="inline-flex items-center justify-center w-12 h-12 rounded-xl mb-3" style={{ background: '#ecfdf5' }}>
                <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="#34d399" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                  <polyline points="20 6 9 17 4 12"/>
                </svg>
              </div>
              <h2 className="text-base font-bold mb-2" style={{ color: '#1a1f3c' }}>Password updated</h2>
              <p className="text-sm text-gray-500">Redirecting you to sign in...</p>
            </div>
          ) : (
            <>
              <div className="mb-6 text-center">
                <h1 className="text-base font-bold" style={{ color: '#1a1f3c' }}>Set new password</h1>
                <p className="text-sm text-gray-500 mt-1">Choose a new password for your account.</p>
              </div>

              <form onSubmit={handleSubmit} className="space-y-4">
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
                  <label className="block text-xs font-semibold text-gray-500 mb-1.5">Confirm password</label>
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
                  <div className="rounded-lg px-4 py-3 text-sm font-medium text-red-700 bg-red-50 border border-red-200">{error}</div>
                )}
                <button
                  type="submit"
                  disabled={loading}
                  className="w-full py-3 sm:py-2.5 min-h-[44px] rounded-lg text-sm font-bold text-white transition-all duration-150"
                  style={{ background: loading ? '#f0a08a' : '#e8390e', opacity: loading ? 0.8 : 1 }}
                  onMouseEnter={(e) => { if (!loading) e.currentTarget.style.background = '#c73009'; }}
                  onMouseLeave={(e) => { if (!loading) e.currentTarget.style.background = '#e8390e'; }}
                >
                  {loading ? 'Saving...' : 'Set new password'}
                </button>
              </form>
            </>
          )}
        </div>
      </div>
    </div>
  );
}
