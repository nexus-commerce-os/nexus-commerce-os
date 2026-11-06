/*
 * How old is this feed, and is that old enough to refuse?
 *
 * WHY A RULE AND NOT A GLANCE. The Soundcore export arrives daily, and prices
 * move between them: one headphone went from $67.99 on 29 October to $79.99 on
 * 2 November. A page that prints a five-day-old price with a five-day-old date
 * on it is not lying, but it is wrong, and "the date was on the page" is not a
 * defence a shopper should have to rely on. The cutoff below turns that into a
 * build failure instead of a judgement call.
 *
 * THE TIMESTAMP COMES FROM THE FEED, NOT THE FILE. A file's mtime says when
 * someone last copied it, which is trivially newer than the data inside — the
 * exact failure this guard exists to catch. The Shopping export stamps every
 * row with LAST_UPDATED at generation time (measured on the 5 November feed:
 * 224 rows spanning 239 milliseconds), so the newest row's timestamp is when
 * the provider finished building the catalogue.
 *
 * Everything here compares instants. An ISO-8601 string with an offset parses
 * to an absolute moment, so the arithmetic is UTC whatever the local zone is.
 */
import type { RawShoppingRow } from './feed/cj-shopping-feed';

/** A feed older than this is refused by a release build. */
export const MAX_FEED_AGE_MS = 48 * 60 * 60 * 1000;

/**
 * How far a provider's clock may run ahead of ours before the timestamp is
 * treated as wrong rather than merely early. Five minutes is the smallest
 * tolerance that survives ordinary NTP drift between two hosts; anything
 * beyond it is a broken timestamp, not a fast clock, and a future-dated feed
 * would otherwise compute a negative age and pass every check.
 */
export const MAX_CLOCK_SKEW_MS = 5 * 60 * 1000;

export type FeedFreshness =
  | { readonly kind: 'fresh'; readonly exportedAt: string; readonly ageMs: number }
  | { readonly kind: 'stale'; readonly exportedAt: string; readonly ageMs: number }
  | { readonly kind: 'future'; readonly exportedAt: string; readonly skewMs: number }
  | { readonly kind: 'unparsable' }
  | { readonly kind: 'absent' };

/**
 * The instant the provider finished generating this feed: the newest
 * LAST_UPDATED across its rows. Returns null when no row carries a readable
 * one — which is refused rather than filled in from somewhere else.
 */
export function feedExportedAt(rows: readonly RawShoppingRow[]): string | null {
  let newest = Number.NEGATIVE_INFINITY;
  for (const row of rows) {
    const raw = row.fields.lastUpdated;
    if (raw === '') continue;
    const t = new Date(raw).getTime();
    if (Number.isNaN(t)) continue;
    if (t > newest) newest = t;
  }
  return newest === Number.NEGATIVE_INFINITY ? null : new Date(newest).toISOString();
}

/**
 * Classify a feed's age. Pure: `now` is passed in so the rule can be tested
 * at every boundary instead of only at whatever time the suite happens to run.
 */
export function assessFeedFreshness(
  exportedAt: string | null | undefined,
  now: Date,
  maxAgeMs: number = MAX_FEED_AGE_MS,
): FeedFreshness {
  if (exportedAt === null || exportedAt === undefined || exportedAt.trim() === '') {
    return { kind: 'absent' };
  }
  const exported = new Date(exportedAt).getTime();
  if (Number.isNaN(exported)) return { kind: 'unparsable' };

  const nowMs = now.getTime();
  if (Number.isNaN(nowMs)) return { kind: 'unparsable' };

  const ageMs = nowMs - exported;
  if (ageMs < -MAX_CLOCK_SKEW_MS) {
    return { kind: 'future', exportedAt, skewMs: -ageMs };
  }
  // Inside the skew window a slightly-ahead clock counts as right now, not as
  // a negative age that would make every later comparison nonsense.
  const effectiveAge = Math.max(ageMs, 0);
  if (effectiveAge > maxAgeMs) {
    return { kind: 'stale', exportedAt, ageMs: effectiveAge };
  }
  return { kind: 'fresh', exportedAt, ageMs: effectiveAge };
}

/** True only for a feed a release build may use. */
export function isReleasable(freshness: FeedFreshness): boolean {
  return freshness.kind === 'fresh';
}

const HOUR_MS = 60 * 60 * 1000;

function hours(ms: number): string {
  return `${(ms / HOUR_MS).toFixed(1)}h`;
}

/**
 * One line a build log or a page can print. It names the age and the limit and
 * nothing else — no product data ever reaches a log through this.
 */
export function describeFreshness(
  freshness: FeedFreshness,
  maxAgeMs: number = MAX_FEED_AGE_MS,
): string {
  switch (freshness.kind) {
    case 'fresh':
      return `feed exported ${freshness.exportedAt} (${hours(freshness.ageMs)} old, limit ${hours(maxAgeMs)})`;
    case 'stale':
      return `feed is ${hours(freshness.ageMs)} old, older than the ${hours(maxAgeMs)} limit (exported ${freshness.exportedAt})`;
    case 'future':
      return `feed is dated ${hours(freshness.skewMs)} in the future (exported ${freshness.exportedAt}), beyond the ${Math.round(MAX_CLOCK_SKEW_MS / 60000)}-minute clock-skew tolerance`;
    case 'unparsable':
      return 'feed export timestamp could not be read as an instant';
    case 'absent':
      return 'feed carries no export timestamp';
  }
}
