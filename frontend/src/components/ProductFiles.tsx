'use client';
import { useEffect, useState, useCallback } from 'react';
import api from '@/lib/api';
import socket from '@/lib/socket';
import { ProductFile } from '@/types';
import ProductFileViewer from './ProductFileViewer';

interface Props {
  boardId: string;
  isAdmin: boolean;
}

const ACCENT = '#e8390e';
const NAVY = '#1a1f3c';

type ModalState =
  | { kind: 'add' }
  | { kind: 'edit'; file: ProductFile }
  | { kind: 'delete'; file: ProductFile }
  | null;

export default function ProductFiles({ boardId, isAdmin }: Props) {
  const [files, setFiles] = useState<ProductFile[]>([]);
  const [loading, setLoading] = useState(true);
  const [collapsed, setCollapsed] = useState(false);
  const [viewing, setViewing] = useState<ProductFile | null>(null);

  const [modal, setModal] = useState<ModalState>(null);
  const [form, setForm] = useState({ title: '', url: '' });
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');

  const load = useCallback(async () => {
    try {
      const { data } = await api.get<ProductFile[]>(`/boards/${boardId}/product-files`);
      setFiles(data);
    } catch { /* board may have no access — leave empty */ }
    finally { setLoading(false); }
  }, [boardId]);

  useEffect(() => { load(); }, [load]);

  // Real-time: refetch when anyone changes this board's product files
  useEffect(() => {
    const onChanged = (payload: { boardId?: string }) => {
      if (payload?.boardId === boardId) load();
    };
    socket.on('product-files-changed', onChanged);
    return () => { socket.off('product-files-changed', onChanged); };
  }, [boardId, load]);

  const openModal = (m: ModalState) => {
    setError('');
    if (m?.kind === 'edit') setForm({ title: m.file.title, url: m.file.url });
    else setForm({ title: '', url: '' });
    setModal(m);
  };
  const closeModal = () => { if (!busy) { setModal(null); setError(''); } };

  const submitModal = async () => {
    if (!modal) return;
    setBusy(true);
    setError('');
    try {
      if (modal.kind === 'add') {
        const { data } = await api.post<ProductFile>(`/boards/${boardId}/product-files`, form);
        setFiles((prev) => [...prev, data]);
      } else if (modal.kind === 'edit') {
        const { data } = await api.patch<ProductFile>(`/boards/${boardId}/product-files/${modal.file.id}`, form);
        setFiles((prev) => prev.map((f) => (f.id === data.id ? data : f)));
      } else if (modal.kind === 'delete') {
        await api.delete(`/boards/${boardId}/product-files/${modal.file.id}`);
        setFiles((prev) => prev.filter((f) => f.id !== modal.file.id));
      }
      setModal(null);
    } catch (e: any) {
      setError(e.response?.data?.error || 'Something went wrong. Please try again.');
    } finally { setBusy(false); }
  };

  // Hide the section entirely for non-admins when there's nothing to show
  if (loading) return null;
  if (files.length === 0 && !isAdmin) return null;

  const isDelete = modal?.kind === 'delete';

  return (
    <div className="flex-shrink-0 bg-white border-b border-gray-200">
      {/* Header */}
      <div className="flex items-center gap-2 sm:gap-3 px-4 sm:px-6 py-2.5">
        <button
          onClick={() => setCollapsed((c) => !c)}
          className="flex items-center gap-1.5 text-sm font-bold transition-colors"
          style={{ color: NAVY }}
          aria-label={collapsed ? 'Expand product files' : 'Collapse product files'}
        >
          <svg
            width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"
            style={{ transform: collapsed ? 'rotate(-90deg)' : 'none', transition: 'transform 150ms' }}
          >
            <polyline points="6 9 12 15 18 9" />
          </svg>
          Product Files
          {files.length > 0 && (
            <span className="text-[10px] font-bold px-1.5 py-0.5 rounded-full text-gray-400 bg-gray-100">
              {files.length}
            </span>
          )}
        </button>

        {isAdmin && (
          <button
            onClick={() => openModal({ kind: 'add' })}
            className="flex items-center gap-1 text-xs font-semibold px-2.5 py-1.5 rounded-lg border transition-all duration-150 ml-auto flex-shrink-0"
            style={{ color: ACCENT, borderColor: ACCENT, background: 'white' }}
          >
            <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
              <line x1="12" y1="5" x2="12" y2="19" /><line x1="5" y1="12" x2="19" y2="12" />
            </svg>
            Add File
          </button>
        )}
      </div>

      {/* Body */}
      {!collapsed && (
        <div className="px-4 sm:px-6 pb-4">
          {files.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-6 text-center">
              <p className="text-sm font-semibold text-gray-500 mb-1">No product files yet</p>
              <p className="text-xs text-gray-400">
                {isAdmin
                  ? 'Add a Google Drive (or other) link so the team can read the product info.'
                  : 'An admin needs to add product files.'}
              </p>
            </div>
          ) : (
            <div className="grid gap-2 grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
              {files.map((file) => (
                <div
                  key={file.id}
                  className="group flex items-center gap-2.5 rounded-xl border border-gray-200 bg-[#fafbfc] px-3 py-2.5 transition-all hover:border-gray-300 hover:shadow-sm"
                >
                  <button
                    onClick={() => setViewing(file)}
                    className="flex items-center gap-2.5 flex-1 min-w-0 text-left"
                    title="Open in browser"
                  >
                    <span
                      className="w-8 h-8 rounded-lg flex items-center justify-center flex-shrink-0"
                      style={{ background: '#fff1ed' }}
                    >
                      <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke={ACCENT} strokeWidth="2">
                        <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" />
                        <polyline points="14 2 14 8 20 8" />
                      </svg>
                    </span>
                    <span className="text-sm font-semibold text-gray-700 truncate group-hover:text-gray-900">
                      {file.title}
                    </span>
                  </button>
                  {isAdmin && (
                    <div className="flex items-center gap-0.5 flex-shrink-0 opacity-0 group-hover:opacity-100 transition-all">
                      <button
                        onClick={() => openModal({ kind: 'edit', file })}
                        className="w-6 h-6 flex items-center justify-center rounded text-gray-300 hover:text-blue-500 hover:bg-blue-50 transition-all"
                        title="Edit"
                      >
                        <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                          <path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7" />
                          <path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z" />
                        </svg>
                      </button>
                      <button
                        onClick={() => openModal({ kind: 'delete', file })}
                        className="w-6 h-6 flex items-center justify-center rounded text-gray-300 hover:text-red-500 hover:bg-red-50 transition-all"
                        title="Remove"
                      >
                        <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
                          <line x1="18" y1="6" x2="6" y2="18" /><line x1="6" y1="6" x2="18" y2="18" />
                        </svg>
                      </button>
                    </div>
                  )}
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* In-browser file viewer */}
      {viewing && <ProductFileViewer file={viewing} onClose={() => setViewing(null)} />}

      {/* Add / Edit / Delete modal */}
      {modal && (
        <div className="fixed inset-0 bg-black/40 flex items-end sm:items-center justify-center z-50" onClick={closeModal}>
          <div className="bg-white w-full sm:max-w-sm rounded-t-2xl sm:rounded-xl shadow-xl p-6" onClick={(e) => e.stopPropagation()}>
            <div className="flex items-center justify-between mb-5">
              <h3 className="font-semibold text-base" style={{ color: NAVY }}>
                {modal.kind === 'add' ? 'Add Product File' : modal.kind === 'edit' ? 'Edit Product File' : 'Remove Product File'}
              </h3>
              <button onClick={closeModal} className="text-gray-400 text-xl w-8 h-8 flex items-center justify-center">×</button>
            </div>

            {isDelete ? (
              <>
                <p className="text-sm text-gray-600 mb-5">
                  Remove <span className="font-semibold">{(modal as { file: ProductFile }).file.title}</span>? Tickets that
                  reference it will keep working but lose the link.
                </p>
                {error && <p className="text-sm text-red-600 mb-3">{error}</p>}
                <div className="flex gap-2">
                  <button type="button" onClick={closeModal} disabled={busy} className="flex-1 py-2.5 min-h-[44px] rounded-lg text-sm font-medium text-gray-600 border border-gray-200 disabled:opacity-50">Cancel</button>
                  <button type="button" onClick={submitModal} disabled={busy} className="flex-1 py-2.5 min-h-[44px] rounded-lg text-sm font-bold text-white disabled:opacity-50" style={{ background: '#dc2626' }}>
                    {busy ? 'Removing...' : 'Remove'}
                  </button>
                </div>
              </>
            ) : (
              <form onSubmit={(e) => { e.preventDefault(); submitModal(); }} className="space-y-4">
                <div>
                  <label className="block text-xs font-semibold text-gray-500 mb-1.5">File Name <span className="text-red-500">*</span></label>
                  <input
                    autoFocus
                    type="text"
                    value={form.title}
                    onChange={(e) => setForm({ ...form, title: e.target.value })}
                    placeholder="e.g. Product Requirements Doc"
                    className="w-full px-3 py-2.5 text-sm rounded-lg border border-gray-200 outline-none"
                    style={{ color: '#111827' }}
                    onFocus={(e) => { e.currentTarget.style.borderColor = ACCENT; e.currentTarget.style.boxShadow = '0 0 0 3px rgba(232,57,14,0.1)'; }}
                    onBlur={(e) => { e.currentTarget.style.borderColor = '#e5e7eb'; e.currentTarget.style.boxShadow = 'none'; }}
                  />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-gray-500 mb-1.5">Link <span className="text-red-500">*</span></label>
                  <input
                    type="url"
                    value={form.url}
                    onChange={(e) => setForm({ ...form, url: e.target.value })}
                    placeholder="https://drive.google.com/file/d/…/view"
                    className="w-full px-3 py-2.5 text-sm rounded-lg border border-gray-200 outline-none"
                    style={{ color: '#111827' }}
                    onFocus={(e) => { e.currentTarget.style.borderColor = ACCENT; e.currentTarget.style.boxShadow = '0 0 0 3px rgba(232,57,14,0.1)'; }}
                    onBlur={(e) => { e.currentTarget.style.borderColor = '#e5e7eb'; e.currentTarget.style.boxShadow = 'none'; }}
                  />
                  <p className="text-xs text-gray-400 mt-1.5">Paste a shareable Google Drive link (set to “anyone with the link”) so it can open in the browser.</p>
                </div>
                {error && <p className="text-sm text-red-600">{error}</p>}
                <div className="flex gap-2">
                  <button type="button" onClick={closeModal} disabled={busy} className="flex-1 py-2.5 min-h-[44px] rounded-lg text-sm font-medium text-gray-600 border border-gray-200 disabled:opacity-50">Cancel</button>
                  <button type="submit" disabled={busy || !form.title.trim() || !form.url.trim()} className="flex-1 py-2.5 min-h-[44px] rounded-lg text-sm font-bold text-white disabled:opacity-50" style={{ background: ACCENT }}>
                    {busy ? 'Saving...' : 'Save'}
                  </button>
                </div>
              </form>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
