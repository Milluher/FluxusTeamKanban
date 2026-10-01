'use client';
import { useEffect, useState } from 'react';
import BoardCanvas from './BoardCanvas';
import ProductFiles from './ProductFiles';

interface Props {
  boardId: string;
  isAdmin: boolean;
}

// Project Overview and Product Files took around 420px between them even with
// nothing in either, which pushed the first row of tickets to the bottom of a
// laptop screen. When both are empty they fold into one slim row instead, so the
// board is the first thing you see.
//
// Both sections stay mounted either way: each fetches its own data and reports
// its count back, which is how this knows whether there is anything to show.
export default function BoardInfo({ boardId, isAdmin }: Props) {
  const [overviewCount, setOverviewCount] = useState<number | null>(null);
  const [filesCount, setFilesCount] = useState<number | null>(null);
  const [expanded, setExpanded] = useState(false);

  const storageKey = `fluxus:boardInfoExpanded:${boardId}`;

  useEffect(() => {
    try {
      const saved = localStorage.getItem(storageKey);
      if (saved === '1' || saved === '0') setExpanded(saved === '1');
    } catch {
      // Storage can be blocked; the collapsed default stands.
    }
  }, [storageKey]);

  const setExpandedPersisted = (next: boolean) => {
    setExpanded(next);
    try {
      localStorage.setItem(storageKey, next ? '1' : '0');
    } catch {
      // Not persisting is acceptable.
    }
  };

  const loaded = overviewCount !== null && filesCount !== null;
  const bothEmpty = loaded && overviewCount === 0 && filesCount === 0;

  // Nothing set up and nothing the viewer can do about it: show nothing at all.
  // Both child sections already hide themselves for non-admins when empty.
  const slimRow = bothEmpty && isAdmin && !expanded;
  const hideSections = bothEmpty && (!isAdmin || !expanded);

  return (
    <>
      {slimRow && (
        <div className="flex-shrink-0 bg-white border-b border-gray-200 px-4 sm:px-6 h-12 flex items-center gap-2 sm:gap-3 overflow-x-auto">
          <span className="text-sm font-bold flex-shrink-0" style={{ color: '#1a1f3c' }}>Board info</span>
          <span className="text-gray-300 flex-shrink-0" aria-hidden="true">·</span>
          <span className="text-xs text-gray-600 flex-shrink-0">Overview not set up</span>
          <span className="text-gray-300 flex-shrink-0" aria-hidden="true">·</span>
          <span className="text-xs text-gray-600 flex-shrink-0">Files 0</span>
          <button
            onClick={() => setExpandedPersisted(true)}
            className="flex-shrink-0 flex items-center gap-1 text-xs font-semibold px-2.5 py-1 rounded-lg transition-all duration-150"
            style={{ color: '#c73009', background: '#fff7f5', border: '1px solid #fbd5c8' }}
          >
            <span className="text-sm leading-none font-bold">+</span>
            Add
          </button>
        </div>
      )}

      <div className="flex-shrink-0" hidden={hideSections}>
        {bothEmpty && isAdmin && expanded && (
          <div className="bg-white border-b border-gray-200 px-4 sm:px-6 h-12 flex items-center">
            <button
              onClick={() => setExpandedPersisted(false)}
              className="text-xs font-semibold text-gray-600 hover:text-gray-900 transition-colors"
            >
              Hide board info
            </button>
          </div>
        )}
        <BoardCanvas boardId={boardId} isAdmin={isAdmin} onCountChange={setOverviewCount} />
        <ProductFiles boardId={boardId} isAdmin={isAdmin} onCountChange={setFilesCount} />
      </div>
    </>
  );
}
