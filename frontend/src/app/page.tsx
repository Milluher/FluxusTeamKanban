'use client';
import { useState } from 'react';
import { useRouter } from 'next/navigation';
import Image from 'next/image';
import api from '@/lib/api';

export default function AuthPage() {
  const [mode, setMode] = useState<'login' | 'register'>('login');
  const [form, setForm] = useState({ email: '', password: '', name: '' });
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const [showForgotMsg, setShowForgotMsg] = useState(false);
  const router = useRouter();

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setLoading(true);
    try {
      const endpoint = mode === 'login' ? '/auth/login' : '/auth/register';
      const payload = mode === 'login'
        ? { email: form.email, password: form.password }
        : form;
      const { data } = await api.post(endpoint, payload);
      localStorage.setItem('user', JSON.stringify(data.user));
      router.push(data.user.mustChangePassword ? '/change-password' : '/dashboard');
    } catch (err: any) {
      setError(err.response?.data?.error || 'Something went wrong');
    } finally {
      setLoading(false);
    }
  };

  const inputBase = "w-full rounded-lg px-4 py-2.5 text-base sm:text-sm text-gray-900 placeholder-gray-400 outline-none border border-gray-200 bg-white transition-all duration-150";

  return (
    <div className="relative min-h-screen flex items-center justify-center px-4">
      {/* Background images — fixed so they always fill the viewport */}
      <Image
        src="/auth-bg-mobile.png"
        alt=""
        fill
        priority
        className="object-cover md:hidden"
        style={{ zIndex: -1 }}
      />
      <Image
        src="/auth-bg-desktop.png"
        alt=""
        fill
        priority
        className="object-cover hidden md:block"
        style={{ zIndex: -1 }}
      />
      <div className="w-full max-w-sm relative">

        {/* Card */}
        <div className="bg-white border border-gray-200 rounded-2xl shadow-sm p-8">

          {/* Logo + Brand */}
          <div className="flex items-center justify-center gap-2.5 mb-8">
            <Image src="/logo.png" width={40} height={40} alt="Fluxus" className="rounded-lg" />
            <span className="text-xl font-bold tracking-tight" style={{ color: '#1a1f3c' }}>FluxusTeam</span>
          </div>

          {/* Tab switcher — underline style */}
          <div className="flex border-b border-gray-200 mb-6">
            {(['login', 'register'] as const).map((m) => (
              <button
                key={m}
                onClick={() => { setMode(m); setError(''); }}
                className="flex-1 pb-2.5 text-sm font-semibold transition-all duration-150 relative"
                style={{
                  color: mode === m ? '#1a1f3c' : '#6b7280',
                }}
              >
                {m === 'login' ? 'Sign In' : 'Register'}
                {mode === m && (
                  <span
                    className="absolute bottom-0 left-0 right-0 h-0.5 rounded-full"
                    style={{ background: '#e8390e' }}
                  />
                )}
              </button>
            ))}
          </div>

          <form onSubmit={handleSubmit} className="space-y-4">
            {mode === 'register' && (
              <div>
                <label className="block text-xs font-semibold text-gray-500 mb-1.5">Full Name</label>
                <input
                  type="text"
                  value={form.name}
                  onChange={(e) => setForm({ ...form, name: e.target.value })}
                  className={inputBase}
                  onFocus={(e) => {
                    e.currentTarget.style.borderColor = '#e8390e';
                    e.currentTarget.style.boxShadow = '0 0 0 3px rgba(232,57,14,0.1)';
                  }}
                  onBlur={(e) => {
                    e.currentTarget.style.borderColor = '#e5e7eb';
                    e.currentTarget.style.boxShadow = 'none';
                  }}
                  placeholder="John Doe"
                  required
                />
              </div>
            )}

            <div>
              <label className="block text-xs font-semibold text-gray-500 mb-1.5">Email</label>
              <input
                type="email"
                value={form.email}
                onChange={(e) => setForm({ ...form, email: e.target.value })}
                className={inputBase}
                onFocus={(e) => {
                  e.currentTarget.style.borderColor = '#e8390e';
                  e.currentTarget.style.boxShadow = '0 0 0 3px rgba(232,57,14,0.1)';
                }}
                onBlur={(e) => {
                  e.currentTarget.style.borderColor = '#e5e7eb';
                  e.currentTarget.style.boxShadow = 'none';
                }}
                placeholder="you@example.com"
                required
              />
            </div>

            <div>
              <div className="flex items-center justify-between mb-1.5">
                <label className="block text-xs font-semibold text-gray-500">Password</label>
                {mode === 'login' && (
                  <button
                    type="button"
                    onClick={() => setShowForgotMsg((p) => !p)}
                    className="text-xs text-gray-400 hover:text-gray-600 transition-colors"
                  >
                    Forgot password?
                  </button>
                )}
              </div>
              <input
                type="password"
                value={form.password}
                onChange={(e) => setForm({ ...form, password: e.target.value })}
                className={inputBase}
                onFocus={(e) => {
                  e.currentTarget.style.borderColor = '#e8390e';
                  e.currentTarget.style.boxShadow = '0 0 0 3px rgba(232,57,14,0.1)';
                }}
                onBlur={(e) => {
                  e.currentTarget.style.borderColor = '#e5e7eb';
                  e.currentTarget.style.boxShadow = 'none';
                }}
                placeholder="••••••••"
                required
              />
            </div>

            {showForgotMsg && mode === 'login' && (
              <div className="rounded-lg px-4 py-3 text-sm text-gray-600 bg-gray-50 border border-gray-200">
                Contact Femi to reset your password.
              </div>
            )}

            {error && (
              <div className="rounded-lg px-4 py-3 text-sm font-medium text-red-700 bg-red-50 border border-red-200">
                {error}
              </div>
            )}

            <button
              type="submit"
              disabled={loading}
              className="w-full py-3 sm:py-2.5 min-h-[44px] rounded-lg text-sm font-bold text-white transition-all duration-150 mt-1"
              style={{
                background: loading ? '#f0a08a' : '#e8390e',
                opacity: loading ? 0.8 : 1,
              }}
              onMouseEnter={(e) => { if (!loading) e.currentTarget.style.background = '#c73009'; }}
              onMouseLeave={(e) => { if (!loading) e.currentTarget.style.background = '#e8390e'; }}
            >
              {loading ? 'Please wait...' : mode === 'login' ? 'Sign In' : 'Create Account'}
            </button>
          </form>

        </div>
      </div>
    </div>
  );
}
