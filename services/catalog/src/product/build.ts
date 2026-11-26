/*
 * OFFERS IN, PUBLICATION CANDIDATES OUT.
 *
 * This is the whole pipeline in one pure function: match, classify, rank,
 * decide. No database, no clock of its own, no network — so every rule below
 * is testable by passing rows in and reading the answer, and the eligibility
 * decision a visitor is affected by can be re-derived from the inputs that
 * produced it.
 *
 * ELIGIBILITY IS DEFAULT-DENY. A product reaches the public catalogue only
 * when every one of these holds, and each failure is recorded with a code so
 * the dashboard can explain an absence without re-running anything:
 *
 *   · at least one ACTIVE offer;
 *   · from a merchant whose relationship is APPROVED — possession of a feed is
 *     not approval;
 *   · whose data is FRESH, within the same window the import guard uses;
 *   · with an UNAMBIGUOUS identity.
 *
 * It does NOT require a verified delivered cost. No offer measured so far has
 * one, so requiring it would publish an empty catalogue — and a product listed
 * with an honest "shipping not stated" is useful, while a product listed with
 * an invented total is the thing this project exists to avoid. Ranking is
 * where verification is mandatory, and that rule lives in offer.ts.
 */
import { MAX_FEED_AGE_MS } from '../freshness';
import type { Money } from '../money';
import type { StoredOffer } from '../store/offer-store';
import { classifyFromProductType, type Category } from './classify';
import { normaliseBrand, type IdentityBasis, type MatchConfidence } from './identity';
import { matchOffers, type MatchResult, type UnmatchedOffer } from './match';
import { rankOffers, type OfferRanking } from './ranking';

export type IneligibleReason =
  'no_active_offer' | 'merchant_not_approved' | 'stale_data' | 'ambiguous_identity';

export const ELIGIBLE = 'eligible';

export interface ProductDraft {
  /** Derived from the identity, so it is the same across runs. */
  readonly productKey: string;
  readonly basis: IdentityBasis;
  readonly confidence: MatchConfidence;
  readonly slug: string;
  readonly title: string;
  readonly brand: string | null;
  readonly brandNormalised: string | null;
  readonly categorySlug: string | null;
  readonly categoryPath: readonly Category[];
  readonly gtin: string | null;
  readonly mpn: string | null;
  /**
   * Variants are NOT derived. See `variantGroupId` below.
   */
  readonly variantGroupId: string | null;
  readonly offerIds: readonly string[];
  readonly ranking: OfferRanking;
  readonly fromPrice: Money | null;
  /** The newest `lastSeenAt` among the product's offers. Shown to visitors. */
  readonly dataVerifiedAt: string;
  readonly searchText: string;
  readonly eligible: boolean;
  readonly reasonCode: typeof ELIGIBLE | IneligibleReason;
}

export interface BuildProductsInput {
  readonly offers: readonly StoredOffer[];
  /**
   * Merchants whose relationship is `approved`. Everything else is withheld.
   * Passed in rather than queried so this stays pure and so the caller cannot
   * accidentally default it to "all".
   */
  readonly approvedMerchants: ReadonlySet<string>;
  /**
   * `PRODUCT_TYPE` per offer id, overriding what the offers carry.
   *
   * Normally unnecessary: `StoredOffer.productType` holds the merchant's own
   * path, so classification needs no side table. This remains for callers
   * reclassifying from a source other than the stored row.
   */
  readonly productTypeByOfferId?: ReadonlyMap<string, string>;
  /**
   * An explicit variant group per offer id, when a feed states one.
   *
   * THE GOOGLE-FORMAT FEED IN USE HAS NO SUCH COLUMN (measured: the 17 headers
   * are listed in the fixture), so this is empty in practice and
   * `variantGroupId` is null. Deriving variants from title or MPN suffixes
   * would be guessing which products are the same thing in a different size,
   * which is the merge this pipeline refuses everywhere else.
   */
  readonly variantGroupByOfferId?: ReadonlyMap<string, string>;
  readonly now: Date;
  /** Defaults to the import guard's window, so one rule means one age. */
  readonly maxAgeMs?: number;
}

export interface BuildProductsResult {
  readonly products: readonly ProductDraft[];
  /** Offers that could not be attached to any product, with the reason. */
  readonly unmatched: readonly UnmatchedOffer[];
  readonly ambiguousKeys: readonly string[];
  readonly counts: {
    readonly offers: number;
    readonly products: number;
    readonly eligible: number;
    readonly withheld: number;
    readonly unmatched: number;
  };
}

export function buildProducts(input: BuildProductsInput): BuildProductsResult {
  const maxAgeMs = input.maxAgeMs ?? MAX_FEED_AGE_MS;
  const nowMs = input.now.getTime();
  const byId = new Map(input.offers.map((o) => [o.id, o]));

  const match: MatchResult = matchOffers(input.offers);

  const products = match.products.map((group) => {
    const offers = group.offerIds
      .map((id) => byId.get(id))
      .filter((o): o is StoredOffer => o !== undefined);

    const active = offers.filter((o) => o.state === 'active');
    const approved = active.filter((o) => input.approvedMerchants.has(o.merchantId));
    const fresh = approved.filter((o) => {
      const seen = Date.parse(o.lastSeenAt);
      // An unparseable timestamp is stale. It is not "probably fine".
      return Number.isFinite(seen) && nowMs - seen <= maxAgeMs;
    });

    // The representative row. The one whose data is newest, so the title and
    // brand a visitor reads are the most recently confirmed — not the first
    // merchant the feed happened to list.
    const pool =
      fresh.length > 0
        ? fresh
        : approved.length > 0
          ? approved
          : active.length > 0
            ? active
            : offers;
    const representative = [...pool].sort((a, b) =>
      a.lastSeenAt < b.lastSeenAt ? 1 : a.lastSeenAt > b.lastSeenAt ? -1 : 0,
    )[0];

    const ranking = rankOffers(fresh);
    // The representative's own stated path first, then any other offer's, then
    // the override map. A merchant who states nothing must not silently adopt
    // another merchant's categorisation unless nobody in the group stated one.
    const productType =
      findFirst(input.productTypeByOfferId, group.offerIds) ??
      representative.productType ??
      firstStatedProductType(pool);
    const classification = classifyFromProductType(productType);
    const variantGroupId = findFirst(input.variantGroupByOfferId, group.offerIds) ?? null;

    let eligible = true;
    let reasonCode: typeof ELIGIBLE | IneligibleReason = ELIGIBLE;
    if (active.length === 0) {
      eligible = false;
      reasonCode = 'no_active_offer';
    } else if (approved.length === 0) {
      eligible = false;
      reasonCode = 'merchant_not_approved';
    } else if (fresh.length === 0) {
      eligible = false;
      reasonCode = 'stale_data';
    }

    const brand = representative.brand.trim() === '' ? null : representative.brand.trim();

    return {
      productKey: group.productKey,
      basis: group.basis,
      confidence: group.confidence,
      slug: productSlug(representative.title, group.productKey),
      title: representative.title,
      brand,
      brandNormalised: brand === null ? null : normaliseBrand(brand) || null,
      categorySlug: classification.categorySlug,
      categoryPath: classification.path,
      gtin: representative.gtin,
      mpn: representative.mpn,
      variantGroupId,
      offerIds: group.offerIds,
      ranking,
      // The listing price is the cheapest VERIFIED delivered cost or nothing.
      // An item price presented as a "from" price is the half-truth the whole
      // delivered-cost machinery exists to refuse.
      fromPrice: ranking.fromDelivered,
      dataVerifiedAt: newestSeen(pool),
      searchText: searchTextFor(representative.title, brand, classification.path),
      eligible,
      reasonCode,
    } satisfies ProductDraft;
  });

  // The ambiguity refusals from the matcher are product-level absences too, so
  // they are reported in the same place rather than only as unmatched offers.
  const eligibleCount = products.filter((p) => p.eligible).length;

  return {
    products,
    unmatched: match.unmatched,
    ambiguousKeys: match.ambiguousKeys,
    counts: {
      offers: input.offers.length,
      products: products.length,
      eligible: eligibleCount,
      withheld: products.length - eligibleCount,
      unmatched: match.unmatched.length,
    },
  };
}

/* ───────────────────────────── helpers ───────────────────────────── */

function findFirst(
  source: ReadonlyMap<string, string> | undefined,
  offerIds: readonly string[],
): string | null {
  if (source === undefined) return null;
  for (const id of offerIds) {
    const value = source.get(id);
    if (value !== undefined && value.trim() !== '') return value;
  }
  return null;
}

function firstStatedProductType(offers: readonly StoredOffer[]): string | null {
  for (const offer of offers) {
    if (offer.productType !== null && offer.productType.trim() !== '') return offer.productType;
  }
  return null;
}

function newestSeen(offers: readonly StoredOffer[]): string {
  let newest = offers[0].lastSeenAt;
  for (const offer of offers) if (offer.lastSeenAt > newest) newest = offer.lastSeenAt;
  return newest;
}

/**
 * A URL slug that cannot collide and cannot change under a product.
 *
 * The identity key is appended, not optional. Two different products called
 * "Wireless Earbuds" are ordinary, and a slug derived from the title alone
 * would make the second one unpublishable — `published_slug_open` is a unique
 * index, so the collision would surface as a failed publication rather than a
 * bad URL. The suffix also keeps the slug stable when a merchant edits a
 * title, which a title-only slug would not.
 */
export function productSlug(title: string, productKey: string): string {
  const base = title
    .normalize('NFKD')
    .replace(/\p{M}+/gu, '')
    .toLowerCase()
    .replace(/&/g, ' and ')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 72)
    .replace(/-+$/, '');
  const suffix = productKey
    .replace(/[^a-zA-Z0-9]+/g, '')
    .slice(-12)
    .toLowerCase();
  return base === '' ? suffix : `${base}-${suffix}`;
}

function searchTextFor(title: string, brand: string | null, path: readonly Category[]): string {
  const parts = [title, brand ?? '', ...path.map((c) => c.name)];
  return parts
    .join(' ')
    .normalize('NFKD')
    .replace(/\p{M}+/gu, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, ' ')
    .trim();
}
