/*
 * The guard, and the invariant the whole increment exists for: shipping the
 * provider did not state stays MISSING, and an offer whose delivered cost is
 * unknown never becomes eligible for delivered-price ranking.
 */
import assert from 'node:assert/strict';
import { test } from 'node:test';

import {
  buildCatalog,
  deliveredCost,
  deliveredPriceRankingEligibility,
  isValidGtin,
  itemPrice,
  parseShoppingFeed,
  verifiedShipping,
} from '../dist/index.js';
import { buildFeed, gtin12, product, source } from './fixtures/synthetic-feed.mjs';

function build(rows, sourceOverrides = {}) {
  return buildCatalog(parseShoppingFeed(buildFeed(rows)), source(sourceOverrides));
}

test('a complete row becomes an offer with its fields intact', () => {
  const { offers, rejected } = build([product()]);
  assert.deepEqual(rejected, []);
  assert.equal(offers.length, 1);

  const offer = offers[0];
  assert.equal(offer.offerId, 'northwind:NW-1001');
  assert.equal(offer.merchantId, 'northwind');
  assert.equal(offer.merchantOfferId, 'NW-1001');
  assert.equal(offer.brand, 'Northwind Trading');
  assert.deepEqual(offer.listPrice, { amountMinor: 2499, currency: 'USD' });
  assert.deepEqual(offer.salePrice, { amountMinor: 1999, currency: 'USD' });
  assert.equal(offer.availability, 'in_stock');
  assert.equal(offer.condition, 'new');
  assert.equal(offer.sourceFeed, 'test:shopping:0000000');
  assert.equal(offer.snapshotAt, '2026-10-29T11:35:12.000Z');
});

test('item price is the lower of list and sale, and is not a total', () => {
  const { offers } = build([product()]);
  assert.deepEqual(itemPrice(offers[0]), { amountMinor: 1999, currency: 'USD' });

  const { offers: noSale } = build([product({ id: 'NW-2', salePrice: '' })]);
  assert.deepEqual(itemPrice(noSale[0]), { amountMinor: 2499, currency: 'USD' });

  // A sale price above list is ignored rather than preferred.
  const { offers: oddSale } = build([product({ id: 'NW-3', salePrice: '99.00 USD' })]);
  assert.deepEqual(itemPrice(oddSale[0]), { amountMinor: 2499, currency: 'USD' });
});

/* ---------------- the shipping invariant ---------------- */

test('a feed with no shipping value yields MISSING, never zero', () => {
  const { offers } = build([product()]);
  const { shipping } = offers[0];
  assert.equal(shipping.kind, 'MISSING');
  assert.equal('cost' in shipping, false);
  assert.match(shipping.reason, /no shipping value/);
  // The exact failure this guards against: a zero that reads as free delivery.
  assert.notEqual(JSON.stringify(shipping).includes('"amountMinor":0'), true);
});

test('this is what the real Soundcore feed looks like — all three columns empty', () => {
  const rows = Array.from({ length: 25 }, (_, i) =>
    product({
      id: `NW-${1000 + i}`,
      gtin: gtin12(String(10000000000 + i)),
      shippingPacked: '',
      shippingPrice: '',
      shippingCountry: '',
    }),
  );
  const { offers, rejected } = build(rows);
  assert.deepEqual(rejected, []);
  assert.equal(offers.length, 25);
  assert.equal(
    offers.every((o) => o.shipping.kind === 'MISSING'),
    true,
  );
  assert.equal(
    offers.every((o) => deliveredCost(o).kind === 'UNAVAILABLE'),
    true,
  );
  assert.equal(
    offers.every((o) => deliveredPriceRankingEligibility(o).eligible === false),
    true,
  );
});

test('a shipping price without a destination country is not verified', () => {
  const { offers } = build([product({ shippingPrice: '5.99', shippingCountry: '' })]);
  assert.equal(offers[0].shipping.kind, 'MISSING');
  assert.match(offers[0].shipping.reason, /no destination country/);
});

test('split shipping columns with a country ARE verified', () => {
  const { offers } = build([product({ shippingPrice: '5.99', shippingCountry: 'US' })]);
  const { shipping } = offers[0];
  assert.equal(shipping.kind, 'VERIFIED');
  assert.deepEqual(shipping.cost, { amountMinor: 599, currency: 'USD' });
  assert.equal(shipping.destinationCountry, 'US');
  assert.equal(shipping.evidence, 'test:shopping:0000000#SHIPPING(PRICE)');
});

test('the packed shipping form is read, preferring the US entry', () => {
  const { offers } = build([product({ shippingPacked: 'CA:ON:Ground:12.00,US:CA:Ground:5.99' })]);
  assert.equal(offers[0].shipping.kind, 'VERIFIED');
  assert.deepEqual(offers[0].shipping.cost, { amountMinor: 599, currency: 'USD' });
});

test('an unreadable packed shipping value stays MISSING', () => {
  const { offers } = build([product({ shippingPacked: 'ask at checkout' })]);
  assert.equal(offers[0].shipping.kind, 'MISSING');
});

test('a verified shipping cost cannot be constructed without evidence', () => {
  const cost = { amountMinor: 0, currency: 'USD' };
  assert.throws(() => verifiedShipping(cost, 'US', ''), TypeError);
  assert.throws(() => verifiedShipping(cost, 'usa', 'somewhere'), TypeError);
  assert.throws(
    () => verifiedShipping({ amountMinor: -1, currency: 'USD' }, 'US', 'x'),
    RangeError,
  );
  // Free delivery is representable — but only when a provider actually said so.
  assert.equal(verifiedShipping(cost, 'US', 'provider:free-shipping-promo').kind, 'VERIFIED');
});

/* ---------------- delivered cost and ranking ---------------- */

test('delivered cost stays UNAVAILABLE while fees are unknown, even with shipping', () => {
  const { offers } = build([product({ shippingPrice: '5.99', shippingCountry: 'US' })]);
  const cost = deliveredCost(offers[0]);
  assert.equal(cost.kind, 'UNAVAILABLE');
  assert.deepEqual(cost.missing, ['mandatory-fees']);
});

test('delivered cost adds up only when every component is verified', () => {
  const { offers } = build([product({ shippingPrice: '5.99', shippingCountry: 'US' })]);
  const offer = {
    ...offers[0],
    mandatoryFees: {
      kind: 'VERIFIED',
      total: { amountMinor: 150, currency: 'USD' },
      evidence: 'test:fees',
    },
  };
  const cost = deliveredCost(offer);
  assert.equal(cost.kind, 'VERIFIED');
  // 19.99 item + 5.99 shipping + 1.50 fees
  assert.deepEqual(cost.total, { amountMinor: 2748, currency: 'USD' });
  assert.deepEqual(deliveredPriceRankingEligibility(offer), { eligible: true, blockers: [] });
});

test('ranking eligibility names every unmet condition', () => {
  const { offers } = build([product({ availability: 'out of stock' })]);
  assert.deepEqual(deliveredPriceRankingEligibility(offers[0]).blockers, [
    'shipping-not-verified',
    'mandatory-fees-unknown',
    'not-purchasable',
  ]);
});

/* ---------------- rejection ---------------- */

const REJECT_CASES = [
  ['missing-offer-id', { id: '' }],
  ['missing-title', { title: '' }],
  ['missing-brand', { brand: '', mpn: '' }],
  ['invalid-price', { price: 'call us' }],
  ['invalid-sale-price', { salePrice: '0.00 USD' }],
  ['price-currency-mismatch', { salePrice: '19.99 EUR' }],
  ['invalid-availability', { availability: 'maybe' }],
  ['invalid-condition', { condition: 'open box' }],
  ['invalid-product-url', { link: 'http://example.invalid/p' }],
  ['invalid-image-url', { imageLink: 'not a url' }],
  ['invalid-snapshot-timestamp', { lastUpdated: 'last Tuesday' }],
  ['future-snapshot-timestamp', { lastUpdated: '2027-01-01T00:00:00.000Z' }],
];

for (const [reason, overrides] of REJECT_CASES) {
  test(`rejects a row for ${reason}`, () => {
    const { offers, rejected } = build([product(overrides)]);
    assert.deepEqual(offers, []);
    assert.equal(rejected.length, 1);
    assert.equal(
      rejected[0].reasons.includes(reason),
      true,
      `expected ${reason}, got ${rejected[0].reasons.join(', ')}`,
    );
  });
}

test('weak identity is rejected: no valid GTIN and no brand+MPN pair', () => {
  const { offers, rejected } = build([product({ gtin: '', mpn: '' })]);
  assert.deepEqual(offers, []);
  assert.equal(rejected[0].reasons.includes('weak-identity'), true);
});

test('a GTIN failing its check digit falls back to brand+MPN, not to a bad GTIN', () => {
  const { offers, rejected } = build([product({ gtin: '012345678901' })]);
  assert.deepEqual(rejected, []);
  assert.equal(offers[0].gtin, null);
  assert.equal(offers[0].mpn, 'NWTM-1');
});

test('GTIN check digits are actually verified', () => {
  assert.equal(isValidGtin(gtin12('01234567890')), true);
  assert.equal(isValidGtin('012345678901'), false);
  assert.equal(isValidGtin('1234567'), false);
  assert.equal(isValidGtin('abcdefghijkl'), false);
  assert.equal(isValidGtin(''), false);
});

test('every fault on a row is reported, not just the first', () => {
  const { rejected } = build([product({ price: 'free', availability: 'maybe', link: '' })]);
  assert.deepEqual(rejected[0].reasons, [
    'invalid-price',
    'invalid-availability',
    'invalid-product-url',
  ]);
});

/* ---------------- duplicates ---------------- */

test('a duplicate offer id is rejected and the first occurrence is kept', () => {
  const first = product({ id: 'NW-DUP', title: 'First' });
  const second = product({ id: 'NW-DUP', title: 'Second' });
  const { offers, rejected } = build([first, second]);
  assert.equal(offers.length, 1);
  assert.equal(offers[0].title, 'First');
  assert.deepEqual(rejected, [
    { rowNumber: 3, merchantOfferId: 'NW-DUP', reasons: ['duplicate-offer-id'] },
  ]);
});

test('a rejected row does not reserve its id for a later valid row', () => {
  const broken = product({ id: 'NW-9', price: 'free' });
  const good = product({ id: 'NW-9' });
  const { offers, rejected } = build([broken, good]);
  assert.equal(offers.length, 1);
  assert.equal(rejected.length, 1);
  assert.equal(rejected[0].reasons.includes('duplicate-offer-id'), false);
});

/* ---------------- leakage and caller errors ---------------- */

test('rejections never echo cell contents', () => {
  const secretish = 'https://www.anrdoezrs.invalid/links/1234567/type/dlg/sid/SECRET-TOKEN';
  const { rejected } = build([
    product({ price: 'call us', link: secretish, title: 'Confidential Product Name' }),
  ]);
  const serialised = JSON.stringify(rejected);
  assert.equal(serialised.includes('SECRET-TOKEN'), false);
  assert.equal(serialised.includes('anrdoezrs'), false);
  assert.equal(serialised.includes('Confidential Product Name'), false);
  assert.equal(serialised.includes('call us'), false);
  // The SKU is kept on purpose: it is what an operator needs to find the row.
  assert.equal(rejected[0].merchantOfferId, 'NW-1001');
});

test('malformed feed diagnostics carry no cell contents either', () => {
  const parse = parseShoppingFeed(buildFeed([product()], { extraLines: ['NW-X\tSECRET-TOKEN'] }));
  assert.equal(JSON.stringify(parse.malformed).includes('SECRET-TOKEN'), false);
});

test('a bad caller configuration throws rather than producing offers', () => {
  const parse = parseShoppingFeed(buildFeed([product()]));
  assert.throws(() => buildCatalog(parse, source({ merchantId: 'Northwind' })), TypeError);
  assert.throws(() => buildCatalog(parse, source({ merchantId: '' })), TypeError);
  assert.throws(
    () => buildCatalog(parse, source({ sourceFeed: 'https://example.invalid/?key=abc' })),
    TypeError,
  );
  assert.throws(() => buildCatalog(parse, source({ feedSnapshotAt: 'whenever' })), TypeError);
});

test('an empty feed produces an empty catalog, not an error', () => {
  const { offers, rejected } = build([]);
  assert.deepEqual(offers, []);
  assert.deepEqual(rejected, []);
});
