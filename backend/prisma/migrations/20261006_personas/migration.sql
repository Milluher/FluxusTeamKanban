-- Personas: the attributes of a user category.
--
-- Workspace-wide, like the dictionary and initiatives. Admins create and curate;
-- every authenticated user reads.
--
-- A fixed template: the same named fields on every persona, so two are
-- comparable and a PRD can summarise one. Only the name is required — a persona
-- is usually filled in over time, and a half-researched one is still worth
-- having on record.

CREATE TABLE "Persona" (
  "id" TEXT NOT NULL,
  "name" TEXT NOT NULL,
  "segment" TEXT,
  "description" TEXT,
  "goals" TEXT,
  "painPoints" TEXT,
  "behaviours" TEXT,
  "techComfort" TEXT,
  "createdById" TEXT NOT NULL,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "Persona_pkey" PRIMARY KEY ("id")
);

ALTER TABLE "Persona" ADD CONSTRAINT "Persona_createdById_fkey"
  FOREIGN KEY ("createdById") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

CREATE INDEX "Persona_name_idx" ON "Persona"("name");
