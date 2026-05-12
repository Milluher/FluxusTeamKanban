'use client';
import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import Image from 'next/image';
import api from '@/lib/api';
import { avatarUrl } from '@/lib/avatar';
import { User } from '@/types';

interface AdminUser extends User {
  createdAt: string;
}

export default function AdminPage() {
  const router = useRouter();
  const [users, setUsers] = useState<AdminUser[]>([]);
  const [currentUser, setCurrentUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);
  const [resetModal, setResetModal] = useState<AdminUser | null>(null);
  const [newPassword, setNewPassword] = useState('');
  const [resetMsg, setResetMsg] = useState('');
  const [resetting, setResetting] = useState(false);

  useEffect(() => {
    const stored = localStorage.getItem('user');
    if (!stored) { router.push('/'); return; }
    const u = JSON.parse(stored);
    if (u.role !== 'admin') { router.push('/dashboard'); return; }
    setCurrentUser(u);
    api.get('/admin/users').then(({ data }) => setUsers(data)).finally(() => setLoading(false));
  }, []);

  const resetPassword = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!resetModal) return;
    setResetting(true);
    setResetMsg('');
    try {
      await api.post(`/admin/users/${resetModal.id}/reset-password`, { newPassword });
      setResetMsg('Password reset successfully');
      setNewPassword('');
    } catch (e: any) {
      setResetMsg(e.response?.data?.error || 'Failed');
    } finally { setResetting(false); }
  };

  if (loading) return (
    <div className="min-h-screen flex items-center justify-center bg-[#f7f8fa]">
      <p className="text-sm text-gray-400">Loading...</p>
    </div>
  );

  return (
    <div className="min-h-screen bg-[#f7f8fa]">
      <nav className="bg-white border-b border-gray-200 px-6 h-14 flex items-center justify-between sticky top-0 z-10">
        <div className="flex items-center gap-3">
          <Image src="/logo.png" width={26} height={26} alt="Fluxus" />
          <span className="font-bold text-sm" style={{ color: '#1a1f3c' }}>FluxusTeam</span>
          <span className="text-gray-300 text-sm">/</span>
          <span className="text-sm font-medium text-gray-600">Admin</span>
        </div>
        <div className="flex items-center gap-3">
          <button onClick={() => router.push('/dashboard')} className="text-sm text-gray-500 hover:text-gray-700">← Dashboard</button>
          <button onClick={() => { localStorage.clear(); router.push('/'); }} className="text-sm text-gray-500 hover:text-gray-700">Logout</button>
        </div>
      </nav>

      <main className="max-w-5xl mx-auto px-6 py-8">
        <h1 className="text-2xl font-bold mb-6" style={{ color: '#1a1f3c' }}>User Management</h1>

        <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
          <table className="w-full text-sm">
            <thead className="bg-gray-50 border-b border-gray-200">
              <tr>
                <th className="text-left px-5 py-3 font-semibold text-gray-600">User</th>
                <th className="text-left px-5 py-3 font-semibold text-gray-600">Email</th>
                <th className="text-left px-5 py-3 font-semibold text-gray-600">Role</th>
                <th className="text-left px-5 py-3 font-semibold text-gray-600">Joined</th>
                <th className="text-right px-5 py-3 font-semibold text-gray-600">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {users.map((u) => (
                <tr key={u.id} className="hover:bg-gray-50">
                  <td className="px-5 py-3">
                    <div className="flex items-center gap-3">
                      <img src={avatarUrl(u.name)} className="w-8 h-8 rounded-full" alt={u.name} />
                      <span className="font-medium text-gray-900">{u.name}</span>
                    </div>
                  </td>
                  <td className="px-5 py-3 text-gray-500">{u.email}</td>
                  <td className="px-5 py-3">
                    <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${u.role === 'admin' ? 'bg-orange-50 text-orange-600' : 'bg-gray-100 text-gray-600'}`}>
                      {u.role}
                    </span>
                  </td>
                  <td className="px-5 py-3 text-gray-500">{new Date(u.createdAt).toLocaleDateString()}</td>
                  <td className="px-5 py-3 text-right">
                    {u.id !== currentUser?.id && (
                      <button
                        onClick={() => { setResetModal(u); setResetMsg(''); setNewPassword(''); }}
                        className="text-xs text-gray-500 hover:text-gray-800 border border-gray-200 rounded px-2 py-1 hover:border-gray-400 transition-colors"
                      >
                        Reset Password
                      </button>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </main>

      {resetModal && (
        <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50 p-4" onClick={() => setResetModal(null)}>
          <div className="bg-white rounded-xl shadow-xl w-full max-w-sm p-6" onClick={e => e.stopPropagation()}>
            <div className="flex items-center justify-between mb-4">
              <h3 className="font-semibold" style={{ color: '#1a1f3c' }}>Reset Password</h3>
              <button onClick={() => setResetModal(null)} className="text-gray-400 text-xl">×</button>
            </div>
            <p className="text-sm text-gray-500 mb-4">Set a new password for <strong>{resetModal.name}</strong></p>
            <form onSubmit={resetPassword} className="space-y-3">
              <input
                type="text"
                placeholder="New password"
                value={newPassword}
                onChange={e => setNewPassword(e.target.value)}
                className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-orange-500"
                required
                minLength={6}
              />
              {resetMsg && <p className={`text-sm ${resetMsg.includes('success') ? 'text-green-600' : 'text-red-500'}`}>{resetMsg}</p>}
              <button
                type="submit"
                disabled={resetting}
                className="w-full py-2 rounded-lg text-sm font-semibold text-white disabled:opacity-50"
                style={{ background: '#e8390e' }}
              >
                {resetting ? 'Resetting...' : 'Reset Password'}
              </button>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
