import { describe, expect, it } from 'vitest';
import { Prd, PrdAdminBlock } from '@/types';
import { approvalBlockedReason, unansweredBlocks } from './prdApproval';

/**
 * The §16 completeness rule exists twice: in
 * `backend/src/lib/prdAdminBlocks.js`, which enforces it, and in
 * `prdApproval.ts`, which disables the Approve button with a reason.
 *
 * Duplicated because they are different languages, not because anyone wants
 * two of them — so what is tested here is that they *agree*. A rule that
 * drifts is worse than one place: the button would offer a click the server
 * refuses, or grey out an approval the server would have accepted.
 *
 * The backend module is plain CommonJS with no database and no Express in it,
 * and the backend has no test runner, so it is required across the same way
 * the migration-order guard and the changelog view test do.
 */
// eslint-disable-next-line @typescript-eslint/no-var-requires
const backend = require('../../../backend/src/lib/prdAdminBlocks.js');

type BlockShape = Pick<PrdAdminBlock, 'role' | 'dataNeeded' | 'actionsNeeded'>;

const blk = (over: Partial<BlockShape> = {}): BlockShape => ({
  role: 'Compliance',
  dataNeeded: 'The KYB vendor list',
  actionsNeeded: 'Sign off the vendor',
  ...over,
});

/** Every shape worth disagreeing about. */
const CASES: { name: string; blocks: BlockShape[] }[] = [
  { name: 'no blocks', blocks: [] },
  { name: 'one complete', blocks: [blk()] },
  { name: 'one missing data', blocks: [blk({ dataNeeded: null })] },
  { name: 'one missing actions', blocks: [blk({ actionsNeeded: null })] },
  { name: 'one blank-string data', blocks: [blk({ dataNeeded: '' })] },
  { name: 'one whitespace-only data', blocks: [blk({ dataNeeded: '   ' })] },
  { name: 'one whitespace-only actions', blocks: [blk({ actionsNeeded: '\\n\\t ' })] },
  { name: 'both missing', blocks: [blk({ dataNeeded: null, actionsNeeded: null })] },
  {
    name: 'two complete',
    blocks: [blk(), blk({ role: 'Legal' })],
  },
  {
    name: 'one of two outstanding',
    blocks: [blk({ role: 'Compliance', dataNeeded: null }), blk({ role: 'Legal' })],
  },
  {
    name: 'two of three outstanding',
    blocks: [
      blk({ role: 'Compliance', dataNeeded: null }),
      blk({ role: 'Legal', actionsNeeded: '' }),
      blk({ role: 'Finance' }),
    ],
  },
];

describe('§16 completeness rule: backend and frontend agree', () => {
  it.each(CASES)('reaches the same verdict for $name', ({ blocks }) => {
    const front = approvalBlockedReason({ adminBlocks: blocks } as unknown as Pick<Prd, 'adminBlocks'>);
    const back = backend.approvalBlockedReason(blocks);

    // The verdict — approvable or not — must match exactly. The wording may
    // differ in its quote marks, so only the decision is compared.
    expect(back === null).toBe(front === null);
  });

  it.each(CASES)('flags the same blocks for $name', ({ blocks }) => {
    const front = unansweredBlocks({ adminBlocks: blocks } as unknown as Pick<Prd, 'adminBlocks'>);
    const back = backend.unansweredBlocks(blocks);

    expect(back.map((b: BlockShape) => b.role)).toEqual(front.map((b) => b.role));
  });

  it('names the outstanding roles on both sides, so the reason is actionable', () => {
    const blocks = [blk({ role: 'Compliance', dataNeeded: null }), blk({ role: 'Legal' })];
    expect(backend.approvalBlockedReason(blocks)).toContain('Compliance');
    expect(approvalBlockedReason({ adminBlocks: blocks } as unknown as Pick<Prd, 'adminBlocks'>)).toContain(
      'Compliance'
    );
  });

  it('is undisturbed by a missing or null block list', () => {
    // The route passes whatever Prisma returned; the component passes whatever
    // the API sent. Neither should be able to throw here.
    expect(backend.approvalBlockedReason(undefined)).toBeNull();
    expect(backend.approvalBlockedReason(null)).toBeNull();
    expect(
      approvalBlockedReason({ adminBlocks: undefined } as unknown as Pick<Prd, 'adminBlocks'>)
    ).toBeNull();
  });
});
