import type { Pool, PoolClient, QueryResultRow } from 'pg';

/**
 * Narrow database surface the adapters depend on — just enough to run a
 * parameterised statement. Keeping it this small means an adapter can be handed
 * either the pool or a transaction-bound client without knowing the difference.
 */
export interface SqlExecutor {
  query<R extends QueryResultRow = QueryResultRow>(
    text: string,
    params?: readonly unknown[],
  ): Promise<{ rows: R[]; rowCount: number | null }>;
}

/**
 * Runs `work` inside a single transaction on one connection.
 *
 * Used to keep **one aggregate** consistent when it spans more than one table
 * (a session and its refresh-token family, a user and its profile). It is
 * deliberately *not* a cross-aggregate unit of work: use cases stay autocommit
 * and rely on their fail-safe ordering, so no application code depends on
 * transaction plumbing.
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
    await client.query('ROLLBACK');
    throw error;
  } finally {
    client.release();
  }
}
