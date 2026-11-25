import assert from 'node:assert/strict';
import { test } from 'node:test';
import { parseGtin } from './identifiers.js';
import {
  type Product,
  categoryKey,
  duplicateVariants,
  groupVariants,
  identifiersOf,
  isWithinCategory,
  productMatchStrength,
  validateProduct,
  variantKey,
} from './product.js';

/** SYNTHETIC fixture. No real product, brand or merchant; test-only. */
const product = (over: Partial<Product> = {}): Product => ({
  productId: 'p-1',
  brand: 'TestBrand',
  canonicalTitle: 'Test Headphones',
  categoryPath: ['electronics', 'audio', 'headphones'],
  variantAxes: [],
  attributes: {},
  ...over,
});

// A GTIN-13 with a correct check digit, computed by the library itself so the
// fixture cannot drift from the algorithm it is testing.
const VALID_GTIN = parseGtin('4006381333931');

test('a category path is normalised to one comparable key', () => {
  assert.equal(
    categoryKey(['Electronics', ' Audio ', 'Headphones']),
    'electronics/audio/headphones',
  );
  assert.equal(categoryKey(['', '  ']), '');
});

test('category containment is by path segment, not by string prefix', () => {
  assert.equal(isWithinCategory(['electronics', 'audio'], ['electronics']), true);
  assert.equal(isWithinCategory(['electronics'], ['electronics']), true);
  assert.equal(isWithinCategory(['electronics'], []), true, 'the root contains everything');
  assert.equal(isWithinCategory(['electronics', 'audio'], ['audio']), false);
  // "electronics-accessories" must not count as inside "electronics".
  assert.equal(isWithinCategory(['electronics-accessories'], ['electronics']), false);
});

test('identifiers are derived, with the MPN normalised', () => {
  const ids = identifiersOf(product({ mpn: ' wh-1000 xm5 ', gtin: VALID_GTIN }));
  assert.equal(ids.mpn, 'WH1000XM5');
  assert.equal(ids.gtin?.gtin14, VALID_GTIN.gtin14);
  assert.equal(ids.brand, 'TestBrand');
  // A product without them does not acquire empty ones.
  assert.equal(identifiersOf(product()).gtin, undefined);
  assert.equal(identifiersOf(product()).mpn, undefined);
});

test('matching is by GTIN, then brand+MPN, and never by title', () => {
  const a = product({ productId: 'a', gtin: VALID_GTIN });
  const b = product({ productId: 'b', gtin: VALID_GTIN, canonicalTitle: 'Totally Different Name' });
  assert.equal(productMatchStrength(a, b), 'gtin');

  const c = product({ productId: 'c', brand: 'TestBrand', mpn: 'wh-1000xm5' });
  const d = product({ productId: 'd', brand: 'testbrand', mpn: 'WH1000XM5' });
  assert.equal(productMatchStrength(c, d), 'brand-mpn');

  // Identical titles, nothing else: deliberately NOT a match.
  const e = product({ productId: 'e', canonicalTitle: 'Test Headphones' });
  const f = product({ productId: 'f', canonicalTitle: 'Test Headphones' });
  assert.equal(
    productMatchStrength(e, f),
    'none',
    'two feeds using the same words is not evidence of the same product',
  );
});

test('a variant key is order-independent and case-insensitive', () => {
  const a = variantKey([
    { axis: 'Colour', value: 'Black' },
    { axis: 'capacity', value: '256GB' },
  ]);
  const b = variantKey([
    { axis: 'capacity', value: '256gb' },
    { axis: 'colour', value: 'black' },
  ]);
  assert.equal(a, b, 'two feeds listing the axes in either order must agree');
  assert.equal(a, 'capacity=256gb;colour=black');
  assert.equal(variantKey([]), '');
});

test('products with no group become groups of one rather than being dropped', () => {
  const groups = groupVariants([
    product({ productId: 'solo-a' }),
    product({ productId: 'solo-b' }),
  ]);
  assert.equal(groups.length, 2);
  assert.deepEqual(groups.flatMap((g) => g.members.map((m) => m.productId)).sort(), [
    'solo-a',
    'solo-b',
  ]);
});

test('a variant family is gathered with every axis it uses', () => {
  const members = [
    product({
      productId: 'p-black-256',
      variantGroupId: 'fam-1',
      variantAxes: [
        { axis: 'colour', value: 'black' },
        { axis: 'capacity', value: '256GB' },
      ],
    }),
    product({
      productId: 'p-white-512',
      variantGroupId: 'fam-1',
      variantAxes: [
        { axis: 'colour', value: 'white' },
        { axis: 'capacity', value: '512GB' },
      ],
    }),
  ];
  const groups = groupVariants(members);
  assert.equal(groups.length, 1);
  assert.deepEqual(groups[0].axes, ['capacity', 'colour']);
  assert.deepEqual(
    groups[0].members.map((m) => m.productId),
    ['p-black-256', 'p-white-512'],
    'members are in a stable order, so a rendered list does not reshuffle',
  );
});

test('two variants that cannot be told apart are reported, not merged', () => {
  const axes = [{ axis: 'colour', value: 'black' }];
  const group = groupVariants([
    product({ productId: 'dup-1', variantGroupId: 'fam-1', variantAxes: axes }),
    product({ productId: 'dup-2', variantGroupId: 'fam-1', variantAxes: axes }),
    product({
      productId: 'distinct',
      variantGroupId: 'fam-1',
      variantAxes: [{ axis: 'colour', value: 'white' }],
    }),
  ])[0];

  const duplicates = duplicateVariants(group);
  assert.equal(duplicates.length, 1);
  assert.deepEqual(
    duplicates[0].map((p) => p.productId),
    ['dup-1', 'dup-2'],
  );
});

test('a clean variant family reports no duplicates', () => {
  const group = groupVariants([
    product({
      productId: 'a',
      variantGroupId: 'fam',
      variantAxes: [{ axis: 'size', value: 'S' }],
    }),
    product({
      productId: 'b',
      variantGroupId: 'fam',
      variantAxes: [{ axis: 'size', value: 'M' }],
    }),
  ])[0];
  assert.deepEqual(duplicateVariants(group), []);
});

test('validation collects every problem at once', () => {
  const bad = product({ productId: '  ', canonicalTitle: '', brand: ' ', categoryPath: [] });
  const v = validateProduct(bad);
  assert.equal(v.usable, false);
  const kinds = v.problems.map((p) => p.problem).sort();
  assert.deepEqual(kinds, ['empty-brand', 'empty-category', 'empty-title', 'missing-id']);
});

test('a GTIN that fails its check digit is rejected, not stored', () => {
  // Hand-built to bypass parseGtin, which is how a bad GTIN would actually
  // reach us: deserialised straight from a feed into the struct.
  const forged = product({
    gtin: { gtin14: '04006381333932', format: 'GTIN-13' as const },
  });
  const v = validateProduct(forged);
  assert.equal(v.usable, false);
  assert.ok(v.problems.some((p) => p.problem === 'malformed-gtin'));
});

test('a valid GTIN passes validation', () => {
  assert.equal(validateProduct(product({ gtin: VALID_GTIN })).usable, true);
});

test('a variant must say what varies, and axes need a group to vary within', () => {
  const groupless = validateProduct(product({ variantAxes: [{ axis: 'colour', value: 'black' }] }));
  assert.equal(groupless.usable, false);
  assert.ok(groupless.problems.some((p) => p.problem === 'axes-without-group'));

  const axisless = validateProduct(product({ variantGroupId: 'fam-1', variantAxes: [] }));
  assert.equal(axisless.usable, false);
  assert.ok(axisless.problems.some((p) => p.problem === 'variant-without-axes'));
});
