-- Riverly Dictionary: the workspace's shared vocabulary.
--
-- Global rather than per-board: a term means the same thing everywhere, and
-- every authenticated user can both read and add one.
--
-- The unique index is on LOWER("term"), so "KYB", "Kyb" and "kyb" cannot all
-- exist side by side. Prisma cannot express a functional index, so the route
-- reports the violation (P2002) as a conflict rather than a server error.

CREATE TABLE "DictionaryTerm" (
  "id" TEXT NOT NULL,
  "term" TEXT NOT NULL,
  "definition" TEXT NOT NULL,
  "createdById" TEXT NOT NULL,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "DictionaryTerm_pkey" PRIMARY KEY ("id")
);

ALTER TABLE "DictionaryTerm" ADD CONSTRAINT "DictionaryTerm_createdById_fkey"
  FOREIGN KEY ("createdById") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

CREATE INDEX "DictionaryTerm_term_idx" ON "DictionaryTerm"("term");
CREATE UNIQUE INDEX "DictionaryTerm_term_lower_key" ON "DictionaryTerm" (LOWER("term"));
