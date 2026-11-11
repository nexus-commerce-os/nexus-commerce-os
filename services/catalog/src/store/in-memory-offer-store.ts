/*
 * In-memory OfferStore — the adapter the unit tests and the local report run on.
 *
 * It mirrors the constraints the Postgres schema enforces rather than being a
 * loose map, because a fake that accepts what the database would reject tests
 * nothing. Specifically it enforces, in code, what 0001_catalog_init.sql
 * enforces in DDL:
 *
 *   merchant_offer_identity          one row per (merchantId, merchantOfferId)
 *   import_run_applied_once          one applied run per (merchantId, sha256)
 *   offer_price_history_once_per_run one observation per (offerId, runId)
 *
 * …and, since the port grew a unit of work, it enforces ATOMICITY too: a write
 * phase that throws leaves this store exactly as it was. That is not polish.
 * Without it the fake would pass the "a failed import writes no offers" test
 * for the wrong reason and the Postgres adapter would be the only thing that
 * had to be right.
 *
 * The same split as services/auth: ports with in-memory adapters, with the SQL
 * alongside as the authoritative shape.
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
} from './offer-store';

export class InMemoryOfferStore implements OfferStore {
  /** key: `${merchantId}\u0000${merchantOfferId}` — the DDL's unique index. */
  private offers = new Map<string, StoredOffer>();
  private runs = new Map<string, ImportRun>();
  private history: PriceHistoryEntry[] = [];
  private quarantine: QuarantineEntry[] = [];

  private static key(merchantId: string, merchantOfferId: string): string {
    return `${merchantId}\u0000${merchantOfferId}`;
  }

  async listOffers(merchantId: string): Promise<readonly StoredOffer[]> {
    return [...this.offers.values()].filter((o) => o.merchantId === merchantId);
  }

  async findOffer(merchantId: string, merchantOfferId: string): Promise<StoredOffer | null> {
    return this.offers.get(InMemoryOfferStore.key(merchantId, merchantOfferId)) ?? null;
  }

  async findAppliedRun(merchantId: string, contentSha256: string): Promise<ImportRun | null> {
    for (const run of this.runs.values()) {
      if (
        run.merchantId === merchantId &&
        run.contentSha256 === contentSha256 &&
        run.status === 'applied'
      ) {
        return run;
      }
    }
    return null;
  }

  async beginRun(
    run: Omit<ImportRun, 'finishedAt' | 'status'> & { status: 'started' },
  ): Promise<void> {
    if (this.runs.has(run.id)) throw new Error(`duplicate import run id: ${run.id}`);
    this.runs.set(run.id, { ...run, finishedAt: null });
  }

  /**
   * One unit of work, by snapshot-and-restore.
   *
   * Copying four collections is affordable at this size (225 offers a day) and
   * is the only way a Map-backed fake can offer the rollback the port now
   * promises. The snapshot is shallow because every stored value is treated as
   * immutable — adapters replace rows, they never mutate them in place.
   */
  async applyRun<T>(work: (tx: OfferWriter) => Promise<T>): Promise<T> {
    const snapshot = {
      offers: new Map(this.offers),
      runs: new Map(this.runs),
      history: [...this.history],
      quarantine: [...this.quarantine],
    };
    try {
      return await work(this);
    } catch (error) {
      this.offers = snapshot.offers;
      this.runs = snapshot.runs;
      this.history = snapshot.history;
      this.quarantine = snapshot.quarantine;
      throw error;
    }
  }

  async finishRun(id: string, patch: Partial<ImportRun> & { status: ImportStatus }): Promise<void> {
    const existing = this.runs.get(id);
    if (!existing) throw new Error(`unknown import run: ${id}`);
    if (patch.status === 'applied') {
      // import_run_applied_once, enforced here so the fake cannot accept what
      // the database would refuse.
      const clash = await this.findAppliedRun(existing.merchantId, existing.contentSha256);
      if (clash && clash.id !== id) {
        throw new DuplicateApplyError(existing.merchantId, existing.contentSha256);
      }
    }
    this.runs.set(id, { ...existing, ...patch, finishedAt: patch.finishedAt ?? nowIso() });
  }

  async upsertOffer(offer: StoredOffer): Promise<void> {
    this.offers.set(InMemoryOfferStore.key(offer.merchantId, offer.merchantOfferId), offer);
  }

  async markInactive(offerIds: readonly string[], at: string, runId: string): Promise<void> {
    const wanted = new Set(offerIds);
    for (const [key, offer] of this.offers) {
      if (!wanted.has(offer.id)) continue;
      this.offers.set(key, {
        ...offer,
        state: 'inactive',
        // The first absence is what is recorded; later ones do not reset it.
        inactiveSince: offer.inactiveSince ?? at,
        lastSeenRun: offer.lastSeenRun,
        lastSeenAt: offer.lastSeenAt,
      });
      void runId;
    }
  }

  async appendPriceHistory(entries: readonly PriceHistoryEntry[]): Promise<void> {
    for (const entry of entries) {
      const already = this.history.some(
        (h) => h.offerId === entry.offerId && h.importRunId === entry.importRunId,
      );
      if (already) continue; // offer_price_history_once_per_run
      this.history.push(entry);
    }
  }

  async listPriceHistory(offerId: string): Promise<readonly PriceHistoryEntry[]> {
    return this.history
      .filter((h) => h.offerId === offerId)
      .sort((a, b) => a.observedAt.localeCompare(b.observedAt));
  }

  async recordQuarantine(entries: readonly QuarantineEntry[]): Promise<void> {
    this.quarantine.push(...entries);
  }

  async listQuarantine(importRunId: string): Promise<readonly QuarantineEntry[]> {
    return this.quarantine.filter((q) => q.importRunId === importRunId);
  }

  async listRuns(merchantId: string): Promise<readonly ImportRun[]> {
    return [...this.runs.values()]
      .filter((r) => r.merchantId === merchantId)
      .sort((a, b) => a.startedAt.localeCompare(b.startedAt));
  }

  /** Test helper: total history rows, for asserting a re-import adds none. */
  get priceHistoryCount(): number {
    return this.history.length;
  }
}

function nowIso(): string {
  return new Date().toISOString();
}
