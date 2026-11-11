/*
 * The persistence boundary for the Catalog context.
 *
 * A PORT, with the Postgres schema in migrations/0001_catalog_init.sql as its
 * authoritative shape and an in-memory adapter beside it — the ports-and-adapters
 * split ADR-0010 requires, so that no driver type reaches the core. The
 * reconciliation logic is then testable against real exports without a database,
 * and the SQL stays the single description of what is stored.
 *
 * WHAT THE PORT REFUSES TO OFFER. There is no `deleteOffer`. A product absent
 * from one export is marked inactive, never erased: CJ exports drop and
 * restore items between days — measured on the 9→10 November pair, one product
 * left and one arrived out of 225 — and deleting on absence would discard the
 * price history that is the only reason to keep the row.
 */
import type { Availability, ItemCondition, Money, Offer } from '../index';

export type OfferState = 'active' | 'inactive';

/** A stored offer: the feed's content plus the lifecycle this context owns. */
export interface StoredOffer {
  readonly id: string;
  readonly merchantId: string;
  readonly merchantOfferId: string;
  readonly gtin: string | null;
  readonly mpn: string | null;
  readonly brand: string;
  readonly title: string;
  readonly listPrice: Money;
  readonly salePrice: Money | null;
  readonly availability: Availability;
  readonly condition: ItemCondition;
  /** The CJ tracking wrapper. Mutable, and never part of identity. */
  readonly productUrl: string;
  readonly imageUrl: string;
  readonly shippingVerified: boolean;
  readonly feesVerified: boolean;
  readonly snapshotAt: string;
  readonly sourceFeed: string;
  readonly firstSeenRun: string;
  readonly lastSeenRun: string;
  readonly lastSeenAt: string;
  readonly state: OfferState;
  readonly inactiveSince: string | null;
}

export type PriceChangeKind = 'initial' | 'list' | 'sale' | 'both';

export interface PriceHistoryEntry {
  readonly offerId: string;
  readonly importRunId: string;
  readonly observedAt: string;
  readonly listPrice: Money;
  readonly salePrice: Money | null;
  readonly changeKind: PriceChangeKind;
}

export interface QuarantineEntry {
  readonly importRunId: string;
  readonly merchantId: string;
  readonly rowNumber: number;
  /** The merchant's SKU when readable. Never a URL and never a price. */
  readonly merchantOfferId: string | null;
  readonly reasons: readonly string[];
}

export type ImportStatus = 'started' | 'applied' | 'skipped_duplicate' | 'skipped_stale' | 'failed';

export interface ImportRun {
  readonly id: string;
  readonly merchantId: string;
  readonly sourceFeed: string;
  readonly contentSha256: string;
  readonly feedExportedAt: string | null;
  readonly startedAt: string;
  readonly finishedAt: string | null;
  readonly status: ImportStatus;
  readonly rowsTotal: number | null;
  readonly offersAdded: number | null;
  readonly offersRemoved: number | null;
  readonly offersUpdated: number | null;
  readonly offersUnchanged: number | null;
  readonly rowsQuarantined: number | null;
  readonly skipReason: string | null;
}

/**
 * Raised when finishing a run as `applied` collided with a run that was
 * already applied for the same (merchant, payload).
 *
 * This is the RACE LOSER, and it is a distinct outcome rather than a generic
 * failure. The pre-flight `findAppliedRun` check cannot span connections, so
 * two imports of one export can both pass it; the database arbitrates through
 * `import_run_applied_once`, and because the whole write phase is one
 * transaction the loser writes nothing at all. "Someone else applied this
 * export" is then reported as `skipped_duplicate`, which is what happened,
 * instead of `failed`, which would page somebody at 3am over a retry.
 */
export class DuplicateApplyError extends Error {
  readonly _tag = 'DuplicateApplyError';
  constructor(
    readonly merchantId: string,
    readonly contentSha256: string,
  ) {
    super(`an applied import run already exists for this merchant and payload`);
    this.name = 'DuplicateApplyError';
  }
}

/**
 * The write half of the port, as seen from INSIDE one unit of work.
 *
 * Every mutation an import performs is here and nowhere else, so the set of
 * things that must succeed or fail together is a type rather than a convention
 * somebody has to remember.
 */
export interface OfferWriter {
  upsertOffer(offer: StoredOffer): Promise<void>;
  markInactive(offerIds: readonly string[], at: string, runId: string): Promise<void>;

  /** Append-only. One observation per offer per run; a repeat is a no-op. */
  appendPriceHistory(entries: readonly PriceHistoryEntry[]): Promise<void>;

  recordQuarantine(entries: readonly QuarantineEntry[]): Promise<void>;

  /**
   * @throws DuplicateApplyError when `status` is `applied` and this merchant
   * already has an applied run for the same payload.
   */
  finishRun(id: string, patch: Partial<ImportRun> & { status: ImportStatus }): Promise<void>;
}

export interface OfferStore extends OfferWriter {
  /** Every offer for a merchant, active and inactive. */
  listOffers(merchantId: string): Promise<readonly StoredOffer[]>;
  findOffer(merchantId: string, merchantOfferId: string): Promise<StoredOffer | null>;

  /**
   * Has this exact payload already been applied for this merchant?
   *
   * The idempotency question, asked of the content hash rather than of a
   * filename or a timestamp, both of which a re-download changes. It is a
   * cheap pre-flight, NOT the guarantee — see DuplicateApplyError.
   */
  findAppliedRun(merchantId: string, contentSha256: string): Promise<ImportRun | null>;

  /**
   * Records an attempt. Committed on its own, deliberately: a run that then
   * crashes stays visible as `started`, and a run that fails can be updated to
   * `failed` after its write phase has rolled away.
   */
  beginRun(run: Omit<ImportRun, 'finishedAt' | 'status'> & { status: 'started' }): Promise<void>;

  /**
   * Runs the write phase of one import as ONE unit of work: every offer, every
   * price observation, every quarantine row and the run's own transition to
   * `applied` either all land or none do.
   *
   * The run's final status belongs inside the unit because that is what makes
   * the idempotency index load-bearing: the loser of a race fails on the index
   * and takes its 225 half-written offers down with it. Were the status
   * committed separately, a crash between the two would leave a catalogue that
   * no ledger row explains.
   */
  applyRun<T>(work: (tx: OfferWriter) => Promise<T>): Promise<T>;

  listPriceHistory(offerId: string): Promise<readonly PriceHistoryEntry[]>;
  listQuarantine(importRunId: string): Promise<readonly QuarantineEntry[]>;
  listRuns(merchantId: string): Promise<readonly ImportRun[]>;
}

/** Shapes a freshly parsed Offer into a stored row for a given run. */
export function toStoredOffer(
  offer: Offer,
  run: { readonly id: string; readonly at: string },
  previous: StoredOffer | null,
): StoredOffer {
  return {
    id: previous?.id ?? offer.offerId,
    merchantId: offer.merchantId,
    merchantOfferId: offer.merchantOfferId,
    gtin: offer.gtin,
    mpn: offer.mpn,
    brand: offer.brand,
    title: offer.title,
    listPrice: offer.listPrice,
    salePrice: offer.salePrice,
    availability: offer.availability,
    condition: offer.condition,
    productUrl: offer.productUrl,
    imageUrl: offer.imageUrl,
    shippingVerified: offer.shipping.kind === 'VERIFIED',
    feesVerified: offer.mandatoryFees.kind === 'VERIFIED',
    snapshotAt: offer.snapshotAt,
    sourceFeed: offer.sourceFeed,
    firstSeenRun: previous?.firstSeenRun ?? run.id,
    lastSeenRun: run.id,
    lastSeenAt: run.at,
    // Seeing a product again revives it: absence is a signal, not a verdict.
    state: 'active',
    inactiveSince: null,
  };
}
