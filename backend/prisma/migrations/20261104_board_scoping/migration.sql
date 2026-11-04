-- Localise personas, initiatives, the dictionary and the changelog to boards.
--
-- All four were workspace-wide. Each now belongs to exactly one board, and
-- `boardId` is NOT NULL on all of them — including ChangelogEntry, where NULL
-- used to mean "company-wide". There is no company-wide entry any more.
--
-- Existing rows have no board, so they are moved to one named board below.
-- Two properties this migration deliberately has:
--
--   1. On a database with nothing to move (a fresh local DB, an empty staging)
--      it needs no board at all and does nothing. So it is safe to apply before
--      any board exists.
--   2. On a database that *does* have rows to move, a board name that matches
--      nothing — or more than one board — aborts the whole migration. It never
--      guesses, and it never leaves rows half-assigned: SET NOT NULL below
--      would fail anyway, so failing here with a readable message is strictly
--      better than failing there with "column contains null values".
--
-- Written to be safe to run twice (ADD COLUMN IF NOT EXISTS, guarded
-- constraints), because this project has been bitten by a renamed migration
-- looking pending to a database that already applied it.

-- ---------------------------------------------------------------------------
-- 1. The new columns, nullable for now so the backfill has somewhere to write.
-- ---------------------------------------------------------------------------

ALTER TABLE "Persona"        ADD COLUMN IF NOT EXISTS "boardId" TEXT;
ALTER TABLE "DictionaryTerm" ADD COLUMN IF NOT EXISTS "boardId" TEXT;
ALTER TABLE "Initiative"     ADD COLUMN IF NOT EXISTS "boardId" TEXT;
-- ChangelogEntry."boardId" already exists and is already nullable.

-- ---------------------------------------------------------------------------
-- 2. Move every unassigned row to one board.
-- ---------------------------------------------------------------------------

DO $$
DECLARE
  -- The exact Board.name that existing workspace-wide personas, dictionary
  -- terms, initiatives and company-wide changelog entries belong to.
  --
  -- Matched exactly, including case and spacing. If production spells it any
  -- differently the migration aborts and prints the real board names rather
  -- than assigning nothing.
  -- Verified against production on 2026-11-04: the board is spelled in
  -- capitals there. The comparison is exact, so the casing matters.
  target_name  TEXT := 'RIVERLY FINANCE COY';

  target_id    TEXT;
  name_matches INT;
  to_move      INT;
BEGIN
  SELECT
      (SELECT count(*) FROM "Persona"        WHERE "boardId" IS NULL)
    + (SELECT count(*) FROM "DictionaryTerm" WHERE "boardId" IS NULL)
    + (SELECT count(*) FROM "Initiative"     WHERE "boardId" IS NULL)
    + (SELECT count(*) FROM "ChangelogEntry" WHERE "boardId" IS NULL)
  INTO to_move;

  IF to_move = 0 THEN
    RAISE NOTICE 'board_scoping: nothing to move; no target board needed.';
    RETURN;
  END IF;

  SELECT count(*) INTO name_matches FROM "Board" WHERE "name" = target_name;

  IF name_matches = 0 THEN
    RAISE EXCEPTION
      'board_scoping: % rows need a board, but no board is named %. Edit target_name in 20261104_board_scoping/migration.sql to an existing board name. Boards present: %',
      to_move, target_name,
      COALESCE((SELECT string_agg(quote_literal("name"), ', ' ORDER BY "createdAt") FROM "Board"), '(none)');
  END IF;

  IF name_matches > 1 THEN
    RAISE EXCEPTION
      'board_scoping: % boards are named %. Board names are not unique, so rename one or use its id instead.',
      name_matches, target_name;
  END IF;

  SELECT "id" INTO target_id FROM "Board" WHERE "name" = target_name;

  UPDATE "Persona"        SET "boardId" = target_id WHERE "boardId" IS NULL;
  UPDATE "DictionaryTerm" SET "boardId" = target_id WHERE "boardId" IS NULL;
  UPDATE "Initiative"     SET "boardId" = target_id WHERE "boardId" IS NULL;
  UPDATE "ChangelogEntry" SET "boardId" = target_id WHERE "boardId" IS NULL;

  RAISE NOTICE 'board_scoping: moved % rows to board % (%).', to_move, target_name, target_id;
END $$;

-- ---------------------------------------------------------------------------
-- 3. Now the column can be required everywhere.
-- ---------------------------------------------------------------------------

ALTER TABLE "Persona"        ALTER COLUMN "boardId" SET NOT NULL;
ALTER TABLE "DictionaryTerm" ALTER COLUMN "boardId" SET NOT NULL;
ALTER TABLE "Initiative"     ALTER COLUMN "boardId" SET NOT NULL;
ALTER TABLE "ChangelogEntry" ALTER COLUMN "boardId" SET NOT NULL;

-- ---------------------------------------------------------------------------
-- 4. Foreign keys. ON DELETE CASCADE: these are a board's own furniture, so
--    deleting the board takes them with it. ChangelogEntry's existing key is
--    ON DELETE SET NULL, which is no longer a legal action for a NOT NULL
--    column, so it is replaced rather than added to.
-- ---------------------------------------------------------------------------

ALTER TABLE "ChangelogEntry" DROP CONSTRAINT IF EXISTS "ChangelogEntry_boardId_fkey";

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'Persona_boardId_fkey') THEN
    ALTER TABLE "Persona" ADD CONSTRAINT "Persona_boardId_fkey"
      FOREIGN KEY ("boardId") REFERENCES "Board"("id") ON DELETE CASCADE ON UPDATE CASCADE;
  END IF;

  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'DictionaryTerm_boardId_fkey') THEN
    ALTER TABLE "DictionaryTerm" ADD CONSTRAINT "DictionaryTerm_boardId_fkey"
      FOREIGN KEY ("boardId") REFERENCES "Board"("id") ON DELETE CASCADE ON UPDATE CASCADE;
  END IF;

  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'Initiative_boardId_fkey') THEN
    ALTER TABLE "Initiative" ADD CONSTRAINT "Initiative_boardId_fkey"
      FOREIGN KEY ("boardId") REFERENCES "Board"("id") ON DELETE CASCADE ON UPDATE CASCADE;
  END IF;

  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'ChangelogEntry_boardId_fkey') THEN
    ALTER TABLE "ChangelogEntry" ADD CONSTRAINT "ChangelogEntry_boardId_fkey"
      FOREIGN KEY ("boardId") REFERENCES "Board"("id") ON DELETE CASCADE ON UPDATE CASCADE;
  END IF;
END $$;

CREATE INDEX IF NOT EXISTS "Persona_boardId_idx"        ON "Persona"("boardId");
CREATE INDEX IF NOT EXISTS "DictionaryTerm_boardId_idx" ON "DictionaryTerm"("boardId");
CREATE INDEX IF NOT EXISTS "Initiative_boardId_idx"     ON "Initiative"("boardId");
-- ChangelogEntry_boardId_idx already exists.

-- ---------------------------------------------------------------------------
-- 5. The dictionary's case-insensitive uniqueness becomes per-board.
--    "KYB" may now mean one thing on one board and another elsewhere — that is
--    the point of localising it — but still cannot be defined twice on the
--    same board. Prisma cannot express a functional index, so this is hand-made
--    and the route keeps reporting P2002 as a 409.
-- ---------------------------------------------------------------------------

DROP INDEX IF EXISTS "DictionaryTerm_term_lower_key";

CREATE UNIQUE INDEX IF NOT EXISTS "DictionaryTerm_boardId_term_lower_key"
  ON "DictionaryTerm" ("boardId", LOWER("term"));
