/*
 * The narrow database surface the catalog adapters depend on.
 *
 * Just enough to run a parameterised statement, so one adapter class can be
 * handed either the pool or a transaction-bound client without knowing the
 * difference.
 *
 * It is deliberately local to this context rather than shared. Each bounded
 * context owns its own schema under its own database role (docs/06 §4,
 * ADR-0020), and a context that imported another's infrastructure would be
 * reaching across exactly the boundary that design exists to keep — so a
 * sibling context defining the same two-method surface is intended duplication,
 * not an accident.
 */
import type { Pool, PoolClient, QueryResultRow } from 'pg';

export interface SqlExecutor {
  query<R extends QueryResultRow = QueryResultRow>(
    text: string,
    params?: readonly unknown[],
  ): Promise<{ rows: R[]; rowCount: number | null }>;
}

/**
 * Runs `work` inside a single transaction on one connection.
 *
 * This is the import's unit of work, and unlike the auth service's use of the
 * same helper it IS cross-table on purpose: offers, price history, quarantine
 * and the run's transition to `applied` are one fact about one export. A
 * partially applied feed is not a degraded catalogue, it is a wrong one.
 */
export async function withTransaction<T>(
  pool: Pool,
  work: (tx: SqlExecutor) => Promise<T>,
): Promise<T> {
  const client: PoolClient = await pool.connect();
  try {
    await client.query('BEGIN');
    const result = await work(client);
    await client.query('COMMIT');
    return result;
  } catch (error) {
    // ROLLBACK can itself fail if the connection died mid-transaction. The
    // original error is the one worth reporting, so the rollback's is dropped
    // rather than allowed to mask it.
    try {
      await client.query('ROLLBACK');
    } catch {
      /* the server already discarded the transaction */
    }
    throw error;
  } finally {
    client.release();
  }
}

/*
 * Error classification lives in ../failure-reason.ts, which has no driver
 * dependency, so the import orchestrator can use it without importing `pg`.
 */
export {
  driverErrorOf as pgErrorOf,
  safeFailureReason,
  PG_CHECK_VIOLATION,
  PG_UNIQUE_VIOLATION,
} from '../failure-reason';
