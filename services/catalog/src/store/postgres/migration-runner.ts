/*
 * Applies catalog/migrations/*.sql exactly once, in order.
 *
 * Plain SQL, run by a runner this thin, for the reason stated in the migration
 * itself: CI greps those files for DDL that escapes the `catalog` schema, which
 * an ORM's opaque migration format would defeat.
 *
 * WHY THE LEDGER INSERT IS `ON CONFLICT DO NOTHING` HERE. 0001_catalog_init.sql
 * records itself, so that applying it by hand with psql — which an operator
 * restoring a database will do — leaves the ledger correct rather than empty.
 * The runner would then collide with the file on a primary key. Making the
 * runner's insert tolerant is what lets both paths be right; it is not a
 * weakened guarantee, because the ledger is read before anything is applied and
 * the file list is the source of truth for what is outstanding.
 */
import { readdir, readFile } from 'node:fs/promises';
import { join } from 'node:path';
import type { Pool } from 'pg';
import { withTransaction } from './connection';

const MIGRATION_FILE = /^(\d{4})_[a-z0-9_]+\.sql$/;

export interface AppliedMigration {
  readonly version: string;
  readonly appliedAt: Date;
}

export class CatalogMigrationRunner {
  constructor(
    private readonly pool: Pool,
    private readonly migrationsDir: string,
  ) {}

  /** Applies anything outstanding and returns the versions applied by this call. */
  async migrate(): Promise<string[]> {
    await this.ensureLedger();
    const applied = new Set((await this.applied()).map((m) => m.version));
    const pending = (await this.available()).filter((v) => !applied.has(v));

    for (const version of pending) {
      const sql = await readFile(join(this.migrationsDir, `${version}.sql`), 'utf8');
      // DDL and the ledger row in ONE transaction: a migration that fails
      // half-way leaves neither the tables nor the claim that it ran.
      await withTransaction(this.pool, async (tx) => {
        await tx.query(sql);
        await tx.query(
          `INSERT INTO catalog.schema_migration (version) VALUES ($1)
             ON CONFLICT (version) DO NOTHING`,
          [version],
        );
      });
    }
    return pending;
  }

  async applied(): Promise<AppliedMigration[]> {
    await this.ensureLedger();
    const result = await this.pool.query<{ version: string; applied_at: Date }>(
      'SELECT version, applied_at FROM catalog.schema_migration ORDER BY version',
    );
    return result.rows.map((row) => ({ version: row.version, appliedAt: row.applied_at }));
  }

  /** Migration file names (without `.sql`), in application order. */
  async available(): Promise<string[]> {
    const entries = await readdir(this.migrationsDir);
    return entries
      .filter((name) => MIGRATION_FILE.test(name))
      .map((name) => name.replace(/\.sql$/, ''))
      .sort((a, b) => a.localeCompare(b));
  }

  /**
   * The ledger must exist before the first migration can be recorded, and the
   * first migration is what creates the schema — so bootstrap both with
   * statements that are safe to repeat.
   */
  private async ensureLedger(): Promise<void> {
    await this.pool.query('CREATE SCHEMA IF NOT EXISTS catalog');
    await this.pool.query(
      `CREATE TABLE IF NOT EXISTS catalog.schema_migration (
         version    text        PRIMARY KEY,
         applied_at timestamptz NOT NULL DEFAULT now()
       )`,
    );
  }
}
