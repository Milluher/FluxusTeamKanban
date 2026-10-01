'use client';
import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import api from '@/lib/api';
import { avatarUrl } from '@/lib/avatar';
import { User } from '@/types';
import AppHeader from '@/components/AppHeader';
import ConfirmByName from '@/components/ConfirmByName';
import RowMenu from '@/components/RowMenu';
import { formatDay } from '@/lib/formatDate';

interface AdminUser extends User {
  createdAt: string;
}

const OWNER_EMAIL = 'femi@fluxx.ng';
const ROLES = ['standard', 'admin'] as const;

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
  const [savingRoleId, setSavingRoleId] = useState<string | null>(null);
  const [roleMsg, setRoleMsg] = useState('');

  // The workspace owner. Checked in one place rather than by repeating the email
  // comparison at every call site.
  const isOwner = (u: Pick<User, 'email'>) => u.email === OWNER_EMAIL;
  const isSuperAdmin = Boolean(currentUser && isOwner(currentUser));

  useEffect(() => {
    const stored = localStorage.getItem('user');
    if (!stored) { router.push('/'); return; }
    const u = JSON.parse(stored);
    if (u.role !== 'admin') { router.push('/dashboard'); return; }
    setCurrentUser(u);
    api.get('/admin/users').then(({ data }) => setUsers(data)).finally(() => setLoading(false));
  }, []);

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

  const setRole = async (u: AdminUser, role: string) => {
    if (role === u.role) return;
    setRoleMsg('');
    setSavingRoleId(u.id);
    try {
      const { data } = await api.patch(`/admin/users/${u.id}/role`, { role });
      setUsers((prev) => prev.map((x) => x.id === u.id ? { ...x, role: data.role } : x));
    } catch (e: any) {
      setRoleMsg(e.response?.data?.error || `Failed to update ${u.name}'s role`);
    } finally {
      setSavingRoleId(null);
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
      <p className="text-sm text-gray-500">Loading...</p>
    </div>
  );

  return (
    <div className="min-h-screen bg-[#f7f8fa]">
      <AppHeader user={currentUser} current="admin" />

      <main className="max-w-5xl mx-auto px-4 sm:px-6 py-6 sm:py-8">
        <h1 className="text-xl sm:text-2xl font-bold mb-5 sm:mb-6" style={{ color: '#1a1f3c' }}>User Management</h1>

        {roleMsg && (
          <p role="alert" className="text-sm text-red-700 mb-4">{roleMsg}</p>
        )}

        {/* Mobile card list */}
        <div className="sm:hidden bg-white rounded-xl border border-gray-200 overflow-hidden divide-y divide-gray-100">
          {users.map((u) => (
            <div key={u.id} className="px-4 py-4 flex items-center justify-between gap-3">
              <div className="flex items-center gap-3 min-w-0">
                <img src={avatarUrl(u.name)} className="w-10 h-10 rounded-full flex-shrink-0" alt={u.name} />
                <div className="min-w-0">
                  <p className="font-medium text-sm text-gray-900 truncate">{u.name}</p>
                  <p className="text-xs text-gray-500 truncate">{u.email}</p>
                  <span className={`text-xs px-2 py-0.5 rounded-full font-medium whitespace-nowrap ${u.role === 'admin' ? 'bg-orange-50 text-orange-700' : 'bg-gray-100 text-gray-600'}`}>
                    {isOwner(u) ? 'super-admin' : u.role}
                  </span>
                  <p className="text-xs text-gray-600 mt-1">Joined {formatDay(u.createdAt)}</p>
                </div>
              </div>
              {isOwner(u) ? (
                <span className="text-xs px-2.5 py-1 rounded-full font-semibold whitespace-nowrap" style={{ background: '#fff7f5', color: '#c73009', border: '1px solid #fbd5c8' }}>Owner</span>
              ) : u.id !== currentUser?.id && (
                <div className="flex items-center gap-1.5 flex-shrink-0">
                  {isSuperAdmin && (
                    <select
                      value={u.role}
                      onChange={(e) => setRole(u, e.target.value)}
                      disabled={savingRoleId === u.id}
                      aria-label={`Role for ${u.name}`}
                      className="text-xs font-medium rounded-lg border border-gray-200 px-2 py-1.5 min-h-[32px] bg-white text-gray-700 outline-none disabled:opacity-50"
                    >
                      {ROLES.map((r) => <option key={r} value={r}>{r}</option>)}
                    </select>
                  )}
                  <RowMenu
                    label={`Actions for ${u.name}`}
                    items={[
                      { label: 'Reset password', onSelect: () => generateLink(u) },
                      { label: 'Delete user', destructive: true, onSelect: () => { setDeleteConfirm(u); setDeleteMsg(''); } },
                    ]}
                  />
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
                    {/* The owner's role is fixed, and nobody edits their own. */}
                    {isOwner(u) || u.id === currentUser?.id || !isSuperAdmin ? (
                      <span className={`text-xs px-2 py-0.5 rounded-full font-medium whitespace-nowrap ${isOwner(u) || u.role === 'admin' ? 'bg-orange-50 text-orange-700' : 'bg-gray-100 text-gray-600'}`}>
                        {isOwner(u) ? 'super-admin' : u.role}
                      </span>
                    ) : (
                      <select
                        value={u.role}
                        onChange={(e) => setRole(u, e.target.value)}
                        disabled={savingRoleId === u.id}
                        aria-label={`Role for ${u.name}`}
                        className="text-xs font-medium rounded-lg border border-gray-200 px-2 py-1 bg-white text-gray-700 outline-none disabled:opacity-50"
                      >
                        {ROLES.map((r) => <option key={r} value={r}>{r}</option>)}
                      </select>
                    )}
                  </td>
                  <td className="px-5 py-3 text-gray-600 whitespace-nowrap">{formatDay(u.createdAt)}</td>
                  <td className="px-5 py-3 text-right">
                    {isOwner(u) ? (
                      <span className="text-xs px-2.5 py-1 rounded-full font-semibold whitespace-nowrap" style={{ background: '#fff7f5', color: '#c73009', border: '1px solid #fbd5c8' }}>Owner</span>
                    ) : u.id !== currentUser?.id && (
                      <div className="flex items-center justify-end">
                        <RowMenu
                          label={`Actions for ${u.name}`}
                          items={[
                            { label: 'Reset password', onSelect: () => generateLink(u) },
                            { label: 'Delete user', destructive: true, onSelect: () => { setDeleteConfirm(u); setDeleteMsg(''); } },
                          ]}
                        />
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
              <button onClick={() => setLinkModal(null)} aria-label="Close password reset link" className="text-gray-500 text-xl w-8 h-8 flex items-center justify-center">×</button>
            </div>
            <p className="text-sm text-gray-500 mb-4">Share this link with <strong>{linkModal.name}</strong>. It expires in 24 hours.</p>
            {generatingLink && <p className="text-sm text-gray-500">Generating link...</p>}
            {linkMsg && <p className="text-sm text-red-700">{linkMsg}</p>}
            {resetLink && (
              <div className="space-y-3">
                <div className="bg-gray-50 border border-gray-200 rounded-lg px-3 py-2.5 text-xs text-gray-600 break-all font-mono">
                  {resetLink}
                </div>
                <button
                  onClick={copyLink}
                  className="w-full py-2.5 min-h-[44px] rounded-lg text-sm font-semibold text-white transition-colors"
                  style={{ background: copied ? '#34d399' : '#c73009' }}
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
        <ConfirmByName
          title="Delete user"
          name={deleteConfirm.name}
          description={
            <>
              <span className="flex items-center gap-3 mb-3 p-3 bg-gray-50 rounded-lg">
                <img src={avatarUrl(deleteConfirm.name)} className="w-10 h-10 rounded-full flex-shrink-0" alt="" />
                <span className="block min-w-0">
                  <span className="block font-medium text-sm text-gray-900 truncate">{deleteConfirm.name}</span>
                  <span className="block text-xs text-gray-600 truncate">{deleteConfirm.email}</span>
                </span>
              </span>
              This permanently removes <strong>{deleteConfirm.name}</strong> from the workspace, along
              with their board memberships and comments. Their ticket history is kept. It cannot be undone.
            </>
          }
          confirmLabel="Delete user"
          busy={deleting}
          error={deleteMsg || null}
          onCancel={() => { setDeleteConfirm(null); setDeleteMsg(''); }}
          onConfirm={deleteUser}
        />
      )}
    </div>
  );
}
