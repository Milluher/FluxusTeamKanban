import { describe, expect, it } from 'vitest';

/**
 * Backend code, tested from here.
 *
 * `backend/src/lib/changelogView.js` has no database and no Express in it —
 * it is the pure shaping rule that decides who is shown a changelog entry's
 * items — and the backend has no test runner of its own. The migration-order
 * guard in this directory already reaches across for the same reason, and CI
 * runs this suite, so the rule is covered where it can actually be run.
 *
 * What is worth covering: `boardId` became NOT NULL, and the old
 * "no board means company-wide, show everyone the detail" branch went with it.
 * If that branch ever comes back, an entry with a missing board silently
 * becomes readable by everyone — so the absence is asserted, not assumed.
 */
// eslint-disable-next-line @typescript-eslint/no-var-requires
const { normalizeItems, presentEntry } = require('../../../backend/src/lib/changelogView.js');

const entry = (overrides: Record<string, unknown> = {}) => ({
  id: 'c1',
  version: '1.4.0',
  title: 'Sprint burndown',
  summary: 'What changed and why.',
  items: [
    { kind: 'added', text: 'A burndown chart' },
    { kind: 'fixed', text: 'Ordering of closed tickets' },
  ],
  boardId: 'b1',
  board: { id: 'b1', name: 'Riverly' },
  author: { id: 'u1', name: 'Alice Doe' },
  publishedAt: '2026-10-01T00:00:00.000Z',
  createdAt: '2026-09-30T00:00:00.000Z',
  updatedAt: '2026-10-01T00:00:00.000Z',
  ...overrides,
});

describe('presentEntry', () => {
  it('details an entry for a member of its board', () => {
    const shaped = presentEntry(entry(), { isAdmin: false, memberBoardIds: new Set(['b1']) });
    expect(shaped.restricted).toBe(false);
    expect(shaped.summary).toBe('What changed and why.');
    expect(shaped.items).toHaveLength(2);
    expect(shaped.itemCount).toBe(2);
  });

  it('withholds the items from someone who is not a member of its board', () => {
    const shaped = presentEntry(entry(), { isAdmin: false, memberBoardIds: new Set(['b2']) });
    expect(shaped.restricted).toBe(true);
    expect(shaped.items).toEqual([]);
    expect(shaped.summary).toBeNull();
    // The count survives, so the entry still reads as having content.
    expect(shaped.itemCount).toBe(2);
    // And the title and board are not secret — only the detail is.
    expect(shaped.title).toBe('Sprint burndown');
    expect(shaped.board).toEqual({ id: 'b1', name: 'Riverly' });
  });

  it('details everything for a system admin, member or not', () => {
    const shaped = presentEntry(entry(), { isAdmin: true, memberBoardIds: new Set() });
    expect(shaped.restricted).toBe(false);
    expect(shaped.items).toHaveLength(2);
  });

  it('does not treat a boardless entry as company-wide', () => {
    // boardId is NOT NULL since 20261104_board_scoping, so this entry cannot
    // exist. If one ever did — a bad backfill, a hand-edited row — it must fail
    // closed rather than hand its items to every user, which is what the old
    // `!entry.boardId` branch did.
    const orphan = entry({ boardId: null, board: null });
    const shaped = presentEntry(orphan, { isAdmin: false, memberBoardIds: new Set(['b1']) });
    expect(shaped.restricted).toBe(true);
    expect(shaped.items).toEqual([]);
    expect(shaped.summary).toBeNull();
  });
});

describe('normalizeItems', () => {
  it('drops anything without text and defaults an unknown kind to changed', () => {
    expect(
      normalizeItems([
        { kind: 'added', text: '  Trimmed  ' },
        { kind: 'nonsense', text: 'Kept' },
        { kind: 'fixed', text: '   ' },
        { kind: 'removed' },
        'not an object',
      ])
    ).toEqual([
      { kind: 'added', text: 'Trimmed' },
      { kind: 'changed', text: 'Kept' },
    ]);
  });

  it('answers with an empty list for a non-array, since the column is free-form JSON', () => {
    expect(normalizeItems(null)).toEqual([]);
    expect(normalizeItems({ kind: 'added', text: 'x' })).toEqual([]);
  });
});
