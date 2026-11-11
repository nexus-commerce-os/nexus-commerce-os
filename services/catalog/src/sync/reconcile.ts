/*
 * Reconciling one export against what is already stored.
 *
 * IDENTITY IS (merchantId, merchantOfferId) AND NOTHING ELSE. The three fields
 * that tempt an implementer to treat them as identity all churn daily, and the
 * 9→10 November exports measure exactly how much:
 *
 *   LINK            178 of 224 common products changed — and in all 178 the
 *                   `url=` destination was identical, so the change is purely
 *                   the tracking wrapper
 *   IMPRESSION_URL  224 of 224 changed — every single row, every day
 *   LAST_UPDATED    224 of 224 changed — it is a generation stamp, not a
 *                   per-product modification time
 *
 * Keying on any of them would retire and re-create most of the catalogue every
 * morning, and the price history — the one thing a daily import exists to
 * accumulate — would be destroyed by the churn it was meant to record.
 *
 * (IMPRESSION_URL is not even exposed by the CJ parser, so it cannot reach
 * this code. That is a property worth keeping and worth a test, not a reason
 * to leave it unsaid.)
 *
 * ABSENCE IS NOT DELETION. A product missing from a new export is marked
 * inactive and keeps its history. Exports drop and restore items between days,
 * and a merchant pausing a line for a week is not a reason to lose a month of
 * its prices.
 */
import type { Money, Offer } from '../index';
import type { PriceChangeKind, StoredOffer } from '../store/offer-store';

export interface OfferChange {
  readonly merchantOfferId: string;
  readonly previous: StoredOffer;
  readonly incoming: Offer;
  /** Field names that differ, excluding provenance and lifecycle. */
  readonly changedFields: readonly string[];
  readonly priceChange: PriceChangeKind | null;
}

export interface Reconciliation {
  readonly added: readonly Offer[];
  /** Present before, absent now. Marked inactive, never deleted. */
  readonly removed: readonly StoredOffer[];
  readonly updated: readonly OfferChange[];
  readonly unchanged: readonly StoredOffer[];
  /**
   * Updates whose ONLY change is the tracking wrapper. A subset of `updated`,
   * counted separately because it is the dominant daily signal and reporting
   * it as a product change would bury the ones that matter.
   */
  readonly trackingRefreshed: readonly OfferChange[];
}

function sameMoney(a: Money | null, b: Money | null): boolean {
  if (a === null || b === null) return a === b;
  return a.amountMinor === b.amountMinor && a.currency === b.currency;
}

/** What moved between two observations, or null when neither price moved. */
export function priceChangeKind(previous: StoredOffer, incoming: Offer): PriceChangeKind | null {
  const listMoved = !sameMoney(previous.listPrice, incoming.listPrice);
  const saleMoved = !sameMoney(previous.salePrice, incoming.salePrice);
  if (listMoved && saleMoved) return 'both';
  if (listMoved) return 'list';
  if (saleMoved) return 'sale';
  return null;
}

/**
 * Fields compared for "did this offer change".
 *
 * `snapshotAt` and `sourceFeed` are provenance and change on every import;
 * including them would make every row an update forever.
 */
function diffFields(previous: StoredOffer, incoming: Offer): readonly string[] {
  const changed: string[] = [];
  if (previous.title !== incoming.title) changed.push('title');
  if (previous.brand !== incoming.brand) changed.push('brand');
  if (previous.gtin !== incoming.gtin) changed.push('gtin');
  if (previous.mpn !== incoming.mpn) changed.push('mpn');
  if (!sameMoney(previous.listPrice, incoming.listPrice)) changed.push('listPrice');
  if (!sameMoney(previous.salePrice, incoming.salePrice)) changed.push('salePrice');
  if (previous.availability !== incoming.availability) changed.push('availability');
  if (previous.condition !== incoming.condition) changed.push('condition');
  if (previous.imageUrl !== incoming.imageUrl) changed.push('imageUrl');
  if (previous.productUrl !== incoming.productUrl) changed.push('productUrl');
  if (previous.shippingVerified !== (incoming.shipping.kind === 'VERIFIED')) {
    changed.push('shippingVerified');
  }
  if (previous.feesVerified !== (incoming.mandatoryFees.kind === 'VERIFIED')) {
    changed.push('feesVerified');
  }
  return changed;
}

export function reconcile(
  stored: readonly StoredOffer[],
  incoming: readonly Offer[],
): Reconciliation {
  const before = new Map(stored.map((o) => [o.merchantOfferId, o]));
  const seen = new Set<string>();

  const added: Offer[] = [];
  const updated: OfferChange[] = [];
  const unchanged: StoredOffer[] = [];
  const trackingRefreshed: OfferChange[] = [];

  for (const offer of incoming) {
    seen.add(offer.merchantOfferId);
    const previous = before.get(offer.merchantOfferId);
    if (!previous) {
      added.push(offer);
      continue;
    }
    const changedFields = diffFields(previous, offer);
    if (changedFields.length === 0) {
      unchanged.push(previous);
      continue;
    }
    const change: OfferChange = {
      merchantOfferId: offer.merchantOfferId,
      previous,
      incoming: offer,
      changedFields,
      priceChange: priceChangeKind(previous, offer),
    };
    updated.push(change);
    if (changedFields.length === 1 && changedFields[0] === 'productUrl') {
      trackingRefreshed.push(change);
    }
  }

  // Only currently-active offers can be "removed" by this export; one already
  // inactive stays inactive without being reported again every day.
  const removed = stored.filter((o) => o.state === 'active' && !seen.has(o.merchantOfferId));

  return { added, removed, updated, unchanged, trackingRefreshed };
}
