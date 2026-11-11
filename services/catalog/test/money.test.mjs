/*
 * Money parsing. These run against the COMPILED module in dist/, so they
 * exercise exactly the artifact other packages will import.
 */
import assert from 'node:assert/strict';
import { test } from 'node:test';

import { addMoney, minMoney, minorUnitExponent, parseFeedMoney } from '../dist/index.js';

test('parses the provider money format into integer minor units', () => {
  assert.deepEqual(parseFeedMoney('79.99 USD'), {
    ok: true,
    money: { amountMinor: 7999, currency: 'USD' },
  });
  assert.deepEqual(parseFeedMoney('1299.00 USD').money, { amountMinor: 129900, currency: 'USD' });
  assert.deepEqual(parseFeedMoney('5.00 USD').money, { amountMinor: 500, currency: 'USD' });
});

test('a whole amount with no decimal part is still minor units', () => {
  assert.deepEqual(parseFeedMoney('24 USD').money, { amountMinor: 2400, currency: 'USD' });
});

test('one decimal place is padded, not truncated', () => {
  assert.deepEqual(parseFeedMoney('24.5 USD').money, { amountMinor: 2450, currency: 'USD' });
});

test('zero-decimal currencies are not multiplied by 100', () => {
  assert.equal(minorUnitExponent('JPY'), 0);
  assert.deepEqual(parseFeedMoney('1000 JPY').money, { amountMinor: 1000, currency: 'JPY' });
  assert.equal(parseFeedMoney('1000.5 JPY').ok, false);
});

test('three-decimal currencies keep all three digits', () => {
  assert.deepEqual(parseFeedMoney('1.250 KWD').money, { amountMinor: 1250, currency: 'KWD' });
});

test('amounts never pass through a float', () => {
  // The canonical IEEE-754 demonstration: 0.1 + 0.2 === 0.30000000000000004.
  const a = parseFeedMoney('0.10 USD').money;
  const b = parseFeedMoney('0.20 USD').money;
  assert.equal(addMoney(a, b).amountMinor, 30);
});

test('rejects rather than guesses', () => {
  assert.deepEqual(parseFeedMoney(''), { ok: false, reason: 'empty' });
  assert.deepEqual(parseFeedMoney('   '), { ok: false, reason: 'empty' });
  // Grouped thousands are ambiguous across locales, so they are refused.
  assert.deepEqual(parseFeedMoney('1,234.00 USD'), { ok: false, reason: 'unrecognised-format' });
  assert.deepEqual(parseFeedMoney('9.999 USD'), { ok: false, reason: 'too-many-decimal-places' });
  assert.deepEqual(parseFeedMoney('79.99'), { ok: false, reason: 'unrecognised-format' });
  assert.deepEqual(parseFeedMoney('79.99 usd'), { ok: false, reason: 'unrecognised-format' });
  assert.deepEqual(parseFeedMoney('-5.00 USD'), { ok: false, reason: 'unrecognised-format' });
  assert.deepEqual(parseFeedMoney('free USD'), { ok: false, reason: 'unrecognised-format' });
  assert.deepEqual(parseFeedMoney('1e3 USD'), { ok: false, reason: 'unrecognised-format' });
});

test('an amount beyond safe integer range is refused, not rounded', () => {
  assert.deepEqual(parseFeedMoney('99999999999999999.99 USD'), {
    ok: false,
    reason: 'out-of-safe-range',
  });
});

test('mixing currencies is a programmer error and throws', () => {
  const usd = { amountMinor: 100, currency: 'USD' };
  const eur = { amountMinor: 100, currency: 'EUR' };
  assert.throws(() => addMoney(usd, eur), TypeError);
  assert.throws(() => minMoney(usd, eur), TypeError);
});

test('minMoney picks the smaller amount', () => {
  const a = { amountMinor: 2499, currency: 'USD' };
  const b = { amountMinor: 1999, currency: 'USD' };
  assert.equal(minMoney(a, b).amountMinor, 1999);
  assert.equal(minMoney(b, a).amountMinor, 1999);
});
