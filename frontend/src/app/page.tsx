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
    <div className="min-h-screen flex items-center justify-center bg-[#f7f8fa] px-4">
      <div className="w-full max-w-sm">

        {/* Illustration */}
        <div className="flex justify-center mb-6">
          <svg width="280" height="148" viewBox="0 0 280 148" fill="none" aria-hidden="true">
            {/* Background subtle glow */}
            <ellipse cx="140" cy="120" rx="110" ry="20" fill="#e8390e" fillOpacity="0.04"/>

            {/* ── Left figure ── */}
            {/* Body */}
            <path d="M28 118 Q28 96 44 96 Q60 96 60 118" fill="#1a1f3c" fillOpacity="0.08"/>
            {/* Torso */}
            <rect x="34" y="96" width="20" height="22" rx="6" fill="#1a1f3c" fillOpacity="0.13"/>
            {/* Head */}
            <circle cx="44" cy="86" r="10" fill="#1a1f3c" fillOpacity="0.18"/>
            {/* Face highlight */}
            <circle cx="41" cy="85" r="2.5" fill="white" fillOpacity="0.5"/>
            {/* Left arm reaching toward board */}
            <path d="M54 102 Q68 98 76 95" stroke="#1a1f3c" strokeOpacity="0.2" strokeWidth="3.5" strokeLinecap="round"/>
            {/* Floating card from left figure */}
            <rect x="18" y="62" width="32" height="18" rx="5" fill="white" stroke="#e5e7eb" strokeWidth="1.2"/>
            <rect x="24" y="67" width="18" height="3" rx="1.5" fill="#d1d5db"/>
            <rect x="24" y="72" width="12" height="3" rx="1.5" fill="#e8390e" fillOpacity="0.4"/>
            {/* Dotted line from card to board */}
            <line x1="50" y1="71" x2="76" y2="71" stroke="#e8390e" strokeOpacity="0.25" strokeWidth="1.2" strokeDasharray="3 3"/>

            {/* ── Kanban board (center) ── */}
            {/* Board shadow */}
            <rect x="78" y="22" width="124" height="106" rx="12" fill="#1a1f3c" fillOpacity="0.06"/>
            {/* Board background */}
            <rect x="76" y="20" width="124" height="106" rx="12" fill="white" stroke="#e5e7eb" strokeWidth="1.5"/>
            {/* Board top bar */}
            <rect x="76" y="20" width="124" height="16" rx="12" fill="#1a1f3c" fillOpacity="0.04"/>
            <rect x="76" y="28" width="124" height="8" fill="#1a1f3c" fillOpacity="0.04"/>
            {/* Top bar dots */}
            <circle cx="89" cy="28" r="3" fill="#e8390e" fillOpacity="0.5"/>
            <circle cx="99" cy="28" r="3" fill="#f59e0b" fillOpacity="0.5"/>
            <circle cx="109" cy="28" r="3" fill="#34d399" fillOpacity="0.5"/>

            {/* Column 1 — Backlog */}
            <rect x="84" y="44" width="34" height="74" rx="7" fill="#f8fafc" stroke="#e5e7eb" strokeWidth="1"/>
            <rect x="90" y="50" width="22" height="3.5" rx="1.5" fill="#94a3b8"/>
            <rect x="90" y="58" width="22" height="12" rx="4" fill="white" stroke="#e5e7eb" strokeWidth="1"/>
            <rect x="93" y="61" width="12" height="2.5" rx="1" fill="#cbd5e1"/>
            <rect x="93" y="65" width="8" height="2.5" rx="1" fill="#e2e8f0"/>
            <rect x="90" y="74" width="22" height="12" rx="4" fill="white" stroke="#e5e7eb" strokeWidth="1"/>
            <rect x="93" y="77" width="14" height="2.5" rx="1" fill="#cbd5e1"/>
            <rect x="93" y="81" width="10" height="2.5" rx="1" fill="#e2e8f0"/>
            <rect x="90" y="90" width="16" height="12" rx="4" fill="white" stroke="#e5e7eb" strokeWidth="1"/>
            <rect x="93" y="93" width="8" height="2.5" rx="1" fill="#e2e8f0"/>
            <rect x="93" y="97" width="6" height="2.5" rx="1" fill="#e2e8f0"/>

            {/* Column 2 — In Progress (highlighted, orange accent) */}
            <rect x="123" y="44" width="34" height="74" rx="7" fill="#fff8f6" stroke="#e8390e" strokeWidth="1.2" strokeOpacity="0.4"/>
            <rect x="129" y="50" width="22" height="3.5" rx="1.5" fill="#e8390e" fillOpacity="0.55"/>
            {/* Active card — elevated */}
            <rect x="126" y="56" width="28" height="15" rx="5" fill="white" stroke="#e8390e" strokeWidth="1.2" strokeOpacity="0.5"/>
            <rect x="126" y="55" width="28" height="15" rx="5" fill="white"/>
            <rect x="126" y="55" width="4" height="15" rx="3" fill="#e8390e" fillOpacity="0.75"/>
            <rect x="133" y="58" width="16" height="2.5" rx="1" fill="#1a1f3c" fillOpacity="0.3"/>
            <rect x="133" y="63" width="10" height="2.5" rx="1" fill="#e8390e" fillOpacity="0.35"/>
            {/* Small avatar dot on active card */}
            <circle cx="148" cy="66" r="3" fill="#e8390e" fillOpacity="0.4"/>
            <rect x="129" y="74" width="22" height="12" rx="4" fill="white" stroke="#e5e7eb" strokeWidth="1"/>
            <rect x="132" y="77" width="12" height="2.5" rx="1" fill="#cbd5e1"/>
            <rect x="132" y="81" width="8" height="2.5" rx="1" fill="#e2e8f0"/>
            <rect x="129" y="90" width="22" height="12" rx="4" fill="white" stroke="#e5e7eb" strokeWidth="1"/>
            <rect x="132" y="93" width="16" height="2.5" rx="1" fill="#cbd5e1"/>
            <rect x="132" y="97" width="10" height="2.5" rx="1" fill="#e2e8f0"/>

            {/* Column 3 — Done (green accent) */}
            <rect x="162" y="44" width="34" height="74" rx="7" fill="#f0fdf9" stroke="#34d399" strokeWidth="1" strokeOpacity="0.4"/>
            <rect x="168" y="50" width="22" height="3.5" rx="1.5" fill="#34d399" fillOpacity="0.6"/>
            <rect x="168" y="58" width="22" height="12" rx="4" fill="white" stroke="#34d399" strokeWidth="1" strokeOpacity="0.4"/>
            {/* Checkmark on done card */}
            <path d="M173 64 L175.5 66.5 L180 62" stroke="#34d399" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
            <rect x="168" y="74" width="22" height="12" rx="4" fill="white" stroke="#34d399" strokeWidth="1" strokeOpacity="0.4"/>
            <path d="M173 80 L175.5 82.5 L180 78" stroke="#34d399" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
            <rect x="168" y="90" width="14" height="12" rx="4" fill="white" stroke="#e5e7eb" strokeWidth="1"/>
            <rect x="171" y="93" width="6" height="2.5" rx="1" fill="#e2e8f0"/>

            {/* ── Right figure ── */}
            {/* Body */}
            <path d="M220 118 Q220 96 236 96 Q252 96 252 118" fill="#e8390e" fillOpacity="0.1"/>
            {/* Torso */}
            <rect x="226" y="96" width="20" height="22" rx="6" fill="#e8390e" fillOpacity="0.15"/>
            {/* Head */}
            <circle cx="236" cy="86" r="10" fill="#e8390e" fillOpacity="0.22"/>
            {/* Face highlight */}
            <circle cx="233" cy="85" r="2.5" fill="white" fillOpacity="0.6"/>
            {/* Right arm reaching toward board */}
            <path d="M226 102 Q212 98 204 95" stroke="#e8390e" strokeOpacity="0.2" strokeWidth="3.5" strokeLinecap="round"/>
            {/* Floating card from right figure */}
            <rect x="230" y="55" width="36" height="18" rx="5" fill="white" stroke="#34d399" strokeWidth="1.2" strokeOpacity="0.6"/>
            <rect x="236" y="60" width="18" height="2.5" rx="1" fill="#34d399" fillOpacity="0.5"/>
            <path d="M237 65 L239 67.5 L244 63" stroke="#34d399" strokeWidth="1.4" strokeLinecap="round" strokeLinejoin="round"/>
            {/* Dotted line from board to right card */}
            <line x1="200" y1="65" x2="228" y2="64" stroke="#34d399" strokeOpacity="0.3" strokeWidth="1.2" strokeDasharray="3 3"/>

            {/* Floating spark / confetti accents */}
            <circle cx="140" cy="14" r="3" fill="#e8390e" fillOpacity="0.35"/>
            <circle cx="155" cy="10" r="2" fill="#34d399" fillOpacity="0.4"/>
            <circle cx="125" cy="12" r="2" fill="#1a1f3c" fillOpacity="0.15"/>
            <circle cx="67" cy="44" r="2" fill="#e8390e" fillOpacity="0.2"/>
            <circle cx="213" cy="42" r="2" fill="#34d399" fillOpacity="0.25"/>
          </svg>
        </div>

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
