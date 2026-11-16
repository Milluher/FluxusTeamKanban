-- Products.
--
-- A PRD used to hang off a canvas *feature*: adding a feature started the
-- document behind it. That put the two at the wrong level. A block is a heading
-- on the canvas and its features are the bullet points under it — a sentence
-- each — while a PRD is a long document with scope, personas, approvers and
-- sign-off. Writing one per bullet point meant the builder opened over trivia.
--
-- So the document belongs to a "product": a thing an admin adds to a project
-- alongside its blocks, which exists in order to have a PRD. Features go back
-- to being what they look like — a list.
--
-- Nullable, and `canvasFeatureId` is left exactly as it is. Every PRD already
-- attached to a feature keeps that attachment and stays readable and editable
-- where it is; this is a second way for a PRD to be reached, not a replacement
-- that would strand the first.
--
-- ON DELETE SET NULL, matching the feature link: deleting a block of the canvas
-- must not delete a document somebody wrote.
ALTER TABLE "Prd" ADD COLUMN IF NOT EXISTS "canvasProjectId" TEXT;

DO $$
BEGIN
  ALTER TABLE "Prd"
    ADD CONSTRAINT "Prd_canvasProjectId_fkey"
    FOREIGN KEY ("canvasProjectId") REFERENCES "CanvasProject"("id")
    ON DELETE SET NULL ON UPDATE CASCADE;
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;

CREATE INDEX IF NOT EXISTS "Prd_canvasProjectId_idx" ON "Prd"("canvasProjectId");
