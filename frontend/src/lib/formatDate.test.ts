import { describe, expect, it } from 'vitest';
import { formatDateRange, formatDay, formatSprintDates, formatSprintTiming } from './formatDate';

const NOW = new Date(2026, 9, 16); // 16 Oct 2026, local

describe('formatDay', () => {
  it('uses one unambiguous format', () => {
    expect(formatDay('2026-05-15')).toBe('15 May 2026');
    expect(formatDay('2026-05-15T00:00:00.000Z')).toBe('15 May 2026');
  });

  it('returns null rather than a placeholder for missing or junk input', () => {
    expect(formatDay(null)).toBeNull();
    expect(formatDay(undefined)).toBeNull();
    expect(formatDay('')).toBeNull();
    expect(formatDay('not a date')).toBeNull();
  });

  it('reads a stored UTC-midnight date as that calendar day', () => {
    // Parsed as an instant this would land on 11 Jun in any timezone west of UTC.
    expect(formatDay('2026-06-12T00:00:00.000Z')).toBe('12 Jun 2026');
  });
});

describe('formatDateRange', () => {
  it('collapses a range inside one month', () => {
    expect(formatDateRange('2026-10-12', '2026-10-26', NOW)).toBe('12–26 Oct');
  });

  it('spells out both sides across months', () => {
    expect(formatDateRange('2026-09-28', '2026-10-12', NOW)).toBe('28 Sep – 12 Oct');
  });

  it('adds years when they differ from each other or from today', () => {
    expect(formatDateRange('2026-12-28', '2027-01-04', NOW)).toBe('28 Dec 2026 – 4 Jan 2027');
    expect(formatDateRange('2025-03-01', '2025-03-10', NOW)).toBe('1–10 Mar 2025');
  });

  it('handles a single-day sprint and half-set dates', () => {
    expect(formatDateRange('2026-10-12', '2026-10-12', NOW)).toBe('12 Oct');
    expect(formatDateRange('2026-10-12', null, NOW)).toBe('From 12 Oct 2026');
    expect(formatDateRange(null, '2026-10-26', NOW)).toBe('Until 26 Oct 2026');
    expect(formatDateRange(null, null, NOW)).toBeNull();
  });
});

describe('formatSprintTiming', () => {
  it('counts down inside the sprint', () => {
    expect(formatSprintTiming('2026-10-12', '2026-10-20', NOW)).toBe('4 days left');
    expect(formatSprintTiming('2026-10-12', '2026-10-17', NOW)).toBe('1 day left');
  });

  it('names the boundary days', () => {
    expect(formatSprintTiming('2026-10-12', '2026-10-16', NOW)).toBe('Ends today');
    expect(formatSprintTiming('2026-10-01', '2026-10-15', NOW)).toBe('Ended yesterday');
    expect(formatSprintTiming('2026-10-01', '2026-10-13', NOW)).toBe('Ended 3 days ago');
  });

  it('looks forward before the sprint starts', () => {
    expect(formatSprintTiming('2026-10-17', '2026-10-31', NOW)).toBe('Starts tomorrow');
    expect(formatSprintTiming('2026-10-18', '2026-10-31', NOW)).toBe('Starts in 2 days');
    // Starting today falls through to the end-date countdown.
    expect(formatSprintTiming('2026-10-16', '2026-10-30', NOW)).toBe('14 days left');
  });

  it('returns null with no end date to count towards', () => {
    expect(formatSprintTiming(null, null, NOW)).toBeNull();
    expect(formatSprintTiming('2026-10-12', null, NOW)).toBeNull();
  });
});

describe('formatSprintDates', () => {
  it('joins the range and the countdown', () => {
    expect(formatSprintDates('2026-10-12', '2026-10-20', NOW)).toBe('12–20 Oct · 4 days left');
  });

  it('is null when no dates are set, so callers can offer Set dates instead', () => {
    expect(formatSprintDates(null, null, NOW)).toBeNull();
  });
});
