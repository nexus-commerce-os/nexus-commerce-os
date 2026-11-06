/*
 * The 48-hour rule, tested at its boundaries rather than at whatever time the
 * suite happens to run. Every `now` is explicit.
 */
import assert from 'node:assert/strict';
import { test } from 'node:test';

import {
  MAX_CLOCK_SKEW_MS,
  MAX_FEED_AGE_MS,
  assessFeedFreshness,
  describeFreshness,
  feedExportedAt,
  isReleasable,
  parseShoppingFeed,
} from '../dist/index.js';

import { buildFeed, product } from './fixtures/synthetic-feed.mjs';

const HOUR = 60 * 60 * 1000;
const EXPORTED = '2026-11-05T12:46:08.126Z';
const at = (offsetMs) => new Date(Date.parse(EXPORTED) + offsetMs);

test('the limit is 48 hours and the skew tolerance is 5 minutes', () => {
  assert.equal(MAX_FEED_AGE_MS, 48 * HOUR);
  assert.equal(MAX_CLOCK_SKEW_MS, 5 * 60 * 1000);
});

test('a feed exported moments ago is fresh', () => {
  const f = assessFeedFreshness(EXPORTED, at(30 * 1000));
  assert.equal(f.kind, 'fresh');
  assert.equal(f.ageMs, 30 * 1000);
  assert.equal(isReleasable(f), true);
});

test('one hour short of the limit is still fresh', () => {
  const f = assessFeedFreshness(EXPORTED, at(47 * HOUR));
  assert.equal(f.kind, 'fresh');
  assert.equal(isReleasable(f), true);
});

test('exactly 48 hours is fresh; one millisecond more is stale', () => {
  assert.equal(assessFeedFreshness(EXPORTED, at(48 * HOUR)).kind, 'fresh');
  const over = assessFeedFreshness(EXPORTED, at(48 * HOUR + 1));
  assert.equal(over.kind, 'stale');
  assert.equal(isReleasable(over), false);
});

test('the dataset this guard was written for is correctly classified', () => {
  // The 29 October feed, judged on 6 November — five days and change.
  const old = assessFeedFreshness('2026-10-29T11:35:12.000Z', new Date('2026-11-06T12:40:00.000Z'));
  assert.equal(old.kind, 'stale');
  assert.equal(isReleasable(old), false);
  // The 5 November feed, judged at the same moment.
  const recent = assessFeedFreshness(EXPORTED, new Date('2026-11-06T12:40:00.000Z'));
  assert.equal(recent.kind, 'fresh');
  assert.equal(isReleasable(recent), true);
});

/* ---------------- clock skew ---------------- */

test('a feed dated slightly ahead counts as current, not as a negative age', () => {
  const f = assessFeedFreshness(EXPORTED, at(-60 * 1000));
  assert.equal(f.kind, 'fresh');
  assert.equal(f.ageMs, 0, 'a clock a minute behind must not produce a negative age');
});

test('exactly at the skew tolerance is still accepted', () => {
  assert.equal(assessFeedFreshness(EXPORTED, at(-MAX_CLOCK_SKEW_MS)).kind, 'fresh');
});

test('beyond the skew tolerance the timestamp is wrong, not early', () => {
  const f = assessFeedFreshness(EXPORTED, at(-MAX_CLOCK_SKEW_MS - 1));
  assert.equal(f.kind, 'future');
  assert.equal(isReleasable(f), false);
});

test('a wildly future-dated feed cannot pass by having a negative age', () => {
  const f = assessFeedFreshness('2027-01-01T00:00:00.000Z', new Date('2026-11-06T00:00:00.000Z'));
  assert.equal(f.kind, 'future');
  assert.equal(isReleasable(f), false);
});

/* ---------------- missing and malformed ---------------- */

for (const [label, value] of [
  ['null', null],
  ['undefined', undefined],
  ['empty string', ''],
  ['whitespace', '   '],
]) {
  test(`a ${label} timestamp is absent, and absent is refused`, () => {
    const f = assessFeedFreshness(value, new Date());
    assert.equal(f.kind, 'absent');
    assert.equal(isReleasable(f), false);
  });
}

for (const bad of ['yesterday', '2026-13-45T99:99:99Z', 'NaN', '0000-00-00']) {
  test(`an unreadable timestamp (${bad}) is refused`, () => {
    const f = assessFeedFreshness(bad, new Date('2026-11-06T00:00:00.000Z'));
    assert.equal(f.kind, 'unparsable');
    assert.equal(isReleasable(f), false);
  });
}

/* ---------------- time zones are not a loophole ---------------- */

test('an offset timestamp is compared as an instant, not as wall-clock text', () => {
  // 2026-11-05T04:46:08.126-08:00 is the same moment as 12:46:08.126Z.
  const offset = assessFeedFreshness('2026-11-05T04:46:08.126-08:00', at(HOUR));
  assert.equal(offset.kind, 'fresh');
  assert.equal(offset.ageMs, HOUR);
});

test('a feed that looks fresh in local text but is stale in UTC is still stale', () => {
  // +14:00 is the furthest-ahead real offset; the date reads 7 Nov locally
  // while the instant is 6 Nov in UTC.
  const f = assessFeedFreshness(
    '2026-11-07T01:00:00.000+14:00',
    new Date('2026-11-09T12:00:00.000Z'),
  );
  assert.equal(f.kind, 'stale');
});

/* ---------------- deriving the timestamp from the feed ---------------- */

test('the export timestamp is the newest LAST_UPDATED in the file', () => {
  const parse = parseShoppingFeed(
    buildFeed([
      product({ id: 'A', lastUpdated: '2026-11-05T04:46:07.887-08:00' }),
      product({ id: 'B', lastUpdated: '2026-11-05T04:46:08.126-08:00' }),
      product({ id: 'C', lastUpdated: '2026-11-05T04:46:07.950-08:00' }),
    ]),
  );
  assert.equal(feedExportedAt(parse.rows), '2026-11-05T12:46:08.126Z');
});

test('rows with no or unreadable timestamps are skipped, not guessed at', () => {
  const parse = parseShoppingFeed(
    buildFeed([
      product({ id: 'A', lastUpdated: '' }),
      product({ id: 'B', lastUpdated: 'whenever' }),
      product({ id: 'C', lastUpdated: '2026-11-05T12:00:00.000Z' }),
    ]),
  );
  assert.equal(feedExportedAt(parse.rows), '2026-11-05T12:00:00.000Z');
});

test('a feed where no row carries a timestamp yields null, which is refused', () => {
  const parse = parseShoppingFeed(
    buildFeed([product({ id: 'A', lastUpdated: '' }), product({ id: 'B', lastUpdated: '' })]),
  );
  assert.equal(feedExportedAt(parse.rows), null);
  assert.equal(isReleasable(assessFeedFreshness(feedExportedAt(parse.rows), new Date())), false);
});

test('an empty feed yields null rather than a default', () => {
  assert.equal(feedExportedAt([]), null);
});

/* ---------------- the message ---------------- */

test('the description names the age and the limit and no product data', () => {
  const stale = assessFeedFreshness(EXPORTED, at(72 * HOUR));
  const text = describeFreshness(stale);
  assert.match(text, /72\.0h/);
  assert.match(text, /48\.0h/);
  assert.equal(/soundcore|price|\$/i.test(text), false);

  assert.match(describeFreshness({ kind: 'absent' }), /no export timestamp/);
  assert.match(describeFreshness({ kind: 'unparsable' }), /could not be read/);
  assert.match(describeFreshness(assessFeedFreshness(EXPORTED, at(-HOUR))), /future/);
});
