import { describe, expect, it } from 'vitest';
import { Prd, PrdApprover } from '@/types';
import { prdBadge } from './prdBadge';

const approver = (status: PrdApprover['status'], id = 'a1'): PrdApprover =>
  ({ id, prdId: 'p1', userId: `u-${id}`, user: { id: `u-${id}`, name: id }, status, createdAt: '', updatedAt: '' }) as PrdApprover;

const prd = (status: Prd['status'], approvers: PrdApprover[]) =>
  ({ status, approvers }) as Pick<Prd, 'status' | 'approvers'>;

describe('prdBadge', () => {
  it('calls an unpublished document a draft, whoever has been named', () => {
    expect(prdBadge(prd('draft', [approver('approved')])).label).toBe('Draft');
  });

  it('counts the approvals while any are outstanding', () => {
    // More useful at a glance than "Published": the question about a circulated
    // document is how far through sign-off it is.
    expect(prdBadge(prd('published', [approver('approved'), approver('pending', 'a2')])).label)
      .toBe('1 of 2 approved');
  });

  it('lets a change request outrank the approvals, as the state does', () => {
    const badge = prdBadge(prd('published', [approver('approved'), approver('changes_requested', 'a2')]));
    expect(badge.label).toBe('Changes requested');
  });

  it('says approved only once everyone has approved', () => {
    expect(prdBadge(prd('published', [approver('approved'), approver('approved', 'a2')])).label)
      .toBe('Approved');
  });

  it('falls back to Published for a document named nobody', () => {
    // Only reachable on a PRD published before the two-approver minimum.
    expect(prdBadge(prd('published', [])).label).toBe('Published');
  });

  it('gives every state a full set of colours', () => {
    const states: Pick<Prd, 'status' | 'approvers'>[] = [
      prd('draft', []),
      prd('published', []),
      prd('published', [approver('pending')]),
      prd('published', [approver('approved')]),
      prd('published', [approver('changes_requested')]),
    ];
    for (const s of states) {
      const badge = prdBadge(s);
      expect(badge.bg).toMatch(/^#/);
      expect(badge.fg).toMatch(/^#/);
      expect(badge.bd).toMatch(/^#/);
    }
  });
});
