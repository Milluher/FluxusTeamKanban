'use client';
import Link from 'next/link';
import { AssignedTicket } from '@/types';
import { descriptionPreview } from '@/lib/richText';
import { formatSprintDates, formatTimeAgo } from '@/lib/formatDate';

interface Props {
  tickets: AssignedTicket[];
  loading: boolean;
  onShowBoards: () => void;
}

const PRIORITY: Record<string, { label: string; color: string; bg: string; border: string }> = {
  low: { label: 'Low', color: '#6b7280', bg: '#f9fafb', border: '#d1d5db' },
  medium: { label: 'Medium', color: '#b45309', bg: '#fffbeb', border: '#fcd34d' },
  high: { label: 'High', color: '#c2410c', bg: '#fff7ed', border: '#fed7aa' },
  urgent: { label: 'Urgent 🔥', color: '#b91c1c', bg: '#fef2f2', border: '#fecaca' },
};

// What someone assigned work actually wants on landing: the tickets, grouped by
// the board they live on, each one a link straight into that ticket.
export default function MyTicketsView({ tickets, loading, onShowBoards }: Props) {
  if (loading) {
    return <p className="text-sm text-gray-600 py-10 text-center">Loading your tickets…</p>;
  }

  if (tickets.length === 0) {
    return (
      <div className="bg-white border border-gray-200 rounded-xl py-16 text-center">
        <p className="text-base font-semibold text-gray-700 mb-1">Nothing assigned to you</p>
        <p className="text-sm text-gray-600 mb-5">
          When someone assigns you a ticket it will show up here.
        </p>
        <button
          onClick={onShowBoards}
          className="px-5 py-2.5 rounded-lg text-sm font-semibold text-white"
          style={{ background: '#c73009' }}
        >
          Browse boards
        </button>
      </div>
    );
  }

  // Group by board, keeping the server's most-recently-updated-first order.
  const boards = new Map<string, { name: string; type: string; tickets: AssignedTicket[] }>();
  for (const t of tickets) {
    const board = t.column.board;
    if (!boards.has(board.id)) boards.set(board.id, { name: board.name, type: board.type, tickets: [] });
    boards.get(board.id)!.tickets.push(t);
  }

  return (
    <div className="space-y-7">
      {Array.from(boards.entries()).map(([boardId, board]) => (
        <section key={boardId}>
          <div className="flex items-center gap-2 mb-3">
            <h2 className="text-xs font-semibold uppercase tracking-wider text-gray-600">{board.name}</h2>
            <span
              className={`text-xs px-2 py-0.5 rounded-full font-medium whitespace-nowrap ${
                board.type === 'kanban' ? 'bg-purple-50 text-purple-700' : 'bg-orange-50 text-orange-700'
              }`}
            >
              {board.type === 'kanban' ? 'Kanban' : 'Sprint'}
            </span>
            <Link
              href={`/board/${boardId}`}
              className="ml-auto text-xs font-semibold text-gray-600 hover:text-gray-900 transition-colors"
            >
              Open board
            </Link>
          </div>

          <ul className="bg-white border border-gray-200 rounded-xl divide-y divide-gray-100 overflow-hidden">
            {board.tickets.map((t) => {
              const preview = descriptionPreview(t.description);
              const priority = t.priority ? PRIORITY[t.priority] : null;
              const updated = formatTimeAgo(t.updatedAt);
              const sprintDates = t.sprint ? formatSprintDates(null, t.sprint.endDate) : null;

              return (
                <li key={t.id}>
                  <Link
                    href={`/board/${boardId}?ticket=${t.id}`}
                    className="block px-4 py-3 hover:bg-gray-50 transition-colors"
                  >
                    <div className="flex items-start gap-3">
                      <div className="min-w-0 flex-1">
                        <p className="text-sm font-semibold text-gray-800 mb-0.5">{t.title}</p>
                        {preview.kind === 'text' && (
                          <p className="text-xs text-gray-600 line-clamp-1">{preview.text}</p>
                        )}
                        {preview.kind === 'checklist' && (
                          <p className="text-xs text-gray-600">
                            {preview.done} of {preview.total} done
                          </p>
                        )}
                      </div>

                      <div className="flex items-center gap-1.5 flex-shrink-0">
                        {priority && (
                          <span
                            className="text-xs font-semibold px-1.5 py-0.5 rounded-full whitespace-nowrap"
                            style={{ background: priority.bg, color: priority.color, border: `1px solid ${priority.border}` }}
                          >
                            {priority.label}
                          </span>
                        )}
                        <span className="text-xs font-medium px-2 py-0.5 rounded-full bg-gray-100 text-gray-600 whitespace-nowrap">
                          {t.column.name}
                        </span>
                      </div>
                    </div>

                    {(t.sprint || updated) && (
                      <div className="flex items-center gap-2 mt-1.5 text-xs text-gray-600">
                        {t.sprint && <span className="truncate">{t.sprint.title}</span>}
                        {t.sprint && sprintDates && <span className="text-gray-300" aria-hidden="true">·</span>}
                        {sprintDates && <span className="whitespace-nowrap">{sprintDates}</span>}
                        {updated && (
                          <span className="ml-auto whitespace-nowrap">Updated {updated}</span>
                        )}
                      </div>
                    )}
                  </Link>
                </li>
              );
            })}
          </ul>
        </section>
      ))}
    </div>
  );
}
