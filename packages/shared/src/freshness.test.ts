import assert from 'node:assert/strict';
import { test } from 'node:test';
import {
  type Freshness,
  MAX_AGE_SECONDS,
  describeAge,
  evaluateFreshness,
  isFresh,
} from './freshness.js';

const NOW = new Date('2026-06-01T12:00:00Z');

const observed = (secondsAgo: number, tier: Freshness['tier'] = 'hot'): Freshness => ({
  tier,
  priceObservedAt: new Date(NOW.getTime() - secondsAgo * 1000).toISOString(),
  feedSyncedAt: new Date(NOW.getTime() - secondsAgo * 1000).toISOString(),
});

test('each tier has its own ceiling, and the ceiling is enforced', () => {
  assert.ok(isFresh(observed(MAX_AGE_SECONDS.live - 1, 'live'), NOW));
  assert.equal(isFresh(observed(MAX_AGE_SECONDS.live + 1, 'live'), NOW), false);

  assert.ok(isFresh(observed(MAX_AGE_SECONDS.hot - 1, 'hot'), NOW));
  assert.equal(isFresh(observed(MAX_AGE_SECONDS.hot + 1, 'hot'), NOW), false);

  assert.ok(isFresh(observed(MAX_AGE_SECONDS.warm - 1, 'warm'), NOW));
  assert.equal(isFresh(observed(MAX_AGE_SECONDS.warm + 1, 'warm'), NOW), false);
});

test('the same age is fresh in one tier and stale in another', () => {
  const twoHours = 2 * 60 * 60;
  assert.equal(isFresh(observed(twoHours, 'live'), NOW), false);
  assert.equal(isFresh(observed(twoHours, 'hot'), NOW), true);
});

test('a stale verdict names the age and the limit', () => {
  const v = evaluateFreshness(observed(MAX_AGE_SECONDS.live + 60, 'live'), NOW);
  assert.equal(v.fresh, false);
  assert.equal(v.reason, 'too-old');
  assert.match(v.detail!, /live tier allows 900s/);
  assert.equal(v.ageSeconds, 960);
});

test('a price from the future is a clock problem, not a bargain', () => {
  const future: Freshness = {
    tier: 'hot',
    priceObservedAt: new Date(NOW.getTime() + 10 * 60 * 1000).toISOString(),
    feedSyncedAt: NOW.toISOString(),
  };
  const v = evaluateFreshness(future, NOW);
  assert.equal(v.fresh, false);
  assert.equal(v.reason, 'future-timestamp');
});

test('ordinary clock skew is tolerated, so a partner a minute fast still works', () => {
  const slightlyAhead: Freshness = {
    tier: 'hot',
    priceObservedAt: new Date(NOW.getTime() + 60 * 1000).toISOString(),
    feedSyncedAt: NOW.toISOString(),
  };
  const v = evaluateFreshness(slightlyAhead, NOW);
  assert.equal(v.fresh, true);
  assert.equal(v.ageSeconds, 0, 'a slightly future reading is reported as age zero, not negative');
});

test('a malformed timestamp is stale, never fresh by accident', () => {
  const v = evaluateFreshness(
    { tier: 'hot', priceObservedAt: 'yesterday', feedSyncedAt: 'yesterday' },
    NOW,
  );
  assert.equal(v.fresh, false);
  assert.equal(v.reason, 'malformed-timestamp');
  assert.equal(v.ageSeconds, null);
});

test('ages are described in words a reader can act on', () => {
  assert.equal(describeAge(5), 'just now');
  assert.equal(describeAge(60), '1 minute ago');
  assert.equal(describeAge(3600), '1 hour ago');
  assert.equal(describeAge(7200), '2 hours ago');
  assert.equal(describeAge(86_400), '1 day ago');
  assert.equal(describeAge(200_000), '2 days ago');
});
