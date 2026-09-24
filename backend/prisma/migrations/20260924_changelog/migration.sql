-- Changelog: curated, admin-authored release notes visible to every user
-- across every project. boardId = NULL means the entry is company-wide.
-- publishedAt = NULL means the entry is a draft (admin-only).

CREATE TABLE "ChangelogEntry" (
  "id" TEXT NOT NULL,
  "version" TEXT,
  "title" TEXT NOT NULL,
  "summary" TEXT,
  "items" JSONB NOT NULL DEFAULT '[]',
  "boardId" TEXT,
  "authorId" TEXT NOT NULL,
  "publishedAt" TIMESTAMP(3),
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "ChangelogEntry_pkey" PRIMARY KEY ("id")
);

ALTER TABLE "ChangelogEntry" ADD CONSTRAINT "ChangelogEntry_boardId_fkey"
  FOREIGN KEY ("boardId") REFERENCES "Board"("id") ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "ChangelogEntry" ADD CONSTRAINT "ChangelogEntry_authorId_fkey"
  FOREIGN KEY ("authorId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

CREATE INDEX "ChangelogEntry_publishedAt_idx" ON "ChangelogEntry"("publishedAt");
CREATE INDEX "ChangelogEntry_boardId_idx" ON "ChangelogEntry"("boardId");
