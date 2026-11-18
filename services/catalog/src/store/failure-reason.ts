/*
 * Turning a thrown thing into a sentence that is SAFE TO STORE.
 *
 * `import_run.skip_reason` is read by operators, pasted into reports and kept
 * in backups, and the import path's most likely failure is a constraint
 * violation — whose Postgres `detail` quotes the offending row. For this
 * schema that row holds a product title, a price and a CJ tracking URL. So the
 * code and the constraint name are recorded and the message is not.
 *
 * This file has NO database dependency on purpose: it duck-types the two
 * fields it needs, so the import orchestrator can classify a failure without
 * importing a driver and without caring which adapter it is running on.
 */

/** Postgres error codes this context reacts to by name rather than by string. */
export const PG_UNIQUE_VIOLATION = '23505';
export const PG_CHECK_VIOLATION = '23514';
export const PG_IN_FAILED_TRANSACTION = '25P02';

export interface DriverError {
  readonly code?: string;
  readonly constraint?: string;
}

/** The error as a driver error, when it looks like one. */
export function driverErrorOf(error: unknown): DriverError | null {
  if (typeof error !== 'object' || error === null) return null;
  const candidate = error as DriverError;
  return typeof candidate.code === 'string' ? candidate : null;
}

/**
 * A short, content-free description.
 *
 * Deliberately lossy. The full error still propagates to the caller, which is
 * where a stack trace belongs; what gets written to a durable column is only
 * ever the shape of the failure.
 */
export function safeFailureReason(error: unknown): string {
  const driver = driverErrorOf(error);
  if (driver) {
    return driver.constraint
      ? `database ${driver.code} (${driver.constraint})`
      : `database ${driver.code}`;
  }
  if (error instanceof Error) return error.name;
  return 'unknown error';
}
