-- Product Files: named external links (e.g. Google Drive docs) per board,
-- plus an optional "product doc" reference on tickets.

CREATE TABLE "ProductFile" (
  "id" TEXT NOT NULL,
  "boardId" TEXT NOT NULL,
  "title" TEXT NOT NULL,
  "url" TEXT NOT NULL,
  "order" INTEGER NOT NULL DEFAULT 0,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "ProductFile_pkey" PRIMARY KEY ("id")
);

ALTER TABLE "ProductFile" ADD CONSTRAINT "ProductFile_boardId_fkey"
  FOREIGN KEY ("boardId") REFERENCES "Board"("id") ON DELETE CASCADE ON UPDATE CASCADE;

CREATE INDEX "ProductFile_boardId_idx" ON "ProductFile"("boardId");

-- Ticket reference to a product file ("product doc" attribute)
ALTER TABLE "Ticket" ADD COLUMN "productDocId" TEXT;

ALTER TABLE "Ticket" ADD CONSTRAINT "Ticket_productDocId_fkey"
  FOREIGN KEY ("productDocId") REFERENCES "ProductFile"("id") ON DELETE SET NULL ON UPDATE CASCADE;

CREATE INDEX "Ticket_productDocId_idx" ON "Ticket"("productDocId");
