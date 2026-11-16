import { Prd } from '@/types';
import { approvalCount, approvalState } from './prdApproval';

/**
 * How a PRD's state is drawn, wherever it is shown.
 *
 * Shared between the product cards on the canvas and the builder's own header,
 * the way `columnStyle` is shared between a board and "My tickets" — a document
 * that reads "1 of 2 approved" in one place must not read "Published" in the
 * other.
 *
 * The label is the most useful true thing about the document at a glance, which
 * is not always its status column: once published, where it stands with its
 * approvers matters far more than the fact of publishing, so that is what it
 * says.
 */
export interface PrdBadge {
  label: string;
  /** Background, foreground and border, in that order of use. */
  bg: string;
  fg: string;
  bd: string;
}

export function prdBadge(prd: Pick<Prd, 'status' | 'approvers'>): PrdBadge {
  if (prd.status !== 'published') {
    return { label: 'Draft', bg: '#fffbeb', fg: '#b45309', bd: '#fcd34d' };
  }

  const state = approvalState(prd);
  if (state === 'approved') {
    return { label: 'Approved', bg: '#ecfdf5', fg: '#047857', bd: '#a7f3d0' };
  }
  if (state === 'changes_requested') {
    return { label: 'Changes requested', bg: '#fef2f2', fg: '#b91c1c', bd: '#fecaca' };
  }
  if (state === 'pending') {
    const { approved, total } = approvalCount(prd);
    return { label: `${approved} of ${total} approved`, bg: '#eff6ff', fg: '#1d4ed8', bd: '#bfdbfe' };
  }
  // Published with nobody named. Publishing enforces a minimum of two
  // approvers, so this is only reachable on a document that predates that.
  return { label: 'Published', bg: '#ecfdf5', fg: '#047857', bd: '#a7f3d0' };
}
