import { Prd } from '@/types';

/** §17: "The creator should assign at least two people to approve the PRD." */
export const MIN_APPROVERS = 2;

export type ApprovalState =
  /** Still a draft, or nobody named yet. */
  | 'none'
  /** Published and waiting on at least one approver. */
  | 'pending'
  /** Every approver approved. */
  | 'approved'
  /** At least one approver asked for changes, which outranks any approval. */
  | 'changes_requested';

/**
 * Where a PRD stands with its approvers.
 *
 * Derived rather than stored: the answer is always a function of the approver
 * rows, and a cached copy would be one more thing able to disagree with them.
 *
 * A change request outranks approvals deliberately — one approver wanting
 * something altered is the signal that matters, however many others have
 * already said yes.
 */
export function approvalState(prd: Pick<Prd, 'status' | 'approvers'>): ApprovalState {
  const approvers = prd.approvers ?? [];
  if (prd.status !== 'published' || approvers.length === 0) return 'none';
  if (approvers.some((a) => a.status === 'changes_requested')) return 'changes_requested';
  if (approvers.every((a) => a.status === 'approved')) return 'approved';
  return 'pending';
}

/** How many have approved, for "2 of 3 approved". */
export function approvalCount(prd: Pick<Prd, 'approvers'>): { approved: number; total: number } {
  const approvers = prd.approvers ?? [];
  return {
    approved: approvers.filter((a) => a.status === 'approved').length,
    total: approvers.length,
  };
}

/**
 * Whether the author may still write to it. Mirrors the server.
 *
 * A published PRD reopens when an approver asks for changes, because feedback
 * nobody can act on is not feedback — and unpublishing would mean unpicking
 * the tasks publishing already raised.
 */
export function isWritable(prd: Pick<Prd, 'status' | 'approvers'>): boolean {
  if (prd.status !== 'published') return true;
  return (prd.approvers ?? []).some((a) => a.status === 'changes_requested');
}

/** Why publishing is refused, or null when it is allowed. */
export function approverShortfall(prd: Pick<Prd, 'approvers'>): string | null {
  const total = (prd.approvers ?? []).length;
  if (total >= MIN_APPROVERS) return null;
  const needed = MIN_APPROVERS - total;
  return `Name ${needed} more approver${needed === 1 ? '' : 's'} — a PRD needs at least ${MIN_APPROVERS}.`;
}

/**
 * §16 blocks still missing either answer.
 *
 * Mirrors `backend/src/lib/prdAdminBlocks.js`, which is what actually enforces
 * it — this exists so the Approve button can be disabled with a reason instead
 * of offering a click that comes back 409.
 */
export function unansweredBlocks(prd: Pick<Prd, 'adminBlocks'>) {
  return (prd.adminBlocks ?? []).filter(
    (b) => !(b.dataNeeded || '').trim() || !(b.actionsNeeded || '').trim()
  );
}

/**
 * Why this PRD cannot be approved yet, or null when it can.
 *
 * Approval only. Unanswered blocks are a perfectly good reason to send a PRD
 * back, so "request changes" is never gated — an approver who could neither
 * approve nor object would be stuck. A PRD with no blocks is approvable:
 * blocks are optional, and treating "none" as "incomplete" would make such a
 * PRD unapprovable.
 */
export function approvalBlockedReason(prd: Pick<Prd, 'adminBlocks'>): string | null {
  const outstanding = unansweredBlocks(prd);
  if (outstanding.length === 0) return null;

  const roles = outstanding.map((b) => b.role).join(', ');
  return outstanding.length === 1
    ? `The administrative block “${roles}” has not been filled in yet.`
    : `${outstanding.length} administrative blocks have not been filled in yet: ${roles}.`;
}
