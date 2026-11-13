import { describe, expect, it } from 'vitest';
import { Prd, PrdAdminBlock, PrdApprover } from '@/types';
import {
  MIN_APPROVERS,
  approvalBlockedReason,
  approvalCount,
  approvalState,
  approverShortfall,
  isWritable,
  unansweredBlocks,
} from './prdApproval';

const approver = (status: PrdApprover['status'], id = 'a1'): PrdApprover => ({
  id,
  prdId: 'p1',
  userId: `u-${id}`,
  user: { id: `u-${id}`, name: `User ${id}` },
  status,
  createdAt: '',
  updatedAt: '',
});

const prd = (status: Prd['status'], approvers: PrdApprover[]) =>
  ({ status, approvers } as Pick<Prd, 'status' | 'approvers'>);

describe('approvalState', () => {
  it('is none while still a draft, however many approvers are named', () => {
    expect(approvalState(prd('draft', [approver('approved'), approver('approved', 'a2')]))).toBe('none');
  });

  it('is none when published with nobody named', () => {
    expect(approvalState(prd('published', []))).toBe('none');
  });

  it('is pending while anyone has yet to decide', () => {
    expect(approvalState(prd('published', [approver('approved'), approver('pending', 'a2')]))).toBe('pending');
  });

  it('is approved only once every approver has approved', () => {
    expect(approvalState(prd('published', [approver('approved'), approver('approved', 'a2')]))).toBe('approved');
  });

  it('lets one change request outrank every approval', () => {
    const state = approvalState(
      prd('published', [approver('approved'), approver('approved', 'a2'), approver('changes_requested', 'a3')])
    );
    expect(state).toBe('changes_requested');
  });
});

describe('isWritable', () => {
  it('allows a draft', () => {
    expect(isWritable(prd('draft', []))).toBe(true);
  });

  it('keeps a published PRD open while anyone has still to decide', () => {
    // Publishing circulates a document for sign-off; it does not finish it.
    expect(isWritable(prd('published', [approver('pending')]))).toBe(true);
    expect(isWritable(prd('published', [approver('approved'), approver('pending', 'a2')]))).toBe(true);
  });

  it('keeps it open when an approver asks for changes', () => {
    expect(isWritable(prd('published', [approver('approved'), approver('changes_requested', 'a2')]))).toBe(true);
  });

  it('closes it once every approver has approved', () => {
    expect(isWritable(prd('published', [approver('approved')]))).toBe(false);
    expect(isWritable(prd('published', [approver('approved'), approver('approved', 'a2')]))).toBe(false);
  });
});

describe('approverShortfall', () => {
  it('names how many more are needed, in the plural that fits', () => {
    expect(approverShortfall({ approvers: [] } as Pick<Prd, 'approvers'>)).toContain('2 more approvers');
    expect(approverShortfall({ approvers: [approver('pending')] } as Pick<Prd, 'approvers'>)).toContain('1 more approver');
  });

  it('is satisfied at the minimum', () => {
    const two = [approver('pending'), approver('pending', 'a2')];
    expect(approverShortfall({ approvers: two } as Pick<Prd, 'approvers'>)).toBeNull();
    expect(MIN_APPROVERS).toBe(2);
  });
});

describe('approvalCount', () => {
  it('counts approvals against the roster', () => {
    const approvers = [approver('approved'), approver('pending', 'a2'), approver('changes_requested', 'a3')];
    expect(approvalCount({ approvers } as Pick<Prd, 'approvers'>)).toEqual({ approved: 1, total: 3 });
  });
});

describe('unansweredBlocks / approvalBlockedReason', () => {
  const blk = (over: Partial<PrdAdminBlock> = {}): PrdAdminBlock =>
    ({
      id: 'ab1',
      prdId: 'p1',
      role: 'Compliance',
      assigneeId: 'u2',
      assignee: { id: 'u2', name: 'Bob Roe' },
      dataNeeded: 'The KYB vendor list',
      actionsNeeded: 'Sign off the vendor',
      ticketId: null,
      ticket: null,
      createdAt: '2026-10-01T00:00:00.000Z',
      updatedAt: '2026-10-01T00:00:00.000Z',
      ...over,
    }) as PrdAdminBlock;

  const of = (adminBlocks: PrdAdminBlock[]) => ({ adminBlocks } as Pick<Prd, 'adminBlocks'>);

  it('allows approval when every block has both answers', () => {
    expect(unansweredBlocks(of([blk(), blk({ id: 'ab2', role: 'Legal' })]))).toEqual([]);
    expect(approvalBlockedReason(of([blk()]))).toBeNull();
  });

  it('allows approval when there are no blocks at all, since they are optional', () => {
    // §16 is only reached if the author assigns a block. Treating "none" as
    // "incomplete" would make such a PRD impossible to approve.
    expect(approvalBlockedReason(of([]))).toBeNull();
  });

  it('counts a block missing either answer as unanswered', () => {
    expect(unansweredBlocks(of([blk({ dataNeeded: null })]))).toHaveLength(1);
    expect(unansweredBlocks(of([blk({ actionsNeeded: null })]))).toHaveLength(1);
  });

  it('treats whitespace as unanswered, not as an answer', () => {
    expect(unansweredBlocks(of([blk({ dataNeeded: '   ' })]))).toHaveLength(1);
  });

  it('names the single outstanding block', () => {
    const reason = approvalBlockedReason(of([blk({ role: 'Compliance', dataNeeded: null })]));
    expect(reason).toContain('Compliance');
    expect(reason).toContain('has not been filled in');
  });

  it('counts and lists several outstanding blocks', () => {
    const reason = approvalBlockedReason(
      of([
        blk({ id: 'ab1', role: 'Compliance', dataNeeded: null }),
        blk({ id: 'ab2', role: 'Legal', actionsNeeded: '' }),
        blk({ id: 'ab3', role: 'Finance' }),
      ])
    );
    expect(reason).toContain('2 administrative blocks');
    expect(reason).toContain('Compliance, Legal');
    // The answered one is not named.
    expect(reason).not.toContain('Finance');
  });
});
