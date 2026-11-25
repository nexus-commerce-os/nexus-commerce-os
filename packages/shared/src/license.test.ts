import assert from 'node:assert/strict';
import { test } from 'node:test';
import {
  type LicenseTag,
  attributionFor,
  cacheTtlSeconds,
  licenseAllowsImageRedistribution,
  licenseAllowsPriceDisplay,
  licenseAllowsRegion,
  licenseAllowsReviewText,
  licenseAllowsUse,
} from './license.js';

const NOW = new Date('2026-06-01T12:00:00Z');

/** A permissive tag. SYNTHETIC — test fixture, not a real partner licence. */
const tag = (over: Partial<LicenseTag> = {}): LicenseTag => ({
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

test('no licence tag means no permission — the rule, not a default', () => {
  const d = licenseAllowsUse(null, NOW);
  assert.equal(d.allowed, false);
  assert.equal(d.refusal, 'missing');
  assert.equal(licenseAllowsUse(undefined, NOW).allowed, false);
});

test('an expired licence is refused even though every flag says yes', () => {
  const d = licenseAllowsUse(tag({ expiresAt: '2026-05-31T23:59:59Z' }), NOW);
  assert.equal(d.allowed, false);
  assert.equal(d.refusal, 'expired');
  assert.match(d.detail!, /expired at/);
});

test('expiry is evaluated against the instant passed in, not the wall clock', () => {
  const t = tag({ expiresAt: '2026-06-01T12:00:01Z' });
  assert.equal(licenseAllowsUse(t, new Date('2026-06-01T12:00:00Z')).allowed, true);
  assert.equal(licenseAllowsUse(t, new Date('2026-06-01T12:00:02Z')).allowed, false);
});

test('a malformed expiry is refused rather than treated as never expiring', () => {
  const d = licenseAllowsUse(tag({ expiresAt: 'soon' }), NOW);
  assert.equal(d.refusal, 'malformed-expiry');
});

test('an empty geo list means unrestricted; a non-empty one is a whitelist', () => {
  assert.equal(licenseAllowsRegion(tag(), 'BD', NOW).allowed, true);

  const limited = tag({ geoRestrictions: ['US', 'EU'] });
  assert.equal(licenseAllowsRegion(limited, 'us', NOW).allowed, true);
  const denied = licenseAllowsRegion(limited, 'BD', NOW);
  assert.equal(denied.allowed, false);
  assert.equal(denied.refusal, 'region-not-permitted');
});

test('region checks still fail closed on an expired licence', () => {
  const t = tag({ geoRestrictions: ['US'], expiresAt: '2020-01-01T00:00:00Z' });
  assert.equal(licenseAllowsRegion(t, 'US', NOW).refusal, 'expired');
});

test('caching and displaying are separate permissions', () => {
  const cacheOnly = tag({ mayDisplayPrice: false, mayCachePrice: true });
  assert.equal(licenseAllowsUse(cacheOnly, NOW).allowed, true);
  const d = licenseAllowsPriceDisplay(cacheOnly, NOW);
  assert.equal(d.allowed, false);
  assert.equal(d.refusal, 'display-not-permitted');
  assert.equal(cacheTtlSeconds(cacheOnly, 300), 300);
});

test('review text and images carry their own permissions', () => {
  assert.equal(licenseAllowsReviewText(tag(), NOW).allowed, false);
  assert.equal(licenseAllowsReviewText(tag({ mayDisplayReviewText: true }), NOW).allowed, true);
  assert.equal(licenseAllowsImageRedistribution(tag(), NOW).allowed, true);
  assert.equal(
    licenseAllowsImageRedistribution(tag({ mayRedistributeImage: false }), NOW).allowed,
    false,
  );
});

test('cacheTtlMaxSeconds is a ceiling, expressed as min so it cannot be exceeded', () => {
  const t = tag({ cacheTtlMaxSeconds: 60 });
  assert.equal(cacheTtlSeconds(t, 3600), 60, 'a longer tier TTL is clamped to the licence');
  assert.equal(cacheTtlSeconds(t, 30), 30, 'a shorter tier TTL wins');
});

test('no caching permission means a TTL of zero, not a short one', () => {
  assert.equal(cacheTtlSeconds(tag({ mayCachePrice: false }), 3600), 0);
  assert.equal(cacheTtlSeconds(null, 3600), 0);
});

test('nonsense TTLs degrade to zero rather than to forever', () => {
  assert.equal(cacheTtlSeconds(tag({ cacheTtlMaxSeconds: Number.NaN }), 300), 0);
  assert.equal(cacheTtlSeconds(tag({ cacheTtlMaxSeconds: -5 }), 300), 0);
  assert.equal(cacheTtlSeconds(tag({ cacheTtlMaxSeconds: Infinity }), 300), 0);
});

test('attribution is surfaced when the licence requires it', () => {
  assert.equal(attributionFor(tag()), 'Source: test-partner');
  assert.equal(attributionFor(tag({ attributionRequired: false })), null);
});
