-- PRD Builder: the document behind a feature.
--
-- Purely additive — two new tables and no change to anything that exists — so
-- it cannot disturb a database that is already running.
--
-- Every section column is nullable, including the ones the brief calls
-- required. A PRD is written over days and saved as a draft from the first
-- keystroke, so "required" is a condition of publishing, enforced in the
-- publish route. A NOT NULL here would make a half-written draft unstorable,
-- which is the opposite of what the brief asks for.

CREATE TABLE "Prd" (
  "id" TEXT NOT NULL,
  "title" TEXT NOT NULL,
  "version" TEXT,
  "status" TEXT NOT NULL DEFAULT 'draft',
  "overview" TEXT,
  "goals" TEXT,
  "userStories" TEXT,
  "functionalReqs" TEXT,
  "nonFunctionalReqs" TEXT,
  "userFlows" TEXT,
  "assumptions" TEXT,
  "platforms" TEXT,
  "classification" TEXT,
  "inScope" TEXT,
  "outOfScope" TEXT,
  "acceptanceCriteria" TEXT,
  "successMetrics" TEXT,
  "boardId" TEXT NOT NULL,
  "canvasFeatureId" TEXT,
  "createdById" TEXT NOT NULL,
  "publishedAt" TIMESTAMP(3),
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "Prd_pkey" PRIMARY KEY ("id")
);

-- One PRD per canvas feature.
CREATE UNIQUE INDEX "Prd_canvasFeatureId_key" ON "Prd"("canvasFeatureId");
CREATE INDEX "Prd_boardId_idx" ON "Prd"("boardId");
CREATE INDEX "Prd_status_idx" ON "Prd"("status");

ALTER TABLE "Prd" ADD CONSTRAINT "Prd_boardId_fkey"
  FOREIGN KEY ("boardId") REFERENCES "Board"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- SET NULL, not CASCADE: removing a feature from the canvas must not shred the
-- document written about it.
ALTER TABLE "Prd" ADD CONSTRAINT "Prd_canvasFeatureId_fkey"
  FOREIGN KEY ("canvasFeatureId") REFERENCES "CanvasFeature"("id") ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "Prd" ADD CONSTRAINT "Prd_createdById_fkey"
  FOREIGN KEY ("createdById") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- §10 Target Personas. A join, so a deleted persona leaves every PRD that
-- named it rather than leaving a dangling id behind.
CREATE TABLE "PrdPersona" (
  "id" TEXT NOT NULL,
  "prdId" TEXT NOT NULL,
  "personaId" TEXT NOT NULL,
  CONSTRAINT "PrdPersona_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "PrdPersona_prdId_personaId_key" ON "PrdPersona"("prdId", "personaId");

ALTER TABLE "PrdPersona" ADD CONSTRAINT "PrdPersona_prdId_fkey"
  FOREIGN KEY ("prdId") REFERENCES "Prd"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "PrdPersona" ADD CONSTRAINT "PrdPersona_personaId_fkey"
  FOREIGN KEY ("personaId") REFERENCES "Persona"("id") ON DELETE CASCADE ON UPDATE CASCADE;
