import assert from 'node:assert/strict';
import { test } from 'node:test';
import {
  MoneyError,
  add,
  compare,
  currencyExponent,
  equals,
  formatMoney,
  fromJSON,
  max,
  min,
  money,
  multiply,
  parseMoney,
  percentOf,
  subtract,
  sum,
  toDecimalString,
  toJSON,
  zero,
} from './money.js';

test('the float bug this type exists to prevent', () => {
  // 0.1 + 0.2 !== 0.3 as floats. As minor units it is exact, every time.
  const a = parseMoney('0.10', 'USD');
  const b = parseMoney('0.20', 'USD');
  assert.equal(toDecimalString(add(a, b)), '0.30');
  assert.ok(equals(add(a, b), parseMoney('0.30', 'USD')));

  // And it stays exact over a long run, where float error accumulates.
  let total = zero('USD');
  for (let i = 0; i < 10_000; i++) total = add(total, parseMoney('0.01', 'USD'));
  assert.equal(toDecimalString(total), '100.00');
});

test('currencies are not all two decimal places', () => {
  assert.equal(currencyExponent('USD'), 2);
  assert.equal(currencyExponent('JPY'), 0);
  assert.equal(currencyExponent('KWD'), 3);

  assert.equal(toDecimalString(parseMoney('1200', 'JPY')), '1200');
  assert.equal(parseMoney('1200', 'JPY').minorUnits, 1200n);
  assert.equal(parseMoney('1.234', 'KWD').minorUnits, 1234n);
  assert.equal(parseMoney('19.99', 'USD').minorUnits, 1999n);
});

test('an unknown currency is refused rather than assumed to be two decimals', () => {
  assert.throws(() => money(100, 'XYZ'), MoneyError);
  assert.throws(() => parseMoney('1.00', 'XYZ'), /Unknown currency/);
});

test('arithmetic across currencies is refused, never silently converted', () => {
  const usd = parseMoney('10.00', 'USD');
  const eur = parseMoney('10.00', 'EUR');
  assert.throws(() => add(usd, eur), /Cannot add USD and EUR/);
  assert.throws(() => subtract(usd, eur), /Cannot subtract/);
  assert.throws(() => compare(usd, eur), /Cannot compare/);
  assert.equal(equals(usd, eur), false);
});

test('parsing rejects more precision than the currency has', () => {
  assert.throws(() => parseMoney('1.005', 'USD'), /has 3 decimal places but USD has 2/);
  assert.throws(() => parseMoney('1.5', 'JPY'), /JPY has 0/);
  assert.throws(() => parseMoney('not a price', 'USD'), /not a decimal amount/);
});

test('parsing accepts the shapes feeds actually send', () => {
  assert.equal(parseMoney('1,299.00', 'USD').minorUnits, 129900n);
  assert.equal(parseMoney('  19.99 ', 'USD').minorUnits, 1999n);
  assert.equal(parseMoney('-5.00', 'USD').minorUnits, -500n);
  assert.equal(parseMoney('7', 'USD').minorUnits, 700n);
});

test('a fractional minor unit is a rounding decision this type will not make', () => {
  assert.throws(() => money(10.5, 'USD'), /whole number/);
});

test('half-even rounding, because repeated half-up biases a total upward', () => {
  // 2.5 -> 2 and 3.5 -> 4 under banker's rounding.
  assert.equal(multiply(money(5, 'USD'), 1, 2n, 'half-even').minorUnits, 2n);
  assert.equal(multiply(money(7, 'USD'), 1, 2n, 'half-even').minorUnits, 4n);
  assert.equal(multiply(money(5, 'USD'), 1, 2n, 'half-up').minorUnits, 3n);
  assert.equal(multiply(money(5, 'USD'), 1, 2n, 'down').minorUnits, 2n);
});

test('negative amounts round away from zero symmetrically', () => {
  assert.equal(multiply(money(-5, 'USD'), 1, 2n, 'half-up').minorUnits, -3n);
  assert.equal(multiply(money(-5, 'USD'), 1, 2n, 'down').minorUnits, -2n);
});

test('a tax rate is a rational, not a float factor', () => {
  const price = parseMoney('19.99', 'USD');
  const vat = percentOf(price, 20);
  assert.equal(toDecimalString(vat), '4.00'); // 3.998 -> 4.00
  assert.equal(toDecimalString(add(price, vat)), '23.99');

  // 7.5% of 10.00 is exactly 0.75, with no float drift.
  assert.equal(toDecimalString(percentOf(parseMoney('10.00', 'USD'), 7.5)), '0.75');
});

test('multiplying by zero denominator is refused', () => {
  assert.throws(() => multiply(money(100, 'USD'), 1, 0n), /denominator zero/);
});

test('sum, min and max', () => {
  const prices = ['3.00', '1.50', '9.99'].map((p) => parseMoney(p, 'USD'));
  assert.equal(toDecimalString(sum(prices)), '14.49');
  assert.equal(toDecimalString(min(prices)!), '1.50');
  assert.equal(toDecimalString(max(prices)!), '9.99');
  assert.equal(min([]), null);
  assert.equal(toDecimalString(sum([], 'USD')), '0.00');
  assert.throws(() => sum([]), /without being told the currency/);
});

test('the wire form is a string, so no JSON parser can round it', () => {
  const big = money(9_007_199_254_740_993n, 'USD'); // > Number.MAX_SAFE_INTEGER
  const round = fromJSON(JSON.parse(JSON.stringify(toJSON(big))));
  assert.ok(equals(round, big), 'a large amount survived the round trip exactly');
  assert.equal(typeof toJSON(big).minorUnits, 'string');
});

test('display formatting is locale-explicit', () => {
  const p = parseMoney('1299.50', 'USD');
  const formatted = formatMoney(p, 'en-US');
  assert.match(formatted, /1,299\.50/);
  assert.match(formatted, /\$/);
  assert.equal(formatMoney(parseMoney('1200', 'JPY'), 'en-US').includes('.'), false);
});

test('money objects are frozen, so a shared amount cannot be mutated', () => {
  const m = parseMoney('1.00', 'USD');
  assert.throws(() => {
    (m as { currency: string }).currency = 'EUR';
  }, TypeError);
});
