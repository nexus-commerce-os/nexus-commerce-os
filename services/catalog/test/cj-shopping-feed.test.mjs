/*
 * The feed adapter. The emphasis is on malformed input: this parser reads
 * provider files nobody on this team controls, and the requirement is that a
 * bad file costs rows, never the process.
 */
import assert from 'node:assert/strict';
import { test } from 'node:test';

import { parseShoppingFeed } from '../dist/index.js';
import { buildFeed, HEADERS, product } from './fixtures/synthetic-feed.mjs';

test('reads the header row and maps the provider column spellings', () => {
  const parse = parseShoppingFeed(buildFeed([product()]));
  assert.equal(parse.columnCount, HEADERS.length);
  assert.deepEqual(parse.missingColumns, []);
  assert.equal(parse.rows.length, 1);
  assert.equal(parse.rows[0].rowNumber, 2);
  assert.equal(parse.rows[0].fields.price, '24.99 USD');
  assert.equal(parse.rows[0].fields.title, 'Northwind Trading Travel Mug');
});

test('a missing logical column is reported, never silently substituted', () => {
  const headers = HEADERS.filter((h) => h !== 'GTIN' && h !== 'SHIPPING(PRICE)');
  const parse = parseShoppingFeed(buildFeed([product()], { headers }));
  assert.deepEqual([...parse.missingColumns].sort(), ['gtin', 'shippingPrice']);
  assert.equal(parse.rows[0].fields.gtin, '');
});

test('column-count mismatches are quarantined, not read', () => {
  const feed = buildFeed([product()], { extraLines: ['short\trow'] });
  const parse = parseShoppingFeed(feed);
  assert.equal(parse.rows.length, 1);
  assert.deepEqual(parse.malformed, [
    { rowNumber: 3, reason: 'column-count-mismatch', columns: 2 },
  ]);
});

test('blank lines are counted separately from broken ones', () => {
  const feed = buildFeed([product()], { extraLines: ['', '   '] });
  const parse = parseShoppingFeed(feed);
  assert.equal(parse.rows.length, 1);
  assert.deepEqual(
    parse.malformed.map((m) => m.reason),
    ['blank-line', 'blank-line'],
  );
});

test('CRLF line endings and a UTF-8 BOM are handled', () => {
  const feed = '﻿' + buildFeed([product(), product({ id: 'NW-1002' })], { newline: '\r\n' });
  const parse = parseShoppingFeed(feed);
  assert.equal(parse.headers[0], 'ID');
  assert.equal(parse.rows.length, 2);
  assert.equal(parse.rows[1].fields.id, 'NW-1002');
});

test('quoted fields may contain delimiters, newlines and doubled quotes', () => {
  const header = 'ID\tTITLE\tPRICE';
  const row = '"NW-1"\t"Mug, 12"" tall\nblue"\t"24.99 USD"';
  const parse = parseShoppingFeed(`${header}\n${row}\n`);
  assert.equal(parse.rows.length, 1);
  assert.equal(parse.rows[0].fields.title, 'Mug, 12" tall\nblue');
  assert.equal(parse.rows[0].fields.price, '24.99 USD');
});

test('an unbalanced quote does not throw', () => {
  const parse = parseShoppingFeed('ID\tTITLE\nNW-1\t"never closed\n');
  assert.equal(parse.malformed.length + parse.rows.length, 1);
});

test('empty and header-only input parse to empty catalogs', () => {
  const empty = parseShoppingFeed('');
  assert.deepEqual(empty.rows, []);
  assert.equal(empty.missingColumns.length > 0, true);

  const headerOnly = parseShoppingFeed(buildFeed([]));
  assert.deepEqual(headerOnly.rows, []);
  assert.deepEqual(headerOnly.malformed, []);
});

test('binary junk is rejected row-by-row rather than crashing', () => {
  const feed = buildFeed([product()], { extraLines: ['\u0000\u0001\u0002', '�'.repeat(500)] });
  const parse = parseShoppingFeed(feed);
  assert.equal(parse.rows.length, 1);
  assert.equal(parse.malformed.length, 2);
});

test('a duplicated header column resolves to the first occurrence', () => {
  const parse = parseShoppingFeed('ID\tPRICE\tPRICE\nNW-1\t10.00 USD\t99.00 USD\n');
  assert.equal(parse.rows[0].fields.price, '10.00 USD');
});

test('header matching ignores case', () => {
  const parse = parseShoppingFeed('id\ttitle\tshipping(price)\nNW-1\tMug\t5.00\n');
  assert.equal(parse.rows[0].fields.shippingPrice, '5.00');
});

test('a non-string input is a caller bug and throws', () => {
  assert.throws(() => parseShoppingFeed(undefined), TypeError);
  assert.throws(() => parseShoppingFeed(Buffer.from('ID\n')), TypeError);
});
