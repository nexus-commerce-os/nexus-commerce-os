/**
 * How old a price is allowed to be before it stops being a price.
 *
 * A stale price is the specific failure this site exists to avoid: a figure
 * that was true when it was fetched and is false when it is read. The three
 * tiers come from docs/06 §4; what they mean in seconds is decided here, in
 * one place, so that "fresh" means the same thing to the ranker, the cache and
 * the page.
 */

export type FreshnessTier = 'hot' | 'warm' | 'live';

export interface Freshness {
  readonly tier: FreshnessTier;
  /** When the price itself was observed (ISO-8601). */
  readonly priceObservedAt: string;
  /** When the feed this came from last synced (ISO-8601). */
  readonly feedSyncedAt: string;
}

/**
 * Maximum age at which an observation in each tier is still usable.
 *
 *   live — fetched per request; minutes, because it is as current as we get
 *   hot  — frequently re-synced popular offers
 *   warm — the long tail, re-synced slowly, so a wider but still bounded window
 *
 * These are ceilings on *display*, not cache TTLs. A licence may require a
 * shorter cache (see `cacheTtlSeconds`); nothing may lengthen these.
 */
export const MAX_AGE_SECONDS: Readonly<Record<FreshnessTier, number>> = Object.freeze({
  live: 15 * 60,
  hot: 6 * 60 * 60,
  warm: 24 * 60 * 60,
});

export type StalenessReason = 'malformed-timestamp' | 'future-timestamp' | 'too-old';

export interface FreshnessVerdict {
  readonly fresh: boolean;
  readonly ageSeconds: number | null;
  readonly reason?: StalenessReason;
  readonly detail?: string;
}

/**
 * Is this observation still fresh at `now`?
 *
 * A timestamp in the future is treated as stale rather than as very fresh.
 * Clock skew on a partner's side is common, and the failure mode of trusting
 * it is showing a price that has not happened yet. A small tolerance absorbs
 * ordinary skew; beyond that the record is refused.
 */
export function evaluateFreshness(
  freshness: Freshness,
  now: Date = new Date(),
  skewToleranceSeconds = 120,
): FreshnessVerdict {
  const observed = Date.parse(freshness.priceObservedAt);
  if (Number.isNaN(observed)) {
    return {
      fresh: false,
      ageSeconds: null,
      reason: 'malformed-timestamp',
      detail: `priceObservedAt "${freshness.priceObservedAt}" is not an ISO-8601 instant.`,
    };
  }

  const ageSeconds = Math.floor((now.getTime() - observed) / 1000);

  if (ageSeconds < -skewToleranceSeconds) {
    return {
      fresh: false,
      ageSeconds,
      reason: 'future-timestamp',
      detail:
        `Observed ${-ageSeconds}s in the future, beyond the ${skewToleranceSeconds}s skew ` +
        `tolerance. A price from the future is a clock problem, not a bargain.`,
    };
  }

  const maxAge = MAX_AGE_SECONDS[freshness.tier];
  if (ageSeconds > maxAge) {
    return {
      fresh: false,
      ageSeconds,
      reason: 'too-old',
      detail: `${ageSeconds}s old; the ${freshness.tier} tier allows ${maxAge}s.`,
    };
  }
  return { fresh: true, ageSeconds: Math.max(0, ageSeconds) };
}

export const isFresh = (freshness: Freshness, now: Date = new Date()): boolean =>
  evaluateFreshness(freshness, now).fresh;

/**
 * "2 hours ago" — for the line next to a price that says when it was checked.
 * Plain and explicit; a reader deciding whether to trust a figure deserves the
 * number, not a vague "recently".
 */
export function describeAge(ageSeconds: number): string {
  if (ageSeconds < 60) return 'just now';
  const minutes = Math.floor(ageSeconds / 60);
  if (minutes < 60) return `${minutes} minute${minutes === 1 ? '' : 's'} ago`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours} hour${hours === 1 ? '' : 's'} ago`;
  const days = Math.floor(hours / 24);
  return `${days} day${days === 1 ? '' : 's'} ago`;
}
