/**
 * The canonical Offer: one merchant's current proposition for one product.
 *
 * The shape is the one in docs/06 §4, which is also the shape of the
 * `offer.upserted` event and the Postgres row, so there is one schema rather
 * than three that drift. Money fields are the canonical money type; the
 * licence tag travels with the offer and decides whether any of it may be
 * shown.
 *
 * The all-in price is the point of this project. A merchant's headline price
 * is not what a buyer pays, and ranking on the headline is how comparison
 * sites end up recommending the dearer option. So `allInPrice` is item +
 * shipping + tax, and an offer that cannot produce one honestly says so
 * instead of guessing a zero.
 */

import {
  type Money,
  compare as compareMoney,
  equals as moneyEquals,
  sum as sumMoney,
} from './money.js';
import type { Freshness } from './freshness.js';
import { evaluateFreshness } from './freshness.js';
import type { LicenseTag } from './license.js';
import { licenseAllowsPriceDisplay, licenseAllowsRegion, licenseAllowsUse } from './license.js';

export type Availability = 'in_stock' | 'out' | 'preorder' | 'unknown';

/**
 * A cost component that may be unknown.
 *
 * Shipping is the honest difficulty in price comparison: it often depends on
 * a postcode nobody has typed yet. Modelling it as "known amount" or
 * "explicitly unknown" keeps the third possibility — a silent zero — out of
 * the type, because a silent zero makes an expensive offer look cheapest.
 */
export type CostComponent =
  | { readonly known: true; readonly amount: Money }
  | { readonly known: false; readonly reason: string };

export const knownCost = (amount: Money): CostComponent => ({ known: true, amount });
export const unknownCost = (reason: string): CostComponent => ({ known: false, reason });

export interface Offer {
  /** Deterministic from (sourceId, merchantId, merchantSku) — see `offerId`. */
  readonly offerId: string;
  readonly productId: string;
  readonly merchantId: string;
  /** Which adapter or partner produced this. */
  readonly sourceId: string;
  readonly merchantSku: string;
  readonly title: string;
  readonly price: Money;
  readonly shipping: CostComponent;
  readonly tax: CostComponent;
  readonly availability: Availability;
  /** Destination URL. Affiliate wrapping happens at the link layer, not here. */
  readonly url: string;
  readonly mediaRefs: readonly string[];
  readonly freshness: Freshness;
  readonly licenseTag: LicenseTag;
}

export class OfferError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'OfferError';
  }
}

/**
 * A stable id for the same merchant listing across syncs, so an upsert is
 * idempotent and a re-sync does not create a second row.
 *
 * Deterministic and readable rather than a hash: when an offer misbehaves,
 * being able to see which source and SKU it came from in the id itself turns
 * a database query into a glance.
 */
export function offerId(sourceId: string, merchantId: string, merchantSku: string): string {
  const parts = [sourceId, merchantId, merchantSku].map((p) => p.trim());
  if (parts.some((p) => p.length === 0)) {
    throw new OfferError('offerId needs a sourceId, a merchantId and a merchantSku.');
  }
  return parts.map(encodeURIComponent).join(':');
}

export type AllInResult =
  | { readonly complete: true; readonly allIn: Money }
  | {
      readonly complete: false;
      /** The parts that are known, so a partial total can still be shown as a floor. */
      readonly floor: Money;
      readonly missing: readonly ('shipping' | 'tax')[];
    };

/**
 * Item + shipping + tax.
 *
 * Returns `complete: false` when a component is unknown, with the sum of what
 * IS known as a floor. That lets a surface say "from $328.00, shipping not
 * published" — true, useful, and not the same as claiming $328.00 is the
 * total. Ranking must not treat a floor as an all-in price.
 */
export function allInPrice(offer: Offer): AllInResult {
  const missing: ('shipping' | 'tax')[] = [];
  const parts: Money[] = [offer.price];

  if (offer.shipping.known) parts.push(offer.shipping.amount);
  else missing.push('shipping');

  if (offer.tax.known) parts.push(offer.tax.amount);
  else missing.push('tax');

  // sumMoney throws on mixed currencies, which is the correct failure: an
  // all-in price assembled from two currencies is not a price.
  const total = sumMoney(parts);
  return missing.length === 0
    ? { complete: true, allIn: total }
    : { complete: false, floor: total, missing };
}

/** The amount to rank on, or null when the offer cannot be ranked honestly. */
export function comparableTotal(offer: Offer): Money | null {
  const result = allInPrice(offer);
  return result.complete ? result.allIn : null;
}

export type OfferProblem =
  | 'negative-price'
  | 'currency-mismatch'
  | 'license-refused'
  | 'stale'
  | 'empty-title'
  | 'bad-url'
  | 'unknown-availability';

export interface OfferValidation {
  readonly usable: boolean;
  readonly problems: readonly { readonly problem: OfferProblem; readonly detail: string }[];
}

/**
 * Everything that must be true before an offer may be indexed, ranked or
 * shown. Collects every problem rather than returning the first, because an
 * ingestion report that names one fault at a time takes as many runs as there
 * are faults.
 *
 * `unknown` availability is a warning, not a rejection: plenty of honest feeds
 * omit it, and refusing them would quietly bias the catalogue toward merchants
 * with richer data rather than better prices.
 */
export function validateOffer(offer: Offer, now: Date = new Date()): OfferValidation {
  const problems: { problem: OfferProblem; detail: string }[] = [];
  const note = (problem: OfferProblem, detail: string) => problems.push({ problem, detail });

  if (offer.price.minorUnits < 0n) {
    note('negative-price', `Price is ${offer.price.minorUnits} minor units.`);
  }

  for (const [name, component] of [
    ['shipping', offer.shipping],
    ['tax', offer.tax],
  ] as const) {
    if (component.known && component.amount.currency !== offer.price.currency) {
      note(
        'currency-mismatch',
        `${name} is in ${component.amount.currency} but the price is in ${offer.price.currency}.`,
      );
    }
    if (component.known && component.amount.minorUnits < 0n) {
      note('negative-price', `${name} is negative.`);
    }
  }

  const licence = licenseAllowsUse(offer.licenseTag, now);
  if (!licence.allowed) note('license-refused', licence.detail ?? 'Licence refused.');

  const fresh = evaluateFreshness(offer.freshness, now);
  if (!fresh.fresh) note('stale', fresh.detail ?? 'Observation is stale.');

  if (offer.title.trim().length === 0) note('empty-title', 'Offer has no title.');

  try {
    const url = new URL(offer.url);
    if (url.protocol !== 'https:') note('bad-url', `URL is ${url.protocol}, not https.`);
  } catch {
    note('bad-url', `"${offer.url}" is not a URL.`);
  }

  if (offer.availability === 'unknown') {
    note('unknown-availability', 'Availability not published by this feed.');
  }

  const blocking = problems.filter((p) => p.problem !== 'unknown-availability');
  return { usable: blocking.length === 0, problems };
}

/** May this offer's price be shown to a reader in `region`? */
export function offerIsDisplayable(offer: Offer, region: string, now: Date = new Date()): boolean {
  return (
    validateOffer(offer, now).usable &&
    licenseAllowsRegion(offer.licenseTag, region, now).allowed &&
    licenseAllowsPriceDisplay(offer.licenseTag, now).allowed
  );
}

/**
 * Cheapest first, on the all-in total — never on the headline price, and never
 * on anything a merchant pays for.
 *
 * Offers that cannot produce a complete total sort last, whatever their
 * headline says. Sorting a floor against a total would systematically favour
 * merchants who publish less, which is the opposite of what this site is for.
 */
export function rankByTotal(offers: readonly Offer[]): readonly Offer[] {
  const withTotal: { offer: Offer; total: Money }[] = [];
  const without: Offer[] = [];

  for (const offer of offers) {
    const total = comparableTotal(offer);
    if (total) withTotal.push({ offer, total });
    else without.push(offer);
  }

  withTotal.sort((a, b) => {
    const byPrice = compareMoney(a.total, b.total);
    // Stable, explicit tie-break so two equal totals do not reorder between
    // runs and look like a change that never happened.
    return byPrice !== 0 ? byPrice : a.offer.offerId.localeCompare(b.offer.offerId);
  });

  without.sort((a, b) => a.offerId.localeCompare(b.offerId));
  return [...withTotal.map((w) => w.offer), ...without];
}

/** True when two offers quote the same total — used to detect duplicate feeds. */
export const sameTotal = (a: Offer, b: Offer): boolean => {
  const ta = comparableTotal(a);
  const tb = comparableTotal(b);
  return ta !== null && tb !== null && moneyEquals(ta, tb);
};
