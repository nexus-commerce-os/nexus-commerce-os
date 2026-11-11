/*
 * Synthetic Shopping-format feeds for the catalog tests.
 *
 * EVERY PRODUCT HERE IS INVENTED. No Soundcore record, title, price, GTIN or
 * link appears in this repository — the real export is provider content under
 * the CJ terms, and this is a public repository. What IS copied from the real
 * file is its SCHEMA: the column names, their odd `SHIPPING(...)` spellings,
 * and the "79.99 USD" money format. A fixture that used tidier column names
 * than the provider actually sends would test a feed nobody receives.
 *
 * Column names and formats were measured on the 29 Oct 2026 export and are
 * documented in provider-access/research/SOUNDCORE-FEED-MEASUREMENT.md.
 */

import { deflateRawSync } from 'node:zlib';

/** The subset of the real 87-column header that the adapter maps. */
export const HEADERS = [
  'ID',
  'TITLE',
  'DESCRIPTION',
  'BRAND',
  'GTIN',
  'MPN',
  'PRICE',
  'SALE_PRICE',
  'AVAILABILITY',
  'CONDITION',
  'LINK',
  'IMAGE_LINK',
  'LAST_UPDATED',
  'PRODUCT_TYPE',
  'SHIPPING(COUNTRY:REGION:SERVICE:PRICE)',
  'SHIPPING(PRICE)',
  'SHIPPING(COUNTRY)',
];

const FIELD_BY_HEADER = {
  ID: 'id',
  TITLE: 'title',
  DESCRIPTION: 'description',
  BRAND: 'brand',
  GTIN: 'gtin',
  MPN: 'mpn',
  PRICE: 'price',
  SALE_PRICE: 'salePrice',
  AVAILABILITY: 'availability',
  CONDITION: 'condition',
  LINK: 'link',
  IMAGE_LINK: 'imageLink',
  LAST_UPDATED: 'lastUpdated',
  PRODUCT_TYPE: 'productType',
  'SHIPPING(COUNTRY:REGION:SERVICE:PRICE)': 'shippingPacked',
  'SHIPPING(PRICE)': 'shippingPrice',
  'SHIPPING(COUNTRY)': 'shippingCountry',
};

/**
 * Append the GTIN-12 check digit to an 11-digit body, so fixtures carry
 * structurally valid identifiers rather than numbers the guard would reject
 * for the wrong reason.
 */
export function gtin12(body11) {
  const digits = [...body11].map(Number);
  const sum = digits
    .reverse()
    .reduce((total, digit, index) => total + digit * (index % 2 === 0 ? 3 : 1), 0);
  return body11 + String((10 - (sum % 10)) % 10);
}

/** A complete, valid synthetic row. Override any field per test. */
export function product(overrides = {}) {
  return {
    id: 'NW-1001',
    title: 'Northwind Trading Travel Mug',
    description: 'A fictional product used only to exercise the parser.',
    brand: 'Northwind Trading',
    gtin: gtin12('01234567890'),
    mpn: 'NWTM-1',
    price: '24.99 USD',
    salePrice: '19.99 USD',
    availability: 'in stock',
    condition: 'new',
    link: 'https://example.invalid/products/travel-mug',
    imageLink: 'https://cdn.example.invalid/img/travel-mug.jpg',
    lastUpdated: '2026-10-29T04:35:12.000-07:00',
    productType: 'Home > Drinkware',
    shippingPacked: '',
    shippingPrice: '',
    shippingCountry: '',
    ...overrides,
  };
}

/**
 * Render rows as a tab-delimited feed.
 *
 * `options.headers` replaces the header line (for schema-change tests) and
 * `options.extraLines` appends raw text verbatim (for malformed-input tests).
 */
export function buildFeed(rows, options = {}) {
  const headers = options.headers ?? HEADERS;
  const lines = [headers.join('\t')];
  for (const row of rows) {
    lines.push(headers.map((h) => String(row[FIELD_BY_HEADER[h]] ?? '')).join('\t'));
  }
  for (const extra of options.extraLines ?? []) lines.push(extra);
  return lines.join(options.newline ?? '\n') + (options.trailingNewline === false ? '' : '\n');
}

/** The source descriptor the guard is given in tests. */
export function source(overrides = {}) {
  return {
    merchantId: 'northwind',
    sourceFeed: 'test:shopping:0000000',
    feedSnapshotAt: '2026-10-29T11:35:12.000Z',
    now: new Date('2026-10-29T12:00:00.000Z'),
    ...overrides,
  };
}

/**
 * Wraps feed text in a ZIP, so a test drives the real entry point rather than
 * reaching past the archive reader. Shared because two suites need it and a
 * second hand-rolled ZIP writer is a second place for the CRC to be wrong.
 */
export function zipOf(text) {
  const data = Buffer.from(text, 'utf8');
  const name = Buffer.from('feed.txt', 'utf8');
  const body = deflateRawSync(data);
  const crc = crc32(data);

  const local = Buffer.alloc(30);
  local.writeUInt32LE(0x04034b50, 0);
  local.writeUInt16LE(8, 8);
  local.writeUInt32LE(crc, 14);
  local.writeUInt32LE(body.length, 18);
  local.writeUInt32LE(data.length, 22);
  local.writeUInt16LE(name.length, 26);

  const central = Buffer.alloc(46);
  central.writeUInt32LE(0x02014b50, 0);
  central.writeUInt16LE(8, 10);
  central.writeUInt32LE(crc, 16);
  central.writeUInt32LE(body.length, 20);
  central.writeUInt32LE(data.length, 24);
  central.writeUInt16LE(name.length, 28);
  central.writeUInt32LE(0, 42);

  const localPart = Buffer.concat([local, name, body]);
  const centralPart = Buffer.concat([central, name]);
  const eocd = Buffer.alloc(22);
  eocd.writeUInt32LE(0x06054b50, 0);
  eocd.writeUInt16LE(1, 8);
  eocd.writeUInt16LE(1, 10);
  eocd.writeUInt32LE(centralPart.length, 12);
  eocd.writeUInt32LE(localPart.length, 16);
  return Buffer.concat([localPart, centralPart, eocd]);
}

const CRC_TABLE = (() => {
  const t = new Int32Array(256);
  for (let n = 0; n < 256; n += 1) {
    let c = n;
    for (let k = 0; k < 8; k += 1) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
    t[n] = c;
  }
  return t;
})();
function crc32(buf) {
  let c = -1;
  for (let i = 0; i < buf.length; i += 1) c = (c >>> 8) ^ CRC_TABLE[(c ^ buf[i]) & 0xff];
  return (c ^ -1) >>> 0;
}
