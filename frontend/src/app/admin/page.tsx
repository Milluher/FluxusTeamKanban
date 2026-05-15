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
  const [linkModal, setLinkModal] = useState<AdminUser | null>(null);
  const [resetLink, setResetLink] = useState('');
  const [generatingLink, setGeneratingLink] = useState(false);
  const [linkMsg, setLinkMsg] = useState('');
  const [copied, setCopied] = useState(false);
  const [deleteConfirm, setDeleteConfirm] = useState<AdminUser | null>(null);
  const [deleting, setDeleting] = useState(false);
  const [deleteMsg, setDeleteMsg] = useState('');

  const isSuperAdmin = currentUser?.email === 'femi@fluxx.ng';

  useEffect(() => {
    const stored = localStorage.getItem('user');
    if (!stored) { router.push('/'); return; }
    const u = JSON.parse(stored);
    if (u.role !== 'admin') { router.push('/dashboard'); return; }
    setCurrentUser(u);
    api.get('/admin/users').then(({ data }) => setUsers(data)).finally(() => setLoading(false));
  }, []);

  const logout = () => {
    localStorage.removeItem('token');
    localStorage.removeItem('user');
    router.push('/');
  };

  const generateLink = async (user: AdminUser) => {
    setLinkModal(user);
    setResetLink('');
    setLinkMsg('');
    setCopied(false);
    setGeneratingLink(true);
    try {
      const { data } = await api.post(`/admin/users/${user.id}/reset-link`);
      setResetLink(data.link);
    } catch (e: any) {
      setLinkMsg(e.response?.data?.error || 'Failed to generate link');
    } finally {
      setGeneratingLink(false);
    }
  };

  const copyLink = async () => {
    if (!resetLink) return;
    await navigator.clipboard.writeText(resetLink);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const toggleRole = async (u: AdminUser) => {
    const newRole = u.role === 'admin' ? 'standard' : 'admin';
    try {
      const { data } = await api.patch(`/admin/users/${u.id}/role`, { role: newRole });
      setUsers((prev) => prev.map((x) => x.id === u.id ? { ...x, role: data.role } : x));
    } catch (e: any) {
      alert(e.response?.data?.error || 'Failed to update role');
    }
  };

  const deleteUser = async () => {
    if (!deleteConfirm) return;
    setDeleting(true);
    setDeleteMsg('');
    try {
      await api.delete(`/admin/users/${deleteConfirm.id}`);
      setUsers((prev) => prev.filter((u) => u.id !== deleteConfirm.id));
      setDeleteConfirm(null);
    } catch (e: any) {
      setDeleteMsg(e.response?.data?.error || 'Failed to delete user');
    } finally { setDeleting(false); }
  };

  if (loading) return (
    <div className="min-h-screen flex items-center justify-center bg-[#f7f8fa]">
      <p className="text-sm text-gray-400">Loading...</p>
    </div>
  );

  return (
    <div className="min-h-screen bg-[#f7f8fa]">
      <nav className="bg-white border-b border-gray-200 px-4 sm:px-6 h-14 flex items-center justify-between sticky top-0 z-10">
        <div className="flex items-center gap-2 sm:gap-3 min-w-0">
          <Image src="/logo.png" width={26} height={26} alt="Fluxus" />
          <span className="font-bold text-sm" style={{ color: '#1a1f3c' }}>FluxusTeam</span>
          <span className="text-gray-300 text-sm hidden sm:inline">/</span>
          <span className="text-sm font-medium text-gray-600 hidden sm:inline">Admin</span>
        </div>
        <div className="flex items-center gap-2 sm:gap-3">
          <button onClick={() => router.push('/dashboard')} className="text-sm text-gray-500 hover:text-gray-700 min-h-[44px] flex items-center">← <span className="hidden sm:inline ml-1">Dashboard</span></button>
          <button onClick={logout} className="text-sm text-gray-500 hover:text-gray-700 min-h-[44px] flex items-center">Logout</button>
        </div>
      </nav>

      <main className="max-w-5xl mx-auto px-4 sm:px-6 py-6 sm:py-8">
        <h1 className="text-xl sm:text-2xl font-bold mb-5 sm:mb-6" style={{ color: '#1a1f3c' }}>User Management</h1>

        {/* Mobile card list */}
        <div className="sm:hidden bg-white rounded-xl border border-gray-200 overflow-hidden divide-y divide-gray-100">
          {users.map((u) => (
            <div key={u.id} className="px-4 py-4 flex items-center justify-between gap-3">
              <div className="flex items-center gap-3 min-w-0">
                <img src={avatarUrl(u.name)} className="w-10 h-10 rounded-full flex-shrink-0" alt={u.name} />
                <div className="min-w-0">
                  <p className="font-medium text-sm text-gray-900 truncate">{u.name}</p>
                  <p className="text-xs text-gray-500 truncate">{u.email}</p>
                  <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${u.role === 'admin' ? 'bg-orange-50 text-orange-600' : 'bg-gray-100 text-gray-600'}`}>{u.role}</span>
                </div>
              </div>
              {u.id !== currentUser?.id && (
                <div className="flex flex-col gap-1.5 flex-shrink-0">
                  <button onClick={() => generateLink(u)} className="text-xs border border-gray-200 rounded-lg px-3 py-1.5 text-gray-600 min-h-[32px]">Reset pw</button>
                  {isSuperAdmin && u.email !== 'femi@fluxx.ng' && (
                    <button onClick={() => toggleRole(u)} className={`text-xs border rounded-lg px-3 py-1.5 min-h-[32px] ${u.role === 'admin' ? 'border-orange-200 text-orange-600' : 'border-blue-200 text-blue-600'}`}>
                      {u.role === 'admin' ? 'Revoke admin' : 'Make admin'}
                    </button>
                  )}
                  <button onClick={() => { setDeleteConfirm(u); setDeleteMsg(''); }} className="text-xs border border-red-200 rounded-lg px-3 py-1.5 text-red-500 min-h-[32px]">Delete</button>
                </div>
              )}
            </div>
          ))}
        </div>

        {/* Desktop table */}
        <div className="hidden sm:block bg-white rounded-xl border border-gray-200 overflow-hidden">
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
                    <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${u.role === 'admin' ? 'bg-orange-50 text-orange-600' : 'bg-gray-100 text-gray-600'}`}>{u.role}</span>
                  </td>
                  <td className="px-5 py-3 text-gray-500">{new Date(u.createdAt).toLocaleDateString()}</td>
                  <td className="px-5 py-3 text-right">
                    {u.id !== currentUser?.id && (
                      <div className="flex items-center justify-end gap-2">
                        <button onClick={() => generateLink(u)} className="text-xs text-gray-500 hover:text-gray-800 border border-gray-200 rounded px-2 py-1 hover:border-gray-400 transition-colors">
                          Reset Password
                        </button>
                        {isSuperAdmin && u.email !== 'femi@fluxx.ng' && (
                          <button onClick={() => toggleRole(u)} className={`text-xs border rounded px-2 py-1 transition-colors ${u.role === 'admin' ? 'border-orange-200 text-orange-500 hover:border-orange-400' : 'border-blue-200 text-blue-500 hover:border-blue-400'}`}>
                            {u.role === 'admin' ? 'Revoke Admin' : 'Make Admin'}
                          </button>
                        )}
                        <button onClick={() => { setDeleteConfirm(u); setDeleteMsg(''); }} className="text-xs text-red-500 hover:text-red-700 border border-red-200 rounded px-2 py-1 hover:border-red-400 transition-colors">
                          Delete
                        </button>
                      </div>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </main>

      {/* Reset Link Modal */}
      {linkModal && (
        <div className="fixed inset-0 bg-black/40 flex items-end sm:items-center justify-center z-50" onClick={() => setLinkModal(null)}>
          <div className="bg-white rounded-t-2xl sm:rounded-xl shadow-xl w-full sm:max-w-md p-6" onClick={e => e.stopPropagation()}>
            <div className="flex items-center justify-between mb-4">
              <h3 className="font-semibold" style={{ color: '#1a1f3c' }}>Password Reset Link</h3>
              <button onClick={() => setLinkModal(null)} className="text-gray-400 text-xl w-8 h-8 flex items-center justify-center">×</button>
            </div>
            <p className="text-sm text-gray-500 mb-4">Share this link with <strong>{linkModal.name}</strong>. It expires in 24 hours.</p>
            {generatingLink && <p className="text-sm text-gray-400">Generating link...</p>}
            {linkMsg && <p className="text-sm text-red-500">{linkMsg}</p>}
            {resetLink && (
              <div className="space-y-3">
                <div className="bg-gray-50 border border-gray-200 rounded-lg px-3 py-2.5 text-xs text-gray-600 break-all font-mono">
                  {resetLink}
                </div>
                <button
                  onClick={copyLink}
                  className="w-full py-2.5 min-h-[44px] rounded-lg text-sm font-semibold text-white transition-colors"
                  style={{ background: copied ? '#34d399' : '#e8390e' }}
                >
                  {copied ? 'Copied!' : 'Copy Link'}
                </button>
              </div>
            )}
          </div>
        </div>
      )}

      {/* Delete Confirmation Modal */}
      {deleteConfirm && (
        <div className="fixed inset-0 bg-black/40 flex items-end sm:items-center justify-center z-50" onClick={() => setDeleteConfirm(null)}>
          <div className="bg-white rounded-t-2xl sm:rounded-xl shadow-xl w-full sm:max-w-sm p-6" onClick={e => e.stopPropagation()}>
            <div className="flex items-center justify-between mb-4">
              <h3 className="font-semibold text-red-600">Delete User</h3>
              <button onClick={() => setDeleteConfirm(null)} className="text-gray-400 text-xl w-8 h-8 flex items-center justify-center">×</button>
            </div>
            <div className="flex items-center gap-3 mb-4 p-3 bg-gray-50 rounded-lg">
              <img src={avatarUrl(deleteConfirm.name)} className="w-10 h-10 rounded-full flex-shrink-0" alt={deleteConfirm.name} />
              <div>
                <p className="font-medium text-sm text-gray-900">{deleteConfirm.name}</p>
                <p className="text-xs text-gray-500">{deleteConfirm.email}</p>
              </div>
            </div>
            <p className="text-sm text-gray-600 mb-1">This will permanently remove <strong>{deleteConfirm.name}</strong> from the workspace.</p>
            <p className="text-xs text-gray-400 mb-5">Their ticket history will be preserved. Board memberships and comments will be removed.</p>
            {deleteMsg && <p className="text-sm text-red-500 mb-3">{deleteMsg}</p>}
            <div className="flex gap-2">
              <button onClick={() => setDeleteConfirm(null)} className="flex-1 py-2.5 min-h-[44px] rounded-lg text-sm font-medium text-gray-600 border border-gray-200">Cancel</button>
              <button onClick={deleteUser} disabled={deleting} className="flex-1 py-2.5 min-h-[44px] rounded-lg text-sm font-semibold text-white bg-red-500 hover:bg-red-600 transition-colors disabled:opacity-50">
                {deleting ? 'Deleting...' : 'Delete User'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
