'use client';
import { useEffect, useState } from 'react';
import { useRouter, useParams } from 'next/navigation';
import Image from 'next/image';
import api from '@/lib/api';

export default function InvitePage() {
  const params = useParams();
  const token = params.token as string;
  const router = useRouter();

  const [invite, setInvite] = useState<{ boardName: string; boardId: string } | null>(null);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(true);
  const [accepting, setAccepting] = useState(false);
  const [mode, setMode] = useState<'login' | 'register'>('register');
  const [form, setForm] = useState({ email: '', password: '', name: '' });
  const [authError, setAuthError] = useState('');

  useEffect(() => {
    api.get(`/invitations/${token}`)
      .then(({ data }) => setInvite(data))
      .catch((e) => setError(e.response?.data?.error || 'Invalid invitation'))
      .finally(() => setLoading(false));
  }, [token]);

  const handleAuth = async (e: React.FormEvent) => {
    e.preventDefault();
    setAuthError('');
    setAccepting(true);
    try {
      // Auth first
      const endpoint = mode === 'login' ? '/auth/login' : '/auth/register';
      const payload = mode === 'login' ? { email: form.email, password: form.password } : form;
      const { data: authData } = await api.post(endpoint, payload);
      localStorage.setItem('token', authData.token);
      localStorage.setItem('user', JSON.stringify(authData.user));

      // Accept invite
      const { data } = await api.post(`/invitations/${token}/accept`);
      router.push(`/board/${data.boardId}`);
    } catch (e: any) {
      setAuthError(e.response?.data?.error || 'Something went wrong');
    } finally { setAccepting(false); }
  };

  // If already logged in, just accept
  const acceptDirectly = async () => {
    setAccepting(true);
    try {
      const { data } = await api.post(`/invitations/${token}/accept`);
      router.push(`/board/${data.boardId}`);
    } catch (e: any) {
      setAuthError(e.response?.data?.error || 'Failed to join board');
      setAccepting(false);
    }
  };

  useEffect(() => {
    const storedToken = localStorage.getItem('token');
    if (storedToken && invite) acceptDirectly();
  }, [invite]);

  if (loading) return (
    <div className="min-h-screen flex items-center justify-center bg-[#f7f8fa]">
      <p className="text-gray-400 text-sm">Loading invitation...</p>
    </div>
  );

  if (error) return (
    <div className="min-h-screen flex items-center justify-center bg-[#f7f8fa]">
      <div className="text-center">
        <p className="text-red-500 font-medium">{error}</p>
        <button onClick={() => router.push('/')} className="mt-4 text-sm text-gray-500 hover:text-gray-700">Go to login</button>
      </div>
    </div>
  );

  return (
    <div className="min-h-screen flex items-center justify-center bg-[#f7f8fa] px-4 py-8">
      <div className="bg-white rounded-2xl border border-gray-200 shadow-sm w-full max-w-sm px-6 py-8 sm:px-8">
        <div className="flex items-center gap-2 mb-6">
          <Image src="/logo.png" width={32} height={32} alt="Fluxus" />
          <span className="font-bold text-lg" style={{ color: '#1a1f3c' }}>FluxusTeam</span>
        </div>

        <h2 className="text-xl font-bold mb-1" style={{ color: '#1a1f3c' }}>You're invited!</h2>
        <p className="text-sm text-gray-500 mb-6">Join <strong>{invite?.boardName}</strong> on FluxusTeam</p>

        <div className="flex rounded-lg overflow-hidden border border-gray-200 mb-5">
          {(['register', 'login'] as const).map((m) => (
            <button
              key={m}
              onClick={() => setMode(m)}
              className={`flex-1 py-2.5 min-h-[44px] text-sm font-medium transition-colors ${mode === m ? 'text-white' : 'text-gray-500 hover:bg-gray-50'}`}
              style={mode === m ? { background: '#1a1f3c' } : {}}
            >
              {m === 'register' ? 'Create Account' : 'Sign In'}
            </button>
          ))}
        </div>

        <form onSubmit={handleAuth} className="space-y-3">
          {mode === 'register' && (
            <input
              type="text"
              placeholder="Full name"
              value={form.name}
              onChange={e => setForm({ ...form, name: e.target.value })}
              className="w-full border border-gray-300 rounded-lg px-3 py-2.5 text-base sm:text-sm focus:outline-none focus:ring-2 focus:ring-orange-500"
              required
            />
          )}
          <input
            type="email"
            placeholder="Email"
            value={form.email}
            onChange={e => setForm({ ...form, email: e.target.value })}
            className="w-full border border-gray-300 rounded-lg px-3 py-2.5 text-base sm:text-sm focus:outline-none focus:ring-2 focus:ring-orange-500"
            required
          />
          <input
            type="password"
            placeholder="Password"
            value={form.password}
            onChange={e => setForm({ ...form, password: e.target.value })}
            className="w-full border border-gray-300 rounded-lg px-3 py-2.5 text-base sm:text-sm focus:outline-none focus:ring-2 focus:ring-orange-500"
            required
          />
          {authError && <p className="text-red-500 text-sm">{authError}</p>}
          <button
            type="submit"
            disabled={accepting}
            className="w-full py-3 sm:py-2.5 min-h-[44px] rounded-lg text-sm font-semibold text-white disabled:opacity-50"
            style={{ background: '#e8390e' }}
          >
            {accepting ? 'Joining...' : `Join ${invite?.boardName}`}
          </button>
        </form>
      </div>
    </div>
  );
}
