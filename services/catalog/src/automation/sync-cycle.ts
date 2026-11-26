/*
 * ONE SCHEDULED CYCLE, END TO END.
 *
 * Retrieval already works against any `OfferStore`, and `D1OfferStore` is one.
 * Publication already works. What did not exist was the thing that runs them
 * both on a timer, decides whether it may, and writes down what happened.
 *
 * THE ORDER IS THE DESIGN:
 *
 *   1. is automation paused?        — the one-line stop, before any read
 *   2. is there budget?             — before any write
 *   3. retrieve and import          — per source, failures isolated
 *   4. publish                      — one atomic pointer move
 *   5. record the cost and health   — including when the answer was "no"
 *
 * A CYCLE THAT WAS REFUSED IS STILL RECORDED. A scheduler that writes a row
 * only when it succeeds looks exactly like one that never fired, and "did the
 * cron run?" is the first question anybody asks.
 *
 * NOTHING HERE THROWS FOR ONE SOURCE'S FAILURE. That rule already lives in
 * `runCycle`; this file keeps it and adds the one it needs: a failed
 * RETRIEVAL must never reach publication as an empty catalogue. It does not
 * have to try — `publishCatalogue` reads the database, not this cycle's
 * results, and the cliff guard refuses a collapse whatever caused it.
 */
import { runCycle, type CycleReport, type SchedulerOptions } from '../retrieval/scheduler';
import { GenerationPublisher, type PruneOutcome } from '../publication/publisher';
import { D1OfferStore } from '../store/d1/d1-offer-store';
import type { D1Like } from '../store/d1/d1-client';
import { CatalogD1 } from './catalog-store';
import { D1FeedSourceStore, type FeedSourceRow } from './feed-source-store';
import { publishCatalogue, type PublishCatalogueResult } from './publish-catalogue';
import {
  CycleMeter,
  FREE_TIER,
  assessBudget,
  meteredD1,
  utcDay,
  type BudgetLimits,
  type BudgetUsage,
  type BudgetVerdict,
} from './quota';
import type { ValidationLimits } from '../publication/generation';

export type CycleTrigger = 'scheduled' | 'manual' | 'test';

export type CycleOutcome = 'ran' | 'paused' | 'budget_exhausted' | 'failed';

export interface SyncCycleOptions {
  readonly now: Date;
  readonly trigger: CycleTrigger;
  readonly budget?: BudgetLimits;
  readonly publishLimits?: ValidationLimits;
  /** Passed through to the retrieval loop. */
  readonly scheduler?: Omit<SchedulerOptions, 'now'>;
  /** Skip publication — retrieval only. For a diagnostic run. */
  readonly importOnly?: boolean;
}

export interface SyncCycleResult {
  readonly id: string;
  readonly outcome: CycleOutcome;
  readonly detail: string | null;
  readonly budget: BudgetVerdict;
  readonly retrieval: CycleReport | null;
  readonly publication: PublishCatalogueResult | null;
  /** What retention removed, or null when it did not run. */
  readonly pruned: PruneOutcome | null;
  readonly cost: {
    readonly rowsWritten: number;
    readonly rowsRead: number;
    readonly statements: number;
  };
}

export async function runSyncCycle(
  db: D1Like,
  options: SyncCycleOptions,
): Promise<SyncCycleResult> {
  const at = options.now.toISOString();
  const id = `cycle-${at}-${options.trigger}`;
  const limits = options.budget ?? FREE_TIER;

  const catalog = new CatalogD1(db);
  const quota = new QuotaD1(db);

  const finish = async (
    outcome: CycleOutcome,
    detail: string | null,
    extra: Partial<SyncCycleResult> = {},
    meter?: CycleMeter,
  ): Promise<SyncCycleResult> => {
    const cost = meter
      ? { rowsWritten: meter.rowsWritten, rowsRead: meter.rowsRead, statements: meter.statements }
      : { rowsWritten: 0, rowsRead: 0, statements: 0 };
    await recordCycle(db, {
      id,
      startedAt: at,
      finishedAt: new Date(Math.max(options.now.getTime(), Date.now())).toISOString(),
      trigger: options.trigger,
      outcome,
      retrieval: extra.retrieval ?? null,
      generation: extra.publication?.outcome?.generation ?? null,
      cost,
      detail,
    });
    if (meter && (meter.rowsWritten > 0 || meter.rowsRead > 0)) {
      await quota.add(utcDay(options.now), meter.rowsWritten, meter.rowsRead, at);
    }
    return {
      id,
      outcome,
      detail,
      budget: extra.budget ?? {
        allowed: false,
        reason: 'daily_exhausted',
        remaining: 0,
        detail: '',
      },
      retrieval: extra.retrieval ?? null,
      publication: extra.publication ?? null,
      pruned: extra.pruned ?? null,
      cost,
    };
  };

  // ── 1. the one-line stop ──
  const config = await catalog.automationConfig();
  if (config.paused) {
    return finish('paused', config.pausedReason);
  }

  // ── 2. the budget ──
  const usage = await quota.usage(utcDay(options.now));
  const verdict = assessBudget(usage, limits);
  if (!verdict.allowed) {
    return finish('budget_exhausted', verdict.detail, { budget: verdict });
  }

  const meter = new CycleMeter(verdict.cycleCap);
  const metered = meteredD1(db, meter);
  const sources = new D1FeedSourceStore(metered);
  const store = new D1OfferStore(metered);

  let runnable: readonly FeedSourceRow[];
  try {
    runnable = await sources.runnable();
  } catch (error) {
    return finish('failed', `could not read the feed sources: ${(error as Error).message}`, {
      budget: verdict,
    });
  }

  // ── 3. retrieve and import ──
  let retrieval: CycleReport | null = null;
  if (runnable.length > 0) {
    retrieval = await runCycle(runnable, store, sources, {
      ...options.scheduler,
      now: () => options.now,
    });
    await recordHealth(metered, retrieval, at);
  }

  /*
   * The budget is checked AGAIN before publication, not only before
   * retrieval. A first import can be far more expensive than the estimate the
   * cycle started with, and the reserve exists precisely so that publication
   * still has room — but if retrieval has eaten the cycle cap anyway, staging
   * a generation that cannot be published is worse than not starting one.
   */
  if (meter.exhausted) {
    return finish(
      'budget_exhausted',
      `retrieval used the whole cycle allowance of ${verdict.cycleCap} rows; publication deferred to the next cycle`,
      { budget: verdict, retrieval },
      meter,
    );
  }

  if (options.importOnly === true) {
    return finish(
      'ran',
      'import only; publication was not attempted',
      { budget: verdict, retrieval },
      meter,
    );
  }

  // ── 4. publish ──
  let publication: PublishCatalogueResult;
  try {
    publication = await publishCatalogue(metered, {
      now: options.now,
      limits: options.publishLimits,
      decidedBy: `scheduler:${options.trigger}`,
    });
  } catch (error) {
    return finish(
      'failed',
      `publication threw: ${(error as Error).message}`,
      {
        budget: verdict,
        retrieval,
      },
      meter,
    );
  }

  /*
   * ── 5. retention ──
   *
   * `prune` existed and nothing called it, which is the same mistake the cron
   * was: a cleanup nobody invokes is not bounded retention. Measured on
   * staging, candidate rows accumulated at roughly 21 per cycle and simply
   * stayed.
   *
   * Only after a SUCCESSFUL publication, so a refused generation is not
   * tidied away before anybody has looked at why it was refused. Bounded by
   * `maxDeletes`, and the remaining cycle allowance, because cleanup that can
   * consume the daily write budget is not cleanup.
   */
  let pruned: Awaited<ReturnType<GenerationPublisher['prune']>> | null = null;
  if (publication.outcome !== null && !meter.exhausted) {
    try {
      pruned = await new GenerationPublisher(metered).prune({
        keep: 5,
        maxDeletes: Math.min(2_000, meter.remaining),
      });
    } catch (error) {
      // A failed cleanup must not fail a successful publication. The
      // catalogue is live and correct; the history is merely longer.
      pruned = null;
      console.warn(`prune failed, which is not fatal: ${(error as Error).message}`);
    }
  }

  const detail = publication.rejected
    ? `publication refused: ${publication.rejected.code}`
    : publication.skipped
      ? `publication skipped: ${publication.skipped}`
      : null;

  return finish('ran', detail, { budget: verdict, retrieval, publication, pruned }, meter);
}

/* ─────────────────────────── the quota table ─────────────────────────── */

export class QuotaD1 {
  constructor(private readonly db: D1Like) {}

  async usage(day: string): Promise<BudgetUsage> {
    const row = await this.db
      .prepare(
        `SELECT day, estimated_writes, estimated_reads, authoritative_writes,
                authoritative_at, cycles
           FROM catalog_quota_usage WHERE day = ?`,
      )
      .bind(day)
      .first<Record<string, unknown>>();
    if (!row) {
      return {
        day,
        estimatedWrites: 0,
        estimatedReads: 0,
        authoritativeWrites: null,
        authoritativeAt: null,
        cycles: 0,
      };
    }
    return {
      day: String(row.day),
      estimatedWrites: Number(row.estimated_writes ?? 0),
      estimatedReads: Number(row.estimated_reads ?? 0),
      authoritativeWrites:
        row.authoritative_writes === null || row.authoritative_writes === undefined
          ? null
          : Number(row.authoritative_writes),
      authoritativeAt:
        row.authoritative_at === null || row.authoritative_at === undefined
          ? null
          : String(row.authoritative_at),
      cycles: Number(row.cycles ?? 0),
    };
  }

  /** Adds this cycle's cost. Accumulates, because a day has many cycles. */
  async add(day: string, writes: number, reads: number, at: string): Promise<void> {
    await this.db
      .prepare(
        `INSERT INTO catalog_quota_usage
           (day, estimated_writes, estimated_reads, cycles, updated_at)
         VALUES (?,?,?,1,?)
         ON CONFLICT (day) DO UPDATE SET
           estimated_writes = estimated_writes + excluded.estimated_writes,
           estimated_reads  = estimated_reads + excluded.estimated_reads,
           cycles           = cycles + 1,
           updated_at       = excluded.updated_at`,
      )
      .bind(day, writes, reads, at)
      .run();
  }

  /**
   * Records Cloudflare's own figure.
   *
   * Kept apart from the estimate rather than replacing it: the estimate is
   * current and blind, this is complete and late, and a reader needs to be
   * able to see both and the gap between them.
   */
  async recordAuthoritative(day: string, writes: number, at: string): Promise<void> {
    await this.db
      .prepare(
        `INSERT INTO catalog_quota_usage (day, authoritative_writes, authoritative_at, updated_at)
         VALUES (?,?,?,?)
         ON CONFLICT (day) DO UPDATE SET
           authoritative_writes = excluded.authoritative_writes,
           authoritative_at = excluded.authoritative_at,
           updated_at = excluded.updated_at`,
      )
      .bind(day, writes, at, at)
      .run();
  }

  async recent(days = 14): Promise<readonly BudgetUsage[]> {
    const out = await this.db
      .prepare(
        `SELECT day, estimated_writes, estimated_reads, authoritative_writes,
                authoritative_at, cycles
           FROM catalog_quota_usage ORDER BY day DESC LIMIT ?`,
      )
      .bind(days)
      .all<Record<string, unknown>>();
    return out.results.map((row) => ({
      day: String(row.day),
      estimatedWrites: Number(row.estimated_writes ?? 0),
      estimatedReads: Number(row.estimated_reads ?? 0),
      authoritativeWrites:
        row.authoritative_writes === null || row.authoritative_writes === undefined
          ? null
          : Number(row.authoritative_writes),
      authoritativeAt:
        row.authoritative_at === null || row.authoritative_at === undefined
          ? null
          : String(row.authoritative_at),
      cycles: Number(row.cycles ?? 0),
    }));
  }
}

/* ──────────────────────────── the cycle log ──────────────────────────── */

async function recordCycle(
  db: D1Like,
  entry: {
    id: string;
    startedAt: string;
    finishedAt: string;
    trigger: CycleTrigger;
    outcome: CycleOutcome;
    retrieval: CycleReport | null;
    generation: number | null;
    cost: { rowsWritten: number; rowsRead: number };
    detail: string | null;
  },
): Promise<void> {
  const outcomes = entry.retrieval?.outcomes ?? [];
  await db
    .prepare(
      `INSERT INTO catalog_sync_cycle
         (id, started_at, finished_at, trigger, outcome,
          sources_considered, sources_imported, sources_unchanged, sources_failed,
          rows_written, rows_read, generation, detail)
       VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?)
       ON CONFLICT (id) DO UPDATE SET
         finished_at = excluded.finished_at,
         outcome = excluded.outcome,
         sources_considered = excluded.sources_considered,
         sources_imported = excluded.sources_imported,
         sources_unchanged = excluded.sources_unchanged,
         sources_failed = excluded.sources_failed,
         rows_written = excluded.rows_written,
         rows_read = excluded.rows_read,
         generation = excluded.generation,
         detail = excluded.detail`,
    )
    .bind(
      entry.id,
      entry.startedAt,
      entry.finishedAt,
      entry.trigger,
      entry.outcome,
      entry.retrieval?.considered ?? 0,
      outcomes.filter((o) => o.outcome === 'imported').length,
      outcomes.filter((o) => o.outcome === 'unchanged').length,
      outcomes.filter((o) => o.outcome === 'failed').length,
      entry.cost.rowsWritten,
      entry.cost.rowsRead,
      entry.generation,
      entry.detail,
    )
    .run();
}

/**
 * Consecutive failures per source.
 *
 * Reset to zero on any non-failure, incremented otherwise — so "broken since
 * Tuesday" and "failed once an hour ago" are different numbers rather than the
 * same boolean.
 */
async function recordHealth(db: D1Like, report: CycleReport, at: string): Promise<void> {
  const statements = report.outcomes.map((outcome) =>
    outcome.outcome === 'failed'
      ? db
          .prepare(
            `UPDATE catalog_feed_source
                SET consecutive_failures = consecutive_failures + 1,
                    last_failure_at = ?, last_failure_reason = ?, last_attempt_at = ?
              WHERE id = ?`,
          )
          .bind(at, outcome.reason.slice(0, 500), at, outcome.sourceId)
      : db
          .prepare(
            `UPDATE catalog_feed_source
                SET consecutive_failures = 0, last_attempt_at = ?
              WHERE id = ?`,
          )
          .bind(at, outcome.sourceId),
  );
  const BATCH = 40;
  for (let i = 0; i < statements.length; i += BATCH) {
    await db.batch(statements.slice(i, i + BATCH));
  }
}

/** The cycle log, newest first. For the dashboard and for "did the cron run?". */
export async function recentCycles(
  db: D1Like,
  limit = 20,
): Promise<
  readonly {
    id: string;
    startedAt: string;
    finishedAt: string | null;
    trigger: string;
    outcome: string;
    rowsWritten: number;
    generation: number | null;
    detail: string | null;
  }[]
> {
  const out = await db
    .prepare(
      `SELECT id, started_at, finished_at, trigger, outcome, rows_written, generation, detail
         FROM catalog_sync_cycle ORDER BY started_at DESC LIMIT ?`,
    )
    .bind(limit)
    .all<Record<string, unknown>>();
  return out.results.map((row) => ({
    id: String(row.id),
    startedAt: String(row.started_at),
    finishedAt:
      row.finished_at === null || row.finished_at === undefined ? null : String(row.finished_at),
    trigger: String(row.trigger),
    outcome: String(row.outcome),
    rowsWritten: Number(row.rows_written ?? 0),
    generation:
      row.generation === null || row.generation === undefined ? null : Number(row.generation),
    detail: row.detail === null || row.detail === undefined ? null : String(row.detail),
  }));
}
