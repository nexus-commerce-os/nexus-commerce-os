/**
 * The licence tag: the legitimacy contract that travels with every offer.
 *
 * docs/06 §4 states the rule in RFC-2119 terms — an offer whose `license_tag`
 * is missing or expired MUST NOT be indexed, cached, or served, and fields
 * flagged `may_display_* = false` MUST NOT be rendered. This module is where
 * that rule is a function rather than a paragraph, so the answer is the same
 * everywhere it is asked.
 *
 * The shape is the one in docs/06 §4, in TypeScript spelling.
 */

export type AcquisitionMethod = 'api' | 'licensed_feed' | 'affiliate_network';

export interface LicenseTag {
  /** Partner id this data came from. */
  readonly source: string;
  readonly acquiredVia: AcquisitionMethod;
  readonly mayCachePrice: boolean;
  /** Partner-imposed ceiling on any cache TTL for this offer's price. */
  readonly cacheTtlMaxSeconds: number;
  readonly mayDisplayPrice: boolean;
  readonly mayDisplayReviewText: boolean;
  readonly mayRedistributeImage: boolean;
  readonly attributionRequired: boolean;
  /** ISO-3166 regions the licence permits. Empty means unrestricted. */
  readonly geoRestrictions: readonly string[];
  /** ISO-8601 instant at which the licence lapses. */
  readonly expiresAt: string;
}

export type LicenseRefusal =
  'missing' | 'expired' | 'malformed-expiry' | 'region-not-permitted' | 'display-not-permitted';

export interface LicenseDecision {
  readonly allowed: boolean;
  /** Present only when `allowed` is false; names which rule refused. */
  readonly refusal?: LicenseRefusal;
  readonly detail?: string;
}

const ALLOW: LicenseDecision = Object.freeze({ allowed: true });

const deny = (refusal: LicenseRefusal, detail: string): LicenseDecision =>
  Object.freeze({ allowed: false, refusal, detail });

/**
 * May this offer be indexed, cached or served at all, right now?
 *
 * `now` is a parameter rather than a call to `Date.now()` so that expiry is
 * testable and so that a batch job evaluates every record against one instant
 * rather than drifting through the run.
 */
export function licenseAllowsUse(
  tag: LicenseTag | null | undefined,
  now: Date = new Date(),
): LicenseDecision {
  if (!tag) {
    return deny('missing', 'No licence tag. An untagged offer has no permission attached to it.');
  }
  const expiry = Date.parse(tag.expiresAt);
  if (Number.isNaN(expiry)) {
    return deny('malformed-expiry', `expiresAt "${tag.expiresAt}" is not an ISO-8601 instant.`);
  }
  if (expiry <= now.getTime()) {
    return deny('expired', `Licence from "${tag.source}" expired at ${tag.expiresAt}.`);
  }
  return ALLOW;
}

/** May this offer be shown to a reader in `region` (ISO-3166 alpha-2)? */
export function licenseAllowsRegion(
  tag: LicenseTag | null | undefined,
  region: string,
  now: Date = new Date(),
): LicenseDecision {
  const base = licenseAllowsUse(tag, now);
  if (!base.allowed) return base;
  const permitted = tag!.geoRestrictions;
  if (permitted.length === 0) return ALLOW;
  const wanted = region.toUpperCase();
  return permitted.some((r) => r.toUpperCase() === wanted)
    ? ALLOW
    : deny(
        'region-not-permitted',
        `Licence permits ${permitted.join(', ')}; this reader is in ${wanted}.`,
      );
}

/** May the price be rendered? Caching and displaying are separate permissions. */
export function licenseAllowsPriceDisplay(
  tag: LicenseTag | null | undefined,
  now: Date = new Date(),
): LicenseDecision {
  const base = licenseAllowsUse(tag, now);
  if (!base.allowed) return base;
  return tag!.mayDisplayPrice
    ? ALLOW
    : deny('display-not-permitted', `Licence from "${tag!.source}" forbids displaying the price.`);
}

export function licenseAllowsImageRedistribution(
  tag: LicenseTag | null | undefined,
  now: Date = new Date(),
): LicenseDecision {
  const base = licenseAllowsUse(tag, now);
  if (!base.allowed) return base;
  return tag!.mayRedistributeImage
    ? ALLOW
    : deny('display-not-permitted', `Licence from "${tag!.source}" forbids redistributing images.`);
}

export function licenseAllowsReviewText(
  tag: LicenseTag | null | undefined,
  now: Date = new Date(),
): LicenseDecision {
  const base = licenseAllowsUse(tag, now);
  if (!base.allowed) return base;
  return tag!.mayDisplayReviewText
    ? ALLOW
    : deny('display-not-permitted', `Licence from "${tag!.source}" forbids showing review text.`);
}

/**
 * The TTL to cache this price for: `min(tierTtl, cacheTtlMaxSeconds)`, and
 * zero when caching is not permitted at all.
 *
 * docs/06 §4 calls `cacheTtlMaxSeconds` a ceiling. Expressing it as `min`
 * rather than as a validation rule means a caller cannot accidentally exceed
 * it by passing a longer tier TTL — the worst case is caching for less time
 * than allowed, which costs a request and breaks no contract.
 */
export function cacheTtlSeconds(
  tag: LicenseTag | null | undefined,
  tierTtlSeconds: number,
): number {
  if (!tag || !tag.mayCachePrice) return 0;
  const ceiling = Number.isFinite(tag.cacheTtlMaxSeconds) ? tag.cacheTtlMaxSeconds : 0;
  return Math.max(0, Math.min(Math.floor(tierTtlSeconds), Math.floor(ceiling)));
}

/** Attribution line a surface must render when the licence demands one. */
export const attributionFor = (tag: LicenseTag): string | null =>
  tag.attributionRequired ? `Source: ${tag.source}` : null;
