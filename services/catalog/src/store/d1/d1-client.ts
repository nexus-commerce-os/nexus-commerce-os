/*
 * The slice of D1 this adapter actually uses.
 *
 * WHY A NARROW INTERFACE RATHER THAN CLOUDFLARE'S TYPES. Two reasons, and the
 * second is the one that matters.
 *
 * 1. The adapter has no business knowing about the rest of the Workers
 *    runtime, and depending on `@cloudflare/workers-types` would drag it in.
 *
 * 2. It lets the contract suite run the SAME adapter against a real SQLite
 *    engine (`node:sqlite`) in Node. That is the difference between testing
 *    the adapter and testing a mock of the adapter — and the in-memory store
 *    has already taught this project once that a test double can be wrong in
 *    ways that look like a passing suite.
 */

export interface D1Result<T = unknown> {
  readonly results: T[];
  readonly success: boolean;
  readonly meta?: {
    readonly changes?: number;
    readonly rows_read?: number;
    readonly rows_written?: number;
  };
}

export interface D1PreparedStatement {
  bind(...values: unknown[]): D1PreparedStatement;
  all<T = unknown>(): Promise<D1Result<T>>;
  run(): Promise<D1Result>;
  first<T = unknown>(): Promise<T | null>;
}

export interface D1Like {
  prepare(sql: string): D1PreparedStatement;
  /**
   * Atomic across the whole array. D1 has no usable BEGIN/COMMIT — it operates
   * in auto-commit — so `batch()` IS the transaction, and a failure anywhere
   * rolls the sequence back.
   */
  batch<T = unknown>(statements: D1PreparedStatement[]): Promise<D1Result<T>[]>;
  exec(sql: string): Promise<unknown>;
}

/**
 * D1 allows at most 100 bound parameters per statement.
 *
 * This is not a tuning constant. Exceeding it is a hard error from the
 * platform, so every multi-row write in this adapter has to be chunked by
 * PARAMETER count rather than by row count — a table with 27 columns fits
 * three rows per statement, not fifty.
 */
export const MAX_BOUND_PARAMS = 100;

/** How many rows of `columnsPerRow` fit inside one statement. */
export function rowsPerStatement(columnsPerRow: number): number {
  if (columnsPerRow < 1) throw new RangeError('a row needs at least one column');
  if (columnsPerRow > MAX_BOUND_PARAMS) {
    throw new RangeError(
      `a single row binds ${columnsPerRow} parameters, over D1's limit of ${MAX_BOUND_PARAMS}; ` +
        `this row cannot be written with bound parameters at all`,
    );
  }
  return Math.floor(MAX_BOUND_PARAMS / columnsPerRow);
}

/** Splits `items` into groups that each fit inside one statement. */
export function chunkForBinding<T>(items: readonly T[], columnsPerRow: number): T[][] {
  const perStatement = rowsPerStatement(columnsPerRow);
  const out: T[][] = [];
  for (let i = 0; i < items.length; i += perStatement) {
    out.push(items.slice(i, i + perStatement));
  }
  return out;
}

/**
 * SQLite stores integers as 64-bit, but a JavaScript number loses precision
 * above 2^53. Money is read back through this so a silently wrong price is
 * impossible: it is either exact or an error.
 */
export function exactInteger(value: unknown, field: string): number {
  if (value === null || value === undefined) {
    throw new TypeError(`${field} is null where a number was required`);
  }
  if (typeof value === 'bigint') {
    if (value > BigInt(Number.MAX_SAFE_INTEGER) || value < BigInt(Number.MIN_SAFE_INTEGER)) {
      throw new RangeError(
        `${field} is ${value}, outside the range a JS number represents exactly — ` +
          `refusing rather than rounding a monetary amount`,
      );
    }
    return Number(value);
  }
  if (typeof value !== 'number' || !Number.isInteger(value)) {
    throw new TypeError(`${field} is ${String(value)}, not an integer`);
  }
  if (!Number.isSafeInteger(value)) {
    throw new RangeError(`${field} is ${value}, beyond exact representation`);
  }
  return value;
}

/** SQLite has no boolean; 0/1 with a CHECK constraint is the storage form. */
export const toInt = (value: boolean): number => (value ? 1 : 0);
export const fromInt = (value: unknown): boolean => value === 1 || value === 1n || value === true;
