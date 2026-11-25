/**
 * The canonical money type: an integer count of ISO-4217 minor units plus a
 * currency. One type, every runtime, zero drift (NFR-CONS-01, ADR-0020).
 *
 * WHY NOT A NUMBER OF POUNDS OR DOLLARS. `0.1 + 0.2 !== 0.3` in IEEE-754, and
 * a price comparison site that is wrong by a hundredth of a unit is wrong in
 * the one place it promises to be right. Minor units are integers, so addition
 * and comparison are exact.
 *
 * WHY `bigint`. A JavaScript number is exact only below 2^53. That is about
 * 90 trillion minor units, which is plenty for one price and not plenty for a
 * sum over a large catalogue in a minor-unit-heavy currency. `bigint` removes
 * the ceiling and the need to think about it.
 *
 * WHAT THIS DELIBERATELY WILL NOT DO. It will not add two amounts in different
 * currencies, and it will not convert between them. Cross-currency comparison
 * happens only in an explicit FX-normalisation step with a dated rate, never
 * as a side effect of arithmetic (docs/06 §4).
 */

/** ISO-4217 alphabetic code, upper case. */
export type CurrencyCode = string;

export interface Money {
  /** Integer count of the currency's minor unit. May be negative. */
  readonly minorUnits: bigint;
  readonly currency: CurrencyCode;
}

export class MoneyError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'MoneyError';
  }
}

/**
 * Minor units per major unit, for the currencies this project actually quotes
 * in. ISO-4217 exponents are not all 2: JPY and KRW have none, and the dinar
 * currencies have three. Getting this wrong silently multiplies a price by a
 * hundred, so the table is explicit and the default is stated rather than
 * assumed.
 */
const EXPONENTS: Readonly<Record<string, number>> = {
  BDT: 2,
  CAD: 2,
  CHF: 2,
  CNY: 2,
  EUR: 2,
  GBP: 2,
  INR: 2,
  USD: 2,
  AUD: 2,
  SEK: 2,
  // Zero-decimal
  JPY: 0,
  KRW: 0,
  VND: 0,
  CLP: 0,
  ISK: 0,
  // Three-decimal
  BHD: 3,
  IQD: 3,
  JOD: 3,
  KWD: 3,
  OMR: 3,
  TND: 3,
};

const CODE_RE = /^[A-Z]{3}$/;

/** True when the code is one this module knows the exponent for. */
export function isSupportedCurrency(code: string): boolean {
  return Object.prototype.hasOwnProperty.call(EXPONENTS, code);
}

export function currencyExponent(code: CurrencyCode): number {
  const exp = EXPONENTS[code];
  if (exp === undefined) {
    throw new MoneyError(
      `Unknown currency "${code}". Add its ISO-4217 exponent to EXPONENTS rather ` +
        `than assuming 2 — JPY has 0 and KWD has 3, and guessing moves the decimal point.`,
    );
  }
  return exp;
}

export function money(minorUnits: bigint | number, currency: string): Money {
  const code = currency.toUpperCase();
  if (!CODE_RE.test(code)) {
    throw new MoneyError(`"${currency}" is not an ISO-4217 alphabetic code.`);
  }
  currencyExponent(code); // throws on unknown
  if (typeof minorUnits === 'number' && !Number.isInteger(minorUnits)) {
    throw new MoneyError(
      `Minor units must be a whole number; got ${minorUnits}. ` +
        `A fractional minor unit is a rounding decision, and this type will not make it for you.`,
    );
  }
  return Object.freeze({ minorUnits: BigInt(minorUnits), currency: code });
}

export const zero = (currency: string): Money => money(0n, currency);

/**
 * Parses a decimal string in MAJOR units — "19.99", "-3", "1,299.00".
 *
 * Deliberately takes a string, not a number: by the time a price is a
 * JavaScript number it may already have lost precision, and this function
 * cannot tell. Feeds and spreadsheets hand us strings; keep them strings until
 * they are integers.
 */
export function parseMoney(amount: string, currency: string): Money {
  const code = currency.toUpperCase();
  const exp = currencyExponent(code);
  const cleaned = amount.trim().replace(/,/g, '').replace(/\s/g, '');
  const m = /^(-)?(\d+)(?:\.(\d+))?$/.exec(cleaned);
  if (!m) throw new MoneyError(`"${amount}" is not a decimal amount.`);

  const [, sign, whole, frac = ''] = m;
  if (frac.length > exp) {
    throw new MoneyError(
      `"${amount}" has ${frac.length} decimal places but ${code} has ${exp}. ` +
        `Round it deliberately before it reaches this type.`,
    );
  }
  const padded = frac.padEnd(exp, '0');
  const units = BigInt(whole + padded) * (sign ? -1n : 1n);
  return money(units, code);
}

function sameCurrency(a: Money, b: Money, op: string): void {
  if (a.currency !== b.currency) {
    throw new MoneyError(
      `Cannot ${op} ${a.currency} and ${b.currency}. Convert through an explicit, ` +
        `dated FX step — implicit conversion is how a comparison site lies.`,
    );
  }
}

export function add(a: Money, b: Money): Money {
  sameCurrency(a, b, 'add');
  return money(a.minorUnits + b.minorUnits, a.currency);
}

export function subtract(a: Money, b: Money): Money {
  sameCurrency(a, b, 'subtract');
  return money(a.minorUnits - b.minorUnits, a.currency);
}

export function sum(amounts: readonly Money[], currency?: string): Money {
  if (amounts.length === 0) {
    if (!currency) {
      throw new MoneyError('Cannot sum an empty list without being told the currency.');
    }
    return zero(currency);
  }
  return amounts.reduce((acc, m) => add(acc, m));
}

/** Negative when a < b, zero when equal, positive when a > b. */
export function compare(a: Money, b: Money): number {
  sameCurrency(a, b, 'compare');
  if (a.minorUnits < b.minorUnits) return -1;
  if (a.minorUnits > b.minorUnits) return 1;
  return 0;
}

export const equals = (a: Money, b: Money): boolean =>
  a.currency === b.currency && a.minorUnits === b.minorUnits;

export const isNegative = (m: Money): boolean => m.minorUnits < 0n;
export const isZero = (m: Money): boolean => m.minorUnits === 0n;

export function min(amounts: readonly Money[]): Money | null {
  if (amounts.length === 0) return null;
  return amounts.reduce((lo, m) => (compare(m, lo) < 0 ? m : lo));
}

export function max(amounts: readonly Money[]): Money | null {
  if (amounts.length === 0) return null;
  return amounts.reduce((hi, m) => (compare(m, hi) > 0 ? m : hi));
}

export type Rounding = 'half-up' | 'half-even' | 'down';

/**
 * Multiplies by a rational `numerator/denominator` — a tax rate, a discount, a
 * share. Rationals rather than a float factor, because 0.1 is not 0.1 and a
 * tax rate applied as a float is a rounding bug with a receipt.
 *
 * `half-even` is the default: repeated half-up rounding biases a total upward,
 * which on a site about honest totals is the wrong direction to be wrong in.
 */
export function multiply(
  m: Money,
  numerator: bigint | number,
  denominator: bigint | number = 1n,
  rounding: Rounding = 'half-even',
): Money {
  const num = BigInt(numerator);
  const den = BigInt(denominator);
  if (den === 0n) throw new MoneyError('Cannot multiply by a fraction with denominator zero.');

  const product = m.minorUnits * num;
  const negative = product < 0n !== den < 0n;
  const absProduct = product < 0n ? -product : product;
  const absDen = den < 0n ? -den : den;

  let q = absProduct / absDen;
  const remainder = absProduct % absDen;

  if (remainder !== 0n && rounding !== 'down') {
    const twice = remainder * 2n;
    if (twice > absDen) q += 1n;
    else if (twice === absDen) {
      if (rounding === 'half-up') q += 1n;
      else if (q % 2n !== 0n) q += 1n; // half-even
    }
  }
  return money(negative ? -q : q, m.currency);
}

/** Applies a percentage, e.g. `percentOf(price, 20)` for 20% VAT. */
export const percentOf = (m: Money, percent: number, rounding: Rounding = 'half-even'): Money =>
  multiply(m, Math.round(percent * 1000), 100_000n, rounding);

/** "19.99" — major units, no symbol, no locale guessing. */
export function toDecimalString(m: Money): string {
  const exp = currencyExponent(m.currency);
  const neg = m.minorUnits < 0n;
  const abs = (neg ? -m.minorUnits : m.minorUnits).toString().padStart(exp + 1, '0');
  const whole = abs.slice(0, abs.length - exp) || '0';
  const frac = exp === 0 ? '' : '.' + abs.slice(abs.length - exp);
  return `${neg ? '-' : ''}${whole}${frac}`;
}

/**
 * Localised display, through Intl so the caller does not hand-roll separators.
 * Takes a locale explicitly: the runtime's default locale is a property of the
 * server, not of the reader.
 */
export function formatMoney(m: Money, locale: string): string {
  const exp = currencyExponent(m.currency);
  return new Intl.NumberFormat(locale, {
    style: 'currency',
    currency: m.currency,
    minimumFractionDigits: exp,
    maximumFractionDigits: exp,
  }).format(Number(toDecimalString(m)));
}

/** Wire form: a string, so no JSON parser can round it. */
export const toJSON = (m: Money): { minorUnits: string; currency: string } => ({
  minorUnits: m.minorUnits.toString(),
  currency: m.currency,
});

export const fromJSON = (v: { minorUnits: string | number | bigint; currency: string }): Money =>
  money(BigInt(v.minorUnits), v.currency);
