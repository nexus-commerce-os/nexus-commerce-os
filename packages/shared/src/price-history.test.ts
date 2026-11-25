import assert from 'node:assert/strict';
import { test } from 'node:test';
import { parseMoney, toDecimalString } from './money.js';
import {
  type PriceObservation,
  PriceHistoryError,
  dailyCloses,
  daysSinceLow,
  describeDrop,
  sortByTime,
  summarise,
  trailingLow,
  volatilityBasisPoints,
  withinWindow,
} from './price-history.js';

/** SYNTHETIC fixtures. No real merchant, no real price, test-only. */
const obs = (day: string, allIn: string, currency = 'USD'): PriceObservation => ({
  offerId: 'src:merchant-a:SKU-1',
  productId: 'prod-1',
  merchantId: 'merchant-a',
  sourceId: 'src',
  allInPrice: parseMoney(allIn, currency),
  basePrice: parseMoney(allIn, currency),
  shipping: null,
  availability: 'in_stock',
  freshnessTier: 'hot',
  observedAt: `2026-05-${day}T10:00:00Z`,
});

test('an empty history summarises to nothing, not to zero', () => {
  assert.equal(summarise([]), null);
  assert.equal(trailingLow([]), null);
  assert.equal(daysSinceLow([]), null);
  assert.equal(volatilityBasisPoints([]), null);
  assert.deepEqual(dailyCloses([]), []);
});

test('observations are ordered by time, however the feed delivered them', () => {
  const ordered = sortByTime([obs('03', '30.00'), obs('01', '10.00'), obs('02', '20.00')]);
  assert.deepEqual(
    ordered.map((o) => toDecimalString(o.allInPrice)),
    ['10.00', '20.00', '30.00'],
  );
});

test('a malformed timestamp is rejected rather than sorted to the epoch', () => {
  const broken = { ...obs('01', '10.00'), observedAt: 'last Tuesday' };
  assert.throws(() => sortByTime([broken]), PriceHistoryError);
});

test('the window is inclusive of both ends', () => {
  const all = [obs('01', '10.00'), obs('05', '50.00'), obs('10', '99.00')];
  const kept = withinWindow(
    all,
    new Date('2026-05-01T10:00:00Z'),
    new Date('2026-05-05T10:00:00Z'),
  );
  assert.equal(kept.length, 2);
});

test('summary reports low, high, mean, first and latest', () => {
  const s = summarise([obs('01', '100.00'), obs('02', '80.00'), obs('03', '90.00')])!;
  assert.equal(s.count, 3);
  assert.equal(toDecimalString(s.low), '80.00');
  assert.equal(toDecimalString(s.high), '100.00');
  assert.equal(toDecimalString(s.mean), '90.00');
  assert.equal(toDecimalString(s.first), '100.00');
  assert.equal(toDecimalString(s.latest), '90.00');
  assert.equal(s.latestObservedAt, '2026-05-03T10:00:00Z');
});

test('the mean is rounded half-even in minor units, not averaged as a float', () => {
  // 10.00 and 10.01 → 10.005 → half-even to 10.00 (1000 is even)
  const s = summarise([obs('01', '10.00'), obs('02', '10.01')])!;
  assert.equal(toDecimalString(s.mean), '10.00');
  // 10.01 and 10.02 → 10.015 → half-even to 10.02 (1002 is even)
  const t = summarise([obs('01', '10.01'), obs('02', '10.02')])!;
  assert.equal(toDecimalString(t.mean), '10.02');
});

test('a mixed-currency history is refused, because a cross-currency low is not a low', () => {
  assert.throws(
    () => summarise([obs('01', '10.00', 'USD'), obs('02', '10.00', 'EUR')]),
    /Mixed currencies/,
  );
});

test('a drop is measured from the highest price actually observed', () => {
  const history = [obs('01', '400.00'), obs('02', '350.00'), obs('03', '299.00')];
  const drop = describeDrop(history, {
    from: new Date('2026-05-01T00:00:00Z'),
    to: new Date('2026-05-31T00:00:00Z'),
  })!;
  assert.equal(drop.isDrop, true);
  assert.equal(toDecimalString(drop.from), '400.00');
  assert.equal(toDecimalString(drop.to), '299.00');
  assert.equal(toDecimalString(drop.saving), '101.00');
  assert.equal(drop.savingBasisPoints, 2525); // 25.25%
  assert.equal(drop.highObservedAt, '2026-05-01T10:00:00Z');
});

test('a price that never fell is reported as no drop, not as a smaller drop', () => {
  const rising = describeDrop([obs('01', '100.00'), obs('02', '120.00')], {
    from: new Date('2026-05-01T00:00:00Z'),
    to: new Date('2026-05-31T00:00:00Z'),
  })!;
  assert.equal(rising.isDrop, false);
  assert.equal(rising.savingBasisPoints, 0);
  assert.equal(toDecimalString(rising.saving), '0.00');
});

test('one observation cannot support a drop claim at all', () => {
  const single = describeDrop([obs('01', '299.00')], {
    from: new Date('2026-05-01T00:00:00Z'),
    to: new Date('2026-05-31T00:00:00Z'),
  });
  assert.equal(single, null, 'with no prior reading there is nothing to compare against');
});

test('a drop outside the window is not borrowed into it', () => {
  const history = [obs('01', '400.00'), obs('20', '299.00')];
  const narrow = describeDrop(history, {
    from: new Date('2026-05-15T00:00:00Z'),
    to: new Date('2026-05-31T00:00:00Z'),
  });
  assert.equal(narrow, null, 'only one observation falls inside the window');
});

test('the trailing low is the cheapest reading and the date it happened', () => {
  const low = trailingLow([obs('01', '100.00'), obs('02', '79.99'), obs('03', '85.00')])!;
  assert.equal(toDecimalString(low.price), '79.99');
  assert.equal(low.observedAt, '2026-05-02T10:00:00Z');
  assert.equal(daysSinceLow([obs('02', '79.99')], new Date('2026-05-12T10:00:00Z')), 10);
});

test('volatility is integer basis points of the mean', () => {
  // Flat history: no movement at all.
  assert.equal(volatilityBasisPoints([obs('01', '100.00'), obs('02', '100.00')]), 0);
  // 90 / 110 around a mean of 100 → mean absolute deviation 10 → 1000 bp.
  assert.equal(volatilityBasisPoints([obs('01', '90.00'), obs('02', '110.00')]), 1000);
});

test('daily closes keep the last reading of each day and invent nothing for the gaps', () => {
  const history = [
    { ...obs('01', '100.00'), observedAt: '2026-05-01T08:00:00Z' },
    { ...obs('01', '95.00'), observedAt: '2026-05-01T20:00:00Z' },
    // nothing at all on 2 May
    { ...obs('03', '90.00'), observedAt: '2026-05-03T09:00:00Z' },
  ];
  const closes = dailyCloses(history);
  assert.deepEqual(
    closes.map((c) => [c.date, toDecimalString(c.price)]),
    [
      ['2026-05-01', '95.00'],
      ['2026-05-03', '90.00'],
    ],
  );
  assert.ok(
    !closes.some((c) => c.date === '2026-05-02'),
    'a day nobody observed must not acquire a price',
  );
});
