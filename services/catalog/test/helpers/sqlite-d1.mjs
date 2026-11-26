/*
 * A `D1Like` backed by node:sqlite, so the contract suite runs the REAL D1
 * adapter against a REAL SQL engine.
 *
 * THIS IS NOT A MOCK OF THE ADAPTER. The adapter under test is the one that
 * ships; only the transport is swapped, exactly as the CSP tests swap
 * HTMLRewriter. That distinction matters here more than usual: this project
 * has already been bitten once by a test double whose behaviour diverged from
 * the real thing (the in-memory store's quadratic price-history write), and a
 * hand-written fake of `prepare().bind().all()` would be a second one.
 *
 * WHAT IT STILL DOES NOT PROVE, said plainly:
 *   · D1's network behaviour, retries and per-invocation query cap;
 *   · that `batch()` on Cloudflare rolls back exactly as SQLite does here;
 *   · the 100-bound-parameter limit, which SQLite does not enforce.
 * The last one is why `chunkForBinding` is unit-tested separately rather than
 * being left for this harness to catch.
 */
import './require-node.mjs';
import { DatabaseSync } from 'node:sqlite';

/** Mirrors D1's own behaviour: foreign keys are enforced and cannot be off. */
export function createSqliteD1(schemaSql) {
  const db = new DatabaseSync(':memory:');
  db.exec('PRAGMA foreign_keys = ON');
  if (schemaSql) db.exec(schemaSql);

  const statement = (sql, bound = []) => ({
    bind(...values) {
      return statement(sql, values);
    },
    async all() {
      const results = db.prepare(sql).all(...bound);
      return { results, success: true, meta: { rows_read: results.length } };
    },
    async first() {
      const row = db.prepare(sql).get(...bound);
      return row ?? null;
    },
    async run() {
      const info = db.prepare(sql).run(...bound);
      return { results: [], success: true, meta: { changes: Number(info.changes ?? 0) } };
    },
    /** Used by the batch implementation below. */
    __exec() {
      return db.prepare(sql).run(...bound);
    },
  });

  return {
    raw: db,
    prepare: (sql) => statement(sql),
    async exec(sql) {
      db.exec(sql);
    },
    /**
     * Atomic across the array, which is what D1 guarantees for `batch()`.
     * SQLite gives that with an explicit transaction — the one place this
     * harness may use BEGIN, because it is standing in for the transport that
     * provides the guarantee rather than for application code.
     */
    async batch(statements) {
      db.exec('BEGIN');
      try {
        const out = statements.map((s) => {
          const info = s.__exec();
          return { results: [], success: true, meta: { changes: Number(info.changes ?? 0) } };
        });
        db.exec('COMMIT');
        return out;
      } catch (error) {
        db.exec('ROLLBACK');
        throw error;
      }
    },
  };
}

/** The D1 schema, read from the migrations that are actually applied. */
export async function d1Schema() {
  const { readFile } = await import('node:fs/promises');
  const { fileURLToPath } = await import('node:url');
  const { join } = await import('node:path');
  const dir = fileURLToPath(new URL('../../migrations-d1/', import.meta.url));
  const parts = [];
  for (const name of ['0001_catalog_init.sql', '0002_publication_and_admin.sql']) {
    parts.push(await readFile(join(dir, name), 'utf8'));
  }
  // Reading the real migrations rather than a copy is the point: a schema that
  // drifts from what is deployed would make every test here a fiction.
  return parts.join('\n');
}
