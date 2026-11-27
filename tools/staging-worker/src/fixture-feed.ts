/*
 * A SYNTHETIC FEED, SERVED OVER REAL HTTPS.
 *
 * WHY THIS EXISTS. The `fixture` transport reads a local file and is refused
 * unless the caller passes `allowFixtures` — correctly, because a fixture must
 * never retrieve in production. So a scheduled cycle pointed at a fixture
 * source proves only that the cron fired.
 *
 * Serving the same synthetic bytes over https instead means the scheduled
 * cycle exercises the REAL path: conditional requests, the SSRF guard, the
 * size limits, the ZIP reader, the freshness guard, reconciliation and
 * publication. Nothing about the pipeline is stubbed; only the provider is.
 *
 * EVERY PRODUCT IS NAMED A FIXTURE and every merchant id starts with
 * `fixture-`, so a row that escaped into a real catalogue would be obvious
 * rather than plausible. These are not plausible products, on purpose.
 *
 * THE BYTES ARE STABLE WITHIN AN HOUR. `LAST_UPDATED` is the current hour, so
 * two cycles in one hour send identical bytes — which is what makes the
 * unchanged-feed path real rather than simulated — and the next hour produces
 * a feed that is genuinely newer.
 */
import { deflateRawSync } from 'node:zlib';

const HEADERS = [
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

const CATEGORIES = [
  'Home > Drinkware',
  'Home > Kitchen > Cookware',
  'Audio > Headphones',
  'Office > Desk Accessories',
];
const NOUNS = ['Travel Mug', 'Saucepan', 'Headphones', 'Desk Mat'];

export interface FixtureMerchant {
  readonly id: string;
  readonly prefix: string;
  readonly brand: string;
  readonly count: number;
  readonly basePriceMinor: number;
}

export const FIXTURE_MERCHANTS: Record<string, FixtureMerchant> = {
  northwind: {
    id: 'fixture-northwind',
    prefix: 'NW',
    brand: 'Northwind Trading',
    count: 9,
    basePriceMinor: 1599,
  },
  contoso: {
    id: 'fixture-contoso',
    prefix: 'CT',
    brand: 'Contoso Supply',
    count: 6,
    basePriceMinor: 2299,
  },
};

/** GTIN-12 with a correct check digit, so the guard rejects nothing by accident. */
function gtin12(body11: string): string {
  const digits = [...body11].map(Number).reverse();
  const sum = digits.reduce((total, digit, index) => total + digit * (index % 2 === 0 ? 3 : 1), 0);
  return body11 + String((10 - (sum % 10)) % 10);
}

function money(minor: number): string {
  return `${(minor / 100).toFixed(2)} USD`;
}

/** The current hour as an ISO instant. See the header: stability is the point. */
export function feedStamp(now: Date): string {
  const hour = new Date(now);
  hour.setUTCMinutes(0, 0, 0);
  return hour.toISOString();
}

/**
 * `cycle` shifts every price by a fixed amount.
 *
 * A real provider republishes its feed with new prices; this is how that is
 * simulated without waiting for one. It is a query parameter on the source
 * URL rather than a code change, so demonstrating a price update does not
 * require deploying anything — which is the claim being demonstrated.
 */
export function buildFixtureFeed(merchant: FixtureMerchant, now: Date, cycle = 0): string {
  const stamp = feedStamp(now);
  const lines = [HEADERS.join('\t')];

  for (let i = 1; i <= merchant.count; i += 1) {
    const category = (i - 1) % CATEGORIES.length;
    const row: Record<string, string> = {
      ID: `${merchant.prefix}-${i}`,
      TITLE: `${merchant.brand} ${NOUNS[category]} ${i} (FIXTURE)`,
      DESCRIPTION: 'A fictional product. It exists only to exercise the ingestion pipeline.',
      BRAND: merchant.brand,
      GTIN: gtin12(String(10_000_000_000 + i + merchant.prefix.charCodeAt(0) * 1_000)),
      MPN: `${merchant.prefix}-MPN-${i}`,
      PRICE: money(merchant.basePriceMinor + i * 100 + cycle * 250),
      SALE_PRICE: '',
      AVAILABILITY: 'in stock',
      CONDITION: 'new',
      LINK: `https://${merchant.id}.invalid/products/${i}`,
      IMAGE_LINK: `https://${merchant.id}.invalid/img/${i}.jpg`,
      LAST_UPDATED: stamp,
      PRODUCT_TYPE: CATEGORIES[category],
      // Left EMPTY, exactly as the measured provider export leaves them.
      // Filling them would invent a delivered cost and make the staging site
      // claim totals the real pipeline cannot.
      'SHIPPING(COUNTRY:REGION:SERVICE:PRICE)': '',
      'SHIPPING(PRICE)': '',
      'SHIPPING(COUNTRY)': '',
    };
    lines.push(HEADERS.map((header) => row[header] ?? '').join('\t'));
  }

  return lines.join('\n') + '\n';
}

/**
 * Wraps the feed in a ZIP, because that is what the archive reader expects and
 * what the real provider sends. A hand-rolled writer rather than a dependency:
 * one member, stored with deflate-raw, and the CRC has to be right.
 */
export function zipOf(text: string, memberName = 'feed.txt'): Uint8Array {
  const data = new TextEncoder().encode(text);
  const name = new TextEncoder().encode(memberName);
  const body = new Uint8Array(deflateRawSync(data));
  const crc = crc32(data);

  const local = new Uint8Array(30 + name.length);
  const lv = new DataView(local.buffer);
  lv.setUint32(0, 0x04034b50, true);
  lv.setUint16(4, 20, true);
  lv.setUint16(6, 0, true);
  lv.setUint16(8, 8, true); // deflate
  lv.setUint16(10, 0, true);
  lv.setUint16(12, 0, true);
  lv.setUint32(14, crc, true);
  lv.setUint32(18, body.length, true);
  lv.setUint32(22, data.length, true);
  lv.setUint16(26, name.length, true);
  lv.setUint16(28, 0, true);
  local.set(name, 30);

  const central = new Uint8Array(46 + name.length);
  const cv = new DataView(central.buffer);
  cv.setUint32(0, 0x02014b50, true);
  cv.setUint16(4, 20, true);
  cv.setUint16(6, 20, true);
  cv.setUint16(8, 0, true);
  cv.setUint16(10, 8, true);
  cv.setUint32(16, crc, true);
  cv.setUint32(20, body.length, true);
  cv.setUint32(24, data.length, true);
  cv.setUint16(28, name.length, true);
  cv.setUint32(42, 0, true);
  central.set(name, 46);

  const end = new Uint8Array(22);
  const ev = new DataView(end.buffer);
  ev.setUint32(0, 0x06054b50, true);
  ev.setUint16(8, 1, true);
  ev.setUint16(10, 1, true);
  ev.setUint32(12, central.length, true);
  ev.setUint32(16, local.length + body.length, true);

  const out = new Uint8Array(local.length + body.length + central.length + end.length);
  let offset = 0;
  for (const part of [local, body, central, end]) {
    out.set(part, offset);
    offset += part.length;
  }
  return out;
}

const CRC_TABLE = (() => {
  const table = new Uint32Array(256);
  for (let i = 0; i < 256; i += 1) {
    let c = i;
    for (let k = 0; k < 8; k += 1) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
    table[i] = c >>> 0;
  }
  return table;
})();

function crc32(bytes: Uint8Array): number {
  let c = 0xffffffff;
  for (const byte of bytes) c = CRC_TABLE[(c ^ byte) & 0xff] ^ (c >>> 8);
  return (c ^ 0xffffffff) >>> 0;
}
