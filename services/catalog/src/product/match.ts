/*
 * CROSS-MERCHANT MATCHING.
 *
 * Offers in, products out. The interesting part is not the grouping — a Map
 * does that — it is the three cases where grouping must be REFUSED:
 *
 *   1. an offer with no usable identifier joins nothing;
 *   2. a brand+MPN key claimed by two different GTINs is ambiguous, and the
 *      offers that depend on it alone are quarantined rather than attached to
 *      whichever GTIN happened to be seen first;
 *   3. a single merchant listing the same identity twice is one offer per
 *      merchant, not two.
 *
 * Case 2 is the one that needs saying out loud. Two manufacturers reusing a
 * part number is common, and a 500 ml and a 750 ml bottle sharing `MPN-1` with
 * different GTINs is the same shape. Picking either is a coin toss about a
 * price, so neither is picked.
 */
import {
  productIdentity,
  secondaryBrandMpnKey,
  type IdentityBasis,
  type MatchConfidence,
} from './identity';

export interface MatchableOffer {
  readonly id: string;
  readonly merchantId: string;
  readonly merchantOfferId: string;
  readonly gtin: string | null;
  readonly mpn: string | null;
  readonly brand: string;
  readonly title: string;
}

export interface ProductGroup {
  /** Stable across runs: derived from the identity, never from a sequence. */
  readonly productKey: string;
  readonly basis: IdentityBasis;
  readonly confidence: MatchConfidence;
  readonly offerIds: readonly string[];
  /** The brand+MPN keys this GTIN product also answers to. */
  readonly aliasKeys: readonly string[];
}

export type UnmatchedReason = 'no_identifier' | 'ambiguous_identity' | 'duplicate_within_merchant';

export interface UnmatchedOffer {
  readonly offerId: string;
  readonly merchantId: string;
  readonly merchantOfferId: string;
  readonly reason: UnmatchedReason;
  /** Human-readable, and safe to show an operator. Never a price or a URL. */
  readonly detail: string;
}

export interface MatchResult {
  readonly products: readonly ProductGroup[];
  readonly unmatched: readonly UnmatchedOffer[];
  /** brand+MPN keys found to be claimed by more than one GTIN. */
  readonly ambiguousKeys: readonly string[];
}

export function matchOffers(offers: readonly MatchableOffer[]): MatchResult {
  /*
   * PASS 1 — find the brand+MPN keys that more than one GTIN claims.
   *
   * This has to happen before any grouping. Deciding as we go would make the
   * outcome depend on feed order, so the same two feeds in a different
   * sequence would produce different catalogues.
   */
  const gtinsByBrandMpn = new Map<string, Set<string>>();
  for (const offer of offers) {
    const identity = productIdentity(offer);
    if (identity.basis !== 'gtin') continue;
    const alias = secondaryBrandMpnKey(offer);
    if (alias === null) continue;
    const seen = gtinsByBrandMpn.get(alias) ?? new Set<string>();
    seen.add(identity.key);
    gtinsByBrandMpn.set(alias, seen);
  }

  const ambiguous = new Set<string>();
  const gtinForBrandMpn = new Map<string, string>();
  for (const [alias, gtins] of gtinsByBrandMpn) {
    if (gtins.size > 1) ambiguous.add(alias);
    else gtinForBrandMpn.set(alias, [...gtins][0]);
  }

  // PASS 2 — group.
  interface Draft {
    basis: IdentityBasis;
    confidence: MatchConfidence;
    offerIds: string[];
    aliasKeys: Set<string>;
    merchants: Map<string, string>;
  }
  const drafts = new Map<string, Draft>();
  const unmatched: UnmatchedOffer[] = [];

  const reject = (offer: MatchableOffer, reason: UnmatchedReason, detail: string) =>
    unmatched.push({
      offerId: offer.id,
      merchantId: offer.merchantId,
      merchantOfferId: offer.merchantOfferId,
      reason,
      detail,
    });

  for (const offer of offers) {
    const identity = productIdentity(offer);

    if (identity.basis === null) {
      reject(
        offer,
        'no_identifier',
        identity.reason === 'invalid_gtin_no_mpn'
          ? 'the GTIN failed its check digit and there is no brand + MPN to fall back to'
          : 'no GTIN and no brand + MPN',
      );
      continue;
    }

    let productKey = identity.key;
    let basis = identity.basis;
    let confidence: MatchConfidence = identity.confidence;

    if (identity.basis === 'brand_mpn') {
      if (ambiguous.has(identity.key)) {
        reject(
          offer,
          'ambiguous_identity',
          `brand + MPN '${identity.key}' is claimed by more than one GTIN, so this offer ` +
            'cannot be attached to a product without guessing which',
        );
        continue;
      }
      // A brand+MPN offer joins the GTIN product when exactly one GTIN claims
      // that key. That is what makes a merchant who omits the GTIN still
      // comparable with one who supplies it.
      const viaGtin = gtinForBrandMpn.get(identity.key);
      if (viaGtin !== undefined) {
        productKey = viaGtin;
        basis = 'gtin';
        // The JOIN still rests on brand + MPN, so the link is not high
        // confidence just because the product it joined has a GTIN.
        confidence = 'medium';
      }
    }

    const draft = drafts.get(productKey) ?? {
      basis,
      confidence,
      offerIds: [],
      aliasKeys: new Set<string>(),
      merchants: new Map<string, string>(),
    };

    // ONE OFFER PER MERCHANT PER PRODUCT. A merchant listing the same identity
    // under two SKUs is a duplicate in their feed, and showing it twice would
    // inflate the offer count a visitor reads as choice.
    const already = draft.merchants.get(offer.merchantId);
    if (already !== undefined && already !== offer.merchantOfferId) {
      reject(
        offer,
        'duplicate_within_merchant',
        `${offer.merchantId} already lists this product as '${already}'`,
      );
      continue;
    }
    draft.merchants.set(offer.merchantId, offer.merchantOfferId);

    if (!draft.offerIds.includes(offer.id)) draft.offerIds.push(offer.id);
    const alias = secondaryBrandMpnKey(offer);
    if (alias !== null && alias !== productKey) draft.aliasKeys.add(alias);
    // A group that gained a GTIN member is a GTIN group, whatever joined first.
    if (basis === 'gtin') draft.basis = 'gtin';
    // Confidence is the WEAKEST link in the group, not the strongest: a
    // product whose offers were joined on brand + MPN is only as trustworthy
    // as that join.
    if (confidence === 'medium' && draft.confidence === 'high') draft.confidence = 'medium';
    drafts.set(productKey, draft);
  }

  const products = [...drafts.entries()]
    .map(([productKey, draft]) => ({
      productKey,
      basis: draft.basis,
      confidence: draft.confidence,
      offerIds: draft.offerIds,
      aliasKeys: [...draft.aliasKeys].sort(),
    }))
    // Sorted so the output does not depend on Map insertion order, which
    // depends on feed order.
    .sort((a, b) => (a.productKey < b.productKey ? -1 : a.productKey > b.productKey ? 1 : 0));

  return { products, unmatched, ambiguousKeys: [...ambiguous].sort() };
}
