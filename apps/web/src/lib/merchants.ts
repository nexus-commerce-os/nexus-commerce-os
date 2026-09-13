/*
 * Merchant registry and outbound-link resolution.
 *
 * ARCHITECTURE ONLY — this module activates nothing. It exists so that when an
 * affiliate relationship is eventually approved, turning it on is a data change
 * in one place rather than a code change scattered across pages.
 *
 * THE SAFETY PROPERTY, stated once: a merchant's affiliate URL is used only
 * when the relationship is `approved` AND a real `affiliateUrl` string has been
 * supplied. Every other combination — pending, declined, expired, or approved
 * with a null URL — resolves to the merchant's ordinary public URL. There is no
 * branch that constructs a tracking URL, and there must never be one: CJ issues
 * tracking links, they cannot be derived from an advertiser ID, and a guessed
 * link would send a real buyer through a URL nobody authorised.
 *
 * `apps/web/scripts/verify-merchants.mjs` asserts these invariants and fails the
 * build if they are broken, so the guarantee does not depend on review.
 *
 * No page imports this yet. Wiring it into rendered output is a separate,
 * deliberate change that happens after an approval exists.
 */

/** Where a merchant stands with us. Only `approved` can produce an affiliate link. */
export type RelationshipStatus = 'none' | 'pending' | 'approved' | 'declined' | 'expired';

export interface Merchant {
  id: string;
  name: string;
  network: 'cj' | 'none';
  /** The network's identifier for this advertiser. Never used to build a URL. */
  advertiserId?: string;
  relationship: RelationshipStatus;
  /** The merchant's ordinary public URL. Always safe to send a visitor to. */
  destinationUrl: string;
  /**
   * A tracking URL **issued by the network**, or null. Never synthesised.
   * Stays null until CJ provides a real one for an approved relationship.
   */
  affiliateUrl: string | null;
}

/**
 * Every merchant we have any relationship with, including none.
 *
 * Soundcore: CJ advertiser 7382109, application PENDING as of 8 Aug 2026.
 * See provider-access/SOUNDCORE-CJ-COMPLIANCE.md for the activation gate.
 */
export const MERCHANTS: readonly Merchant[] = [
  {
    id: 'soundcore',
    name: 'Soundcore',
    network: 'cj',
    advertiserId: '7382109',
    relationship: 'pending',
    destinationUrl: 'https://www.soundcore.com/',
    affiliateUrl: null,
  },
];

export function getMerchant(id: string): Merchant | undefined {
  return MERCHANTS.find((m) => m.id === id);
}

/** What a link to this merchant should currently be. */
export interface OutboundLink {
  href: string;
  /**
   * Present only when the link is a paid/affiliate link. `sponsored` is the
   * attribute Google specifies for exactly that case; omitting it on a real
   * affiliate link is a disclosure failure, and adding it to an ordinary link
   * would misrepresent an unpaid link as paid.
   */
  rel?: string;
  /** True only when an approved affiliate link is actually being used. */
  isAffiliate: boolean;
}

/**
 * Resolve the URL to send a visitor to.
 *
 * Falls back to `destinationUrl` in every case except an approved relationship
 * holding a real, network-issued affiliate URL. The fallback is the point: a
 * missing or unapproved affiliate link must degrade to a working ordinary link,
 * never to a broken one and never to an invented one.
 */
export function resolveOutboundLink(merchant: Merchant): OutboundLink {
  const canUseAffiliate =
    merchant.relationship === 'approved' &&
    typeof merchant.affiliateUrl === 'string' &&
    merchant.affiliateUrl.length > 0;

  if (canUseAffiliate) {
    return {
      href: merchant.affiliateUrl as string,
      rel: 'sponsored noopener noreferrer',
      isAffiliate: true,
    };
  }

  return { href: merchant.destinationUrl, isAffiliate: false };
}

/** Whether a public affiliate relationship may be claimed for this merchant. */
export function mayClaimAffiliateRelationship(merchant: Merchant): boolean {
  return merchant.relationship === 'approved';
}
