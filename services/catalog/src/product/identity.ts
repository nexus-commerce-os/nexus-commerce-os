/*
 * PRODUCT IDENTITY — deciding when two merchants are selling the same thing.
 *
 * THE ONLY FAILURE THAT MATTERS HERE is merging two different products. A
 * visitor who sees one listing split in two is mildly inconvenienced; a visitor
 * shown "3 merchants from $19" where one of the three is a different item has
 * been misled about a price, which is the single thing this site exists not to
 * do. So every rule below is biased towards refusing to merge, and ambiguity
 * is quarantined rather than resolved.
 *
 * There is no fuzzy matching. No edit distance on titles, no token overlap, no
 * "probably the same". Identity comes from an identifier a manufacturer
 * assigned, or it does not come at all.
 */
import { isValidGtin } from '../catalog-guard';

export type IdentityBasis = 'gtin' | 'brand_mpn';
export type MatchConfidence = 'high' | 'medium' | 'low';

export type ProductIdentity =
  | {
      readonly basis: 'gtin';
      /** GTIN-14 form, so a UPC-12 and its EAN-13 equivalent are one key. */
      readonly key: string;
      readonly confidence: 'high';
    }
  | {
      readonly basis: 'brand_mpn';
      readonly key: string;
      readonly confidence: 'medium';
    }
  | {
      readonly basis: null;
      readonly key: null;
      readonly confidence: null;
      /** Why no identity could be formed. Machine-readable. */
      readonly reason: 'no_gtin_no_mpn' | 'invalid_gtin_no_mpn';
    };

/**
 * Legal-form suffixes removed before comparing brands.
 *
 * SHORT AND EXPLICIT ON PURPOSE. Every entry is a risk: "Apple Inc" and
 * "Apple Corps" both normalise to `apple`, and if brand alone identified a
 * product that would merge a computer with a record label. It does not —
 * brand is only ever half of `brand_mpn`, and two unrelated companies sharing
 * a normalised brand AND a manufacturer part number is the coincidence this
 * accepts. Anything beyond this list is not worth that trade.
 */
const LEGAL_SUFFIXES = new Set([
  'inc',
  'llc',
  'ltd',
  'limited',
  'gmbh',
  'corp',
  'corporation',
  'co',
  'company',
  'plc',
  'sa',
  'sas',
  'bv',
  'nv',
  'ag',
  'ab',
  'oy',
  'as',
  'pty',
  'srl',
  'spa',
  'kg',
  'kk',
]);

/**
 * A brand reduced to a comparison key.
 *
 * Deterministic and lossy in one direction only: two spellings of one brand
 * collapse, but nothing is invented. Accents are folded because `Sennheiser`
 * and `Sennheiser` differing only by a combining mark is a transport artefact,
 * not two brands.
 */
export function normaliseBrand(raw: string): string {
  const folded = raw
    .normalize('NFKD')
    // Strip combining marks. \p{M} needs the unicode flag, which this has.
    .replace(/\p{M}+/gu, '')
    .toLowerCase()
    // Ampersand is written three ways in real feeds; pick one before the
    // punctuation strip removes the character entirely.
    .replace(/&/g, ' and ')
    .replace(/[^a-z0-9]+/g, ' ')
    .trim();

  if (folded === '') return '';

  const words = folded.split(' ');
  // Trailing legal forms only. "Co" at the START of a name is part of it
  // ("Co-op"), and dropping an interior word would change the name.
  while (words.length > 1 && LEGAL_SUFFIXES.has(words[words.length - 1])) {
    words.pop();
  }
  return words.join(' ');
}

/** An MPN reduced to a comparison key: case and separators only. */
export function normaliseMpn(raw: string): string {
  return raw.toUpperCase().replace(/[^A-Z0-9]+/g, '');
}

/**
 * Pads a validated GTIN to its 14-digit form.
 *
 * A UPC-12 and the EAN-13 that is the same code with a leading zero are the
 * same product, and GS1 defines GTIN-14 as the common form. Left-padding is
 * the whole conversion — the check digit is the last character either way.
 */
export function toGtin14(validGtin: string): string {
  const digits = validGtin.replace(/\D/g, '');
  if (digits.length > 14) {
    throw new RangeError(`not a GTIN: ${digits.length} digits`);
  }
  return digits.padStart(14, '0');
}

export interface IdentifiableOffer {
  readonly gtin: string | null;
  readonly mpn: string | null;
  readonly brand: string;
}

/**
 * The identity of what an offer is selling.
 *
 * GTIN first, and only when its check digit passes: an invalid GTIN is worse
 * than none, because it looks authoritative. Falling back to brand + MPN is
 * already the behaviour the import guard documents, and this keeps it.
 */
export function productIdentity(offer: IdentifiableOffer): ProductIdentity {
  if (offer.gtin !== null && isValidGtin(offer.gtin)) {
    return { basis: 'gtin', key: toGtin14(offer.gtin), confidence: 'high' };
  }

  const brand = normaliseBrand(offer.brand);
  const mpn = offer.mpn === null ? '' : normaliseMpn(offer.mpn);
  if (brand !== '' && mpn !== '') {
    return { basis: 'brand_mpn', key: `${brand}|${mpn}`, confidence: 'medium' };
  }

  return {
    basis: null,
    key: null,
    confidence: null,
    reason: offer.gtin === null ? 'no_gtin_no_mpn' : 'invalid_gtin_no_mpn',
  };
}

/**
 * The brand+MPN key for an offer that ALSO has a usable GTIN.
 *
 * Needed by the matcher, not by callers: it is how a brand+MPN key is found to
 * be claimed by two different GTINs, which is the one ambiguity that must stop
 * a merge rather than be resolved.
 */
export function secondaryBrandMpnKey(offer: IdentifiableOffer): string | null {
  const brand = normaliseBrand(offer.brand);
  const mpn = offer.mpn === null ? '' : normaliseMpn(offer.mpn);
  if (brand === '' || mpn === '') return null;
  return `${brand}|${mpn}`;
}
