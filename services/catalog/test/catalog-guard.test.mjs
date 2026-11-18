/*
 * The guard, and the invariant the whole increment exists for: shipping the
 * provider did not state stays MISSING, and an offer whose delivered cost is
 * unknown never becomes eligible for delivered-price ranking.
 */
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { test } from 'node:test';

import {
  buildCatalog,
  deliveredCost,
  deliveredPriceRankingEligibility,
  isHttpsUrl,
  isValidGtin,
  itemPrice,
  parseShoppingFeed,
  readDelimitedPayload,
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

/*
 * ─── URL validation, and the ReDoS it used to carry ────────────────────────
 *
 * CodeQL flagged `js/polynomial-redos` (high) on the product/image URL check.
 * The pattern ended with two adjacent quantifiers over overlapping character
 * classes, so a string that ultimately FAILS to match forced the engine to
 * retry every split point between them — quadratic in the length of an
 * untrusted provider-feed field.
 *
 * These tests exist so that a scanner going quiet is not the evidence. They
 * assert the two things that actually matter: the validator still classifies
 * the same inputs the same way, and it runs in time that does not blow up on a
 * hostile string.
 */

/** Realistic shapes a provider feed actually carries. Every one must be accepted. */
const ACCEPTED_URLS = [
  'https://www.soundcore.com/products/a3027',
  'https://example.invalid/click-000-000?url=https%3A%2F%2Fexample.invalid%2Fp&sid=x',
  'https://cdn.example.invalid/img/thing_1200x1200.jpg',
  'https://example.invalid',
  'https://example.invalid/',
  'https://example.invalid:8443/p',
  'https://example.invalid:8443',
  'https://a.b.c.d.example.invalid/a/b/c?d=e&f=g#frag',
  'https://example.invalid/p?q=a+b%20c',
  'https://example.invalid/p#',
  'https://example.invalid/?',
  'https://xn--80ak6aa92e.invalid/p',
  'https://example.invalid/p/été',
];

/** Each must be refused, and the reason it is refused is stated beside it. */
const REFUSED_URLS = [
  ['plain http is never upgraded', 'http://example.invalid/p'],
  ['protocol-relative is not a URL', '//example.invalid/p'],
  ['no scheme at all', 'example.invalid/p'],
  ['a different scheme', 'ftp://example.invalid/p'],
  ['javascript scheme', 'javascript:alert(1)'],
  ['data scheme', 'data:text/html,<script>1</script>'],
  ['uppercase scheme (providers send lower case; be strict)', 'HTTPS://example.invalid'],
  ['empty authority', 'https://'],
  ['empty authority before a path', 'https:///p'],
  ['authority cannot start with the query delimiter', 'https://?q=1'],
  ['authority cannot start with the fragment delimiter', 'https://#f'],
  ['a space anywhere', 'https://example.invalid/a b'],
  ['a leading space', ' https://example.invalid'],
  ['a trailing space', 'https://example.invalid '],
  ['a tab', 'https://example.invalid/a\tb'],
  ['a newline', 'https://example.invalid/a\nb'],
  ['a NUL', 'https://example.invalid/a\u0000b'],
  ['a C0 control character', 'https://exa\u0001mple.invalid'],
  ['empty string', ''],
  ['the scheme alone', 'https:'],
];

test('every realistic provider URL is accepted', () => {
  for (const url of ACCEPTED_URLS) {
    assert.equal(isHttpsUrl(url), true, url);
  }
});

test('every unsafe or malformed URL is refused', () => {
  for (const [why, url] of REFUSED_URLS) {
    assert.equal(isHttpsUrl(url), false, `${why}: ${JSON.stringify(url)}`);
  }
});

test('the guard rejects the row, not just the string, for a bad URL', () => {
  // The predicate is reachable from the real path: a feed row carrying one of
  // the refused URLs must be quarantined with the matching reason.
  const built = buildCatalog(
    parseShoppingFeed(buildFeed([product({ link: 'http://example.invalid/p' })])),
    source(),
  );
  assert.equal(built.offers.length, 0);
  assert.deepEqual(built.rejected[0].reasons, ['invalid-product-url']);
});

test('a hostile URL cannot make validation blow up', () => {
  /*
   * The attack shape: a long authority of characters the first class accepts,
   * then one character that makes the whole match fail. Under the old pattern
   * this was measured at 87ms for 10k characters, 1.4s for 40k and 5.6s for
   * 80k — so 200k would have taken roughly half a minute.
   *
   * The budget below is deliberately loose. It is not a benchmark; it is a trip
   * wire that a quadratic pattern cannot pass even on a slow, loaded runner,
   * while a linear one clears it by three orders of magnitude.
   */
  const BUDGET_MS = 1000;
  for (const n of [10_000, 50_000, 200_000]) {
    for (const hostile of [
      `https://${'!'.repeat(n)} `, // fails on the trailing space
      `https://${'a'.repeat(n)}\u0001`, // fails on a control character
      `https://${'a'.repeat(n)}/${'b'.repeat(n)} `, // fails after a path, too
    ]) {
      const started = process.hrtime.bigint();
      assert.equal(isHttpsUrl(hostile), false);
      const ms = Number(process.hrtime.bigint() - started) / 1e6;
      assert.ok(ms < BUDGET_MS, `n=${n} took ${ms.toFixed(1)}ms, budget ${BUDGET_MS}ms`);
    }
  }
});

test('a long VALID URL is still accepted, and just as fast', () => {
  // Guards against "fixing" the ReDoS by refusing long strings outright.
  const long = `https://example.invalid/${'a'.repeat(200_000)}`;
  const started = process.hrtime.bigint();
  assert.equal(isHttpsUrl(long), true);
  assert.ok(Number(process.hrtime.bigint() - started) / 1e6 < 1000);
});

test(
  'an import of the real 10 November export is unaffected by the stricter split',
  { skip: !process.env['HONESTTOTAL_FEED_B'] },
  () => {
    // Behaviour, not scanner silence: every URL in a real export still passes, so
    // the rewrite cannot have narrowed the accepted language in practice.
    const payload = readDelimitedPayload(readFileSync(process.env['HONESTTOTAL_FEED_B']));
    const urls = [];
    for (const row of parseShoppingFeed(payload.text).rows) {
      for (const value of Object.values(row.fields ?? {})) {
        if (typeof value === 'string' && value.startsWith('http')) urls.push(value);
      }
    }
    assert.ok(urls.length > 0, 'the export should carry URLs');
    const refused = urls.filter((u) => !isHttpsUrl(u));
    assert.deepEqual(refused, [], `${refused.length} real URLs would now be refused`);
  },
);

test('an empty feed produces an empty catalog, not an error', () => {
  const { offers, rejected } = build([]);
  assert.deepEqual(offers, []);
  assert.deepEqual(rejected, []);
});
