import { describe, expect, it } from 'vitest';
import { Sprint } from '@/types';
import { assignableSprints, isSprintOpen } from './sprintWindow';

const NOW = new Date('2026-11-13T12:00:00.000Z');

const sprint = (over: Partial<Sprint> = {}): Sprint => ({
  id: 's1',
  boardId: 'b1',
  title: 'Sprint 1',
  startDate: '2026-11-01T00:00:00.000Z',
  endDate: '2026-11-20T00:00:00.000Z',
  createdAt: '2026-11-01T00:00:00.000Z',
  status: 'active',
  _count: { tickets: 0, members: 0 },
  ...over,
});

describe('isSprintOpen', () => {
  it('is open while the end date is still ahead', () => {
    expect(isSprintOpen(sprint(), NOW)).toBe(true);
  });

  it('is closed once the end date has passed', () => {
    expect(isSprintOpen(sprint({ endDate: '2026-11-01T00:00:00.000Z' }), NOW)).toBe(false);
  });

  it('is still open on its last day, not from midnight that morning', () => {
    // A sprint is due at the close of its final day. Comparing against the
    // start of the day would make the last day of every sprint unusable.
    expect(isSprintOpen(sprint({ endDate: '2026-11-13T00:00:00.000Z' }), NOW)).toBe(true);
  });

  it('treats a sprint with no end date as open', () => {
    // Dates are optional here, so a missing one must not read as "due".
    expect(isSprintOpen(sprint({ endDate: null }), NOW)).toBe(true);
  });

  it('closes a completed sprint however its dates read', () => {
    expect(isSprintOpen(sprint({ status: 'completed', endDate: null }), NOW)).toBe(false);
  });

  it('counts a backlog sprint as open', () => {
    expect(isSprintOpen(sprint({ status: 'backlog' }), NOW)).toBe(true);
  });
});

describe('assignableSprints', () => {
  const open = sprint({ id: 'open' });
  const past = sprint({ id: 'past', endDate: '2026-10-01T00:00:00.000Z' });
  const done = sprint({ id: 'done', status: 'completed' });

  it('offers only the sprints still taking tickets', () => {
    expect(assignableSprints([open, past, done], null, NOW).map((s) => s.id)).toEqual(['open']);
  });

  it('keeps the sprint a ticket is already in, even once it has closed', () => {
    // Otherwise the picker would look empty on a ticket that plainly has one.
    expect(assignableSprints([open, past, done], 'past', NOW).map((s) => s.id)).toEqual(['open', 'past']);
  });
});
