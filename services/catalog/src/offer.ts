/*
 * The canonical offer model, and the two questions the rest of the platform is
 * allowed to ask about one: what does the item cost, and is the DELIVERED cost
 * known well enough to rank on?
 *
 * THE INVARIANT THIS FILE EXISTS TO ENFORCE. Absent shipping is absent, never
 * zero. The measured Soundcore feed (29 Oct 2026, 227 records) carries no
 * shipping value at all — 0/227 — so every offer built from it is MISSING. A
 * `$0` would read to a shopper as free delivery, which nobody verified and
 * which would make the one number this site promises to get right a guess.
 *
 * The rule is enforced by the TYPE, not by discipline: `MISSING` carries no
 * `Money` field, so there is no `shipping.cost` to default to zero. The only
 * way to obtain a `VERIFIED` shipping cost is `verifiedShipping()`, which
 * demands a destination country and a non-empty evidence string and throws
 * without them. Fabricating a delivered cost cannot happen by accident; it
 * would take someone deliberately writing a lie into `evidence`.
 */
import { addMoney, minMoney, type Money } from './money';

export type Availability = 'in_stock' | 'out_of_stock' | 'preorder' | 'backorder';
export type ItemCondition = 'new' | 'refurbished' | 'used';

/** What is known about getting this offer to a buyer. There is no third state. */
export type ShippingCost =
  | { readonly kind: 'MISSING'; readonly reason: string }
  | {
      readonly kind: 'VERIFIED';
      readonly cost: Money;
      /** ISO-3166-1 alpha-2. A price without a destination is not a verified cost. */
      readonly destinationCountry: string;
      /** Where the figure came from, e.g. `cj:shopping:7382109#SHIPPING(PRICE)`. */
      readonly evidence: string;
    };

/**
 * Unavoidable fees at checkout (handling, mandatory recycling levies, and the
 * like). The Shopping (Google Format) feed has no column for these, so for
 * feed-derived offers this is always UNKNOWN — which is why `price + shipping`
 * would still not be a verified checkout total even once shipping arrives.
 */
export type MandatoryFees =
  | { readonly kind: 'UNKNOWN'; readonly reason: string }
  | { readonly kind: 'VERIFIED'; readonly total: Money; readonly evidence: string };

export interface Offer {
  /** Globally unique within the catalog: `<merchantId>:<merchantOfferId>`. */
  readonly offerId: string;
  readonly merchantId: string;
  /** The merchant's own SKU/ID, exactly as the feed stated it. */
  readonly merchantOfferId: string;
  /** Validated GTIN, or null when identity rests on brand + MPN instead. */
  readonly gtin: string | null;
  readonly mpn: string | null;
  readonly brand: string;
  readonly title: string;
  /** The merchant's list price. */
  readonly listPrice: Money;
  /** The merchant's sale price when one is quoted, else null. */
  readonly salePrice: Money | null;
  readonly availability: Availability;
  readonly condition: ItemCondition;
  readonly productUrl: string;
  readonly imageUrl: string;
  readonly shipping: ShippingCost;
  readonly mandatoryFees: MandatoryFees;
  /** ISO-8601 instant this record was last true according to the provider. */
  readonly snapshotAt: string;
  /** Provenance label for the feed this came from. Carries no credentials. */
  readonly sourceFeed: string;
}

export function missingShipping(reason: string): ShippingCost {
  if (reason.trim() === '') {
    throw new TypeError('missing shipping needs a reason: an unexplained gap is not evidence');
  }
  return { kind: 'MISSING', reason };
}

/**
 * The only constructor for a known shipping cost.
 *
 * Both guards matter. Without a destination, "5.99 shipping" is unverifiable —
 * cheap to Texas is not cheap to Alaska. Without evidence, nobody can later
 * answer "who said so?", which is the question an accuracy complaint starts
 * with. A zero cost is permitted, but only on the same terms as any other
 * figure: a provider has to have stated it.
 */
export function verifiedShipping(
  cost: Money,
  destinationCountry: string,
  evidence: string,
): ShippingCost {
  if (!/^[A-Z]{2}$/.test(destinationCountry)) {
    throw new TypeError('verified shipping needs an ISO-3166-1 alpha-2 destination');
  }
  if (evidence.trim() === '') {
    throw new TypeError('verified shipping needs evidence naming the source of the figure');
  }
  if (cost.amountMinor < 0) {
    throw new RangeError('shipping cost cannot be negative');
  }
  return { kind: 'VERIFIED', cost, destinationCountry, evidence };
}

/**
 * What the buyer pays for the ITEM — the lower of list and sale price. This is
 * deliberately NOT called a total: it excludes shipping and fees, and the
 * naming is the point. A field called `price` gets rendered next to the word
 * "total" by someone who never read this file.
 */
export function itemPrice(offer: Offer): Money {
  return offer.salePrice === null ? offer.listPrice : minMoney(offer.listPrice, offer.salePrice);
}

export type DeliveredCostComponent = 'shipping' | 'mandatory-fees' | 'currency-mismatch';

export type DeliveredCost =
  | { readonly kind: 'UNAVAILABLE'; readonly missing: readonly DeliveredCostComponent[] }
  | {
      readonly kind: 'VERIFIED';
      readonly total: Money;
      readonly item: Money;
      readonly shipping: Money;
      readonly fees: Money;
    };

/**
 * The all-in cost, or an explicit statement of what is missing. There is no
 * partial answer and no best-effort sum: an "estimated total" is the failure
 * mode this whole project exists to avoid.
 */
export function deliveredCost(offer: Offer): DeliveredCost {
  const missing: DeliveredCostComponent[] = [];
  if (offer.shipping.kind !== 'VERIFIED') missing.push('shipping');
  if (offer.mandatoryFees.kind !== 'VERIFIED') missing.push('mandatory-fees');
  if (missing.length > 0) return { kind: 'UNAVAILABLE', missing };

  // Narrowed by the checks above; the compiler cannot see through the array.
  const shipping = (offer.shipping as Extract<ShippingCost, { kind: 'VERIFIED' }>).cost;
  const fees = (offer.mandatoryFees as Extract<MandatoryFees, { kind: 'VERIFIED' }>).total;
  const item = itemPrice(offer);

  // Mixed currencies are a data fault, not a programmer fault, so this
  // degrades to UNAVAILABLE rather than throwing out of a render path.
  if (item.currency !== shipping.currency || item.currency !== fees.currency) {
    return { kind: 'UNAVAILABLE', missing: ['currency-mismatch'] };
  }

  return {
    kind: 'VERIFIED',
    total: addMoney(addMoney(item, shipping), fees),
    item,
    shipping,
    fees,
  };
}

export interface RankingEligibility {
  readonly eligible: boolean;
  /** Empty only when eligible. Each entry names one unmet condition. */
  readonly blockers: readonly string[];
}

/**
 * May this offer take part in cheapest-delivered-cost ranking?
 *
 * Default-deny, and deliberately blunt: an offer qualifies only when every
 * component of the number it would be ranked on has been verified. As measured,
 * no Soundcore offer can pass — not because Soundcore is special-cased, but
 * because its feed states no shipping. Ranking offers whose delivered cost is
 * unknown is exactly what `/how-we-rank` promises not to do.
 */
export function deliveredPriceRankingEligibility(offer: Offer): RankingEligibility {
  const blockers: string[] = [];
  if (offer.shipping.kind !== 'VERIFIED') blockers.push('shipping-not-verified');
  if (offer.mandatoryFees.kind !== 'VERIFIED') blockers.push('mandatory-fees-unknown');
  if (offer.availability !== 'in_stock') blockers.push('not-purchasable');
  if (deliveredCost(offer).kind !== 'VERIFIED' && blockers.length === 0) {
    blockers.push('delivered-cost-unavailable');
  }
  return { eligible: blockers.length === 0, blockers };
}
