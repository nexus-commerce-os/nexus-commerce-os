/*
 * THE DAILY WRITE BUDGET.
 *
 * D1's free tier allows 100,000 rows written per day. Exceeding it does not
 * degrade: writes start failing, which for this system means an import stops
 * half-way and a catalogue is left staged rather than published. That is
 * recoverable — the whole design assumes it — but it is a bad way to find out
 * what a feed costs.
 *
 * ESTIMATED AND AUTHORITATIVE ARE NOT THE SAME NUMBER, and this file is
 * careful never to present one as the other.
 *
 *   · ESTIMATED is what this process has counted from `meta.rows_written` on
 *     its own statements. It is exact for work this process did, and blind to
 *     everything else: another Worker, a migration, an operator with a
 *     database client.
 *
 *   · AUTHORITATIVE is Cloudflare's own figure, from the GraphQL analytics
 *     API. It is the real one, and it lags — analytics are aggregated, so a
 *     write made a minute ago may not appear yet.
 *
 * So the budget is enforced on the ESTIMATE, because it is the number that is
 * current, and the estimate is RECONCILED against the authoritative figure
 * when one is available. A system that budgeted against a lagging number would
 * cheerfully spend the same allowance twice.
 */

export interface BudgetLimits {
  /** Rows the day may write in total. The free tier allows 100,000. */
  readonly dailyWrites: number;
  /**
   * The share a single cycle may spend.
   *
   * Not a nicety: without it, one large first import consumes the whole day
   * and every later cycle — including the cheap ones that keep existing
   * products fresh — is refused until midnight.
   */
  readonly maxCycleFraction: number;
  /**
   * Stop starting new work below this much remaining allowance.
   *
   * Reserved for publication and for the operator. Running out of writes with
   * a generation staged and no allowance to move the pointer is the one state
   * worth engineering around.
   */
  readonly reserve: number;
}

export const FREE_TIER: BudgetLimits = {
  dailyWrites: 100_000,
  // A tenth. Ten full cycles a day is far more than the two the schedule
  // calls for, so this bites only when one cycle is unexpectedly expensive —
  // which is exactly when it should.
  maxCycleFraction: 0.1,
  // 5,000: enough for a publication of several thousand products plus the
  // pointer move, measured at roughly 5 writes per newly published product.
  reserve: 5_000,
};

export interface BudgetUsage {
  /** UTC day, `YYYY-MM-DD`. D1's quota resets at UTC midnight. */
  readonly day: string;
  readonly estimatedWrites: number;
  readonly estimatedReads: number;
  /** Cloudflare's own figure, when it has been fetched. Null otherwise. */
  readonly authoritativeWrites: number | null;
  readonly authoritativeAt: string | null;
  readonly cycles: number;
}

export type BudgetVerdict =
  | { readonly allowed: true; readonly remaining: number; readonly cycleCap: number }
  | {
      readonly allowed: false;
      readonly reason: 'daily_exhausted' | 'reserve_only';
      readonly remaining: number;
      readonly detail: string;
    };

export function utcDay(at: Date): string {
  return at.toISOString().slice(0, 10);
}

/**
 * May a cycle start, and how much may it spend?
 *
 * Pure, so the rule can be read and tested without a database — and so the
 * dashboard can show the same answer the scheduler will give.
 */
export function assessBudget(usage: BudgetUsage, limits: BudgetLimits = FREE_TIER): BudgetVerdict {
  /*
   * The HIGHER of the two numbers.
   *
   * The estimate misses writes this process did not make; the authoritative
   * figure lags behind writes it did. Taking the larger is the only reading
   * that is wrong in the safe direction — it can refuse a cycle that would
   * have fitted, and it cannot permit one that would not.
   */
  const spent = Math.max(usage.estimatedWrites, usage.authoritativeWrites ?? 0);
  const remaining = Math.max(0, limits.dailyWrites - spent);

  if (remaining <= 0) {
    return {
      allowed: false,
      reason: 'daily_exhausted',
      remaining: 0,
      detail: `${spent} of ${limits.dailyWrites} rows written today; the allowance resets at UTC midnight`,
    };
  }

  if (remaining <= limits.reserve) {
    return {
      allowed: false,
      reason: 'reserve_only',
      remaining,
      detail:
        `${remaining} rows remain, at or below the ${limits.reserve} reserved for publication ` +
        'and operator action. Starting an import now could leave a generation staged with no ' +
        'allowance to publish it',
    };
  }

  return {
    allowed: true,
    remaining,
    cycleCap: Math.min(
      remaining - limits.reserve,
      Math.floor(limits.dailyWrites * limits.maxCycleFraction),
    ),
  };
}

/**
 * Counts what this process writes, and knows when it has spent its cap.
 *
 * Deliberately a counter and not an enforcer: it cannot stop a statement
 * mid-flight, and pretending otherwise would be the kind of guarantee that
 * reads as true and is not. What it gives the caller is the moment to stop
 * starting new work.
 */
export class CycleMeter {
  private written = 0;
  private read = 0;
  private requests = 0;

  constructor(readonly cap: number) {}

  /*
   * `rows_written` is D1's own figure and includes index entries. When it is
   * absent — an older runtime, or a transport that does not report it — the
   * fallback is `changes`, which counts table rows only and is therefore a
   * FLOOR rather than the true cost.
   *
   * The fallback matters more than it looks. Reading a missing field as zero
   * would make a busy cycle appear free, and a budget that silently believes
   * it has spent nothing is no budget at all. An undercount refuses too late;
   * a zero never refuses.
   */
  record(meta: { rows_written?: number; rows_read?: number; changes?: number } | undefined): void {
    this.requests += 1;
    const written = meta?.rows_written ?? meta?.changes ?? 0;
    this.written += Number(written);
    this.read += Number(meta?.rows_read ?? 0);
  }

  get rowsWritten(): number {
    return this.written;
  }
  get rowsRead(): number {
    return this.read;
  }
  get statements(): number {
    return this.requests;
  }
  /** True once the cap is reached. Checked BETWEEN sources, never mid-import. */
  get exhausted(): boolean {
    return this.written >= this.cap;
  }
  get remaining(): number {
    return Math.max(0, this.cap - this.written);
  }
}

/**
 * Wraps a `D1Like` so every statement's `meta` is counted.
 *
 * The adapters already return `meta`; nothing else had been reading it. This
 * is the whole mechanism — no sampling, no estimate of an estimate.
 */
export function meteredD1<T extends MeterableD1>(db: T, meter: CycleMeter): T {
  /*
   * A PROXY, NOT A REBUILT OBJECT.
   *
   * The first version returned a fresh `{bind, all, run, first}` literal, and
   * it broke both harnesses: each transport keeps its own internals on the
   * statement — `__exec` on the SQLite one, `__send` on the HTTP one — and a
   * rebuilt object silently dropped them, so `batch()` failed with
   * "s.__exec is not a function".
   *
   * A real D1PreparedStatement is a class instance, so a spread would lose
   * its prototype methods for the same reason. Intercepting only the three
   * calls that carry `meta` leaves everything else exactly as it was.
   */
  const wrapStatement = (statement: D1StatementLike): D1StatementLike =>
    new Proxy(statement, {
      get(target, property, receiver) {
        if (property === 'bind') {
          return (...values: unknown[]) => wrapStatement(target.bind(...values));
        }
        if (property === 'all') {
          return async () => {
            const out = await target.all();
            meter.record(out.meta);
            return out;
          };
        }
        if (property === 'run') {
          return async () => {
            const out = await target.run();
            meter.record(out.meta);
            return out;
          };
        }
        const value = Reflect.get(target, property, receiver);
        // Bound to the TARGET: an internal that closes over `this` must not
        // receive the proxy, or it re-enters this trap on every access.
        return typeof value === 'function' ? value.bind(target) : value;
      },
    });

  return new Proxy(db, {
    get(target, property, receiver) {
      if (property === 'prepare') {
        return (sql: string) => wrapStatement(target.prepare(sql));
      }
      if (property === 'batch') {
        return async (statements: D1StatementLike[]) => {
          const out = await target.batch(statements);
          for (const result of out) meter.record(result?.meta);
          return out;
        };
      }
      const value = Reflect.get(target, property, receiver);
      return typeof value === 'function' ? value.bind(target) : value;
    },
  }) as T;
}

interface D1Meta {
  rows_written?: number;
  rows_read?: number;
  /** The fallback when a transport does not report rows_written. A floor. */
  changes?: number;
}

interface D1StatementLike {
  bind(...values: unknown[]): D1StatementLike;
  all(): Promise<{ meta?: D1Meta }>;
  run(): Promise<{ meta?: D1Meta }>;
  first(...args: unknown[]): Promise<unknown>;
}

interface MeterableD1 {
  prepare(sql: string): D1StatementLike;
  batch(statements: D1StatementLike[]): Promise<{ meta?: D1Meta }[]>;
  exec(sql: string): Promise<unknown>;
}
