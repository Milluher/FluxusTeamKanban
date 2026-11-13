import { Sprint } from '@/types';

/**
 * Which sprints a ticket may still be moved into.
 *
 * A ticket with no sprint is in the backlog and cannot be assigned to anybody,
 * so "which sprints are still open" is the question that decides whether a
 * piece of work can be given to someone. Two things close a sprint: it has been
 * marked completed, or its end date has passed.
 *
 * A sprint with no end date is open. Dates are optional on these boards — the
 * sprint card offers "Set dates" rather than demanding them — so treating a
 * missing date as "due" would quietly make such a sprint unusable.
 *
 * The comparison is against the END of the end date's day, so a sprint ending
 * today is still open today: a sprint is due at the close of its last day, not
 * at midnight that morning.
 *
 * Mirrors `backend/src/lib/sprintWindow.js`, which is what actually enforces
 * this. Here it keeps closed sprints out of the picker, so an admin is not
 * offered a choice the server will refuse.
 */
export function isSprintOpen(
  sprint: Pick<Sprint, 'status' | 'endDate'>,
  now: Date = new Date()
): boolean {
  if (!sprint) return false;
  if (sprint.status === 'completed') return false;
  if (!sprint.endDate) return true;
  const end = new Date(sprint.endDate);
  if (Number.isNaN(end.getTime())) return true;
  end.setHours(23, 59, 59, 999);
  return end.getTime() >= now.getTime();
}

/**
 * The sprints on offer when scheduling a ticket.
 *
 * `current` is the sprint the ticket is already in. It is kept even when it has
 * closed, so the picker shows what the ticket actually points at instead of
 * looking empty — a blank Sprint on a ticket that has one reads as data loss.
 */
export function assignableSprints(
  sprints: Sprint[],
  current?: string | null,
  now: Date = new Date()
): Sprint[] {
  return sprints.filter((s) => s.id === current || isSprintOpen(s, now));
}
