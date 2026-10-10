import { readFileSync, readdirSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';

/**
 * Prisma applies migrations in lexicographic order of their directory names,
 * which is not necessarily the order they were written in. This repo has been
 * bitten by that twice:
 *
 *   20260515_sprint_status  sorted before  20260515_sprints
 *     → ALTER TABLE "Sprint" against a table that did not exist yet
 *
 *   20261007_prd_admin_blocks  sorted before  20261007_prd_builder
 *     → REFERENCES "Prd" against a table that did not exist yet
 *
 * Both only failed against a database that replayed the history — and the
 * second one reached production, where the start command's `;` meant the
 * server booted anyway and the deploy reported SUCCESS with no PRD tables.
 *
 * So the ordering is asserted here rather than left to whoever names the next
 * migration. This reads the real migration files; it needs no database.
 */

const MIGRATIONS_DIR = join(__dirname, '../../../backend/prisma/migrations');

/**
 * The one ordering fault already in this history, recorded rather than
 * asserted away.
 *
 * Fixing it means renaming an applied migration and running
 * `prisma migrate resolve` against production. That has been attempted and
 * reverted three times in this repo, so it is a deliberate decision to leave
 * it, not an oversight. It only affects replaying the history from scratch —
 * every existing database already has the column.
 *
 * Anything *not* on this list fails the test.
 */
const KNOWN_FAULTS = [
  '20260515_sprint_status uses "Sprint", but it is not created until 20260515_sprints',
];

interface Migration {
  name: string;
  sql: string;
  /** Tables this migration creates. */
  creates: string[];
  /** Tables it depends on already existing. */
  needs: string[];
}

function loadMigrations(): Migration[] {
  return readdirSync(MIGRATIONS_DIR, { withFileTypes: true })
    .filter((e) => e.isDirectory())
    .map((e) => e.name)
    // Prisma's own ordering: plain lexicographic on the directory name.
    .sort()
    .map((name) => {
      const sql = readFileSync(join(MIGRATIONS_DIR, name, 'migration.sql'), 'utf8');
      const creates = [...sql.matchAll(/CREATE TABLE(?:\s+IF NOT EXISTS)?\s+"([^"]+)"/gi)].map((m) => m[1]);
      const needs = [
        // A foreign key needs its target table.
        ...[...sql.matchAll(/REFERENCES\s+"([^"]+)"/gi)].map((m) => m[1]),
        // ALTER TABLE needs the table itself.
        ...[...sql.matchAll(/ALTER TABLE\s+"([^"]+)"/gi)].map((m) => m[1]),
        // So does an index on it.
        ...[...sql.matchAll(/CREATE(?:\s+UNIQUE)?\s+INDEX\s+"[^"]+"\s+ON\s+"([^"]+)"/gi)].map((m) => m[1]),
      ];
      return { name, sql, creates, needs };
    });
}

describe('migration order', () => {
  const migrations = loadMigrations();

  it('finds the migrations', () => {
    expect(migrations.length).toBeGreaterThan(10);
  });

  it('never touches a table before the migration that creates it', () => {
    const createdBy = new Map<string, number>();
    migrations.forEach((m, index) => {
      for (const table of m.creates) {
        if (!createdBy.has(table)) createdBy.set(table, index);
      }
    });

    const problems: string[] = [];
    migrations.forEach((m, index) => {
      for (const table of new Set(m.needs)) {
        const createdAt = createdBy.get(table);
        // A table this history never creates came from somewhere else — the
        // very first migration, or a hand-made change. Not this test's business.
        if (createdAt === undefined) continue;
        if (createdAt > index) {
          problems.push(
            `${m.name} uses "${table}", but it is not created until ${migrations[createdAt].name}`
          );
        }
      }
    });

    expect(problems).toEqual(KNOWN_FAULTS);
  });

  it('keeps the PRD migrations in dependency order, builder first', () => {
    const prd = migrations.filter((m) => m.name.includes('_prd_')).map((m) => m.name);
    expect(prd.length).toBeGreaterThanOrEqual(3);
    // Whichever creates "Prd" has to come before the two that reference it.
    const builderIndex = prd.findIndex((n) => n.includes('prd_builder'));
    expect(builderIndex).toBe(0);
  });

  it('every known fault is still real, so the allowance cannot outlive the bug', () => {
    // If someone does fix the sprint ordering, this fails and the allowance
    // above should be deleted — an exception nobody revisits is how the next
    // one gets hidden.
    const names = migrations.map((m) => m.name);
    const sprints = names.indexOf('20260515_sprints');
    const status = names.indexOf('20260515_sprint_status');
    expect(status).toBeLessThan(sprints);
  });
});
