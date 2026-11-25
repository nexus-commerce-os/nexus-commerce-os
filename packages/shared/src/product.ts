/**
 * The canonical Product, its category path, and its variants.
 *
 * The shape is the `PRODUCT` row in docs/06 §3.2: a GTIN where one exists, a
 * canonical title, a brand, a category path and free attributes. Variants are
 * not a separate table there, so they are modelled here the way that schema
 * allows — a variant *is* a product, joined to its siblings by a shared
 * `variantGroupId` and distinguished by named axes (colour, capacity, size).
 *
 * Why that way round. A buyer searching "256GB black" wants one row, and a
 * buyer comparing capacities wants the group. Keeping variants as products
 * with a group key gives both without a second identity for the same thing —
 * and, more importantly, it keeps each variant's own GTIN, which is the only
 * identifier a merchant feed will agree with. A group-level "product" with
 * per-variant prices underneath invites exactly the error this project exists
 * to avoid: quoting the cheapest variant's price for the one the reader is
 * actually looking at.
 */

import {
  type Gtin,
  type MatchStrength,
  type ProductIdentifiers,
  matchStrength,
  normalizeMpn,
  tryParseGtin,
} from './identifiers.js';

/** One distinguishing axis of a variant, e.g. `{ axis: 'capacity', value: '256GB' }`. */
export interface VariantAxis {
  readonly axis: string;
  readonly value: string;
}

export interface Product {
  readonly productId: string;
  /** Present only where the product genuinely has one; never synthesised. */
  readonly gtin?: Gtin;
  readonly mpn?: string;
  readonly brand: string;
  readonly canonicalTitle: string;
  /** Root-first path, e.g. `['electronics', 'audio', 'headphones']`. */
  readonly categoryPath: readonly string[];
  /** Shared by every variant of the same thing; absent when it stands alone. */
  readonly variantGroupId?: string;
  /** What makes this variant different from its siblings. */
  readonly variantAxes: readonly VariantAxis[];
  readonly attributes: Readonly<Record<string, string>>;
}

export class ProductError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'ProductError';
  }
}

/** A category path as one comparable string: `electronics/audio/headphones`. */
export function categoryKey(path: readonly string[]): string {
  return path
    .map((segment) => segment.trim().toLowerCase())
    .filter((segment) => segment.length > 0)
    .join('/');
}

/** True when `path` is `ancestor` or sits beneath it — for category navigation. */
export function isWithinCategory(path: readonly string[], ancestor: readonly string[]): boolean {
  const a = categoryKey(ancestor);
  if (a === '') return true; // the root contains everything
  const p = categoryKey(path);
  return p === a || p.startsWith(`${a}/`);
}

/** The identifiers a matcher should compare, derived from the product. */
export function identifiersOf(product: Product): ProductIdentifiers {
  return {
    ...(product.gtin ? { gtin: product.gtin } : {}),
    ...(product.mpn ? { mpn: normalizeMpn(product.mpn) } : {}),
    ...(product.brand ? { brand: product.brand } : {}),
  };
}

/** How confidently two products are the same thing. Never fuzzy on title. */
export function productMatchStrength(a: Product, b: Product): MatchStrength {
  return matchStrength(identifiersOf(a), identifiersOf(b));
}

/** A variant's axes as a stable key, so two feeds describing it agree. */
export function variantKey(axes: readonly VariantAxis[]): string {
  return [...axes]
    .map((a) => ({ axis: a.axis.trim().toLowerCase(), value: a.value.trim().toLowerCase() }))
    .filter((a) => a.axis.length > 0 && a.value.length > 0)
    .sort((x, y) => x.axis.localeCompare(y.axis))
    .map((a) => `${a.axis}=${a.value}`)
    .join(';');
}

export interface VariantGroup {
  readonly variantGroupId: string;
  readonly members: readonly Product[];
  /** Every axis used anywhere in the group, in a stable order. */
  readonly axes: readonly string[];
}

/**
 * Groups products into variant families.
 *
 * A product with no `variantGroupId` becomes a group of one rather than being
 * dropped: standing alone is the common case, and a function that silently
 * discarded those would under-report the catalogue.
 */
export function groupVariants(products: readonly Product[]): readonly VariantGroup[] {
  const groups = new Map<string, Product[]>();
  for (const product of products) {
    const key = product.variantGroupId ?? `solo:${product.productId}`;
    const existing = groups.get(key);
    if (existing) existing.push(product);
    else groups.set(key, [product]);
  }

  return [...groups.entries()]
    .map(([variantGroupId, members]) => {
      const axes = [...new Set(members.flatMap((m) => m.variantAxes.map((a) => a.axis)))].sort();
      return {
        variantGroupId,
        members: [...members].sort((a, b) => a.productId.localeCompare(b.productId)),
        axes,
      };
    })
    .sort((a, b) => a.variantGroupId.localeCompare(b.variantGroupId));
}

/**
 * Two variants in one group that cannot be told apart are a data fault: a
 * reader choosing between them has no basis to, and an offer attached to
 * either is ambiguous. Reported rather than merged, because which one is
 * wrong is not something this function can know.
 */
export function duplicateVariants(group: VariantGroup): readonly (readonly Product[])[] {
  const byKey = new Map<string, Product[]>();
  for (const member of group.members) {
    const key = variantKey(member.variantAxes);
    const existing = byKey.get(key);
    if (existing) existing.push(member);
    else byKey.set(key, [member]);
  }
  return [...byKey.values()].filter((members) => members.length > 1);
}

export type ProductProblem =
  | 'missing-id'
  | 'empty-title'
  | 'empty-brand'
  | 'empty-category'
  | 'malformed-gtin'
  | 'variant-without-axes'
  | 'axes-without-group';

export interface ProductValidation {
  readonly usable: boolean;
  readonly problems: readonly { readonly problem: ProductProblem; readonly detail: string }[];
}

/**
 * Everything that must hold before a product may be indexed. Collects every
 * problem, for the same reason `validateOffer` does: an ingestion report that
 * names one fault per run takes as many runs as there are faults.
 */
export function validateProduct(product: Product): ProductValidation {
  const problems: { problem: ProductProblem; detail: string }[] = [];
  const note = (problem: ProductProblem, detail: string) => problems.push({ problem, detail });

  if (product.productId.trim().length === 0) note('missing-id', 'Product has no id.');
  if (product.canonicalTitle.trim().length === 0) note('empty-title', 'Product has no title.');
  if (product.brand.trim().length === 0) note('empty-brand', 'Product has no brand.');
  if (categoryKey(product.categoryPath) === '') {
    note('empty-category', 'Product has no category path.');
  }
  if (product.gtin && tryParseGtin(product.gtin.gtin14) === null) {
    note('malformed-gtin', `GTIN "${product.gtin.gtin14}" fails its check digit.`);
  }
  if (product.variantGroupId && product.variantAxes.length === 0) {
    note(
      'variant-without-axes',
      'Product is in a variant group but names nothing that distinguishes it.',
    );
  }
  if (!product.variantGroupId && product.variantAxes.length > 0) {
    note('axes-without-group', 'Product has variant axes but no group to vary within.');
  }

  return { usable: problems.length === 0, problems };
}
