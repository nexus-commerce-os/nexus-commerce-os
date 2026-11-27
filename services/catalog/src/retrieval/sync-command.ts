/*
 * The thing a scheduler actually invokes.
 *
 * `runCycle` decides which sources to fetch and fetches them. This wraps it in
 * what an unattended, time-boxed, observable job needs: a deadline, a health
 * summary, structured logs, and an exit status that means something.
 *
 * WHY A DEADLINE AND NOT A TIMEOUT PER SOURCE. Per-source timeouts already
 * exist in the fetcher. A deadline is a different guarantee: it bounds the
 * WHOLE job, so a cron that fires every 15 minutes cannot start overlapping
 * copies of itself because one slow provider stretched a run past the next
 * trigger. When the deadline passes, the remaining sources are left for the
 * next cycle — which is safe precisely because `isDue` measures from the last
 * SUCCESS, so a skipped source is simply still due.
 *
 * MISSED JOBS NEED NO SPECIAL HANDLING, and that is a design property worth
 * stating rather than a gap. A cron that does not fire, a runner that dies, a
 * deadline that cuts a cycle short — all three leave `lastSuccessAt` where it
 * was, so the source is due on the next cycle and is picked up. There is no
 * backlog to replay because the feed is a snapshot, not a stream of events:
 * fetching the newest export once is exactly as correct as fetching the three
 * you missed.
 */

import { runCycle, type CycleReport, type SourceOutcome, type SourceStateStore } from './scheduler';
import type { retrieveFeed } from './retrieve';
import { isFixtureTransport, validateFeedSource, type FeedSource } from './feed-source';
import type { OfferStore } from '../store/offer-store';
import type { RetrieveOptions } from './retrieve';

export interface SyncOptions {
  /** Wall-clock budget for the whole job. */
  readonly deadlineMs?: number;
  readonly concurrency?: number;
  /** Ignore schedules and run every enabled source now. */
  readonly force?: boolean;
  /** Permit `fixture` sources. Demonstrations and tests only. */
  readonly allowFixtures?: boolean;
  readonly now?: () => Date;
  readonly retrieveOptions?: Omit<RetrieveOptions, 'previous' | 'now'>;
  /** One line per event. Defaults to stdout as JSON. */
  readonly log?: (event: Record<string, unknown>) => void;
  /**
   * Injected in tests. Without this the real fetcher runs and these tests
   * become network tests — which is how the first version of this file spent
   * six seconds failing against a DNS lookup for example.com.
   */
  readonly retrieve?: typeof retrieveFeed;
}

export interface SyncResult {
  readonly report: CycleReport;
  readonly health: SourceHealth;
  /** 0 = nothing failed. Non-zero is what tells a scheduler to alert. */
  readonly exitCode: number;
  readonly deadlineHit: boolean;
}

export interface SourceHealth {
  readonly total: number;
  readonly imported: number;
  readonly unchanged: number;
  readonly skipped: number;
  readonly failed: number;
  /** Sources that failed this cycle, for the alert body. */
  readonly failing: readonly { readonly sourceId: string; readonly reason: string }[];
}

const jsonLog = (event: Record<string, unknown>) => {
  // One JSON object per line: greppable, and parseable by a log shipper later
  // without anyone having to write a format parser for prose.
  process.stdout.write(`${JSON.stringify(event)}\n`);
};

export function summarise(outcomes: readonly SourceOutcome[]): SourceHealth {
  const by = (o: SourceOutcome['outcome']) => outcomes.filter((x) => x.outcome === o).length;
  return {
    total: outcomes.length,
    imported: by('imported'),
    unchanged: by('unchanged'),
    skipped: by('skipped'),
    failed: by('failed'),
    failing: outcomes
      .filter((o) => o.outcome === 'failed')
      .map((o) => ({ sourceId: o.sourceId, reason: o.reason })),
  };
}

/**
 * Validates configuration BEFORE any network call.
 *
 * A bad row should fail the job loudly at the start rather than halfway
 * through, when half the catalogue has already been touched.
 */
export function validateSources(
  sources: readonly FeedSource[],
  allowFixtures: boolean,
): readonly string[] {
  const problems: string[] = [];
  const seen = new Set<string>();

  for (const source of sources) {
    for (const problem of validateFeedSource(source)) {
      problems.push(`${source.id}: ${problem}`);
    }
    if (seen.has(source.id)) problems.push(`${source.id}: duplicate source id`);
    seen.add(source.id);

    if (isFixtureTransport(source.transport) && source.enabled && !allowFixtures) {
      problems.push(
        `${source.id}: a fixture source is enabled but fixtures are not permitted in this run`,
      );
    }
  }
  return problems;
}

/**
 * Runs one synchronisation job.
 *
 * Returns rather than throws, and never calls `process.exit` itself: a library
 * that exits the process cannot be tested, and this is the part most worth
 * testing.
 */
export async function runSync(
  sources: readonly FeedSource[],
  store: OfferStore,
  state: SourceStateStore,
  options: SyncOptions = {},
): Promise<SyncResult> {
  const now = options.now ?? (() => new Date());
  const log = options.log ?? jsonLog;
  const started = now();
  const deadlineMs = options.deadlineMs ?? 10 * 60_000;
  const deadlineAt = started.getTime() + deadlineMs;

  const problems = validateSources(sources, options.allowFixtures === true);
  if (problems.length > 0) {
    log({ event: 'sync.invalid_config', at: started.toISOString(), problems });
    return {
      report: {
        startedAt: started.toISOString(),
        finishedAt: now().toISOString(),
        considered: sources.length,
        outcomes: [],
      },
      health: summarise([]),
      exitCode: 2,
      deadlineHit: false,
    };
  }

  const runnable = sources.filter((s) => s.enabled);
  log({
    event: 'sync.start',
    at: started.toISOString(),
    sources: sources.length,
    enabled: runnable.length,
    fixtures: runnable.filter((s) => isFixtureTransport(s.transport)).map((s) => s.id),
    deadlineMs,
    force: options.force === true,
  });

  /*
   * The deadline is enforced by stopping BEFORE starting another source, not
   * by aborting one in flight. Killing an import mid-write would be the one
   * thing the transactional write phase exists to prevent.
   */
  let deadlineHit = false;
  const admitted: FeedSource[] = [];
  for (const source of runnable) {
    if (now().getTime() >= deadlineAt) {
      deadlineHit = true;
      log({ event: 'sync.deadline', at: now().toISOString(), deferred: source.id });
      continue;
    }
    admitted.push(source);
  }

  const report = await runCycle(admitted, store, state, {
    now,
    concurrency: options.concurrency,
    force: options.force === true,
    ...(options.retrieve ? { retrieve: options.retrieve } : {}),
    retrieveOptions: { ...options.retrieveOptions, allowFixtures: options.allowFixtures },
  });

  for (const outcome of report.outcomes) {
    log({
      event: 'sync.source',
      sourceId: outcome.sourceId,
      merchantId: outcome.merchantId,
      outcome: outcome.outcome,
      reason: outcome.reason,
      attempts: outcome.attempts,
      ...(outcome.counts ?? {}),
    });
  }

  const health = summarise(report.outcomes);
  log({
    event: 'sync.finish',
    at: now().toISOString(),
    deadlineHit,
    ...health,
    failing: health.failing,
  });

  return {
    report,
    health,
    // A failed source is an alert. A skipped or unchanged one is not.
    exitCode: health.failed > 0 ? 1 : 0,
    deadlineHit,
  };
}
