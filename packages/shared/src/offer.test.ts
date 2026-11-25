import assert from 'node:assert/strict';
import { test } from 'node:test';
import { parseMoney, toDecimalString } from './money.js';
import type { LicenseTag } from './license.js';
import type { Freshness } from './freshness.js';
import {
  type Offer,
  OfferError,
  allInPrice,
  comparableTotal,
  knownCost,
  offerId,
  offerIsDisplayable,
  rankByTotal,
  sameTotal,
  unknownCost,
  validateOffer,
} from './offer.js';

const NOW = new Date('2026-06-01T12:00:00Z');

/** SYNTHETIC fixture. No real merchant, no real price, test-only. */
const licence = (over: Partial<LicenseTag> = {}): LicenseTag => ({
  source: 'test-partner',
  acquiredVia: 'licensed_feed',
  mayCachePrice: true,
  cacheTtlMaxSeconds: 3600,
  mayDisplayPrice: true,
  mayDisplayReviewText: false,
  mayRedistributeImage: true,
  attributionRequired: true,
  geoRestrictions: [],
  expiresAt: '2027-01-01T00:00:00Z',
  ...over,
});

const fresh = (): Freshness => ({
  tier: 'hot',
  priceObservedAt: new Date(NOW.getTime() - 60_000).toISOString(),
  feedSyncedAt: new Date(NOW.getTime() - 60_000).toISOString(),
});

const offer = (over: Partial<Offer> = {}): Offer => ({
  offerId: offerId('src', 'merchant-a', 'SKU-1'),
  productId: 'prod-1',
  merchantId: 'merchant-a',
  sourceId: 'src',
  merchantSku: 'SKU-1',
  title: 'Test Product',
  price: parseMoney('100.00', 'USD'),
  shipping: knownCost(parseMoney('5.00', 'USD')),
  tax: knownCost(parseMoney('8.00', 'USD')),
  availability: 'in_stock',
  url: 'https://merchant.example/product',
  mediaRefs: [],
  freshness: fresh(),
  licenseTag: licence(),
  ...over,
});

test('the offer id is deterministic, so a re-sync upserts instead of duplicating', () => {
  assert.equal(offerId('s', 'm', 'SKU'), offerId('s', 'm', 'SKU'));
  assert.notEqual(offerId('s', 'm', 'SKU-1'), offerId('s', 'm', 'SKU-2'));
  // The separator cannot be forged out of the parts.
  assert.notEqual(offerId('a:b', 'c', 'd'), offerId('a', 'b:c', 'd'));
  assert.throws(() => offerId('', 'm', 'SKU'), OfferError);
});

test('all-in is item plus shipping plus tax, not the headline', () => {
  const result = allInPrice(offer());
  assert.equal(result.complete, true);
  // `assert.equal` narrows `complete` to true, so `allIn` is the only branch left.
  assert.equal(toDecimalString(result.allIn), '113.00');
});

test('unknown shipping gives a floor, never a silent zero', () => {
  const result = allInPrice(offer({ shipping: unknownCost('depends on postcode') }));
  assert.equal(result.complete, false);
  assert.equal(toDecimalString(result.floor), '108.00');
  assert.deepEqual(result.missing, ['shipping']);
  // And it cannot be ranked against a complete total.
  assert.equal(comparableTotal(offer({ shipping: unknownCost('x') })), null);
});

test('the cheapest headline is not the cheapest total — the whole point', () => {
  const cheapHeadlineExpensiveShipping = offer({
    offerId: 'a',
    price: parseMoney('95.00', 'USD'),
    shipping: knownCost(parseMoney('25.00', 'USD')),
    tax: knownCost(parseMoney('0.00', 'USD')),
  });
  const dearHeadlineFreeShipping = offer({
    offerId: 'b',
    price: parseMoney('105.00', 'USD'),
    shipping: knownCost(parseMoney('0.00', 'USD')),
    tax: knownCost(parseMoney('0.00', 'USD')),
  });

  const ranked = rankByTotal([cheapHeadlineExpensiveShipping, dearHeadlineFreeShipping]);
  assert.equal(ranked[0].offerId, 'b', 'ranked on 105.00 total, not the 95.00 headline');
  assert.equal(toDecimalString(comparableTotal(ranked[0])!), '105.00');
});

test('offers without a complete total sort last, whatever their headline says', () => {
  const incompleteButCheap = offer({
    offerId: 'cheap-unknown',
    price: parseMoney('1.00', 'USD'),
    shipping: unknownCost('not published'),
  });
  const complete = offer({ offerId: 'complete' });
  const ranked = rankByTotal([incompleteButCheap, complete]);
  assert.equal(ranked[0].offerId, 'complete');
  assert.equal(ranked[1].offerId, 'cheap-unknown');
});

test('ties break deterministically, so a list does not reshuffle between runs', () => {
  const a = offer({ offerId: 'aaa' });
  const b = offer({ offerId: 'bbb' });
  assert.deepEqual(
    rankByTotal([b, a]).map((o) => o.offerId),
    ['aaa', 'bbb'],
  );
  assert.ok(sameTotal(a, b));
});

test('an all-in price cannot be assembled from two currencies', () => {
  assert.throws(
    () => allInPrice(offer({ shipping: knownCost(parseMoney('5.00', 'EUR')) })),
    /Cannot add USD and EUR/,
  );
});

test('validation collects every problem, not just the first', () => {
  const bad = offer({
    title: '   ',
    url: 'http://insecure.example',
    price: parseMoney('-1.00', 'USD'),
  });
  const v = validateOffer(bad, NOW);
  assert.equal(v.usable, false);
  const kinds = v.problems.map((p) => p.problem);
  assert.ok(kinds.includes('negative-price'));
  assert.ok(kinds.includes('empty-title'));
  assert.ok(kinds.includes('bad-url'));
});

test('an expired licence makes an otherwise perfect offer unusable', () => {
  const v = validateOffer(
    offer({ licenseTag: licence({ expiresAt: '2020-01-01T00:00:00Z' }) }),
    NOW,
  );
  assert.equal(v.usable, false);
  assert.ok(v.problems.some((p) => p.problem === 'license-refused'));
});

test('a stale observation makes an offer unusable', () => {
  const old: Freshness = {
    tier: 'live',
    priceObservedAt: new Date(NOW.getTime() - 60 * 60 * 1000).toISOString(),
    feedSyncedAt: NOW.toISOString(),
  };
  const v = validateOffer(offer({ freshness: old }), NOW);
  assert.equal(v.usable, false);
  assert.ok(v.problems.some((p) => p.problem === 'stale'));
});

test('unknown availability is reported but does not reject the offer', () => {
  const v = validateOffer(offer({ availability: 'unknown' }), NOW);
  assert.equal(v.usable, true, 'refusing these would bias the catalogue toward richer feeds');
  assert.ok(v.problems.some((p) => p.problem === 'unknown-availability'));
});

test('display needs a valid offer, a permitted region and display permission', () => {
  assert.equal(offerIsDisplayable(offer(), 'US', NOW), true);

  const usOnly = offer({ licenseTag: licence({ geoRestrictions: ['US'] }) });
  assert.equal(offerIsDisplayable(usOnly, 'US', NOW), true);
  assert.equal(offerIsDisplayable(usOnly, 'BD', NOW), false);

  const noDisplay = offer({ licenseTag: licence({ mayDisplayPrice: false }) });
  assert.equal(offerIsDisplayable(noDisplay, 'US', NOW), false);
});
