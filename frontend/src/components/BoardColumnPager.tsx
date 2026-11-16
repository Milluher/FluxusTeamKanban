'use client';
import { useEffect, useRef, useState } from 'react';
import { columnStyle } from '@/lib/columnStyle';

interface PagerColumn {
  id: string;
  name: string;
  count: number;
}

interface Props {
  columns: PagerColumn[];
  /** Maps a column id to the DOM id KanbanColumn was rendered with. */
  domId: (columnId: string) => string;
}

/**
 * Where you are on the board, and a way to jump — phones only.
 *
 * On a narrow screen one column fills the viewport, so the board loses the
 * thing that makes a board readable: seeing the stages side by side. You cannot
 * tell how many columns there are, which one you are looking at, or where the
 * work has piled up, and reaching "Done" from "To Do" is three flicks into the
 * unknown.
 *
 * This puts that back in one row: every column, its tally, and which one you are
 * on. Tapping scrolls there. On a wide screen the columns are already laid out
 * in front of you, so it is hidden rather than duplicating what you can see.
 */
export default function BoardColumnPager({ columns, domId }: Props) {
  const [activeId, setActiveId] = useState<string | null>(columns[0]?.id ?? null);
  const stripRef = useRef<HTMLDivElement>(null);

  // Which column is in view, so the strip reflects a flick as well as a tap.
  // An observer rather than a scroll listener: it reports only when something
  // actually crosses the threshold, instead of on every frame of a scroll.
  useEffect(() => {
    const nodes = columns
      .map((c) => document.getElementById(domId(c.id)))
      .filter((n): n is HTMLElement => n !== null);
    if (nodes.length === 0) return;

    const observer = new IntersectionObserver(
      (entries) => {
        // The most-visible column wins. Comparing ratios avoids the flicker you
        // get from reacting to whichever entry happens to fire last.
        const best = entries
          .filter((e) => e.isIntersecting)
          .sort((a, b) => b.intersectionRatio - a.intersectionRatio)[0];
        if (best) setActiveId(best.target.id.replace(/^board-col-/, ''));
      },
      // Thresholds rather than a single 0.5: a column narrower than the
      // viewport never reaches half of *the viewport*, so one cutoff would
      // leave the strip stuck.
      { threshold: [0.25, 0.5, 0.75, 1] }
    );
    for (const node of nodes) observer.observe(node);
    return () => observer.disconnect();
  }, [columns, domId]);

  // Keep the active chip in view too — on a board with six columns the chip for
  // the one you scrolled to can itself be off-screen.
  useEffect(() => {
    if (!activeId) return;
    const chip = stripRef.current?.querySelector(`[data-chip="${activeId}"]`);
    chip?.scrollIntoView({ behavior: 'smooth', inline: 'center', block: 'nearest' });
  }, [activeId]);

  if (columns.length < 2) return null;

  const jumpTo = (columnId: string) => {
    const node = document.getElementById(domId(columnId));
    node?.scrollIntoView({ behavior: 'smooth', inline: 'start', block: 'nearest' });
    // Set immediately rather than waiting for the observer, so the tap feels
    // answered even while the smooth scroll is still travelling.
    setActiveId(columnId);
  };

  return (
    <nav
      aria-label="Board columns"
      className="sm:hidden flex-shrink-0 bg-white border-b border-gray-200"
    >
      <div ref={stripRef} className="flex gap-1.5 px-4 py-2 overflow-x-auto no-scrollbar">
        {columns.map((col) => {
          const cfg = columnStyle(col.name);
          const active = col.id === activeId;
          return (
            <button
              key={col.id}
              type="button"
              data-chip={col.id}
              onClick={() => jumpTo(col.id)}
              aria-current={active ? 'true' : undefined}
              className="flex items-center gap-1.5 flex-shrink-0 px-2.5 py-1.5 min-h-[36px] rounded-full text-xs font-semibold transition-all"
              style={{
                background: active ? cfg.badgeBg : 'white',
                color: active ? cfg.badgeText : '#6b7280',
                border: `1px solid ${active ? cfg.dot : '#e5e7eb'}`,
              }}
            >
              <span className="w-1.5 h-1.5 rounded-full flex-shrink-0" style={{ background: cfg.dot }} />
              {col.name}
              <span className={active ? '' : 'text-gray-500'}>{col.count}</span>
            </button>
          );
        })}
      </div>
    </nav>
  );
}
