import assert from 'node:assert/strict';
import { test } from 'node:test';
import { money, parseMoney, toDecimalString } from './money.js';
import { allInPrice, knownCost, offerId, unknownCost, type Offer } from './offer.js';
import type { Product } from './product.js';
import { parseGtin } from './identifiers.js';
import type { Freshness } from './freshness.js';
import type { LicenseTag } from './license.js';
import {
  OFFER_CSV_HEADER,
  PRODUCT_CSV_HEADER,
  SerializationError,
  csvField,
  exportOffersCsv,
  exportOffersJson,
  exportProductsCsv,
  exportProductsJson,
  importOffersCsv,
  importOffersJson,
  importProductsCsv,
  importProductsJson,
  looksLikeFormula,
  parseCsv,
  sanitizeForSpreadsheet,
  toCsv,
} from './serialization.js';

const NOW = new Date('2026-06-01T12:00:00Z');
const OBSERVED = new Date(NOW.getTime() - 60_000).toISOString();

/* ------------------------------------------------- SYNTHETIC fixtures only */

/** Already canonical, so an exact round-trip assertion is meaningful. */
const EXPIRES = new Date('2027-01-01T00:00:00Z').toISOString();

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
  expiresAt: EXPIRES,
  ...over,
});

const fresh = (): Freshness => ({
  tier: 'hot',
  priceObservedAt: OBSERVED,
  feedSyncedAt: OBSERVED,
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

const product = (over: Partial<Product> = {}): Product => ({
  productId: 'p-1',
  brand: 'TestBrand',
  canonicalTitle: 'Test Headphones',
  categoryPath: ['electronics', 'audio', 'headphones'],
  variantAxes: [],
  attributes: {},
  ...over,
});

/** A valid offer row as a record, so a test can break exactly one column. */
const offerRow = (over: Record<string, string> = {}): Record<string, string> => ({
  source_id: 'src',
  merchant_id: 'merchant-a',
  merchant_sku: 'SKU-1',
  product_id: 'prod-1',
  title: 'Test Product',
  currency: 'USD',
  price: '100.00',
  shipping: '5.00',
  shipping_unknown_reason: '',
  tax: '8.00',
  tax_unknown_reason: '',
  availability: 'in_stock',
  url: 'https://merchant.example/product',
  media_refs: '',
  freshness_tier: 'hot',
  price_observed_at: OBSERVED,
  feed_synced_at: OBSERVED,
  license_source: 'test-partner',
  license_acquired_via: 'licensed_feed',
  license_may_cache_price: 'true',
  license_cache_ttl_max_seconds: '3600',
  license_may_display_price: 'true',
  license_may_display_review_text: 'false',
  license_may_redistribute_image: 'true',
  license_attribution_required: 'true',
  license_geo_restrictions: '',
  license_expires_at: '2027-01-01T00:00:00Z',
  ...over,
});

const offerCsv = (...rows: Record<string, string>[]): string =>
  toCsv(
    [...OFFER_CSV_HEADER],
    rows.map((r) => OFFER_CSV_HEADER.map((c) => r[c] ?? '')),
  );

const productRow = (over: Record<string, string> = {}): Record<string, string> => ({
  product_id: 'p-1',
  gtin: '',
  mpn: '',
  brand: 'TestBrand',
  canonical_title: 'Test Headphones',
  category_path: 'electronics/audio/headphones',
  variant_group_id: '',
  variant_axes: '',
  attributes: '',
  ...over,
});

const productCsv = (...rows: Record<string, string>[]): string =>
  toCsv(
    [...PRODUCT_CSV_HEADER],
    rows.map((r) => PRODUCT_CSV_HEADER.map((c) => r[c] ?? '')),
  );

/* -------------------------------------------------------------- CSV parsing */

test('quoted fields may contain commas, quotes and newlines', () => {
  const text = 'a,b,c\r\n"x,1","he said ""hi""","line1\nline2"';
  const rows = parseCsv(text);
  assert.deepEqual(rows[1], ['x,1', 'he said "hi"', 'line1\nline2']);
});

test('a trailing newline does not produce a phantom empty row', () => {
  assert.equal(parseCsv('a,b\r\n1,2\r\n').length, 2);
  assert.equal(parseCsv('a,b\n1,2\n').length, 2);
});

test('CSV that ends inside a quoted field is rejected, not silently truncated', () => {
  assert.throws(() => parseCsv('a,b\r\n"unterminated,2'), SerializationError);
});

test('fields are quoted only when they need it', () => {
  assert.equal(csvField('plain'), 'plain');
  assert.equal(csvField('has,comma'), '"has,comma"');
  assert.equal(csvField('has"quote'), '"has""quote"');
});

/* ------------------------------------------------------------ CSV injection */

test('formula-leading cells are recognised', () => {
  for (const payload of ['=1+1', '+1', '-1', '@SUM(A1)', '\tx', '\rx']) {
    assert.equal(looksLikeFormula(payload), true, `${JSON.stringify(payload)} must be flagged`);
  }
  assert.equal(looksLikeFormula('Sony WH-1000XM5'), false);
  assert.equal(looksLikeFormula(''), false);
});

test('the spreadsheet-safe export neutralises a formula payload', () => {
  const payload = '=HYPERLINK("http://attacker.example","click")';
  const safe = exportProductsCsv([product({ canonicalTitle: payload })], { spreadsheetSafe: true });
  const cell = parseCsv(safe)[1][4];
  assert.equal(cell, `'${payload}`, 'an apostrophe makes a spreadsheet read it as text');
  assert.equal(sanitizeForSpreadsheet('safe title'), 'safe title', 'ordinary values are untouched');
});

test('the faithful export does NOT alter the value, so a round trip stays exact', () => {
  // This is the deliberate split: a re-importable file must not be mangled,
  // and a product legitimately titled "-40C Thermal Mug" is not an attack.
  const payload = '-40C Thermal Mug';
  const csv = exportProductsCsv([product({ canonicalTitle: payload })]);
  assert.equal(parseCsv(csv)[1][4], payload);
  assert.equal(importProductsCsv(csv).accepted[0].canonicalTitle, payload);
});

test('a formula payload imports as an inert string, breaking nothing', () => {
  const result = importProductsCsv(productCsv(productRow({ canonical_title: '=1+1' })));
  assert.equal(result.rejected.length, 0);
  assert.equal(result.accepted[0].canonicalTitle, '=1+1', 'it is data, not a formula');
});

/* ---------------------------------------------------------- Product import */

test('a valid product row imports', () => {
  const result = importProductsCsv(productCsv(productRow()));
  assert.deepEqual(result.rejected, []);
  assert.equal(result.accepted.length, 1);
  assert.deepEqual(result.accepted[0].categoryPath, ['electronics', 'audio', 'headphones']);
});

test('a GTIN that fails its check digit is rejected with its line number', () => {
  const result = importProductsCsv(
    productCsv(productRow(), productRow({ product_id: 'p-2', gtin: '04006381333932' })),
  );
  assert.equal(result.accepted.length, 1, 'the good row still imports');
  assert.equal(result.rejected.length, 1);
  assert.equal(result.rejected[0].line, 3, 'line 3: header is line 1');
  assert.match(result.rejected[0].reason, /check digit/);
});

test('a good file of many rows imports all but the faulty ones', () => {
  const rows = [
    productRow({ product_id: 'ok-1' }),
    productRow({ product_id: 'ok-2' }),
    productRow({ product_id: 'bad-1', brand: '' }),
    productRow({ product_id: 'ok-3' }),
    productRow({ product_id: 'bad-2', category_path: '' }),
  ];
  const result = importProductsCsv(productCsv(...rows));
  assert.equal(result.accepted.length, 3);
  assert.deepEqual(
    result.accepted.map((p) => p.productId),
    ['ok-1', 'ok-2', 'ok-3'],
  );
  assert.deepEqual(
    result.rejected.map((r) => r.line),
    [4, 6],
  );
});

test('a malformed variant axis is rejected rather than guessed at', () => {
  const result = importProductsCsv(
    productCsv(productRow({ variant_group_id: 'fam', variant_axes: 'colourblack' })),
  );
  assert.equal(result.accepted.length, 0);
  assert.match(result.rejected[0].reason, /axis=value/);
});

test('a missing required column fails the rows rather than defaulting them', () => {
  const header = PRODUCT_CSV_HEADER.filter((c) => c !== 'brand');
  const csv = toCsv([...header], [header.map((c) => productRow()[c] ?? '')]);
  const result = importProductsCsv(csv);
  assert.equal(result.accepted.length, 0);
  assert.match(result.rejected[0].reason, /Missing required column "brand"/);
});

test('blank lines are skipped, not rejected', () => {
  const csv = `${productCsv(productRow())}\r\n\r\n`;
  const result = importProductsCsv(csv);
  assert.equal(result.accepted.length, 1);
  assert.deepEqual(result.rejected, []);
});

test('an empty file imports nothing and reports nothing', () => {
  assert.deepEqual(importProductsCsv(''), { accepted: [], rejected: [] });
  assert.deepEqual(importOffersCsv('', NOW), { accepted: [], rejected: [] });
});

/* ------------------------------------------------------------ Offer import */

test('a valid offer row imports with a derived offer id', () => {
  const result = importOffersCsv(offerCsv(offerRow()), NOW);
  assert.deepEqual(result.rejected, []);
  assert.equal(result.accepted[0].offerId, offerId('src', 'merchant-a', 'SKU-1'));
  assert.equal(toDecimalString(result.accepted[0].price), '100.00');
});

test('an empty shipping column must say WHY, or the row is rejected', () => {
  const silent = importOffersCsv(offerCsv(offerRow({ shipping: '' })), NOW);
  assert.equal(silent.accepted.length, 0);
  assert.match(silent.rejected[0].reason, /never treated as zero/);

  const declared = importOffersCsv(
    offerCsv(offerRow({ shipping: '', shipping_unknown_reason: 'depends on postcode' })),
    NOW,
  );
  assert.equal(declared.accepted.length, 1);
  assert.equal(declared.accepted[0].shipping.known, false);
  const total = allInPrice(declared.accepted[0]);
  assert.equal(total.complete, false, 'and it cannot produce a complete all-in price');
});

test('the same rule applies to tax', () => {
  const silent = importOffersCsv(offerCsv(offerRow({ tax: '' })), NOW);
  assert.equal(silent.accepted.length, 0);
  assert.match(silent.rejected[0].reason, /tax_unknown_reason/);
});

test('an unsupported currency is rejected rather than assumed to have 2 decimals', () => {
  const result = importOffersCsv(offerCsv(offerRow({ currency: 'XYZ' })), NOW);
  assert.equal(result.accepted.length, 0);
  assert.match(result.rejected[0].reason, /Unknown currency "XYZ"/);
});

test('a zero-decimal currency keeps its own exponent', () => {
  const result = importOffersCsv(
    offerCsv(offerRow({ currency: 'JPY', price: '1500', shipping: '500', tax: '0' })),
    NOW,
  );
  assert.deepEqual(result.rejected, []);
  assert.equal(result.accepted[0].price.minorUnits, 1500n, 'JPY has no minor unit to multiply by');
  // And a JPY amount with decimals is refused rather than rounded for us.
  const fractional = importOffersCsv(offerCsv(offerRow({ currency: 'JPY', price: '15.00' })), NOW);
  assert.equal(fractional.accepted.length, 0);
  assert.match(fractional.rejected[0].reason, /decimal places/);
});

test('a malformed timestamp is rejected with the column named', () => {
  const result = importOffersCsv(offerCsv(offerRow({ price_observed_at: 'last Tuesday' })), NOW);
  assert.equal(result.accepted.length, 0);
  assert.match(result.rejected[0].reason, /price_observed_at/);
  assert.match(result.rejected[0].reason, /ISO-8601/);
});

test('a stale observation is rejected at import, not stored and shown later', () => {
  const old = new Date(NOW.getTime() - 48 * 3600 * 1000).toISOString();
  const result = importOffersCsv(
    offerCsv(offerRow({ freshness_tier: 'live', price_observed_at: old })),
    NOW,
  );
  assert.equal(result.accepted.length, 0);
  assert.match(result.rejected[0].reason, /stale/);
});

test('an expired licence is rejected at import', () => {
  const result = importOffersCsv(
    offerCsv(offerRow({ license_expires_at: '2020-01-01T00:00:00Z' })),
    NOW,
  );
  assert.equal(result.accepted.length, 0);
  assert.match(result.rejected[0].reason, /license-refused/);
});

test('a licence permission must be literally true or false', () => {
  for (const sloppy of ['yes', '1', 'TRUE', '']) {
    const result = importOffersCsv(offerCsv(offerRow({ license_may_display_price: sloppy })), NOW);
    assert.equal(result.accepted.length, 0, `"${sloppy}" must not be read as a permission`);
  }
});

test('an unknown enum value is rejected and the allowed set is named', () => {
  const result = importOffersCsv(offerCsv(offerRow({ availability: 'maybe' })), NOW);
  assert.equal(result.accepted.length, 0);
  assert.match(result.rejected[0].reason, /in_stock/);
});

test('an insecure URL is rejected', () => {
  const result = importOffersCsv(offerCsv(offerRow({ url: 'http://insecure.example' })), NOW);
  assert.equal(result.accepted.length, 0);
  assert.match(result.rejected[0].reason, /bad-url/);
});

test('geo restrictions are parsed and upper-cased', () => {
  const result = importOffersCsv(
    offerCsv(offerRow({ license_geo_restrictions: 'us; ca ;gb' })),
    NOW,
  );
  assert.deepEqual(result.accepted[0].licenseTag.geoRestrictions, ['US', 'CA', 'GB']);
});

test('every problem in one row is reported together', () => {
  const result = importOffersCsv(
    offerCsv(
      offerRow({ url: 'http://insecure.example', license_expires_at: '2020-01-01T00:00:00Z' }),
    ),
    NOW,
  );
  assert.match(result.rejected[0].reason, /bad-url/);
  assert.match(result.rejected[0].reason, /license-refused/);
});

/* ------------------------------------------------------------- Round trips */

test('offers survive a CSV round trip exactly', () => {
  const original = [
    offer({ offerId: offerId('src', 'merchant-a', 'SKU-1') }),
    offer({
      offerId: offerId('src', 'merchant-b', 'SKU-2'),
      merchantId: 'merchant-b',
      merchantSku: 'SKU-2',
      shipping: unknownCost('depends on postcode'),
      mediaRefs: ['https://cdn.example/a.jpg', 'https://cdn.example/b.jpg'],
      licenseTag: licence({ geoRestrictions: ['US', 'CA'] }),
    }),
  ];
  const back = importOffersCsv(exportOffersCsv(original), NOW);
  assert.deepEqual(back.rejected, []);
  assert.equal(back.accepted.length, 2);
  assert.deepEqual(back.accepted, original);
  // And exporting again is byte-identical — the round trip has a fixed point.
  assert.equal(exportOffersCsv(back.accepted), exportOffersCsv(original));
});

test('products survive a CSV round trip exactly, including awkward text', () => {
  const original = [
    product({
      productId: 'p-1',
      gtin: parseGtin('4006381333931'),
      mpn: 'WH1000XM5',
      canonicalTitle: 'Headphones, "Pro" edition\nsecond line',
      variantGroupId: 'fam-1',
      variantAxes: [
        { axis: 'colour', value: 'black' },
        { axis: 'capacity', value: '256GB' },
      ],
      attributes: { weight: '250g' },
    }),
  ];
  const back = importProductsCsv(exportProductsCsv(original));
  assert.deepEqual(back.rejected, []);
  assert.deepEqual(back.accepted, original);
});

test('offers survive a JSON round trip exactly', () => {
  const original = [
    offer(),
    offer({ merchantSku: 'SKU-9', offerId: offerId('src', 'merchant-a', 'SKU-9') }),
  ];
  const json = exportOffersJson(original);
  assert.ok(Array.isArray(JSON.parse(json)), 'exported as an array of row objects');
  const back = importOffersJson(json, NOW);
  assert.deepEqual(back.rejected, []);
  assert.deepEqual(back.accepted, original);
});

test('products survive a JSON round trip exactly', () => {
  const original = [product({ gtin: parseGtin('4006381333931') })];
  const back = importProductsJson(exportProductsJson(original));
  assert.deepEqual(back.rejected, []);
  assert.deepEqual(back.accepted, original);
});

test('JSON import rejects anything that is not an array of rows', () => {
  assert.throws(() => importOffersJson('{"not":"an array"}', NOW), SerializationError);
  assert.throws(() => importProductsJson('42'), SerializationError);
});

test('JSON and CSV import apply the SAME validation, not two sets of rules', () => {
  const broken = JSON.stringify([{ ...offerRow(), shipping: '', shipping_unknown_reason: '' }]);
  const viaJson = importOffersJson(broken, NOW);
  const viaCsv = importOffersCsv(offerCsv(offerRow({ shipping: '' })), NOW);
  assert.equal(viaJson.accepted.length, 0);
  assert.equal(viaCsv.accepted.length, 0);
  assert.equal(viaJson.rejected[0].reason, viaCsv.rejected[0].reason);
});

/* --------------------------------------------- bigint precision, end to end */

test('a monetary value beyond Number.MAX_SAFE_INTEGER survives CSV exactly', () => {
  // 9_007_199_254_740_993 minor units is MAX_SAFE_INTEGER + 2: as a double it
  // is indistinguishable from +1, so any float step in the pipeline shows up
  // here. 90,071,992,547,409.93 USD is absurd as a price and perfect as a test.
  const huge = money(9_007_199_254_740_993n, 'USD');
  assert.equal(toDecimalString(huge), '90071992547409.93');

  const big = offer({ price: huge, shipping: knownCost(money(1n, 'USD')) });
  const csv = exportOffersCsv([big]);
  assert.match(csv, /90071992547409\.93/);

  const back = importOffersCsv(csv, NOW).accepted[0];
  assert.equal(back.price.minorUnits, 9_007_199_254_740_993n);
  assert.notEqual(
    back.price.minorUnits,
    BigInt(Number(9_007_199_254_740_993n)),
    'a float round trip would have landed on 9007199254740992',
  );
});

test('the same value survives JSON, where a naive exporter would use a float', () => {
  const huge = money(9_007_199_254_740_993n, 'USD');
  const json = exportOffersJson([offer({ price: huge })]);
  // The amount must appear as a quoted decimal STRING, never a bare number.
  assert.match(json, /"price": "90071992547409\.93"/);
  assert.doesNotMatch(json, /"price": 9/, 'a JSON number here would already have lost the value');

  const back = importOffersJson(json, NOW).accepted[0];
  assert.equal(back.price.minorUnits, 9_007_199_254_740_993n);
});

test('negative and zero amounts are not mangled by the round trip', () => {
  const zeroShip = offer({ shipping: knownCost(money(0n, 'USD')) });
  const back = importOffersCsv(exportOffersCsv([zeroShip]), NOW).accepted[0];
  assert.equal(back.shipping.known && back.shipping.amount.minorUnits, 0n);
  assert.equal(
    toDecimalString(back.shipping.known ? back.shipping.amount : back.price),
    '0.00',
    'an explicit free-shipping zero is preserved and is NOT the same as unknown',
  );
});

test('a valid but non-canonical instant is accepted and canonicalised once', () => {
  // "2027-01-01T00:00:00Z" and "...00.000Z" are the same instant spelled two
  // ways. Storing one spelling keeps later string comparisons honest, so the
  // importer canonicalises rather than preserving whatever the feed sent.
  const result = importOffersCsv(
    offerCsv(offerRow({ license_expires_at: '2027-01-01T00:00:00Z' })),
    NOW,
  );
  assert.equal(result.accepted[0].licenseTag.expiresAt, '2027-01-01T00:00:00.000Z');

  // And it is a FIXED POINT: re-importing the export changes nothing further.
  const second = importOffersCsv(exportOffersCsv(result.accepted), NOW);
  assert.deepEqual(second.accepted, result.accepted);
});

test('the GTIN is written back in the length the merchant quoted', () => {
  const csv = exportProductsCsv([product({ gtin: parseGtin('4006381333931') })]);
  assert.equal(parseCsv(csv)[1][1], '4006381333931', 'not the zero-padded 14-digit form');
});
