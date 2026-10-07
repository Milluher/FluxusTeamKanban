-- §17 Approval: the people who must sign a PRD off.
--
-- Additive only: one new table, nothing existing altered.
--
-- "At least two" is enforced when publishing rather than by a constraint — a
-- draft is allowed to have none yet, and publishing is the moment approvers are
-- told, so it is the only point where the rule can mean anything.

CREATE TABLE "PrdApprover" (
  "id" TEXT NOT NULL,
  "prdId" TEXT NOT NULL,
  "userId" TEXT NOT NULL,
  "status" TEXT NOT NULL DEFAULT 'pending',
  "note" TEXT,
  "decidedAt" TIMESTAMP(3),
  "ticketId" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "PrdApprover_pkey" PRIMARY KEY ("id")
);

-- One person cannot be asked to approve the same PRD twice.
CREATE UNIQUE INDEX "PrdApprover_prdId_userId_key" ON "PrdApprover"("prdId", "userId");
-- One task per approver, so publishing could never raise two.
CREATE UNIQUE INDEX "PrdApprover_ticketId_key" ON "PrdApprover"("ticketId");
CREATE INDEX "PrdApprover_userId_idx" ON "PrdApprover"("userId");

ALTER TABLE "PrdApprover" ADD CONSTRAINT "PrdApprover_prdId_fkey"
  FOREIGN KEY ("prdId") REFERENCES "Prd"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "PrdApprover" ADD CONSTRAINT "PrdApprover_userId_fkey"
  FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "PrdApprover" ADD CONSTRAINT "PrdApprover_ticketId_fkey"
  FOREIGN KEY ("ticketId") REFERENCES "Ticket"("id") ON DELETE SET NULL ON UPDATE CASCADE;
