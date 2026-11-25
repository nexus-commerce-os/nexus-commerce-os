/**
 * Regional availability: may this offer be shown here, and can it be bought here?
 *
 * Two different questions that get confused constantly, so they are separate
 * functions with separate refusals:
 *
 *   1. LICENCE — may we display this data to a reader in this region at all?
 *      docs/06 §11 read-local replication is "filtered by
 *      `license_tag.geo_restrictions`", so an offer not licensed for a region
 *      is not served there. That is a legal limit on us.
 *   2. FULFILMENT — will the merchant actually ship there? That is a fact
 *      about the merchant, and it is the one a reader cares about.
 *
 * An offer can pass (1) and fail (2) — perfectly licensed data for a shop that
 * will not post to you. Showing it as available would be the sort of
 * technically-true result that wastes a reader's click, so both must pass
 * before an offer counts as available in a region.
 *
 * `null` shipping reach means "not published", never "ships everywhere". An
 * unknown is reported as unknown; see `regionalAvailability`.
 */

import type { Offer } from './offer.js';
import { validateOffer } from './offer.js';
import { licenseAllowsPriceDisplay, licenseAllowsRegion } from './license.js';

/** ISO-3166 alpha-2, upper-cased. A thin alias so signatures read clearly. */
export type RegionCode = string;

export const normalizeRegion = (region: string): RegionCode => region.trim().toUpperCase();

/**
 * Where a merchant will send goods.
 *
 * `ships` lists permitted regions and `excludes` removes some of them, because
 * real merchant feeds are written both ways ("EU except Malta"). An empty
 * `ships` with `shipsAnywhere: false` means nothing was published — which is
 * why that field exists rather than being inferred from an empty list.
 */
export interface ShippingReach {
  readonly merchantId: string;
  readonly shipsAnywhere: boolean;
  readonly ships: readonly RegionCode[];
  readonly excludes: readonly RegionCode[];
}

export type ReachVerdict = 'ships' | 'does-not-ship' | 'not-published';

export function reachesRegion(
  reach: ShippingReach | null | undefined,
  region: string,
): ReachVerdict {
  if (!reach) return 'not-published';
  const wanted = normalizeRegion(region);

  if (reach.excludes.some((r) => normalizeRegion(r) === wanted)) return 'does-not-ship';
  if (reach.shipsAnywhere) return 'ships';
  if (reach.ships.length === 0) return 'not-published';
  return reach.ships.some((r) => normalizeRegion(r) === wanted) ? 'ships' : 'does-not-ship';
}

export type AvailabilityRefusal =
  | 'offer-invalid'
  | 'license-region'
  | 'license-display'
  | 'merchant-does-not-ship'
  | 'out-of-stock';

export interface RegionalAvailability {
  readonly region: RegionCode;
  /** Show it, and treat it as a real option for a buyer here. */
  readonly available: boolean;
  /** Show it, but say plainly that delivery to this region is unconfirmed. */
  readonly shippingUnconfirmed: boolean;
  readonly refusals: readonly { readonly refusal: AvailabilityRefusal; readonly detail: string }[];
}

/**
 * Can a reader in `region` act on this offer?
 *
 * Unpublished shipping reach does not refuse the offer — it sets
 * `shippingUnconfirmed`, so a surface can show it with the caveat attached
 * rather than hiding a possibly-fine option or implying a delivery promise
 * nobody made. Out of stock also does not hide the offer: a price history is
 * still worth seeing, and a reader deciding whether to wait is better served
 * by the row than by its absence.
 */
export function regionalAvailability(
  offer: Offer,
  region: string,
  reach: ShippingReach | null | undefined,
  now: Date = new Date(),
): RegionalAvailability {
  const wanted = normalizeRegion(region);
  const refusals: { refusal: AvailabilityRefusal; detail: string }[] = [];
  const refuse = (refusal: AvailabilityRefusal, detail: string) =>
    refusals.push({ refusal, detail });

  const validity = validateOffer(offer, now);
  if (!validity.usable) {
    refuse(
      'offer-invalid',
      validity.problems.map((p) => `${p.problem}: ${p.detail}`).join(' · ') ||
        'Offer is not usable.',
    );
  }

  const regionDecision = licenseAllowsRegion(offer.licenseTag, wanted, now);
  if (!regionDecision.allowed) {
    refuse('license-region', regionDecision.detail ?? 'Licence does not cover this region.');
  }

  const displayDecision = licenseAllowsPriceDisplay(offer.licenseTag, now);
  if (!displayDecision.allowed) {
    refuse('license-display', displayDecision.detail ?? 'Licence forbids displaying the price.');
  }

  const verdict = reachesRegion(reach, wanted);
  if (verdict === 'does-not-ship') {
    refuse('merchant-does-not-ship', `Merchant ${offer.merchantId} does not ship to ${wanted}.`);
  }

  if (offer.availability === 'out') {
    refuse('out-of-stock', 'Merchant reports this as out of stock.');
  }

  return {
    region: wanted,
    available: refusals.length === 0,
    shippingUnconfirmed: verdict === 'not-published',
    refusals,
  };
}

/**
 * The offers a reader in `region` may be shown, cheapest-total ranking left to
 * `rankByTotal`. Out-of-stock and unconfirmed-shipping offers are kept, since
 * both are legitimate things to show with a label; licence and validity
 * failures are removed, since neither may be shown at all.
 */
export function offersVisibleInRegion(
  offers: readonly Offer[],
  region: string,
  reachByMerchant: ReadonlyMap<string, ShippingReach>,
  now: Date = new Date(),
): readonly Offer[] {
  return offers.filter((offer) => {
    const verdict = regionalAvailability(offer, region, reachByMerchant.get(offer.merchantId), now);
    return !verdict.refusals.some(
      (r) =>
        r.refusal === 'offer-invalid' ||
        r.refusal === 'license-region' ||
        r.refusal === 'license-display' ||
        r.refusal === 'merchant-does-not-ship',
    );
  });
}
