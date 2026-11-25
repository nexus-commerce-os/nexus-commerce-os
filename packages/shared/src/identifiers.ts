/**
 * Normalised product identifiers: GTIN, MPN, SKU.
 *
 * These are how the same physical product is recognised across merchants who
 * name it differently. "Sennheiser HD 600" and "HD600 Open Back Headphone,
 * Black" are the same object only if something matches them, and the honest
 * way to match them is an identifier the manufacturer assigned — not a string
 * similarity score that will one day merge two different things and quote the
 * cheaper one's price for the dearer one's page.
 */

export type GtinFormat = 'GTIN-8' | 'GTIN-12' | 'GTIN-13' | 'GTIN-14';

export class IdentifierError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'IdentifierError';
  }
}

const GTIN_LENGTHS: Readonly<Record<number, GtinFormat>> = {
  8: 'GTIN-8',
  12: 'GTIN-12',
  13: 'GTIN-13',
  14: 'GTIN-14',
};

/**
 * GS1 modulo-10 check digit. Weights alternate 3 and 1 from the right, which
 * catches every single-digit error and most transpositions — which is the
 * whole reason to compute it rather than trust the feed.
 */
export function gtinCheckDigit(digitsWithoutCheck: string): number {
  let sum = 0;
  const d = digitsWithoutCheck;
  for (let i = 0; i < d.length; i++) {
    const value = d.charCodeAt(d.length - 1 - i) - 48;
    sum += value * (i % 2 === 0 ? 3 : 1);
  }
  return (10 - (sum % 10)) % 10;
}

export interface Gtin {
  /** 14 digits, zero-padded. One shape for storage and comparison. */
  readonly gtin14: string;
  /** The length it arrived in, kept because merchants quote what they know. */
  readonly format: GtinFormat;
}

/**
 * Accepts a GTIN in any of its four lengths, with spaces or hyphens, and
 * returns it padded to 14 — the form everything else compares against.
 * Rejects a bad check digit rather than storing an identifier that will never
 * match anything.
 */
export function parseGtin(raw: string): Gtin {
  const digits = raw.replace(/[\s-]/g, '');
  if (!/^\d+$/.test(digits)) {
    throw new IdentifierError(`GTIN "${raw}" contains non-digits.`);
  }
  const format = GTIN_LENGTHS[digits.length];
  if (!format) {
    throw new IdentifierError(
      `GTIN "${raw}" is ${digits.length} digits; valid lengths are 8, 12, 13 and 14.`,
    );
  }
  const body = digits.slice(0, -1);
  const given = digits.charCodeAt(digits.length - 1) - 48;
  const expected = gtinCheckDigit(body);
  if (given !== expected) {
    throw new IdentifierError(
      `GTIN "${raw}" fails its check digit (expected ${expected}, got ${given}). ` +
        `A mistyped GTIN matches nothing, which is worse than having none.`,
    );
  }
  return Object.freeze({ gtin14: digits.padStart(14, '0'), format });
}

export function tryParseGtin(raw: string): Gtin | null {
  try {
    return parseGtin(raw);
  } catch {
    return null;
  }
}

/** Two GTINs are the same product when their 14-digit forms match. */
export const gtinEquals = (a: Gtin, b: Gtin): boolean => a.gtin14 === b.gtin14;

/**
 * Manufacturer part numbers are case- and punctuation-inconsistent across
 * feeds: "MZ-V9P2T0B/AM", "mz v9p2t0b am". Normalising to upper-case
 * alphanumerics makes those one key. It is lossy on purpose; the original is
 * kept by the caller for display.
 */
export function normalizeMpn(raw: string): string {
  const normalized = raw
    .toUpperCase()
    .replace(/[^A-Z0-9]/g, '')
    .trim();
  if (normalized.length === 0) {
    throw new IdentifierError(`MPN "${raw}" normalises to nothing.`);
  }
  return normalized;
}

/** A merchant's own SKU. Namespaced, because SKUs collide across merchants. */
export interface MerchantSku {
  readonly merchantId: string;
  readonly sku: string;
}

export function merchantSkuKey(ref: MerchantSku): string {
  const sku = ref.sku.trim();
  if (!ref.merchantId.trim() || !sku) {
    throw new IdentifierError('A merchant SKU needs both a merchant id and a sku.');
  }
  // The separator cannot appear in either half once encoded, so the key is
  // unambiguous — "a|b" and "a" + "|b" must not collide.
  return `${encodeURIComponent(ref.merchantId.trim())}|${encodeURIComponent(sku)}`;
}

/**
 * Everything known about which product this is. All optional: a merchant may
 * publish only a title, and that is a fact about the feed rather than a
 * failure, so the type records it instead of inventing an identifier.
 */
export interface ProductIdentifiers {
  readonly gtin?: Gtin;
  readonly mpn?: string;
  readonly brand?: string;
  readonly merchantSku?: MerchantSku;
}

export type MatchStrength = 'gtin' | 'brand-mpn' | 'none';

/**
 * How confidently two sets of identifiers describe the same product.
 *
 * Only two answers are trusted. A GTIN match is definitive. A brand plus MPN
 * match is strong, because an MPN is only unique within a manufacturer.
 * Everything else returns `none` — deliberately, because the tempting third
 * option is fuzzy title matching, and a comparison site that merges two
 * products by name eventually shows one product's price on another's page.
 */
export function matchStrength(a: ProductIdentifiers, b: ProductIdentifiers): MatchStrength {
  if (a.gtin && b.gtin) return gtinEquals(a.gtin, b.gtin) ? 'gtin' : 'none';
  if (a.mpn && b.mpn && a.brand && b.brand) {
    const sameBrand = normalizeMpn(a.brand) === normalizeMpn(b.brand);
    const sameMpn = normalizeMpn(a.mpn) === normalizeMpn(b.mpn);
    return sameBrand && sameMpn ? 'brand-mpn' : 'none';
  }
  return 'none';
}

export const isSameProduct = (a: ProductIdentifiers, b: ProductIdentifiers): boolean =>
  matchStrength(a, b) !== 'none';

/**
 * The GTIN written back in the length it arrived in.
 *
 * Storage and comparison use the 14-digit form, but an export that emits
 * `04006381333931` for a GTIN-13 cannot be re-imported faithfully: parsing it
 * back yields format `GTIN-14`, because that is what 14 digits means. Writing
 * the original length keeps export → import a true round trip, and keeps the
 * file readable to the merchant who quoted it.
 */
export function gtinInOriginalFormat(gtin: Gtin): string {
  const length = Number(gtin.format.slice('GTIN-'.length));
  return gtin.gtin14.slice(gtin.gtin14.length - length);
}
