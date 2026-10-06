-- Initiatives: a large, coordinated body of work aimed at a strategic goal.
--
-- Workspace-wide, so there is no board key: one initiative is fulfilled by
-- tickets across as many boards as the work needs. The link lives on Ticket,
-- and is SET NULL on delete so retiring an initiative never removes work.

CREATE TABLE "Initiative" (
  "id" TEXT NOT NULL,
  "title" TEXT NOT NULL,
  "description" TEXT NOT NULL,
  "status" TEXT NOT NULL DEFAULT 'in_progress',
  "createdById" TEXT NOT NULL,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "Initiative_pkey" PRIMARY KEY ("id")
);

ALTER TABLE "Initiative" ADD CONSTRAINT "Initiative_createdById_fkey"
  FOREIGN KEY ("createdById") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

CREATE INDEX "Initiative_status_idx" ON "Initiative"("status");

ALTER TABLE "Ticket" ADD COLUMN "initiativeId" TEXT;

ALTER TABLE "Ticket" ADD CONSTRAINT "Ticket_initiativeId_fkey"
  FOREIGN KEY ("initiativeId") REFERENCES "Initiative"("id") ON DELETE SET NULL ON UPDATE CASCADE;

CREATE INDEX "Ticket_initiativeId_idx" ON "Ticket"("initiativeId");
