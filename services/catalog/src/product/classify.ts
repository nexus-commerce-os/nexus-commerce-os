/*
 * CATEGORY AND SPECIFICATION — the two places it is most tempting to guess.
 *
 * Both functions here return null rather than a best effort. The schema
 * already says it for specifications: "NULL is a finding, not a gap to be
 * filled with a guess." A product filed under a category nobody stated is a
 * claim about the product, and an unexplained category is how a comparison
 * site ends up comparing a mug with a monitor.
 */

export interface Category {
  readonly slug: string;
  readonly name: string;
  readonly parentSlug: string | null;
}

export interface Classification {
  /** The most specific category, or null when the feed stated no path. */
  readonly categorySlug: string | null;
  /** Root first. Empty when nothing was stated. */
  readonly path: readonly Category[];
  readonly reason: 'classified' | 'no_product_type';
}

/** `Home > Drinkware > Travel Mugs` → a slug per level, root first. */
export function slugifyCategory(name: string): string {
  return name
    .normalize('NFKD')
    .replace(/\p{M}+/gu, '')
    .toLowerCase()
    .replace(/&/g, ' and ')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '');
}

/**
 * Classifies from the path the merchant stated, and from nothing else.
 *
 * NO INFERENCE FROM THE TITLE. "Travel Mug" in a product name is not a
 * statement that the product is drinkware; it is a word in a name, and a
 * keyword rule that puts "Monitor Stand" under Monitors is exactly the kind of
 * silent error nobody finds until a visitor does.
 *
 * Slugs are prefixed by their ancestors, so `Audio > Headphones` and
 * `Gaming > Headphones` stay two categories rather than silently becoming one.
 */
export function classifyFromProductType(productType: string | null): Classification {
  if (productType === null || productType.trim() === '') {
    return { categorySlug: null, path: [], reason: 'no_product_type' };
  }

  const names = productType
    .split('>')
    .map((part) => part.trim())
    .filter((part) => part !== '');

  if (names.length === 0) {
    return { categorySlug: null, path: [], reason: 'no_product_type' };
  }

  const path: Category[] = [];
  let parentSlug: string | null = null;
  for (const name of names) {
    const own = slugifyCategory(name);
    if (own === '') continue;
    const slug: string = parentSlug === null ? own : `${parentSlug}/${own}`;
    path.push({ slug, name, parentSlug });
    parentSlug = slug;
  }

  if (path.length === 0) {
    return { categorySlug: null, path: [], reason: 'no_product_type' };
  }
  return { categorySlug: path[path.length - 1].slug, path, reason: 'classified' };
}

export interface NormalisedSpecification {
  readonly label: string;
  /** The provider's wording, verbatim. This is what gets displayed. */
  readonly value: string;
  /** The parsed magnitude, or null when the value is not one number. */
  readonly valueNum: number | null;
  /** The unit exactly as written, lower-cased. Null with valueNum. */
  readonly unit: string | null;
}

/**
 * Units recognised as a unit. Anything else leaves `unit` null.
 *
 * DELIBERATELY NOT CONVERTED. `12 in` is not rewritten to `30.48 cm`: the
 * manufacturer said inches, a visitor comparing two products wants to see what
 * each manufacturer said, and a rounded conversion presented as a
 * specification is a number nobody stated. Comparison across units is a
 * display problem, and it is better left visible than silently resolved.
 */
const UNITS = new Set([
  'mm',
  'cm',
  'm',
  'in',
  'ft',
  'mg',
  'g',
  'kg',
  'oz',
  'lb',
  'ml',
  'l',
  'floz',
  'mw',
  'w',
  'kw',
  'mah',
  'wh',
  'v',
  'a',
  'hz',
  'khz',
  'mhz',
  'ghz',
  'kb',
  'mb',
  'gb',
  'tb',
  'db',
  'ohm',
  'px',
  'ppi',
  'dpi',
  'h',
  'min',
  's',
  'ms',
  '%',
]);

/**
 * Pulls a magnitude and unit out of a specification value, or declines.
 *
 * Only an unambiguous single measurement qualifies. A range (`20–20000 Hz`), a
 * dimension triple (`10 x 5 x 3 cm`) and a sentence all leave `valueNum` null,
 * because reducing them to one number would be choosing a number the provider
 * did not state.
 */
export function normaliseSpecification(label: string, value: string): NormalisedSpecification {
  const trimmedLabel = label.trim();
  const trimmedValue = value.trim();
  const plain: NormalisedSpecification = {
    label: trimmedLabel,
    value: trimmedValue,
    valueNum: null,
    unit: null,
  };
  if (trimmedLabel === '' || trimmedValue === '') return plain;

  // One number, one optional unit, and nothing else in the string.
  const match = /^(-?\d+(?:[.,]\d+)?)\s*([a-zA-Z%]{1,4})?$/.exec(trimmedValue);
  if (!match) return plain;

  const magnitude = Number(match[1].replace(',', '.'));
  if (!Number.isFinite(magnitude)) return plain;

  const unit = match[2] === undefined ? null : match[2].toLowerCase();
  if (unit !== null && !UNITS.has(unit)) {
    // A trailing word that is not a unit means this is not a measurement —
    // "2 pack" is a count of packages, not 2 of something.
    return plain;
  }

  return { label: trimmedLabel, value: trimmedValue, valueNum: magnitude, unit };
}
