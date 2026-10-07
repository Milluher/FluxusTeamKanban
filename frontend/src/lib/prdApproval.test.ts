import { describe, expect, it } from 'vitest';
import { Prd, PrdApprover } from '@/types';
import { MIN_APPROVERS, approvalCount, approvalState, approverShortfall, isWritable } from './prdApproval';

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

  it('closes a published PRD', () => {
    expect(isWritable(prd('published', [approver('pending')]))).toBe(false);
    expect(isWritable(prd('published', [approver('approved')]))).toBe(false);
  });

  it('reopens it once an approver asks for changes', () => {
    expect(isWritable(prd('published', [approver('approved'), approver('changes_requested', 'a2')]))).toBe(true);
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
