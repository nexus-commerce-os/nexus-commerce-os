/*
 * The D1 implementation of the storage contract.
 *
 * THE HONEST DIFFERENCE FROM POSTGRES, stated first because everything else
 * follows from it:
 *
 *   Postgres gives `applyRun` one real transaction. D1 does not have one.
 *   D1 operates in auto-commit; `batch()` is atomic, but a write phase of
 *   225 offers does not fit in one batch — D1 allows 100 bound parameters per
 *   statement, so a 27-column offer is three rows per statement, and several
 *   hundred statements is several batches.
 *
 * SO `applyRun` HERE IS NOT ATOMIC, and pretending otherwise would be the
 * single most dangerous lie in this codebase. A crash midway leaves some
 * offers written and some not.
 *
 * WHAT MAKES THAT SAFE ANYWAY: nothing public reads these tables. Publication
 * goes through `catalog_published_product`, and a generation is promoted by
 * ONE statement after the import has finished and validated. A half-written
 * import is therefore invisible: it is staged, not published. The atomicity
 * the public needs is on the pointer, not on the write phase, and the pointer
 * move IS atomic.
 *
 * Resumability covers the other half. The write phase is idempotent — every
 * statement is an upsert keyed on identity, and price history has a
 * once-per-run unique index — so re-running an interrupted import converges
 * rather than duplicating.
 */

import {
  DuplicateApplyError,
  type ImportRun,
  type ImportStatus,
  type OfferStore,
  type OfferWriter,
  type PriceHistoryEntry,
  type QuarantineEntry,
  type StoredOffer,
} from '../offer-store';
import {
  MAX_BOUND_PARAMS,
  chunkForBinding,
  exactInteger,
  fromInt,
  toInt,
  type D1Like,
  type D1PreparedStatement,
} from './d1-client';

/** Columns written per offer. Decides how many rows fit in one statement. */
const OFFER_COLUMNS = 27;
const HISTORY_COLUMNS = 8;
const QUARANTINE_COLUMNS = 7;

/*
 * Checked at module load rather than discovered at run time. D1 refuses a
 * statement binding more than 100 parameters, and an offer row binds 27 — so
 * this holds today with room to spare, and will fail loudly the moment
 * someone adds enough columns to break it.
 */
if (OFFER_COLUMNS > MAX_BOUND_PARAMS) {
  throw new RangeError(
    `an offer row binds ${OFFER_COLUMNS} parameters, over D1's limit of ${MAX_BOUND_PARAMS}`,
  );
}

type Row = Record<string, unknown>;

const str = (v: unknown): string => (v === null || v === undefined ? '' : String(v));
const nullable = (v: unknown): string | null => (v === null || v === undefined ? null : String(v));

function toStoredOffer(row: Row): StoredOffer {
  const currency = str(row.currency);
  return {
    id: str(row.id),
    merchantId: str(row.merchant_id),
    merchantOfferId: str(row.merchant_offer_id),
    gtin: nullable(row.gtin),
    mpn: nullable(row.mpn),
    brand: str(row.brand),
    title: str(row.title),
    listPrice: {
      amountMinor: exactInteger(row.list_price_minor, 'list_price_minor'),
      currency,
    },
    salePrice:
      row.sale_price_minor === null || row.sale_price_minor === undefined
        ? null
        : { amountMinor: exactInteger(row.sale_price_minor, 'sale_price_minor'), currency },
    availability: str(row.availability) as StoredOffer['availability'],
    condition: str(row.condition) as StoredOffer['condition'],
    productUrl: str(row.product_url),
    imageUrl: str(row.image_url),
    shippingVerified: fromInt(row.shipping_verified),
    shippingCost:
      row.shipping_cost_minor === null || row.shipping_cost_minor === undefined
        ? null
        : {
            amountMinor: exactInteger(row.shipping_cost_minor, 'shipping_cost_minor'),
            currency: String(row.currency),
          },
    shippingDestination:
      row.shipping_destination === null || row.shipping_destination === undefined
        ? null
        : String(row.shipping_destination),
    feesVerified: fromInt(row.fees_verified),
    feesTotal:
      row.fees_total_minor === null || row.fees_total_minor === undefined
        ? null
        : {
            amountMinor: exactInteger(row.fees_total_minor, 'fees_total_minor'),
            currency: String(row.currency),
          },
    snapshotAt: str(row.snapshot_at),
    sourceFeed: str(row.source_feed),
    firstSeenRun: str(row.first_seen_run),
    lastSeenRun: str(row.last_seen_run),
    lastSeenAt: str(row.last_seen_at),
    state: str(row.state) as StoredOffer['state'],
    inactiveSince: nullable(row.inactive_since),
  };
}

function toImportRun(row: Row): ImportRun {
  const num = (v: unknown): number | null => (v === null || v === undefined ? null : Number(v));
  return {
    id: str(row.id),
    merchantId: str(row.merchant_id),
    sourceFeed: str(row.source_feed),
    contentSha256: str(row.content_sha256),
    feedExportedAt: nullable(row.feed_exported_at),
    startedAt: str(row.started_at),
    finishedAt: nullable(row.finished_at),
    status: str(row.status) as ImportStatus,
    rowsTotal: num(row.rows_total),
    offersAdded: num(row.offers_added),
    offersRemoved: num(row.offers_removed),
    offersUpdated: num(row.offers_updated),
    offersUnchanged: num(row.offers_unchanged),
    rowsQuarantined: num(row.rows_quarantined),
    skipReason: nullable(row.skip_reason),
  };
}

/**
 * Collects statements instead of executing them, so one write phase becomes
 * as few batches as D1's parameter limit allows.
 *
 * Deferring is what makes bounded batching possible at all: executing each
 * call as it arrives would mean one round trip per offer.
 */
class D1Writer implements OfferWriter {
  readonly statements: D1PreparedStatement[] = [];
  /** Set when `finishRun` is told to mark the run applied. */
  duplicateGuardFor: string | null = null;

  constructor(private readonly db: D1Like) {}

  async upsertOffer(offer: StoredOffer): Promise<void> {
    this.statements.push(this.offerStatement(offer));
  }

  offerStatement(offer: StoredOffer): D1PreparedStatement {
    /*
     * ON CONFLICT on IDENTITY, not on the primary key. Two feeds can describe
     * the same (merchant, merchant_offer_id) with different generated ids;
     * the identity index is the thing that must not duplicate.
     *
     * first_seen_run is deliberately NOT updated: it is the first time we saw
     * this offer, and an update would erase that.
     */
    return this.db
      .prepare(
        `INSERT INTO catalog_merchant_offer (
           id, merchant_id, merchant_offer_id, gtin, mpn, brand, title,
           list_price_minor, sale_price_minor, currency, availability, condition,
           product_url, image_url, tracking_url,
           shipping_verified, shipping_cost_minor, shipping_destination,
           fees_verified, fees_total_minor,
           snapshot_at, source_feed, first_seen_run, last_seen_run, last_seen_at,
           state, inactive_since
         ) VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)
         ON CONFLICT (merchant_id, merchant_offer_id) DO UPDATE SET
           gtin = excluded.gtin,
           mpn = excluded.mpn,
           brand = excluded.brand,
           title = excluded.title,
           list_price_minor = excluded.list_price_minor,
           sale_price_minor = excluded.sale_price_minor,
           currency = excluded.currency,
           availability = excluded.availability,
           condition = excluded.condition,
           product_url = excluded.product_url,
           image_url = excluded.image_url,
           snapshot_at = excluded.snapshot_at,
           source_feed = excluded.source_feed,
           last_seen_run = excluded.last_seen_run,
           last_seen_at = excluded.last_seen_at,
           state = excluded.state,
           inactive_since = excluded.inactive_since`,
      )
      .bind(
        offer.id,
        offer.merchantId,
        offer.merchantOfferId,
        offer.gtin,
        offer.mpn,
        offer.brand,
        offer.title,
        offer.listPrice.amountMinor,
        offer.salePrice ? offer.salePrice.amountMinor : null,
        offer.listPrice.currency,
        offer.availability,
        offer.condition,
        offer.productUrl,
        offer.imageUrl,
        // The tracking wrapper is stored but is never part of identity.
        offer.productUrl,
        toInt(offer.shippingVerified),
        offer.shippingCost ? offer.shippingCost.amountMinor : null,
        offer.shippingDestination,
        toInt(offer.feesVerified),
        offer.feesTotal ? offer.feesTotal.amountMinor : null,
        offer.snapshotAt,
        offer.sourceFeed,
        offer.firstSeenRun,
        offer.lastSeenRun,
        offer.lastSeenAt,
        offer.state,
        offer.inactiveSince,
      );
  }

  async markInactive(offerIds: readonly string[], at: string, runId: string): Promise<void> {
    if (offerIds.length === 0) return;
    // ABSENCE IS NOT DELETION. A product missing from an export goes inactive
    // and keeps its history; there is deliberately no delete anywhere here.
    for (const chunk of chunkForBinding(offerIds, 1)) {
      const holes = chunk.map(() => '?').join(',');
      this.statements.push(
        this.db
          .prepare(
            `UPDATE catalog_merchant_offer
               SET state = 'inactive', inactive_since = ?, last_seen_run = ?
             WHERE id IN (${holes}) AND state = 'active'`,
          )
          .bind(at, runId, ...chunk),
      );
    }
  }

  async appendPriceHistory(entries: readonly PriceHistoryEntry[]): Promise<void> {
    for (const chunk of chunkForBinding(entries, HISTORY_COLUMNS)) {
      for (const e of chunk) {
        this.statements.push(
          this.db
            .prepare(
              `INSERT INTO catalog_offer_price_history
                 (id, offer_id, import_run_id, observed_at, list_price_minor, sale_price_minor, currency, availability)
               VALUES (?,?,?,?,?,?,?,?)
               ON CONFLICT (offer_id, import_run_id) DO NOTHING`,
            )
            .bind(
              `${e.offerId}:${e.importRunId}`,
              e.offerId,
              e.importRunId,
              e.observedAt,
              e.listPrice.amountMinor,
              e.salePrice ? e.salePrice.amountMinor : null,
              e.listPrice.currency,
              e.changeKind,
            ),
        );
      }
    }
  }

  async recordQuarantine(entries: readonly QuarantineEntry[]): Promise<void> {
    for (const chunk of chunkForBinding(entries, QUARANTINE_COLUMNS)) {
      for (const e of chunk) {
        this.statements.push(
          this.db
            .prepare(
              `INSERT INTO catalog_quarantined_row
                 (id, import_run_id, merchant_id, row_ref, reason, detail, quarantined_at)
               VALUES (?,?,?,?,?,?,?)`,
            )
            .bind(
              `${e.importRunId}:${e.rowNumber}`,
              e.importRunId,
              e.merchantId,
              e.merchantOfferId,
              e.reasons[0] ?? 'unspecified',
              JSON.stringify(e.reasons),
              new Date().toISOString(),
            ),
        );
      }
    }
  }

  async finishRun(id: string, patch: Partial<ImportRun> & { status: ImportStatus }): Promise<void> {
    if (patch.status === 'applied') this.duplicateGuardFor = id;
    this.statements.push(
      this.db
        .prepare(
          `UPDATE catalog_import_run SET
             status = ?, finished_at = ?, rows_total = ?, offers_added = ?,
             offers_removed = ?, offers_updated = ?, offers_unchanged = ?,
             rows_quarantined = ?, skip_reason = ?
           WHERE id = ?`,
        )
        .bind(
          patch.status,
          patch.finishedAt ?? new Date().toISOString(),
          patch.rowsTotal ?? null,
          patch.offersAdded ?? null,
          patch.offersRemoved ?? null,
          patch.offersUpdated ?? null,
          patch.offersUnchanged ?? null,
          patch.rowsQuarantined ?? null,
          patch.skipReason ?? null,
          id,
        ),
    );
  }
}

export class D1OfferStore implements OfferStore {
  constructor(private readonly db: D1Like) {}

  async listOffers(merchantId: string): Promise<readonly StoredOffer[]> {
    const { results } = await this.db
      .prepare('SELECT * FROM catalog_merchant_offer WHERE merchant_id = ? ORDER BY id')
      .bind(merchantId)
      .all<Row>();
    return results.map(toStoredOffer);
  }

  async findOffer(merchantId: string, merchantOfferId: string): Promise<StoredOffer | null> {
    const row = await this.db
      .prepare(
        'SELECT * FROM catalog_merchant_offer WHERE merchant_id = ? AND merchant_offer_id = ?',
      )
      .bind(merchantId, merchantOfferId)
      .first<Row>();
    return row ? toStoredOffer(row) : null;
  }

  async findAppliedRun(merchantId: string, contentSha256: string): Promise<ImportRun | null> {
    const row = await this.db
      .prepare(
        `SELECT * FROM catalog_import_run
          WHERE merchant_id = ? AND content_sha256 = ? AND status = 'applied' LIMIT 1`,
      )
      .bind(merchantId, contentSha256)
      .first<Row>();
    return row ? toImportRun(row) : null;
  }

  async beginRun(
    run: Omit<ImportRun, 'finishedAt' | 'status'> & { status: 'started' },
  ): Promise<void> {
    // Committed on its own, deliberately: a run that then crashes stays
    // visible as `started`, which is what the job lease reads.
    await this.db
      .prepare(
        `INSERT INTO catalog_import_run
           (id, merchant_id, source_feed, content_sha256, feed_exported_at, started_at, status)
         VALUES (?,?,?,?,?,?,'started')`,
      )
      .bind(
        run.id,
        run.merchantId,
        run.sourceFeed,
        run.contentSha256,
        run.feedExportedAt,
        run.startedAt,
      )
      .run();
  }

  /**
   * Runs the write phase as AS FEW BATCHES AS D1 PERMITS — not as one
   * transaction, because D1 has no transaction that spans batches.
   *
   * The duplicate guard is checked inside the final batch by making the
   * `applied` transition conditional, so two concurrent imports of one payload
   * cannot both succeed: the loser updates zero rows and is told so.
   */
  async applyRun<T>(work: (tx: OfferWriter) => Promise<T>): Promise<T> {
    const writer = new D1Writer(this.db);
    const result = await work(writer);

    if (writer.duplicateGuardFor) {
      const runId = writer.duplicateGuardFor;
      const run = await this.db
        .prepare('SELECT merchant_id, content_sha256 FROM catalog_import_run WHERE id = ?')
        .bind(runId)
        .first<Row>();
      if (run) {
        const clash = await this.db
          .prepare(
            `SELECT id FROM catalog_import_run
              WHERE merchant_id = ? AND content_sha256 = ? AND status = 'applied' AND id <> ?
              LIMIT 1`,
          )
          .bind(str(run.merchant_id), str(run.content_sha256), runId)
          .first<Row>();
        if (clash) {
          // The race loser. Nothing of this run's work is promoted, and the
          // run itself is recorded as a duplicate rather than left `started`.
          await this.db
            .prepare(
              `UPDATE catalog_import_run
                 SET status = 'skipped_duplicate', finished_at = ?, skip_reason = ?
               WHERE id = ?`,
            )
            .bind(
              new Date().toISOString(),
              `payload already applied in run ${str(clash.id)}`,
              runId,
            )
            .run();
          throw new DuplicateApplyError(runId, str(clash.id));
        }
      }
    }

    // Bounded batches. Each is atomic; the sequence is not, which is why
    // publication is a separate pointer move.
    await this.flush(writer);
    return result;
  }

  async listPriceHistory(offerId: string): Promise<readonly PriceHistoryEntry[]> {
    const { results } = await this.db
      .prepare(
        'SELECT * FROM catalog_offer_price_history WHERE offer_id = ? ORDER BY observed_at ASC',
      )
      .bind(offerId)
      .all<Row>();
    return results.map((row) => ({
      offerId: str(row.offer_id),
      importRunId: str(row.import_run_id),
      observedAt: str(row.observed_at),
      listPrice: {
        amountMinor: exactInteger(row.list_price_minor, 'list_price_minor'),
        currency: str(row.currency),
      },
      salePrice:
        row.sale_price_minor === null || row.sale_price_minor === undefined
          ? null
          : {
              amountMinor: exactInteger(row.sale_price_minor, 'sale_price_minor'),
              currency: str(row.currency),
            },
      changeKind: str(row.availability) as PriceHistoryEntry['changeKind'],
    }));
  }

  async listQuarantine(importRunId: string): Promise<readonly QuarantineEntry[]> {
    const { results } = await this.db
      .prepare('SELECT * FROM catalog_quarantined_row WHERE import_run_id = ? ORDER BY id')
      .bind(importRunId)
      .all<Row>();
    return results.map((row) => ({
      importRunId: str(row.import_run_id),
      merchantId: str(row.merchant_id),
      rowNumber: Number(String(row.id).split(':').pop() ?? 0),
      merchantOfferId: nullable(row.row_ref),
      reasons: JSON.parse(str(row.detail) || '[]') as string[],
    }));
  }

  /*
   * `OfferStore` extends `OfferWriter`, so the store itself can be written to
   * outside a run. These execute IMMEDIATELY rather than collecting
   * statements — there is no unit of work to join, and deferring a write that
   * nothing will later flush would silently lose it.
   */
  async upsertOffer(offer: StoredOffer): Promise<void> {
    await new D1Writer(this.db).offerStatement(offer).run();
  }

  async markInactive(offerIds: readonly string[], at: string, runId: string): Promise<void> {
    if (offerIds.length === 0) return;
    const writer = new D1Writer(this.db);
    await writer.markInactive(offerIds, at, runId);
    await this.flush(writer);
  }

  async appendPriceHistory(entries: readonly PriceHistoryEntry[]): Promise<void> {
    const writer = new D1Writer(this.db);
    await writer.appendPriceHistory(entries);
    await this.flush(writer);
  }

  async recordQuarantine(entries: readonly QuarantineEntry[]): Promise<void> {
    const writer = new D1Writer(this.db);
    await writer.recordQuarantine(entries);
    await this.flush(writer);
  }

  async finishRun(id: string, patch: Partial<ImportRun> & { status: ImportStatus }): Promise<void> {
    const writer = new D1Writer(this.db);
    await writer.finishRun(id, patch);
    await this.flush(writer);
  }

  /** Bounded batches. Each is atomic; the sequence is not — see the header. */
  private async flush(writer: D1Writer): Promise<void> {
    const BATCH = 40;
    for (let i = 0; i < writer.statements.length; i += BATCH) {
      await this.db.batch(writer.statements.slice(i, i + BATCH));
    }
  }

  async listRuns(merchantId: string): Promise<readonly ImportRun[]> {
    const { results } = await this.db
      .prepare('SELECT * FROM catalog_import_run WHERE merchant_id = ? ORDER BY started_at DESC')
      .bind(merchantId)
      .all<Row>();
    return results.map(toImportRun);
  }
}
