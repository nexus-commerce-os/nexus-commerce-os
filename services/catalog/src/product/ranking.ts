/*
 * RANKING, AND THE PRICE A LISTING SHOWS.
 *
 * Nothing here computes a delivered cost or decides what counts as verified —
 * `deliveredCost` and `deliveredPriceRankingEligibility` in offer.ts already
 * do, and re-deriving either would be a second definition of the number the
 * site's /how-we-rank page describes. This only reconstructs an `Offer` from a
 * stored row so those functions can be used, and then orders the result.
 *
 * COMMISSION IS NOT AN INPUT. Not weighted, not a tie-break, not consulted.
 * The comparator below takes a delivered cost and a merchant id, and the
 * merchant id is used only to make the order deterministic when two offers
 * cost the same. There is no commission field in scope for this file, and
 * that is deliberate.
 */
import {
  deliveredCost,
  deliveredPriceRankingEligibility,
  itemPrice,
  missingShipping,
  verifiedShipping,
  type DeliveredCost,
  type MandatoryFees,
  type Offer,
  type RankingEligibility,
} from '../offer';
import type { Money } from '../money';
import type { StoredOffer } from '../store/offer-store';

/**
 * A stored row as an `Offer`, so the delivered-cost rules apply unchanged.
 *
 * `evidence` names the feed the figure came from rather than being invented:
 * the original evidence string is not persisted, and "who said so?" has to
 * resolve to something. A stored offer whose shipping is unverified gets a
 * reason that says exactly that, not a blank.
 */
export function storedAsOffer(stored: StoredOffer): Offer {
  const provenance = `${stored.sourceFeed}#${stored.merchantOfferId}`;

  const shipping =
    stored.shippingVerified && stored.shippingCost !== null && stored.shippingDestination !== null
      ? verifiedShipping(stored.shippingCost, stored.shippingDestination, `stored:${provenance}`)
      : missingShipping(
          stored.shippingVerified
            ? // Unreachable through the store, which refuses to hold it: the
              // schema CHECKs pair the flag with the figure in both
              // directions. Treated as unverified rather than trusted, because
              // a half-known cost must never become a total.
              'stored offer claims verified shipping without a figure or destination'
            : 'the source feed states no shipping cost',
        );

  const mandatoryFees: MandatoryFees =
    stored.feesVerified && stored.feesTotal !== null
      ? { kind: 'VERIFIED', total: stored.feesTotal, evidence: `stored:${provenance}` }
      : { kind: 'UNKNOWN', reason: 'the source feed has no column for mandatory fees' };

  return {
    offerId: stored.id,
    merchantId: stored.merchantId,
    merchantOfferId: stored.merchantOfferId,
    gtin: stored.gtin,
    mpn: stored.mpn,
    brand: stored.brand,
    title: stored.title,
    listPrice: stored.listPrice,
    salePrice: stored.salePrice,
    availability: stored.availability,
    condition: stored.condition,
    productUrl: stored.productUrl,
    imageUrl: stored.imageUrl,
    shipping,
    mandatoryFees,
    snapshotAt: stored.snapshotAt,
    sourceFeed: stored.sourceFeed,
  };
}

export interface RankedOffer {
  readonly offerId: string;
  readonly merchantId: string;
  readonly delivered: DeliveredCost;
  readonly item: Money;
  readonly eligibility: RankingEligibility;
}

export interface OfferRanking {
  /**
   * Offers eligible for cheapest-delivered-cost ranking, cheapest first.
   * Empty is the normal case today: no measured offer verifies shipping.
   */
  readonly ranked: readonly RankedOffer[];
  /** Everything else, with its blockers. Still listed, never ranked. */
  readonly unranked: readonly RankedOffer[];
  /**
   * The lowest VERIFIED delivered cost, or null.
   *
   * Null when no offer is eligible, and null when the eligible offers are
   * priced in more than one currency — there is no authorised exchange rate in
   * this system, and converting with an unauthorised one would invent the
   * number the page leads with.
   */
  readonly fromDelivered: Money | null;
  readonly fromReason: 'cheapest_verified_delivered_cost' | 'no_eligible_offer' | 'mixed_currency';
}

export function rankOffers(offers: readonly StoredOffer[]): OfferRanking {
  const assessed: RankedOffer[] = offers.map((stored) => {
    const offer = storedAsOffer(stored);
    return {
      offerId: stored.id,
      merchantId: stored.merchantId,
      delivered: deliveredCost(offer),
      item: itemPrice(offer),
      eligibility: deliveredPriceRankingEligibility(offer),
    };
  });

  const eligible = assessed.filter(
    (o) => o.eligibility.eligible && o.delivered.kind === 'VERIFIED',
  );
  const unranked = assessed.filter(
    (o) => !(o.eligibility.eligible && o.delivered.kind === 'VERIFIED'),
  );

  const ranked = [...eligible].sort((a, b) => {
    const left = a.delivered as Extract<DeliveredCost, { kind: 'VERIFIED' }>;
    const right = b.delivered as Extract<DeliveredCost, { kind: 'VERIFIED' }>;
    if (left.total.currency !== right.total.currency) {
      // Not comparable. Ordered by currency code so the sort stays a total
      // order instead of being undefined, and `fromDelivered` refuses below.
      return left.total.currency < right.total.currency ? -1 : 1;
    }
    if (left.total.amountMinor !== right.total.amountMinor) {
      return left.total.amountMinor - right.total.amountMinor;
    }
    // Equal cost. Merchant id, so the order is stable rather than whatever the
    // feed happened to produce — and emphatically not commission.
    return a.merchantId < b.merchantId ? -1 : a.merchantId > b.merchantId ? 1 : 0;
  });

  if (ranked.length === 0) {
    return { ranked, unranked, fromDelivered: null, fromReason: 'no_eligible_offer' };
  }

  const currencies = new Set(
    ranked.map((o) => (o.delivered as Extract<DeliveredCost, { kind: 'VERIFIED' }>).total.currency),
  );
  if (currencies.size > 1) {
    return { ranked, unranked, fromDelivered: null, fromReason: 'mixed_currency' };
  }

  return {
    ranked,
    unranked,
    fromDelivered: (ranked[0].delivered as Extract<DeliveredCost, { kind: 'VERIFIED' }>).total,
    fromReason: 'cheapest_verified_delivered_cost',
  };
}
