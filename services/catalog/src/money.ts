/*
 * Money for the catalog: an integer count of minor units plus an ISO-4217 code.
 *
 * NFR-CONS-01 mandates integer minor units, and the reason is not house style.
 * `0.1 + 0.2 !== 0.3` in IEEE-754, and a site whose entire claim is "this total
 * is correct" cannot afford a cent that appears or vanishes depending on the
 * order offers were summed in. Parsing therefore goes straight from the feed's
 * decimal STRING to an integer; the value never passes through a float, not
 * even transiently.
 *
 * Failures are returned, never thrown. Feed content is untrusted input and a
 * single malformed price must cost one row, not the whole import. The two
 * functions that DO throw — `addMoney` on mixed currencies, and overflow —
 * throw because those are programmer errors that a caller cannot sensibly
 * recover from, and silently returning a wrong total would be worse.
 */

export interface Money {
  /** Whole number of minor units (cents for USD). Never fractional, never negative here. */
  readonly amountMinor: number;
  /** Upper-case ISO-4217 alphabetic code, exactly as the provider stated it. */
  readonly currency: string;
}

/*
 * Currencies whose minor unit is not 1/100. Everything absent is treated as
 * two decimal places, which holds for every currency this catalog has met.
 * Getting this wrong is not cosmetic: reading "1000 JPY" as 100000 minor units
 * would overstate a price by a factor of 100.
 */
const MINOR_UNIT_EXPONENT: Readonly<Record<string, number>> = {
  BIF: 0,
  CLP: 0,
  DJF: 0,
  GNF: 0,
  ISK: 0,
  JPY: 0,
  KMF: 0,
  KRW: 0,
  PYG: 0,
  RWF: 0,
  UGX: 0,
  VND: 0,
  VUV: 0,
  XAF: 0,
  XOF: 0,
  XPF: 0,
  BHD: 3,
  IQD: 3,
  JOD: 3,
  KWD: 3,
  LYD: 3,
  OMR: 3,
  TND: 3,
};

export function minorUnitExponent(currency: string): number {
  return MINOR_UNIT_EXPONENT[currency] ?? 2;
}

/*
 * The shape CJ's Shopping (Google Format) export actually emits, measured on
 * the 29 Oct 2026 Soundcore feed: amount, one space, ISO code — "79.99 USD".
 *
 * Thousands separators are rejected rather than stripped. "1,234" is 1234 to a
 * US reader and 1.234 to a German one; a parser that guesses will eventually
 * guess wrong on a real price, and a wrong price is the one error this project
 * cannot ship. A provider that starts sending grouped amounts should fail
 * loudly here and be handled deliberately.
 */
const FEED_MONEY = /^(\d+)(?:\.(\d+))?[ \t]+([A-Z]{3})$/;

export type MoneyParseFailure =
  'empty' | 'unrecognised-format' | 'too-many-decimal-places' | 'out-of-safe-range';

export type MoneyParseResult =
  | { readonly ok: true; readonly money: Money }
  | { readonly ok: false; readonly reason: MoneyParseFailure };

/** Parse a provider money string. Returns a failure reason instead of throwing. */
export function parseFeedMoney(raw: string): MoneyParseResult {
  const text = raw.trim();
  if (text === '') return { ok: false, reason: 'empty' };

  const match = FEED_MONEY.exec(text);
  if (match === null) return { ok: false, reason: 'unrecognised-format' };

  const whole = match[1] as string;
  const fraction = match[2] ?? '';
  const currency = match[3] as string;

  const exponent = minorUnitExponent(currency);
  // "9.999 USD" is not a USD amount. Rounding it would invent a price the
  // provider never quoted, so the row is rejected instead.
  if (fraction.length > exponent) return { ok: false, reason: 'too-many-decimal-places' };

  const amountMinor = Number(whole + fraction.padEnd(exponent, '0'));
  if (!Number.isSafeInteger(amountMinor)) return { ok: false, reason: 'out-of-safe-range' };

  return { ok: true, money: { amountMinor, currency } };
}

/**
 * Parse a bare decimal amount that carries no currency of its own — the packed
 * shipping form `US:CA:Ground:5.99` is the only place this is legitimate, and
 * the currency must be supplied by the caller from the offer's own price.
 */
export function parseBareAmount(raw: string, currency: string): MoneyParseResult {
  return parseFeedMoney(`${raw.trim()} ${currency}`);
}

export function addMoney(a: Money, b: Money): Money {
  if (a.currency !== b.currency) {
    throw new TypeError(`cannot add ${b.currency} to ${a.currency}: currencies must match`);
  }
  const amountMinor = a.amountMinor + b.amountMinor;
  if (!Number.isSafeInteger(amountMinor)) {
    throw new RangeError('money addition left the safe integer range');
  }
  return { amountMinor, currency: a.currency };
}

/** The smaller of two amounts in the same currency. */
export function minMoney(a: Money, b: Money): Money {
  if (a.currency !== b.currency) {
    throw new TypeError(`cannot compare ${a.currency} with ${b.currency}: currencies must match`);
  }
  return b.amountMinor < a.amountMinor ? b : a;
}
