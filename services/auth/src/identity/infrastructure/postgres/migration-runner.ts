import { readdir, readFile } from 'node:fs/promises';
import { join } from 'node:path';
import type { Pool } from 'pg';
import { withTransaction } from './connection';

const MIGRATION_FILE = /^(\d{4})_[a-z0-9_]+\.sql$/;

export interface AppliedMigration {
  readonly version: string;
  readonly appliedAt: Date;
}

/**
 * Applies the numbered `.sql` files in `migrationsDir`, in order, exactly once.
 *
 * Plain SQL on purpose: the CI boundary linter greps these files for DDL that
 * escapes the `identity` schema (docs/06 §4), which an ORM's opaque migration
 * format would defeat. Each file runs inside its own transaction together with
 * the ledger insert, so a failure leaves neither the DDL nor the record behind.
 *
 * Re-running is a no-op, which is what makes it safe to invoke on every boot.
 */
export class MigrationRunner {
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
      await withTransaction(this.pool, async (tx) => {
        await tx.query(sql);
        await tx.query('INSERT INTO identity.schema_migration (version) VALUES ($1)', [version]);
      });
    }
    return pending;
  }

  async applied(): Promise<AppliedMigration[]> {
    await this.ensureLedger();
    const result = await this.pool.query<{ version: string; applied_at: Date }>(
      'SELECT version, applied_at FROM identity.schema_migration ORDER BY version',
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
   * The ledger has to exist before the first migration can be recorded, and the
   * first migration is what creates the schema — so bootstrap both here, using
   * statements that are safe to repeat.
   */
  private async ensureLedger(): Promise<void> {
    await this.pool.query('CREATE SCHEMA IF NOT EXISTS identity');
    await this.pool.query(
      `CREATE TABLE IF NOT EXISTS identity.schema_migration (
         version    text        PRIMARY KEY,
         applied_at timestamptz NOT NULL DEFAULT now()
       )`,
    );
  }
}
