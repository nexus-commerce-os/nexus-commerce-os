import assert from 'node:assert/strict';
import { test } from 'node:test';
import {
  IdentifierError,
  gtinCheckDigit,
  gtinEquals,
  isSameProduct,
  matchStrength,
  merchantSkuKey,
  normalizeMpn,
  parseGtin,
  tryParseGtin,
} from './identifiers.js';

test('real GTINs with their real check digits', () => {
  // Sennheiser HD 600 (EAN-13) and a UPC-A, both genuine formats.
  assert.equal(parseGtin('4044155085150').format, 'GTIN-13');
  assert.equal(parseGtin('036000291452').format, 'GTIN-12');
  assert.equal(parseGtin('96385074').format, 'GTIN-8');
});

test('every length normalises to one 14-digit key', () => {
  const upc = parseGtin('036000291452');
  assert.equal(upc.gtin14, '00036000291452');
  assert.equal(upc.gtin14.length, 14);
  // The same article number quoted in two lengths is the same product.
  assert.ok(gtinEquals(parseGtin('036000291452'), parseGtin('00036000291452')));
});

test('a wrong check digit is refused, because it would match nothing', () => {
  assert.throws(() => parseGtin('4044155085151'), /fails its check digit/);
  assert.equal(tryParseGtin('4044155085151'), null);
});

test('separators feeds use are tolerated; letters are not', () => {
  assert.equal(parseGtin('4044-1550-85150').gtin14, '04044155085150');
  assert.equal(parseGtin('4044 1550 85150').gtin14, '04044155085150');
  assert.throws(() => parseGtin('404415508515X'), /non-digits/);
});

test('an impossible length is refused', () => {
  assert.throws(() => parseGtin('12345'), /valid lengths are 8, 12, 13 and 14/);
});

test('the check digit is the GS1 modulo-10, verified against a known value', () => {
  assert.equal(gtinCheckDigit('404415508515'), 0);
  assert.equal(gtinCheckDigit('03600029145'), 2);
});

test('MPNs normalise across the punctuation feeds disagree about', () => {
  assert.equal(normalizeMpn('MZ-V9P2T0B/AM'), 'MZV9P2T0BAM');
  assert.equal(normalizeMpn('mz v9p2t0b am'), 'MZV9P2T0BAM');
  assert.equal(normalizeMpn('  OLED65C4PUA  '), 'OLED65C4PUA');
  assert.throws(() => normalizeMpn('---'), IdentifierError);
});

test('merchant SKUs are namespaced, because SKUs collide across merchants', () => {
  const a = merchantSkuKey({ merchantId: 'm1', sku: 'ABC' });
  const b = merchantSkuKey({ merchantId: 'm2', sku: 'ABC' });
  assert.notEqual(a, b);
  // And the separator cannot be forged from the parts.
  const x = merchantSkuKey({ merchantId: 'a|b', sku: 'c' });
  const y = merchantSkuKey({ merchantId: 'a', sku: 'b|c' });
  assert.notEqual(x, y);
  assert.throws(() => merchantSkuKey({ merchantId: '', sku: 'x' }), IdentifierError);
});

test('a GTIN match is definitive', () => {
  const a = { gtin: parseGtin('4044155085150') };
  const b = { gtin: parseGtin('04044155085150') };
  assert.equal(matchStrength(a, b), 'gtin');
  assert.ok(isSameProduct(a, b));
});

test('different GTINs are different products, whatever else agrees', () => {
  const a = { gtin: parseGtin('4044155085150'), brand: 'Sennheiser', mpn: 'HD600' };
  const b = { gtin: parseGtin('036000291452'), brand: 'Sennheiser', mpn: 'HD600' };
  assert.equal(matchStrength(a, b), 'none');
  assert.equal(isSameProduct(a, b), false);
});

test('brand plus MPN matches, because an MPN is unique only within a maker', () => {
  const a = { brand: 'Samsung', mpn: 'MZ-V9P2T0B/AM' };
  const b = { brand: 'samsung', mpn: 'mz v9p2t0b am' };
  assert.equal(matchStrength(a, b), 'brand-mpn');

  // Same part number, different manufacturer: not the same product.
  const c = { brand: 'Crucial', mpn: 'MZ-V9P2T0B/AM' };
  assert.equal(matchStrength(a, c), 'none');
});

test('a title is never enough to merge two products', () => {
  // The tempting third option. Refused on purpose: merging by name is how one
  // product's price ends up on another product's page.
  const a = { brand: 'Sennheiser' };
  const b = { brand: 'Sennheiser' };
  assert.equal(matchStrength(a, b), 'none');
  assert.equal(matchStrength({}, {}), 'none');
  assert.equal(matchStrength({ mpn: 'HD600' }, { mpn: 'HD600' }), 'none'); // no brand
});
