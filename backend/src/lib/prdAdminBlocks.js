/**
 * §16 completeness: whether every administrative block has actually been
 * answered.
 *
 * This is the gate on approval. An approver is being asked to sign off on the
 * whole document, and §16 is part of the document — approving while the people
 * with blocks have not said what data they need or what they will do means
 * signing off on sections nobody has written. So the decision route refuses an
 * `approved` until they are all in.
 *
 * "Request changes" is deliberately NOT gated: unanswered blocks are a perfectly
 * good reason to send a PRD back, and an approver who can neither approve nor
 * object would be stuck.
 *
 * A PRD with no blocks at all is complete by this rule. Blocks are optional —
 * §16 is only reached if the author assigns one — and treating "none" as
 * "incomplete" would make such a PRD impossible to approve.
 *
 * Mirrored on the frontend in `frontend/src/lib/prdApproval.ts` so the Approve
 * button can be disabled with a reason rather than offering a click that 409s.
 */

/** The blocks still missing either answer, in the order they were created. */
function unansweredBlocks(adminBlocks) {
  return (adminBlocks ?? []).filter(
    (b) => !(b.dataNeeded || '').trim() || !(b.actionsNeeded || '').trim()
  );
}

/** Why approval is refused, or null when every block is answered. */
function approvalBlockedReason(adminBlocks) {
  const outstanding = unansweredBlocks(adminBlocks);
  if (outstanding.length === 0) return null;

  const roles = outstanding.map((b) => b.role).join(', ');
  return outstanding.length === 1
    ? `The administrative block "${roles}" has not been filled in yet.`
    : `${outstanding.length} administrative blocks have not been filled in yet: ${roles}.`;
}

module.exports = { unansweredBlocks, approvalBlockedReason };
