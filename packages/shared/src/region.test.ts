import assert from 'node:assert/strict';
import { test } from 'node:test';
import { parseMoney } from './money.js';
import type { Freshness } from './freshness.js';
import type { LicenseTag } from './license.js';
import { type Offer, knownCost, offerId, unknownCost } from './offer.js';
import {
  type ShippingReach,
  normalizeRegion,
  offersVisibleInRegion,
  reachesRegion,
  regionalAvailability,
} from './region.js';

const NOW = new Date('2026-06-01T12:00:00Z');

/** SYNTHETIC fixtures. No real merchant, price or licence; test-only. */
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

const reach = (over: Partial<ShippingReach> = {}): ShippingReach => ({
  merchantId: 'merchant-a',
  shipsAnywhere: false,
  ships: ['US', 'CA'],
  excludes: [],
  ...over,
});

test('region codes are compared case- and whitespace-insensitively', () => {
  assert.equal(normalizeRegion(' us '), 'US');
  assert.equal(reachesRegion(reach(), 'us'), 'ships');
});

test('unpublished shipping reach is unknown, never "ships everywhere"', () => {
  assert.equal(reachesRegion(null, 'US'), 'not-published');
  assert.equal(reachesRegion(undefined, 'US'), 'not-published');
  assert.equal(
    reachesRegion(reach({ ships: [] }), 'US'),
    'not-published',
    'an empty list is silence, not a promise',
  );
});

test('an exclusion beats a blanket "ships anywhere"', () => {
  const eu = reach({ shipsAnywhere: true, ships: [], excludes: ['MT'] });
  assert.equal(reachesRegion(eu, 'DE'), 'ships');
  assert.equal(reachesRegion(eu, 'MT'), 'does-not-ship');
  // Also when the region is both listed and excluded — the exclusion wins.
  assert.equal(reachesRegion(reach({ ships: ['US'], excludes: ['US'] }), 'US'), 'does-not-ship');
});

test('a region outside the published list does not ship', () => {
  assert.equal(reachesRegion(reach(), 'BD'), 'does-not-ship');
});

test('a licensed, in-stock, shippable offer is available', () => {
  const verdict = regionalAvailability(offer(), 'US', reach(), NOW);
  assert.equal(verdict.available, true);
  assert.equal(verdict.shippingUnconfirmed, false);
  assert.deepEqual(verdict.refusals, []);
  assert.equal(verdict.region, 'US');
});

test('a geo-restricted licence refuses the region it does not cover', () => {
  const usOnly = offer({ licenseTag: licence({ geoRestrictions: ['US'] }) });

  assert.equal(regionalAvailability(usOnly, 'US', reach(), NOW).available, true);

  const abroad = regionalAvailability(usOnly, 'BD', reach({ ships: ['BD'] }), NOW);
  assert.equal(abroad.available, false);
  assert.ok(abroad.refusals.some((r) => r.refusal === 'license-region'));
});

test('licence refusal and merchant refusal are reported separately', () => {
  // Licensed for the US; merchant ships only to Canada. Two distinct reasons,
  // and conflating them would hide whichever one gets fixed first.
  const verdict = regionalAvailability(
    offer({ licenseTag: licence({ geoRestrictions: ['CA'] }) }),
    'US',
    reach({ ships: ['CA'] }),
    NOW,
  );
  assert.equal(verdict.available, false);
  const kinds = verdict.refusals.map((r) => r.refusal).sort();
  assert.deepEqual(kinds, ['license-region', 'merchant-does-not-ship']);
});

test('a licence that forbids showing the price refuses display', () => {
  const verdict = regionalAvailability(
    offer({ licenseTag: licence({ mayDisplayPrice: false }) }),
    'US',
    reach(),
    NOW,
  );
  assert.equal(verdict.available, false);
  assert.ok(verdict.refusals.some((r) => r.refusal === 'license-display'));
});

test('an expired licence fails closed in every region', () => {
  const expired = offer({ licenseTag: licence({ expiresAt: '2020-01-01T00:00:00Z' }) });
  for (const region of ['US', 'CA', 'BD', 'DE']) {
    const verdict = regionalAvailability(expired, region, reach({ shipsAnywhere: true }), NOW);
    assert.equal(verdict.available, false, `expired licence must refuse ${region}`);
  }
});

test('unknown shipping reach flags the caveat instead of hiding the offer', () => {
  const verdict = regionalAvailability(offer(), 'US', null, NOW);
  assert.equal(verdict.shippingUnconfirmed, true);
  assert.equal(
    verdict.available,
    true,
    'an unconfirmed delivery is shown with a caveat, not silently dropped',
  );
});

test('out of stock is reported but does not hide the row', () => {
  const verdict = regionalAvailability(offer({ availability: 'out' }), 'US', reach(), NOW);
  assert.equal(verdict.available, false);
  assert.ok(verdict.refusals.some((r) => r.refusal === 'out-of-stock'));
  // It survives the visibility filter, because a price history is still useful.
  const visible = offersVisibleInRegion(
    [offer({ availability: 'out' })],
    'US',
    new Map([['merchant-a', reach()]]),
    NOW,
  );
  assert.equal(visible.length, 1);
});

test('an invalid offer is refused before any region question is asked', () => {
  const verdict = regionalAvailability(
    offer({ url: 'http://insecure.example' }),
    'US',
    reach(),
    NOW,
  );
  assert.equal(verdict.available, false);
  assert.ok(verdict.refusals.some((r) => r.refusal === 'offer-invalid'));
});

test('the visibility filter removes what may not be shown and keeps what may', () => {
  const offers = [
    offer({ offerId: 'ok', merchantId: 'merchant-a' }),
    offer({
      offerId: 'wrong-region',
      merchantId: 'merchant-a',
      licenseTag: licence({ geoRestrictions: ['CA'] }),
    }),
    offer({
      offerId: 'no-display',
      merchantId: 'merchant-a',
      licenseTag: licence({ mayDisplayPrice: false }),
    }),
    offer({ offerId: 'no-shipping', merchantId: 'merchant-b' }),
    offer({ offerId: 'unconfirmed', merchantId: 'merchant-c' }),
  ];
  const reaches = new Map<string, ShippingReach>([
    ['merchant-a', reach()],
    ['merchant-b', reach({ merchantId: 'merchant-b', ships: ['CA'] })],
    // merchant-c publishes nothing, so its reach is absent from the map.
  ]);

  const visible = offersVisibleInRegion(offers, 'US', reaches, NOW).map((o) => o.offerId);
  assert.deepEqual(visible.sort(), ['ok', 'unconfirmed']);
});

test('an offer with unknown shipping cost is still regionally available', () => {
  // An unknown shipping PRICE and an unknown shipping REACH are different
  // facts; neither implies the other.
  const verdict = regionalAvailability(
    offer({ shipping: unknownCost('depends on postcode') }),
    'US',
    reach(),
    NOW,
  );
  assert.equal(verdict.available, true);
  assert.equal(verdict.shippingUnconfirmed, false);
});
