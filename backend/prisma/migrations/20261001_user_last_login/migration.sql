-- Last successful sign-in, shown on every user profile so the team can see who
-- is active.
--
-- Additive and nullable: nothing is backfilled, so existing users read as
-- "never signed in" until their next sign-in. IF NOT EXISTS so a re-run or an
-- out-of-order apply cannot fail the deploy — this backend runs
-- `prisma migrate deploy` on every boot.
ALTER TABLE "User" ADD COLUMN IF NOT EXISTS "lastLoginAt" TIMESTAMP(3);
