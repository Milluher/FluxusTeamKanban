'use client';
import { useMemo, useState } from 'react';
import { Sprint, Ticket } from '@/types';
import { assignableSprints } from '@/lib/sprintWindow';
import { formatSprintDates } from '@/lib/formatDate';
import Avatar from './Avatar';

interface Props {
  /** Every ticket on the board that is not in a sprint. */
  tickets: Ticket[];
  sprints: Sprint[];
  isAdmin: boolean;
  onTicketClick: (ticket: Ticket) => void;
  onNewTicket: () => void;
  /** Schedules a ticket. Rejected by the server unless the sprint is still open. */
  onSchedule: (ticket: Ticket, sprintId: string) => Promise<void>;
}

const NAVY = '#1a1f3c';
const ACCENT = '#e8390e';
const ACCENT_TEXT = '#c73009';

const PRIORITY_STYLE: Record<string, React.CSSProperties> = {
  low: { color: '#6b7280', background: '#f9fafb', border: '1px solid #d1d5db' },
  medium: { color: '#b45309', background: '#fffbeb', border: '1px solid #fcd34d' },
  high: { color: '#c2410c', background: '#fff7ed', border: '1px solid #fed7aa' },
  urgent: { color: '#b91c1c', background: '#fef2f2', border: '1px solid #fecaca' },
};

/**
 * The backlog: everything raised on this board that no sprint has picked up.
 *
 * A ticket is in the backlog precisely when it has no sprint. That is the whole
 * definition — there is no backlog column and no backlog flag, so the two can
 * never disagree about where a ticket is.
 *
 * A ticket raised here has no owner. Scheduling comes first: putting a ticket in
 * a sprint is the act of deciding it is being done, and only then is there
 * anything to give someone. So the only action on a backlog ticket is an admin's
 * "Schedule into…", offering the sprints that have not ended.
 *
 * One kind of ticket arrives already assigned: the tasks publishing a PRD raises
 * for its administrative blocks and its approvers. Those are handed straight to
 * a named person rather than queued for scheduling, and they have no sprint, so
 * they surface here — where they would otherwise be visible only in that
 * person's "My tickets". The list names whoever owns one rather than pretending
 * nothing here is owned.
 */
export default function BacklogSection({
  tickets,
  sprints,
  isAdmin,
  onTicketClick,
  onNewTicket,
  onSchedule,
}: Props) {
  const [scheduling, setScheduling] = useState<string | null>(null);
  const [error, setError] = useState('');
  const [search, setSearch] = useState('');

  // Offered without a `current`: nothing here is in a sprint yet by definition.
  const open = useMemo(() => assignableSprints(sprints), [sprints]);

  const query = search.trim().toLowerCase();
  const visible = query
    ? tickets.filter((t) => t.title.toLowerCase().includes(query))
    : tickets;

  const schedule = async (ticket: Ticket, sprintId: string) => {
    if (!sprintId) return;
    setScheduling(ticket.id);
    setError('');
    try {
      await onSchedule(ticket, sprintId);
    } catch (e: any) {
      setError(e.response?.data?.error || 'Could not move that ticket into the sprint.');
    } finally {
      setScheduling(null);
    }
  };

  return (
    <section className="bg-white border border-gray-200 rounded-xl overflow-hidden mb-6">
      <div className="flex flex-wrap items-center gap-2 sm:gap-3 px-4 sm:px-5 py-3 border-b border-gray-200">
        <h2 className="text-sm font-bold" style={{ color: NAVY }}>Backlog</h2>
        <span
          className="text-xs font-semibold px-2 py-0.5 rounded-full"
          style={{ background: '#f3f4f6', color: '#6b7280' }}
        >
          {tickets.length}
        </span>
        {tickets.length > 0 && (
          <input
            type="search"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search the backlog"
            aria-label="Search the backlog"
            className="order-last w-full sm:order-none sm:w-48 px-3 py-1.5 text-sm rounded-lg border border-gray-200 outline-none"
            style={{ color: '#111827' }}
            onFocus={(e) => { e.currentTarget.style.borderColor = ACCENT; e.currentTarget.style.boxShadow = '0 0 0 3px rgba(232,57,14,0.1)'; }}
            onBlur={(e) => { e.currentTarget.style.borderColor = '#e5e7eb'; e.currentTarget.style.boxShadow = 'none'; }}
          />
        )}
        <button
          type="button"
          onClick={onNewTicket}
          className="ml-auto flex items-center gap-1.5 text-sm font-semibold px-3 py-2 min-h-[40px] rounded-lg border transition-all duration-150"
          style={{ color: ACCENT_TEXT, borderColor: ACCENT, background: 'white' }}
        >
          <span className="text-base leading-none font-bold">+</span>
          New Ticket
        </button>
      </div>

      {error && (
        <p role="alert" className="mx-4 sm:mx-5 mt-3 px-3 py-2 rounded-lg text-sm bg-red-50 text-red-700 border border-red-200">
          {error}
        </p>
      )}

      {tickets.length === 0 ? (
        <p className="px-4 sm:px-5 py-8 text-center text-sm text-gray-600">
          Nothing in the backlog. New tickets land here until an admin schedules them into a sprint.
        </p>
      ) : visible.length === 0 ? (
        <p className="px-4 sm:px-5 py-8 text-center text-sm text-gray-600">
          No backlog ticket matches “{search.trim()}”.
        </p>
      ) : (
        <ul className="divide-y divide-gray-100">
          {visible.map((ticket) => (
            <li key={ticket.id} className="flex flex-wrap items-center gap-x-3 gap-y-2 px-4 sm:px-5 py-3">
              <button
                type="button"
                onClick={() => onTicketClick(ticket)}
                className="min-w-0 flex-1 text-left rounded outline-none hover:underline focus-visible:underline"
              >
                <span className="block text-sm font-medium truncate" style={{ color: NAVY }}>
                  {ticket.title}
                </span>
                <span className="block text-xs text-gray-500 truncate">
                  Raised by {ticket.createdBy.name}
                </span>
              </button>

              {/* Assigned and unscheduled only happens to a task a PRD raised.
                  Saying who owns it beats a list that implies nobody does. */}
              {ticket.assignee && (
                <span className="flex items-center gap-1.5 flex-shrink-0" title={`Assigned to ${ticket.assignee.name}`}>
                  <Avatar name={ticket.assignee.name} className="w-6 h-6 text-[9px]" />
                  <span className="text-xs text-gray-600 hidden sm:inline">{ticket.assignee.name}</span>
                </span>
              )}
              {ticket.type && (
                <span className="text-xs font-medium px-2 py-0.5 rounded-full bg-gray-100 text-gray-600 flex-shrink-0">
                  {ticket.type}
                </span>
              )}
              {ticket.priority && (
                <span
                  className="text-xs font-semibold px-2 py-0.5 rounded-full flex-shrink-0 capitalize"
                  style={PRIORITY_STYLE[ticket.priority] ?? PRIORITY_STYLE.low}
                >
                  {ticket.priority}
                </span>
              )}

              {isAdmin && (
                open.length > 0 ? (
                  <select
                    value=""
                    disabled={scheduling === ticket.id}
                    onChange={(e) => schedule(ticket, e.target.value)}
                    aria-label={`Schedule ${ticket.title} into a sprint`}
                    className="flex-shrink-0 px-2.5 py-1.5 text-sm rounded-lg border border-gray-200 outline-none disabled:opacity-50"
                    style={{ color: '#111827' }}
                  >
                    <option value="">{scheduling === ticket.id ? 'Scheduling…' : 'Schedule into…'}</option>
                    {open.map((s) => {
                      const dates = formatSprintDates(s.startDate, s.endDate);
                      return (
                        <option key={s.id} value={s.id}>
                          {s.title}{dates ? ` · ${dates}` : ''}
                        </option>
                      );
                    })}
                  </select>
                ) : (
                  // Said rather than shown as an empty picker: an admin with no
                  // open sprint needs to know to create one, not to wonder why
                  // the list is blank.
                  <span className="flex-shrink-0 text-xs text-gray-500">No open sprint to schedule into</span>
                )
              )}
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}
