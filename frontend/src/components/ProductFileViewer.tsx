'use client';
import { ProductFile } from '@/types';

const NAVY = '#1a1f3c';

// Turn a shareable Google Drive / Docs link into an embeddable /preview URL so it
// renders inside an iframe. Non-Google links are returned unchanged (the browser
// will embed them directly when allowed).
export function toEmbedUrl(raw: string): string {
  if (!raw) return raw;
  try {
    const url = new URL(raw);
    const host = url.hostname;

    // Google Docs editors: /document|spreadsheets|presentation/d/{id}/...
    const docsMatch = url.pathname.match(/^\/(document|spreadsheets|presentation)\/d\/([^/]+)/);
    if (host.includes('docs.google.com') && docsMatch) {
      return `https://docs.google.com/${docsMatch[1]}/d/${docsMatch[2]}/preview`;
    }

    // Drive files: /file/d/{id}/...
    const fileMatch = url.pathname.match(/^\/file\/d\/([^/]+)/);
    if (host.includes('drive.google.com') && fileMatch) {
      return `https://drive.google.com/file/d/${fileMatch[1]}/preview`;
    }

    // Drive open?id= / uc?id= forms
    const id = url.searchParams.get('id');
    if (host.includes('drive.google.com') && id) {
      return `https://drive.google.com/file/d/${id}/preview`;
    }

    return raw;
  } catch {
    return raw;
  }
}

interface Props {
  file: ProductFile;
  onClose: () => void;
}

// Full-screen modal that previews a product file link in-browser. Rendered above
// other modals (z-[60]) so it also works when opened from the ticket modal.
export default function ProductFileViewer({ file, onClose }: Props) {
  const embed = toEmbedUrl(file.url);
  return (
    <div
      className="fixed inset-0 bg-black/50 flex items-center justify-center z-[60] p-2 sm:p-6"
      onClick={onClose}
    >
      <div
        className="bg-white w-full max-w-5xl h-[92vh] sm:h-[88vh] rounded-xl shadow-2xl flex flex-col overflow-hidden"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-center gap-3 px-4 sm:px-5 py-3 border-b border-gray-200 flex-shrink-0">
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke={NAVY} strokeWidth="2" className="flex-shrink-0">
            <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" />
            <polyline points="14 2 14 8 20 8" />
          </svg>
          <h3 className="font-semibold text-sm truncate flex-1" style={{ color: NAVY }}>{file.title}</h3>
          <a
            href={file.url}
            target="_blank"
            rel="noreferrer"
            className="hidden sm:inline-flex items-center gap-1 text-xs font-semibold px-2.5 py-1.5 rounded-lg border transition-all duration-150"
            style={{ color: '#e8390e', borderColor: '#e8390e', background: 'white' }}
          >
            <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
              <path d="M18 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h6" />
              <polyline points="15 3 21 3 21 9" /><line x1="10" y1="14" x2="21" y2="3" />
            </svg>
            Open in new tab
          </a>
          <button
            onClick={onClose}
            className="w-8 h-8 flex items-center justify-center rounded-lg text-lg text-gray-400 bg-gray-100 transition-all duration-150 hover:bg-gray-200 hover:text-gray-700"
          >
            ×
          </button>
        </div>

        {/* Embedded preview */}
        <iframe
          src={embed}
          title={file.title}
          className="flex-1 w-full border-0 bg-gray-50"
          allow="autoplay"
          referrerPolicy="no-referrer"
        />
      </div>
    </div>
  );
}
