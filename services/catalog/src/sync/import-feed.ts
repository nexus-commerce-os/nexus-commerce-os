/*
 * One import: archive in, reconciled store out.
 *
 * ORDER MATTERS, AND IT IS THIS: open the archive, hash the payload, refuse a
 * payload already applied, parse, refuse a stale or inconsistent export, build
 * and validate offers, reconcile, then write. Every refusal happens before a
 * single row is written, so a rejected import leaves the store exactly as it
 * was and the ledger explains why.
 *
 * THE RUN IS RECORDED EVEN WHEN NOTHING IS APPLIED. A duplicate, stale or
 * failed feed writes a run row with the reason, because "we looked and
 * declined" and "we never ran" are different facts and an operator needs to
 * tell them apart. `beginRun` is committed on its own for exactly this reason:
 * the attempt has to survive the rollback of its own write phase.
 *
 * THE WRITE PHASE IS ONE UNIT OF WORK, and the run's transition to `applied`
 * is inside it. That is what makes idempotency load-bearing rather than
 * advisory: two processes importing the same export both pass the pre-flight
 * check, and the loser fails on `import_run_applied_once` and takes its
 * half-written catalogue down with it. A partially applied feed is not a
 * degraded catalogue, it is a wrong one.
 *
 * THIS MODULE ACTIVATES NOTHING. It stores a tracking URL because serving one
 * is eventually the point, but nothing here publishes a link. Whether a link may
 * be published is a merchant-approval question, decided by whatever front end
 * consumes this catalogue and enforced there — never inferred from the fact that
 * a feed arrived.
 */
import { randomUUID } from 'node:crypto';

import {
  assessFeedWindow,
  buildCatalog,
  feedExportWindow,
  feedExportedAt,
  isReleasable,
  parseShoppingFeed,
} from '../index';
import { readDelimitedPayload } from '../feed/archive';
import { safeFailureReason } from '../store/failure-reason';
import { reconcile, type Reconciliation } from './reconcile';
import {
  DuplicateApplyError,
  toStoredOffer,
  type ImportRun,
  type OfferStore,
  type PriceHistoryEntry,
  type QuarantineEntry,
} from '../store/offer-store';

export interface ImportOptions {
  readonly merchantId: string;
  readonly sourceFeed: string;
  /** Injected so tests and reports are deterministic. */
  readonly now?: Date;
  /**
   * Import a feed older than the 48-hour guard anyway. Off by default and
   * never set by a scheduled run: a stale feed is exactly what the guard is
   * for. A backfill from a known-old export is the only honest use.
   */
  readonly allowStale?: boolean;
}

export interface ImportResult {
  readonly run: ImportRun;
  readonly applied: boolean;
  readonly reconciliation: Reconciliation | null;
  readonly quarantined: number;
  readonly freshness: string;
}

export async function importFeedArchive(
  archive: Buffer,
  store: OfferStore,
  options: ImportOptions,
): Promise<ImportResult> {
  const now = options.now ?? new Date();
  const at = now.toISOString();
  const payload = readDelimitedPayload(archive);

  // Idempotency first: the cheapest refusal, before any parsing work.
  const alreadyApplied = await store.findAppliedRun(options.merchantId, payload.sha256);

  const parse = parseShoppingFeed(payload.text);
  const window = feedExportWindow(parse.rows);
  const exportedAt = feedExportedAt(parse.rows);
  const freshness = assessFeedWindow(window, now);

  const runId = randomUUID();
  await store.beginRun({
    id: runId,
    merchantId: options.merchantId,
    sourceFeed: options.sourceFeed,
    contentSha256: payload.sha256,
    feedExportedAt: exportedAt,
    startedAt: at,
    rowsTotal: parse.rows.length,
    offersAdded: null,
    offersRemoved: null,
    offersUpdated: null,
    offersUnchanged: null,
    rowsQuarantined: null,
    skipReason: null,
    status: 'started',
  });

  const readRun = async (): Promise<ImportRun> => {
    const runs = await store.listRuns(options.merchantId);
    return runs.find((r) => r.id === runId) as ImportRun;
  };

  /** Ends the run OUTSIDE any transaction — used for every non-applied end. */
  const finish = async (
    status: ImportRun['status'],
    patch: Partial<ImportRun> = {},
  ): Promise<ImportRun> => {
    await store.finishRun(runId, { status, finishedAt: new Date().toISOString(), ...patch });
    return readRun();
  };

  if (alreadyApplied) {
    /*
     * KNOWN EDGE, stated rather than hidden. Idempotency keyed on content
     * means a payload byte-identical to one already applied is refused — even
     * if the store has drifted since, so a product retired between the two
     * would NOT be revived by re-feeding the older identical export.
     *
     * It cannot arise with these exports: every CJ row carries LAST_UPDATED,
     * which is a per-generation stamp and moved on 224 of 224 common products
     * between 9 and 10 November, so two generations never hash alike. It is
     * left as-is because the alternative — re-applying whenever the store
     * might have drifted — would re-apply on every retry and defeat the
     * property this key exists to provide. A provider that emits a stamp-free
     * feed would need a different key, and that is the signal to revisit.
     */
    const run = await finish('skipped_duplicate', {
      skipReason: `payload already applied in run ${alreadyApplied.id}`,
    });
    return { run, applied: false, reconciliation: null, quarantined: 0, freshness: freshness.kind };
  }

  if (!isReleasable(freshness) && options.allowStale !== true) {
    const run = await finish('skipped_stale', { skipReason: `feed freshness: ${freshness.kind}` });
    return { run, applied: false, reconciliation: null, quarantined: 0, freshness: freshness.kind };
  }

  const built = buildCatalog(parse, {
    merchantId: options.merchantId,
    sourceFeed: options.sourceFeed,
    feedSnapshotAt: exportedAt ?? at,
    now,
  });

  const stored = await store.listOffers(options.merchantId);
  const result = reconcile(stored, built.offers);

  const quarantine: QuarantineEntry[] = built.rejected.map((row) => ({
    importRunId: runId,
    merchantId: options.merchantId,
    rowNumber: row.rowNumber,
    merchantOfferId: row.merchantOfferId,
    reasons: row.reasons,
  }));

  // Writes begin only here, once nothing can refuse the import — and all of
  // them, including the run's own transition to `applied`, are one unit of work.
  try {
    await store.applyRun(async (tx) => {
      const history: PriceHistoryEntry[] = [];

      for (const offer of result.added) {
        const row = toStoredOffer(offer, { id: runId, at }, null);
        await tx.upsertOffer(row);
        history.push({
          offerId: row.id,
          importRunId: runId,
          observedAt: at,
          listPrice: offer.listPrice,
          salePrice: offer.salePrice,
          changeKind: 'initial',
        });
      }

      for (const change of result.updated) {
        const row = toStoredOffer(change.incoming, { id: runId, at }, change.previous);
        await tx.upsertOffer(row);
        // History records price MOVEMENT, not every sighting: 225 identical
        // rows a day is noise, and the question the table answers is when a
        // price moved.
        if (change.priceChange) {
          history.push({
            offerId: row.id,
            importRunId: runId,
            observedAt: at,
            listPrice: change.incoming.listPrice,
            salePrice: change.incoming.salePrice,
            changeKind: change.priceChange,
          });
        }
      }

      /*
       * Unchanged offers still get their sighting refreshed, so "last seen"
       * means what it says and an inactivity sweep cannot retire a product the
       * feed is still carrying.
       *
       * `inactiveSince` is cleared here too, not just `state`. A product that
       * went away and came back with identical prices takes this branch rather
       * than the update branch — the first version set the state and left the
       * timestamp, so a revived offer read as active while still carrying the
       * date it went away. Reviving is one fact, and both fields carry it.
       */
      for (const previous of result.unchanged) {
        await tx.upsertOffer({
          ...previous,
          lastSeenRun: runId,
          lastSeenAt: at,
          state: 'active',
          inactiveSince: null,
        });
      }

      if (result.removed.length > 0) {
        await tx.markInactive(
          result.removed.map((o) => o.id),
          at,
          runId,
        );
      }

      await tx.appendPriceHistory(history);
      await tx.recordQuarantine(quarantine);

      await tx.finishRun(runId, {
        status: 'applied',
        finishedAt: new Date().toISOString(),
        offersAdded: result.added.length,
        offersRemoved: result.removed.length,
        offersUpdated: result.updated.length,
        offersUnchanged: result.unchanged.length,
        rowsQuarantined: quarantine.length,
      });
    });
  } catch (error) {
    if (error instanceof DuplicateApplyError) {
      /*
       * Another run applied this exact payload while this one was working. Its
       * writes are gone with the transaction, so this is a duplicate rather
       * than a failure — the same outcome as the pre-flight check above, just
       * discovered later and by the database.
       */
      const run = await finish('skipped_duplicate', {
        skipReason: 'payload applied concurrently by another run',
      });
      return {
        run,
        applied: false,
        reconciliation: null,
        quarantined: 0,
        freshness: freshness.kind,
      };
    }

    // Record the failure, then re-throw: the ledger is for the operator, the
    // exception is for the caller. `safeFailureReason` is what keeps a
    // constraint violation's quoted row out of a durable column.
    await finish('failed', { skipReason: safeFailureReason(error) });
    throw error;
  }

  return {
    run: await readRun(),
    applied: true,
    reconciliation: result,
    quarantined: quarantine.length,
    freshness: freshness.kind,
  };
}
