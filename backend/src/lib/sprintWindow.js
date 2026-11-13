/**
 * Which sprints a ticket may still be moved into.
 *
 * A backlog ticket is one with no sprint, and it stays unassignable until it
 * joins one — so "which sprints are still open" is the question that decides
 * whether a piece of work can be given to anybody. Two things close a sprint:
 *
 *   - it has been marked completed, or
 *   - its end date has passed.
 *
 * A sprint with no end date is open. That is deliberate: dates are optional on
 * this board and the UI offers "Set dates" rather than demanding them, so
 * treating a missing date as "due" would quietly make such a sprint unusable.
 *
 * The comparison is against the END of the end date's day, so a sprint ending
 * today is still open today — a sprint is due at the close of its last day,
 * not at midnight that morning.
 *
 * Mirrored on the frontend in `frontend/src/lib/sprintWindow.ts`, which hides
 * the closed sprints from the picker. This is what actually enforces it.
 */

/** True while a sprint can still take new tickets. */
function isSprintOpen(sprint, now = new Date()) {
  if (!sprint) return false;
  if (sprint.status === 'completed') return false;
  if (!sprint.endDate) return true;
  const end = new Date(sprint.endDate);
  if (Number.isNaN(end.getTime())) return true;
  end.setHours(23, 59, 59, 999);
  return end.getTime() >= now.getTime();
}

/** Why a sprint will not take this ticket, or null when it will. */
function sprintRejectionReason(sprint, boardId) {
  if (!sprint) return 'That sprint no longer exists';
  if (boardId && sprint.boardId !== boardId) return 'That sprint belongs to another board';
  if (sprint.status === 'completed') return `"${sprint.title}" has been completed, so it cannot take new tickets`;
  if (!isSprintOpen(sprint)) return `"${sprint.title}" has already ended, so it cannot take new tickets`;
  return null;
}

module.exports = { isSprintOpen, sprintRejectionReason };
