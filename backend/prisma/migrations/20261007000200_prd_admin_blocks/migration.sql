-- §16 Administrative: blocks of a PRD assigned to individual board members.
--
-- Additive only: one new table and one nullable column on Ticket. Nothing
-- existing is altered, so it cannot disturb a database that is already running.

ALTER TABLE "Ticket" ADD COLUMN "prdId" TEXT;

-- SET NULL, not CASCADE: deleting a PRD must not delete the work it raised.
ALTER TABLE "Ticket" ADD CONSTRAINT "Ticket_prdId_fkey"
  FOREIGN KEY ("prdId") REFERENCES "Prd"("id") ON DELETE SET NULL ON UPDATE CASCADE;

CREATE INDEX "Ticket_prdId_idx" ON "Ticket"("prdId");

CREATE TABLE "PrdAdminBlock" (
  "id" TEXT NOT NULL,
  "prdId" TEXT NOT NULL,
  "role" TEXT NOT NULL,
  "assigneeId" TEXT NOT NULL,
  "dataNeeded" TEXT,
  "actionsNeeded" TEXT,
  "ticketId" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "PrdAdminBlock_pkey" PRIMARY KEY ("id")
);

-- One task per block, so publishing twice could never raise two.
CREATE UNIQUE INDEX "PrdAdminBlock_ticketId_key" ON "PrdAdminBlock"("ticketId");
CREATE INDEX "PrdAdminBlock_prdId_idx" ON "PrdAdminBlock"("prdId");
CREATE INDEX "PrdAdminBlock_assigneeId_idx" ON "PrdAdminBlock"("assigneeId");

ALTER TABLE "PrdAdminBlock" ADD CONSTRAINT "PrdAdminBlock_prdId_fkey"
  FOREIGN KEY ("prdId") REFERENCES "Prd"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "PrdAdminBlock" ADD CONSTRAINT "PrdAdminBlock_assigneeId_fkey"
  FOREIGN KEY ("assigneeId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "PrdAdminBlock" ADD CONSTRAINT "PrdAdminBlock_ticketId_fkey"
  FOREIGN KEY ("ticketId") REFERENCES "Ticket"("id") ON DELETE SET NULL ON UPDATE CASCADE;
