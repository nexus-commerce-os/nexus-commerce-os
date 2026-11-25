/**
 * Price observations over time, and the questions worth asking of them.
 *
 * The shape follows the `price_observations` table in docs/06 §5: one row per
 * reading, keyed by offer and product, carrying the all-in price alongside its
 * parts so a later analysis can tell a shipping change from a price change.
 *
 * WHY THIS MATTERS MORE THAN IT LOOKS. "Was £400, now £299" is the single most
 * common lie in retail. The only defence is a record of what the price
 * actually was, kept by someone with no incentive to flatter it. Every
 * function here is therefore conservative: it answers "I do not know" rather
 * than estimating, and it never interpolates a price that was not observed.
 */

import {
  type Money,
  compare as compareMoney,
  max as maxMoney,
  min as minMoney,
  money,
  subtract as subtractMoney,
  sum as sumMoney,
} from './money.js';
import type { Availability } from './offer.js';
import type { FreshnessTier } from './freshness.js';

export interface PriceObservation {
  readonly offerId: string;
  readonly productId: string;
  readonly merchantId: string;
  readonly sourceId: string;
  readonly allInPrice: Money;
  readonly basePrice: Money;
  readonly shipping: Money | null;
  readonly availability: Availability;
  readonly freshnessTier: FreshnessTier;
  /** ISO-8601 instant. */
  readonly observedAt: string;
}

export class PriceHistoryError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'PriceHistoryError';
  }
}

const instant = (o: PriceObservation): number => {
  const t = Date.parse(o.observedAt);
  if (Number.isNaN(t)) {
    throw new PriceHistoryError(`observedAt "${o.observedAt}" is not an ISO-8601 instant.`);
  }
  return t;
};

/**
 * Oldest first. Sorting is explicit because callers receive feeds unordered.
 *
 * Every timestamp is parsed up front rather than inside the comparator: a
 * comparator is not called for a one-element array, so a single malformed
 * `observedAt` would otherwise pass through unchecked and only misbehave later,
 * when it is impossible to tell which feed produced it.
 */
export function sortByTime(observations: readonly PriceObservation[]): readonly PriceObservation[] {
  const dated = observations.map((o) => ({ o, t: instant(o) }));
  dated.sort((a, b) => a.t - b.t);
  return dated.map((d) => d.o);
}

export function withinWindow(
  observations: readonly PriceObservation[],
  from: Date,
  to: Date,
): readonly PriceObservation[] {
  const lo = from.getTime();
  const hi = to.getTime();
  return observations.filter((o) => {
    const t = instant(o);
    return t >= lo && t <= hi;
  });
}

export interface PriceSummary {
  readonly count: number;
  readonly currency: string;
  readonly low: Money;
  readonly high: Money;
  /** Arithmetic mean, rounded half-even to the minor unit. */
  readonly mean: Money;
  readonly first: Money;
  readonly latest: Money;
  readonly firstObservedAt: string;
  readonly latestObservedAt: string;
}

/**
 * Summarises a run of observations.
 *
 * Refuses a mixed-currency history rather than picking one: a "low" assembled
 * from two currencies is not a low, and the only honest fix is to split the
 * history, which is the caller's decision.
 */
export function summarise(observations: readonly PriceObservation[]): PriceSummary | null {
  if (observations.length === 0) return null;

  const ordered = sortByTime(observations);
  const currency = ordered[0].allInPrice.currency;
  if (ordered.some((o) => o.allInPrice.currency !== currency)) {
    throw new PriceHistoryError(
      'Mixed currencies in one history. Split it by currency; a low across two ' +
        'currencies is not a low.',
    );
  }

  const amounts = ordered.map((o) => o.allInPrice);
  const total = sumMoney(amounts);
  // Integer division with half-even rounding, via the money type rather than
  // a float average that would reintroduce the drift money.ts removes.
  const mean = money(roundedDivide(total.minorUnits, BigInt(amounts.length)), currency);

  return {
    count: ordered.length,
    currency,
    low: minMoney(amounts)!,
    high: maxMoney(amounts)!,
    mean,
    first: ordered[0].allInPrice,
    latest: ordered[ordered.length - 1].allInPrice,
    firstObservedAt: ordered[0].observedAt,
    latestObservedAt: ordered[ordered.length - 1].observedAt,
  };
}

function roundedDivide(numerator: bigint, denominator: bigint): bigint {
  if (denominator === 0n) throw new PriceHistoryError('Cannot average zero observations.');
  const negative = numerator < 0n !== denominator < 0n;
  const a = numerator < 0n ? -numerator : numerator;
  const b = denominator < 0n ? -denominator : denominator;
  let q = a / b;
  const r = a % b;
  if (r !== 0n) {
    const twice = r * 2n;
    if (twice > b || (twice === b && q % 2n !== 0n)) q += 1n;
  }
  return negative ? -q : q;
}

export interface DropClaim {
  /** True only when the current price is genuinely below the window's high. */
  readonly isDrop: boolean;
  readonly from: Money;
  readonly to: Money;
  readonly saving: Money;
  /** Basis points (1/100th of a percent) — integers, so no float percentages. */
  readonly savingBasisPoints: number;
  readonly highObservedAt: string;
}

/**
 * Can we honestly say this price has dropped, and from what?
 *
 * The reference is the highest price ACTUALLY OBSERVED in the window, not a
 * "was" price supplied by the merchant. That is the whole difference between
 * a verified saving and a marketing claim. If the current price is not below
 * that high, there is no drop, and the function says so rather than finding a
 * smaller window in which there is one.
 */
export function describeDrop(
  observations: readonly PriceObservation[],
  window: { from: Date; to: Date },
): DropClaim | null {
  const inWindow = withinWindow(observations, window.from, window.to);
  const summary = summarise(inWindow);
  if (!summary || summary.count < 2) return null;

  const ordered = sortByTime(inWindow);
  const highest = ordered.reduce((hi, o) =>
    compareMoney(o.allInPrice, hi.allInPrice) > 0 ? o : hi,
  );
  const current = summary.latest;

  if (compareMoney(current, highest.allInPrice) >= 0) {
    return {
      isDrop: false,
      from: highest.allInPrice,
      to: current,
      saving: money(0n, summary.currency),
      savingBasisPoints: 0,
      highObservedAt: highest.observedAt,
    };
  }

  const saving = subtractMoney(highest.allInPrice, current);
  const basisPoints =
    highest.allInPrice.minorUnits === 0n
      ? 0
      : Number((saving.minorUnits * 10_000n) / highest.allInPrice.minorUnits);

  return {
    isDrop: true,
    from: highest.allInPrice,
    to: current,
    saving,
    savingBasisPoints: basisPoints,
    highObservedAt: highest.observedAt,
  };
}

/** Lowest price ever observed, and when. The honest "best price we have seen". */
export function trailingLow(
  observations: readonly PriceObservation[],
): { price: Money; observedAt: string } | null {
  if (observations.length === 0) return null;
  const lowest = observations.reduce((lo, o) =>
    compareMoney(o.allInPrice, lo.allInPrice) < 0 ? o : lo,
  );
  return { price: lowest.allInPrice, observedAt: lowest.observedAt };
}

/** Whole days since the lowest observation, or null when there is no history. */
export function daysSinceLow(
  observations: readonly PriceObservation[],
  now: Date = new Date(),
): number | null {
  const low = trailingLow(observations);
  if (!low) return null;
  const ms = now.getTime() - Date.parse(low.observedAt);
  return Math.max(0, Math.floor(ms / 86_400_000));
}

/**
 * How much this price moves, as basis points of the mean.
 *
 * Mean absolute deviation rather than standard deviation: it needs no square
 * root, so it stays in integer arithmetic, and it is the measure a reader
 * would actually recognise — "it typically moves about this much".
 */
export function volatilityBasisPoints(observations: readonly PriceObservation[]): number | null {
  const summary = summarise(observations);
  if (!summary || summary.count < 2) return null;
  if (summary.mean.minorUnits === 0n) return null;

  const deviations = observations.map((o) => {
    const d = o.allInPrice.minorUnits - summary.mean.minorUnits;
    return d < 0n ? -d : d;
  });
  const meanDeviation = roundedDivide(
    deviations.reduce((a, b) => a + b, 0n),
    BigInt(deviations.length),
  );
  const meanAbs = summary.mean.minorUnits < 0n ? -summary.mean.minorUnits : summary.mean.minorUnits;
  return Number((meanDeviation * 10_000n) / meanAbs);
}

/**
 * One reading per day — the last of each UTC day, which is what a daily
 * rollup keeps. Days with no observation are absent rather than filled in:
 * inventing a price for a day nobody looked is exactly the fabrication this
 * module exists to prevent.
 */
export function dailyCloses(
  observations: readonly PriceObservation[],
): readonly { date: string; price: Money }[] {
  const byDay = new Map<string, PriceObservation>();
  for (const o of sortByTime(observations)) {
    byDay.set(o.observedAt.slice(0, 10), o); // later wins, so this is the close
  }
  return [...byDay.entries()]
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([date, o]) => ({ date, price: o.allInPrice }));
}
