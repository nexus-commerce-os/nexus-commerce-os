/*
 * The trigger: deciding WHICH feeds to go and get, and then getting them.
 *
 * `retrieveFeed` fetches one source. `importFeedArchive` ingests one archive.
 * This is the loop that connects them on a schedule, and the part that has to
 * be careful about everything a loop over external systems is careless about:
 * running the same job twice, running a hundred at once, letting one provider's
 * outage stop the other twenty, and — the one that actually destroys data —
 * reading a failed fetch as an empty catalogue.
 *
 * DUPLICATE JOB PREVENTION USES THE RUN LEDGER, NOT A NEW TABLE. `beginRun`
 * already writes a row with status `started` before any work, and that row is
 * committed on its own so it survives the rollback of its own write phase. A
 * source with a `started` run is therefore a source someone is already
 * importing, and that is exactly the fact a lock would have stored. Adding a
 * second mechanism would mean two sources of truth that can disagree.
 *
 * A CRASHED JOB MUST NOT BLOCK A SOURCE FOREVER. A `started` run whose process
 * died never reaches a terminal status, so the lock is bounded by age: past
 * `staleRunMinutes` the run is treated as abandoned and the source may run
 * again. The abandoned run stays in the ledger with its status, because
 * "we started and never finished" is a fact an operator needs to see.
 */

import { importFeedArchive, type ImportResult } from '../sync/import-feed';
import type { OfferStore } from '../store/offer-store';
import { isDue, type FeedSource } from './feed-source';
import { retrieveFeed, type FeedValidators, type RetrieveOptions } from './retrieve';

/** Remembered between runs, per source. Supplied and persisted by the caller. */
export interface SourceState {
  readonly lastSuccessAt: Date | null;
  readonly validators?: FeedValidators;
}

export type SourceStateStore = {
  get(sourceId: string): Promise<SourceState | undefined>;
  set(sourceId: string, state: SourceState): Promise<void>;
};

/** One line per source, per cycle. The structured ingestion log. */
export interface SourceOutcome {
  readonly sourceId: string;
  readonly merchantId: string;
  readonly startedAt: string;
  readonly finishedAt: string;
  /**
   * `skipped` covers "not due" and "already running" — both are healthy.
   * `failed` is retrieval or import failing, and is NEVER an empty catalogue.
   */
  readonly outcome: 'imported' | 'unchanged' | 'skipped' | 'failed';
  readonly reason: string;
  readonly attempts: number;
  readonly counts?: {
    readonly added: number;
    readonly removed: number;
    readonly updated: number;
    readonly unchanged: number;
    readonly quarantined: number;
  };
}

export interface CycleReport {
  readonly startedAt: string;
  readonly finishedAt: string;
  readonly considered: number;
  readonly outcomes: readonly SourceOutcome[];
}

export interface SchedulerOptions {
  readonly now?: () => Date;
  /** How many sources may be in flight at once. */
  readonly concurrency?: number;
  /** A `started` run older than this is treated as abandoned. */
  readonly staleRunMinutes?: number;
  /**
   * Run every enabled source regardless of its schedule — manual sync.
   *
   * Deliberately bypasses `isDue` ONLY. An earlier attempt expressed this by
   * moving the clock forward, which would also have made every feed look
   * ancient and tripped the importer's staleness guard. Forcing a sync must
   * not quietly disable a different safety check.
   */
  readonly force?: boolean;
  readonly retrieve?: typeof retrieveFeed;
  readonly retrieveOptions?: Omit<RetrieveOptions, 'previous' | 'now'>;
}

const DEFAULTS = { concurrency: 2, staleRunMinutes: 30 } as const;

/**
 * Whether another process is already importing this source.
 *
 * Reads the ledger rather than holding a lock in memory, so it works across
 * processes — which is the only kind of duplicate that matters, since a single
 * process already serialises itself.
 */
export async function isAlreadyRunning(
  store: OfferStore,
  source: FeedSource,
  now: Date,
  staleRunMinutes: number,
): Promise<boolean> {
  const runs = await store.listRuns(source.merchantId);
  const cutoff = now.getTime() - staleRunMinutes * 60_000;
  return runs.some(
    (run) =>
      run.status === 'started' &&
      run.sourceFeed === sourceFeedKey(source) &&
      Date.parse(run.startedAt) > cutoff,
  );
}

/** The ledger's `sourceFeed` value for a source. One definition, used by both. */
export function sourceFeedKey(source: FeedSource): string {
  return source.id;
}

/** The most recent run that actually applied, which is what `isDue` measures from. */
export async function lastSuccessFor(store: OfferStore, source: FeedSource): Promise<Date | null> {
  const runs = await store.listRuns(source.merchantId);
  const applied = runs
    .filter((r) => r.status === 'applied' && r.sourceFeed === sourceFeedKey(source))
    .map((r) => Date.parse(r.finishedAt ?? r.startedAt))
    .filter((t) => Number.isFinite(t));
  if (applied.length === 0) return null;
  return new Date(Math.max(...applied));
}

/** Runs tasks with a bounded number in flight. */
async function withConcurrency<T>(
  limit: number,
  tasks: readonly (() => Promise<T>)[],
): Promise<T[]> {
  const results: T[] = new Array(tasks.length);
  let next = 0;
  const workers = Array.from({ length: Math.max(1, Math.min(limit, tasks.length)) }, async () => {
    for (;;) {
      const index = next;
      next += 1;
      if (index >= tasks.length) return;
      results[index] = await tasks[index]!();
    }
  });
  await Promise.all(workers);
  return results;
}

/**
 * One scheduling cycle: look at every source, run the ones that are due.
 *
 * Never throws for one source's failure. A scheduler that stops at the first
 * broken provider is a scheduler that silently stops updating everything else.
 */
export async function runCycle(
  sources: readonly FeedSource[],
  store: OfferStore,
  state: SourceStateStore,
  options: SchedulerOptions = {},
): Promise<CycleReport> {
  const now = options.now ?? (() => new Date());
  const concurrency = options.concurrency ?? DEFAULTS.concurrency;
  const staleRunMinutes = options.staleRunMinutes ?? DEFAULTS.staleRunMinutes;
  const retrieve = options.retrieve ?? retrieveFeed;
  const cycleStarted = now().toISOString();

  const tasks = sources.map((source) => async (): Promise<SourceOutcome> => {
    const startedAt = now().toISOString();
    const base = {
      sourceId: source.id,
      merchantId: source.merchantId,
      startedAt,
      attempts: 0,
    };
    const done = (
      outcome: SourceOutcome['outcome'],
      reason: string,
      extra: Partial<SourceOutcome> = {},
    ): SourceOutcome => ({ ...base, finishedAt: now().toISOString(), outcome, reason, ...extra });

    try {
      const known = await state.get(source.id);
      const lastSuccess = known?.lastSuccessAt ?? (await lastSuccessFor(store, source));

      if (!source.enabled) return done('skipped', 'source is disabled');
      if (!options.force && !isDue(source, lastSuccess, now())) {
        return done('skipped', 'not due yet');
      }

      if (await isAlreadyRunning(store, source, now(), staleRunMinutes)) {
        // Healthy, not an error: another process got here first.
        return done('skipped', 'an import for this source is already running');
      }

      const result = await retrieve(source, {
        ...options.retrieveOptions,
        previous: known?.validators,
        now,
      });

      if (result.status === 'failed') {
        /*
         * THE LINE THAT MATTERS MOST IN THIS FILE. A failed retrieval is
         * reported as failed and nothing is imported. It is never turned into
         * an empty feed, because an empty feed reconciles to "every product
         * departed" and would retire the merchant's entire catalogue.
         */
        return done('failed', `retrieval failed: ${result.reason}`, { attempts: result.attempts });
      }

      if (result.status === 'unchanged') {
        await state.set(source.id, { lastSuccessAt: lastSuccess, validators: result.validators });
        return done('unchanged', 'provider reports no change', { attempts: result.attempts });
      }

      let imported: ImportResult;
      try {
        imported = await importFeedArchive(result.body, store, {
          merchantId: source.merchantId,
          sourceFeed: sourceFeedKey(source),
          now: now(),
        });
      } catch (error) {
        // An import that threw leaves the catalogue untouched — the write
        // phase is one transaction — but the attempt is still a fact.
        return done(
          'failed',
          `import threw: ${error instanceof Error ? error.message : String(error)}`,
          {
            attempts: result.attempts,
          },
        );
      }

      // Validators are only remembered after a SUCCESSFUL import. Storing them
      // after a failed one would make the next cycle send If-None-Match, get a
      // 304, and skip the feed it never managed to ingest.
      await state.set(source.id, {
        lastSuccessAt: imported.applied ? now() : lastSuccess,
        validators: result.validators,
      });

      if (!imported.applied) {
        return done(
          'unchanged',
          imported.run.skipReason ?? `not applied (${imported.run.status})`,
          {
            attempts: result.attempts,
          },
        );
      }

      const r = imported.reconciliation;
      return done('imported', `applied (${imported.freshness})`, {
        attempts: result.attempts,
        counts: {
          added: r?.added.length ?? 0,
          removed: r?.removed.length ?? 0,
          updated: r?.updated.length ?? 0,
          unchanged: r?.unchanged.length ?? 0,
          quarantined: imported.quarantined,
        },
      });
    } catch (error) {
      return done('failed', error instanceof Error ? error.message : String(error));
    }
  });

  const outcomes = await withConcurrency(concurrency, tasks);
  return {
    startedAt: cycleStarted,
    finishedAt: now().toISOString(),
    considered: sources.length,
    outcomes,
  };
}

/** An in-memory `SourceStateStore`, for tests and single-process runs. */
export class InMemorySourceState implements SourceStateStore {
  readonly #byId = new Map<string, SourceState>();
  async get(sourceId: string): Promise<SourceState | undefined> {
    return this.#byId.get(sourceId);
  }
  async set(sourceId: string, state: SourceState): Promise<void> {
    this.#byId.set(sourceId, state);
  }
}
