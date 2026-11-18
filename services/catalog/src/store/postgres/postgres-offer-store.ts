/*
 * The Postgres OfferStore — the adapter 0001_catalog_init.sql was written for.
 *
 * WHAT THIS ADAPTER IS FOR, GIVEN AN IN-MEMORY ONE EXISTS. Three of the port's
 * promises cannot be kept by a Map, and they are precisely the ones a daily
 * unattended import depends on:
 *
 *   1. One applied run per (merchant, payload) ACROSS CONNECTIONS. The
 *      pre-flight check in import-feed.ts is a courtesy; the partial unique
 *      index `import_run_applied_once` is the guarantee, and only a database
 *      can arbitrate between two processes that both looked and saw nothing.
 *   2. All-or-nothing writes. `applyRun` is a real transaction here, so a feed
 *      that fails on row 200 of 225 leaves no trace but a `failed` ledger row.
 *   3. Constraints that outlive this code. The CHECKs on shipping and fee
 *      completeness mean a future writer — another service, or a human with
 *      psql — cannot record a verified delivered cost without both a figure
 *      and a destination.
 *
 * WHAT IT REFUSES TO WRITE. `tracking_url`, `shipping_cost_minor`,
 * `shipping_destination` and `fees_total_minor` are left NULL by every path in
 * this file. They are not oversights: nothing in the CJ shopping feed states a
 * shipping cost or a mandatory fee (measured 0 of 225 rows, seven consecutive
 * exports), and `product_url` already holds the tracking wrapper the feed does
 * supply. Writing a zero into a cost column is how a site starts claiming a
 * total it cannot stand behind, so these stay null until a provider states
 * them and the CHECKs above make a half-filled claim impossible.
 *
 * MONEY crosses the boundary as integer minor units in a `bigint`, and comes
 * back as a string because that is what node-postgres does with int8 — parsed
 * with an explicit safe-integer check rather than a `Number()` that would
 * quietly round above 2^53.
 */
import type { Pool } from 'pg';

import type { Availability, ItemCondition, Money } from '../../index';
import {
  DuplicateApplyError,
  type ImportRun,
  type ImportStatus,
  type OfferStore,
  type OfferWriter,
  type PriceChangeKind,
  type PriceHistoryEntry,
  type QuarantineEntry,
  type StoredOffer,
} from '../offer-store';
import { PG_UNIQUE_VIOLATION, pgErrorOf, withTransaction, type SqlExecutor } from './connection';

const APPLIED_ONCE_INDEX = 'import_run_applied_once';

// ── row shapes ──────────────────────────────────────────────────────────────

interface OfferRow {
  id: string;
  merchant_id: string;
  merchant_offer_id: string;
  gtin: string | null;
  mpn: string | null;
  brand: string;
  title: string;
  list_price_minor: string;
  sale_price_minor: string | null;
  currency: string;
  availability: string;
  condition: string;
  product_url: string;
  image_url: string;
  shipping_verified: boolean;
  fees_verified: boolean;
  snapshot_at: Date;
  source_feed: string;
  first_seen_run: string;
  last_seen_run: string;
  last_seen_at: Date;
  state: string;
  inactive_since: Date | null;
}

interface RunRow {
  id: string;
  merchant_id: string;
  source_feed: string;
  content_sha256: string;
  feed_exported_at: Date | null;
  started_at: Date;
  finished_at: Date | null;
  status: string;
  rows_total: number | null;
  offers_added: number | null;
  offers_removed: number | null;
  offers_updated: number | null;
  offers_unchanged: number | null;
  rows_quarantined: number | null;
  skip_reason: string | null;
}

interface HistoryRow {
  offer_id: string;
  import_run_id: string;
  observed_at: Date;
  list_price_minor: string;
  sale_price_minor: string | null;
  currency: string;
  change_kind: string;
}

interface QuarantineRow {
  import_run_id: string;
  merchant_id: string;
  row_number: number;
  merchant_offer_id: string | null;
  reasons: string[];
}

// ── mapping ─────────────────────────────────────────────────────────────────

/** int8 arrives as a string; refuse it rather than round it. */
function minorUnits(raw: string | number): number {
  const value = typeof raw === 'number' ? raw : Number(raw);
  if (!Number.isSafeInteger(value)) {
    throw new Error(`stored amount is not a safe integer: ${raw}`);
  }
  return value;
}

function money(amount: string | number, currency: string): Money {
  return { amountMinor: minorUnits(amount), currency };
}

function iso(value: Date | string): string {
  return value instanceof Date ? value.toISOString() : new Date(value).toISOString();
}

function isoOrNull(value: Date | string | null): string | null {
  return value === null ? null : iso(value);
}

function toStored(row: OfferRow): StoredOffer {
  return {
    id: row.id,
    merchantId: row.merchant_id,
    merchantOfferId: row.merchant_offer_id,
    gtin: row.gtin,
    mpn: row.mpn,
    brand: row.brand,
    title: row.title,
    listPrice: money(row.list_price_minor, row.currency),
    salePrice: row.sale_price_minor === null ? null : money(row.sale_price_minor, row.currency),
    availability: row.availability as Availability,
    condition: row.condition as ItemCondition,
    productUrl: row.product_url,
    imageUrl: row.image_url,
    shippingVerified: row.shipping_verified,
    feesVerified: row.fees_verified,
    snapshotAt: iso(row.snapshot_at),
    sourceFeed: row.source_feed,
    firstSeenRun: row.first_seen_run,
    lastSeenRun: row.last_seen_run,
    lastSeenAt: iso(row.last_seen_at),
    state: row.state === 'inactive' ? 'inactive' : 'active',
    inactiveSince: isoOrNull(row.inactive_since),
  };
}

function toRun(row: RunRow): ImportRun {
  return {
    id: row.id,
    merchantId: row.merchant_id,
    sourceFeed: row.source_feed,
    contentSha256: row.content_sha256,
    feedExportedAt: isoOrNull(row.feed_exported_at),
    startedAt: iso(row.started_at),
    finishedAt: isoOrNull(row.finished_at),
    status: row.status as ImportStatus,
    rowsTotal: row.rows_total,
    offersAdded: row.offers_added,
    offersRemoved: row.offers_removed,
    offersUpdated: row.offers_updated,
    offersUnchanged: row.offers_unchanged,
    rowsQuarantined: row.rows_quarantined,
    skipReason: row.skip_reason,
  };
}

const RUN_COLUMNS = `id, merchant_id, source_feed, content_sha256, feed_exported_at,
  started_at, finished_at, status, rows_total, offers_added, offers_removed,
  offers_updated, offers_unchanged, rows_quarantined, skip_reason`;

// ── the write half ──────────────────────────────────────────────────────────

/**
 * Every mutation, against whatever executor it is given — the pool for an
 * autocommit write, a transaction-bound client inside `applyRun`. One class, so
 * the transactional and non-transactional paths cannot drift apart.
 */
export class PostgresOfferWriter implements OfferWriter {
  constructor(protected readonly db: SqlExecutor) {}

  async upsertOffer(offer: StoredOffer): Promise<void> {
    if (offer.salePrice !== null && offer.salePrice.currency !== offer.listPrice.currency) {
      // One currency column holds both prices, so a mixed pair would silently
      // relabel one of them.
      throw new Error(
        `offer ${offer.merchantOfferId} mixes ${offer.listPrice.currency} and ${offer.salePrice.currency}`,
      );
    }
    // id and first_seen_run are absent from DO UPDATE on purpose: the row's
    // identity and the run that first saw it are history, not today's news.
    await this.db.query(
      `INSERT INTO catalog.merchant_offer (
         id, merchant_id, merchant_offer_id, gtin, mpn, brand, title,
         list_price_minor, sale_price_minor, currency, availability, condition,
         product_url, image_url, shipping_verified, fees_verified,
         snapshot_at, source_feed, first_seen_run, last_seen_run, last_seen_at,
         state, inactive_since
       ) VALUES (
         $1, $2, $3, $4, $5, $6, $7,
         $8, $9, $10, $11, $12,
         $13, $14, $15, $16,
         $17, $18, $19, $20, $21,
         $22, $23
       )
       ON CONFLICT (merchant_id, merchant_offer_id) DO UPDATE SET
         gtin              = EXCLUDED.gtin,
         mpn               = EXCLUDED.mpn,
         brand             = EXCLUDED.brand,
         title             = EXCLUDED.title,
         list_price_minor  = EXCLUDED.list_price_minor,
         sale_price_minor  = EXCLUDED.sale_price_minor,
         currency          = EXCLUDED.currency,
         availability      = EXCLUDED.availability,
         condition         = EXCLUDED.condition,
         product_url       = EXCLUDED.product_url,
         image_url         = EXCLUDED.image_url,
         shipping_verified = EXCLUDED.shipping_verified,
         fees_verified     = EXCLUDED.fees_verified,
         snapshot_at       = EXCLUDED.snapshot_at,
         source_feed       = EXCLUDED.source_feed,
         last_seen_run     = EXCLUDED.last_seen_run,
         last_seen_at      = EXCLUDED.last_seen_at,
         state             = EXCLUDED.state,
         inactive_since    = EXCLUDED.inactive_since`,
      [
        offer.id,
        offer.merchantId,
        offer.merchantOfferId,
        offer.gtin,
        offer.mpn,
        offer.brand,
        offer.title,
        offer.listPrice.amountMinor,
        offer.salePrice?.amountMinor ?? null,
        offer.listPrice.currency,
        offer.availability,
        offer.condition,
        offer.productUrl,
        offer.imageUrl,
        offer.shippingVerified,
        offer.feesVerified,
        offer.snapshotAt,
        offer.sourceFeed,
        offer.firstSeenRun,
        offer.lastSeenRun,
        offer.lastSeenAt,
        offer.state,
        offer.inactiveSince,
      ],
    );
  }

  async markInactive(offerIds: readonly string[], at: string, runId: string): Promise<void> {
    if (offerIds.length === 0) return;
    void runId; // the run that noticed the absence is in the ledger, not here
    await this.db.query(
      `UPDATE catalog.merchant_offer
          SET state = 'inactive',
              inactive_since = COALESCE(inactive_since, $2::timestamptz)
        WHERE id = ANY($1::text[])`,
      // COALESCE, not assignment: the FIRST absence is the fact worth keeping,
      // and a product absent for a week must not look like it went away today.
      [[...offerIds], at],
    );
  }

  async appendPriceHistory(entries: readonly PriceHistoryEntry[]): Promise<void> {
    for (const entry of entries) {
      await this.db.query(
        `INSERT INTO catalog.offer_price_history (
           offer_id, import_run_id, observed_at, list_price_minor, sale_price_minor,
           currency, change_kind
         ) VALUES ($1, $2, $3, $4, $5, $6, $7)
         ON CONFLICT (offer_id, import_run_id) DO NOTHING`,
        [
          entry.offerId,
          entry.importRunId,
          entry.observedAt,
          entry.listPrice.amountMinor,
          entry.salePrice?.amountMinor ?? null,
          entry.listPrice.currency,
          entry.changeKind,
        ],
      );
    }
  }

  async recordQuarantine(entries: readonly QuarantineEntry[]): Promise<void> {
    for (const entry of entries) {
      await this.db.query(
        `INSERT INTO catalog.quarantined_row (
           import_run_id, merchant_id, row_number, merchant_offer_id, reasons
         ) VALUES ($1, $2, $3, $4, $5::text[])`,
        [
          entry.importRunId,
          entry.merchantId,
          entry.rowNumber,
          entry.merchantOfferId,
          [...entry.reasons],
        ],
      );
    }
  }

  async finishRun(id: string, patch: Partial<ImportRun> & { status: ImportStatus }): Promise<void> {
    /*
     * The identifying pair is read BEFORE the update, not after the failure.
     * Once a statement violates a constraint the transaction is aborted and
     * every further query returns 25P02 — so anything the error needs has to
     * be in hand already.
     */
    const found = await this.db.query<{ merchant_id: string; content_sha256: string }>(
      'SELECT merchant_id, content_sha256 FROM catalog.import_run WHERE id = $1',
      [id],
    );
    if (found.rows.length === 0) throw new Error(`unknown import run: ${id}`);
    const { merchant_id: merchantId, content_sha256: sha } = found.rows[0];

    try {
      await this.db.query(
        `UPDATE catalog.import_run
            SET status           = $2,
                finished_at      = COALESCE($3::timestamptz, now()),
                rows_total       = COALESCE($4, rows_total),
                offers_added     = COALESCE($5, offers_added),
                offers_removed   = COALESCE($6, offers_removed),
                offers_updated   = COALESCE($7, offers_updated),
                offers_unchanged = COALESCE($8, offers_unchanged),
                rows_quarantined = COALESCE($9, rows_quarantined),
                skip_reason      = COALESCE($10, skip_reason)
          WHERE id = $1`,
        [
          id,
          patch.status,
          patch.finishedAt ?? null,
          patch.rowsTotal ?? null,
          patch.offersAdded ?? null,
          patch.offersRemoved ?? null,
          patch.offersUpdated ?? null,
          patch.offersUnchanged ?? null,
          patch.rowsQuarantined ?? null,
          patch.skipReason ?? null,
        ],
      );
    } catch (error) {
      const pg = pgErrorOf(error);
      if (pg?.code === PG_UNIQUE_VIOLATION && pg.constraint === APPLIED_ONCE_INDEX) {
        throw new DuplicateApplyError(merchantId, sha);
      }
      throw error;
    }
  }
}

// ── the full store ──────────────────────────────────────────────────────────

export class PostgresOfferStore extends PostgresOfferWriter implements OfferStore {
  constructor(private readonly pool: Pool) {
    super(pool);
  }

  async applyRun<T>(work: (tx: OfferWriter) => Promise<T>): Promise<T> {
    return withTransaction(this.pool, (tx) => work(new PostgresOfferWriter(tx)));
  }

  async beginRun(
    run: Omit<ImportRun, 'finishedAt' | 'status'> & { status: 'started' },
  ): Promise<void> {
    await this.db.query(
      `INSERT INTO catalog.import_run (
         id, merchant_id, source_feed, content_sha256, feed_exported_at,
         started_at, status, rows_total
       ) VALUES ($1, $2, $3, $4, $5, $6, 'started', $7)`,
      [
        run.id,
        run.merchantId,
        run.sourceFeed,
        run.contentSha256,
        run.feedExportedAt,
        run.startedAt,
        run.rowsTotal,
      ],
    );
  }

  async listOffers(merchantId: string): Promise<readonly StoredOffer[]> {
    const result = await this.db.query<OfferRow>(
      `SELECT * FROM catalog.merchant_offer
        WHERE merchant_id = $1
        ORDER BY merchant_offer_id`,
      [merchantId],
    );
    return result.rows.map(toStored);
  }

  async findOffer(merchantId: string, merchantOfferId: string): Promise<StoredOffer | null> {
    const result = await this.db.query<OfferRow>(
      `SELECT * FROM catalog.merchant_offer
        WHERE merchant_id = $1 AND merchant_offer_id = $2`,
      [merchantId, merchantOfferId],
    );
    return result.rows.length === 0 ? null : toStored(result.rows[0]);
  }

  async findAppliedRun(merchantId: string, contentSha256: string): Promise<ImportRun | null> {
    const result = await this.db.query<RunRow>(
      `SELECT ${RUN_COLUMNS} FROM catalog.import_run
        WHERE merchant_id = $1 AND content_sha256 = $2 AND status = 'applied'`,
      [merchantId, contentSha256],
    );
    return result.rows.length === 0 ? null : toRun(result.rows[0]);
  }

  async listRuns(merchantId: string): Promise<readonly ImportRun[]> {
    const result = await this.db.query<RunRow>(
      `SELECT ${RUN_COLUMNS} FROM catalog.import_run
        WHERE merchant_id = $1
        ORDER BY started_at, id`,
      [merchantId],
    );
    return result.rows.map(toRun);
  }

  async listPriceHistory(offerId: string): Promise<readonly PriceHistoryEntry[]> {
    const result = await this.db.query<HistoryRow>(
      `SELECT offer_id, import_run_id, observed_at, list_price_minor,
              sale_price_minor, currency, change_kind
         FROM catalog.offer_price_history
        WHERE offer_id = $1
        ORDER BY observed_at, id`,
      [offerId],
    );
    return result.rows.map((row) => ({
      offerId: row.offer_id,
      importRunId: row.import_run_id,
      observedAt: iso(row.observed_at),
      listPrice: money(row.list_price_minor, row.currency),
      salePrice: row.sale_price_minor === null ? null : money(row.sale_price_minor, row.currency),
      changeKind: row.change_kind as PriceChangeKind,
    }));
  }

  async listQuarantine(importRunId: string): Promise<readonly QuarantineEntry[]> {
    const result = await this.db.query<QuarantineRow>(
      `SELECT import_run_id, merchant_id, row_number, merchant_offer_id, reasons
         FROM catalog.quarantined_row
        WHERE import_run_id = $1
        ORDER BY row_number`,
      [importRunId],
    );
    return result.rows.map((row) => ({
      importRunId: row.import_run_id,
      merchantId: row.merchant_id,
      rowNumber: row.row_number,
      merchantOfferId: row.merchant_offer_id,
      reasons: row.reasons,
    }));
  }
}
