/**
 * Import and export for products and offers, as CSV and JSON.
 *
 * This is the boundary where untrusted data becomes catalogue data, so it is
 * written to be boring and strict:
 *
 *   - Every row is validated. A file of 10,000 rows with 3 bad ones imports
 *     9,997 and REPORTS the 3 with their row numbers, rather than failing the
 *     whole file or — far worse — importing all 10,000 and leaving three
 *     wrong prices in the catalogue.
 *   - Money is parsed from a decimal STRING into minor units. No floats touch
 *     a price on the way in or out, which is the whole point of ADR-0020.
 *   - Nothing is defaulted. A missing shipping column becomes an explicitly
 *     unknown cost, never zero. A missing licence makes the row unusable,
 *     because docs/06 §4 says an untagged offer MUST NOT be indexed.
 *
 * The CSV dialect is RFC 4180: comma-separated, `"` quoting, `""` for a
 * literal quote, CRLF or LF line endings. Deliberately hand-rolled rather
 * than taking a dependency: the parser is forty lines, and a dependency at
 * this boundary is a supply-chain risk for no gain.
 */

import { type Money, parseMoney, toDecimalString } from './money.js';
import {
  type Offer,
  type Availability,
  knownCost,
  offerId,
  unknownCost,
  validateOffer,
} from './offer.js';
import { type Product, validateProduct } from './product.js';
import { type FreshnessTier } from './freshness.js';
import { type AcquisitionMethod, type LicenseTag } from './license.js';
import { tryParseGtin } from './identifiers.js';

export class SerializationError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'SerializationError';
  }
}

/** One rejected row, with enough context to fix the source file. */
export interface RowRejection {
  /** 1-based line number in the source file, counting the header. */
  readonly line: number;
  readonly reason: string;
}

export interface ImportResult<T> {
  readonly accepted: readonly T[];
  readonly rejected: readonly RowRejection[];
}

/* ------------------------------------------------------------------ CSV core */

/**
 * Parses RFC 4180 CSV into rows of raw strings.
 *
 * Quoted fields may contain commas, quotes (doubled) and newlines; that last
 * one is why this cannot be `split('\n')`, which is how most hand-rolled CSV
 * readers quietly corrupt a product description.
 */
export function parseCsv(text: string): readonly (readonly string[])[] {
  const rows: string[][] = [];
  let row: string[] = [];
  let field = '';
  let quoted = false;
  let i = 0;

  const endField = () => {
    row.push(field);
    field = '';
  };
  const endRow = () => {
    endField();
    rows.push(row);
    row = [];
  };

  while (i < text.length) {
    const ch = text[i];

    if (quoted) {
      if (ch === '"') {
        if (text[i + 1] === '"') {
          field += '"';
          i += 2;
          continue;
        }
        quoted = false;
        i += 1;
        continue;
      }
      field += ch;
      i += 1;
      continue;
    }

    if (ch === '"' && field.length === 0) {
      quoted = true;
      i += 1;
      continue;
    }
    if (ch === ',') {
      endField();
      i += 1;
      continue;
    }
    if (ch === '\r') {
      i += 1;
      continue; // CRLF and lone CR both end the row at the \n or next char
    }
    if (ch === '\n') {
      endRow();
      i += 1;
      continue;
    }
    field += ch;
    i += 1;
  }

  if (quoted) throw new SerializationError('CSV ends inside a quoted field.');
  // A trailing newline must not produce a phantom empty row.
  if (field.length > 0 || row.length > 0) endRow();
  return rows;
}

/** Quotes a field only when it needs it, so diffs stay readable. */
export function csvField(value: string): string {
  return /[",\r\n]/.test(value) ? `"${value.replace(/"/g, '""')}"` : value;
}

export function toCsv(header: readonly string[], rows: readonly (readonly string[])[]): string {
  return [header, ...rows].map((r) => r.map(csvField).join(',')).join('\r\n');
}

/** Maps a header row to indices, so column ORDER in the source file is free. */
function headerIndex(header: readonly string[]): ReadonlyMap<string, number> {
  const index = new Map<string, number>();
  header.forEach((name, i) => index.set(name.trim().toLowerCase(), i));
  return index;
}

const required = (
  row: readonly string[],
  index: ReadonlyMap<string, number>,
  column: string,
): string => {
  const at = index.get(column);
  if (at === undefined) throw new SerializationError(`Missing required column "${column}".`);
  const value = (row[at] ?? '').trim();
  if (value.length === 0) throw new SerializationError(`Column "${column}" is empty.`);
  return value;
};

const optional = (
  row: readonly string[],
  index: ReadonlyMap<string, number>,
  column: string,
): string | null => {
  const at = index.get(column);
  if (at === undefined) return null;
  const value = (row[at] ?? '').trim();
  return value.length === 0 ? null : value;
};

/* -------------------------------------------------------------- Product CSV */

export const PRODUCT_CSV_HEADER = [
  'product_id',
  'gtin',
  'mpn',
  'brand',
  'canonical_title',
  'category_path',
  'variant_group_id',
  'variant_axes',
  'attributes',
] as const;

/** `capacity=256GB;colour=black` — the same spelling `variantKey` produces. */
function parseAxes(raw: string | null): readonly { axis: string; value: string }[] {
  if (!raw) return [];
  return raw
    .split(';')
    .map((pair) => pair.trim())
    .filter((pair) => pair.length > 0)
    .map((pair) => {
      const at = pair.indexOf('=');
      if (at <= 0) throw new SerializationError(`Variant axis "${pair}" is not "axis=value".`);
      return { axis: pair.slice(0, at).trim(), value: pair.slice(at + 1).trim() };
    });
}

/** `key=value;key=value`. Kept flat on purpose: a CSV cell is not a place for JSON. */
function parseAttributes(raw: string | null): Readonly<Record<string, string>> {
  const out: Record<string, string> = {};
  for (const pair of parseAxes(raw)) out[pair.axis] = pair.value;
  return out;
}

export function importProductsCsv(text: string): ImportResult<Product> {
  const rows = parseCsv(text);
  if (rows.length === 0) return { accepted: [], rejected: [] };

  const index = headerIndex(rows[0]);
  const accepted: Product[] = [];
  const rejected: RowRejection[] = [];

  for (let r = 1; r < rows.length; r += 1) {
    const line = r + 1;
    const row = rows[r];
    if (row.every((cell) => cell.trim().length === 0)) continue; // blank line

    try {
      const rawGtin = optional(row, index, 'gtin');
      const gtin = rawGtin ? tryParseGtin(rawGtin) : null;
      if (rawGtin && !gtin) {
        throw new SerializationError(`GTIN "${rawGtin}" fails its check digit.`);
      }

      const variantGroupId = optional(row, index, 'variant_group_id');
      const product: Product = {
        productId: required(row, index, 'product_id'),
        ...(gtin ? { gtin } : {}),
        ...(optional(row, index, 'mpn') ? { mpn: optional(row, index, 'mpn')! } : {}),
        brand: required(row, index, 'brand'),
        canonicalTitle: required(row, index, 'canonical_title'),
        categoryPath: required(row, index, 'category_path')
          .split('/')
          .map((s) => s.trim())
          .filter((s) => s.length > 0),
        ...(variantGroupId ? { variantGroupId } : {}),
        variantAxes: parseAxes(optional(row, index, 'variant_axes')),
        attributes: parseAttributes(optional(row, index, 'attributes')),
      };

      const validation = validateProduct(product);
      if (!validation.usable) {
        throw new SerializationError(
          validation.problems.map((p) => `${p.problem}: ${p.detail}`).join(' · '),
        );
      }
      accepted.push(product);
    } catch (error) {
      rejected.push({ line, reason: error instanceof Error ? error.message : String(error) });
    }
  }

  return { accepted, rejected };
}

export function exportProductsCsv(products: readonly Product[]): string {
  const rows = products.map((p) => [
    p.productId,
    p.gtin?.gtin14 ?? '',
    p.mpn ?? '',
    p.brand,
    p.canonicalTitle,
    p.categoryPath.join('/'),
    p.variantGroupId ?? '',
    p.variantAxes.map((a) => `${a.axis}=${a.value}`).join(';'),
    Object.entries(p.attributes)
      .map(([k, v]) => `${k}=${v}`)
      .join(';'),
  ]);
  return toCsv([...PRODUCT_CSV_HEADER], rows);
}

/* ---------------------------------------------------------------- Offer CSV */

export const OFFER_CSV_HEADER = [
  'source_id',
  'merchant_id',
  'merchant_sku',
  'product_id',
  'title',
  'currency',
  'price',
  'shipping',
  'shipping_unknown_reason',
  'tax',
  'tax_unknown_reason',
  'availability',
  'url',
  'media_refs',
  'freshness_tier',
  'price_observed_at',
  'feed_synced_at',
  'license_source',
  'license_acquired_via',
  'license_may_cache_price',
  'license_cache_ttl_max_seconds',
  'license_may_display_price',
  'license_may_display_review_text',
  'license_may_redistribute_image',
  'license_attribution_required',
  'license_geo_restrictions',
  'license_expires_at',
] as const;

const AVAILABILITIES: readonly Availability[] = ['in_stock', 'out', 'preorder', 'unknown'];
const TIERS: readonly FreshnessTier[] = ['live', 'hot', 'warm'];
const ACQUISITIONS: readonly AcquisitionMethod[] = ['api', 'licensed_feed', 'affiliate_network'];

function parseEnum<T extends string>(value: string, allowed: readonly T[], column: string): T {
  const found = allowed.find((a) => a === value);
  if (!found) {
    throw new SerializationError(
      `Column "${column}" is "${value}"; expected one of ${allowed.join(', ')}.`,
    );
  }
  return found;
}

/**
 * Strict boolean. "yes", "1" and "" are NOT accepted: a licence permission
 * read from a typo is how data gets displayed that may not be.
 */
function parseBool(value: string, column: string): boolean {
  if (value === 'true') return true;
  if (value === 'false') return false;
  throw new SerializationError(`Column "${column}" is "${value}"; expected true or false.`);
}

function parseInstant(value: string, column: string): string {
  const t = Date.parse(value);
  if (Number.isNaN(t)) {
    throw new SerializationError(`Column "${column}" is "${value}"; expected an ISO-8601 instant.`);
  }
  return new Date(t).toISOString();
}

/**
 * Imports offers, validating each against `validateOffer`.
 *
 * `now` is a parameter so a whole file is judged against one instant, and so
 * freshness rejections are reproducible in a test rather than depending on
 * when the suite happened to run.
 */
export function importOffersCsv(text: string, now: Date = new Date()): ImportResult<Offer> {
  const rows = parseCsv(text);
  if (rows.length === 0) return { accepted: [], rejected: [] };

  const index = headerIndex(rows[0]);
  const accepted: Offer[] = [];
  const rejected: RowRejection[] = [];

  for (let r = 1; r < rows.length; r += 1) {
    const line = r + 1;
    const row = rows[r];
    if (row.every((cell) => cell.trim().length === 0)) continue;

    try {
      const currency = required(row, index, 'currency');
      const sourceId = required(row, index, 'source_id');
      const merchantId = required(row, index, 'merchant_id');
      const merchantSku = required(row, index, 'merchant_sku');

      const cost = (amountColumn: string, reasonColumn: string) => {
        const amount = optional(row, index, amountColumn);
        if (amount !== null) return knownCost(parseMoney(amount, currency));
        // No amount: the row must SAY why, so an omission cannot pass as free.
        const reason = optional(row, index, reasonColumn);
        if (!reason) {
          throw new SerializationError(
            `"${amountColumn}" is empty and "${reasonColumn}" does not say why. ` +
              'An unpriced component must be declared unknown, never treated as zero.',
          );
        }
        return unknownCost(reason);
      };

      const licenseTag: LicenseTag = {
        source: required(row, index, 'license_source'),
        acquiredVia: parseEnum(
          required(row, index, 'license_acquired_via'),
          ACQUISITIONS,
          'license_acquired_via',
        ),
        mayCachePrice: parseBool(
          required(row, index, 'license_may_cache_price'),
          'license_may_cache_price',
        ),
        cacheTtlMaxSeconds: Number(required(row, index, 'license_cache_ttl_max_seconds')),
        mayDisplayPrice: parseBool(
          required(row, index, 'license_may_display_price'),
          'license_may_display_price',
        ),
        mayDisplayReviewText: parseBool(
          required(row, index, 'license_may_display_review_text'),
          'license_may_display_review_text',
        ),
        mayRedistributeImage: parseBool(
          required(row, index, 'license_may_redistribute_image'),
          'license_may_redistribute_image',
        ),
        attributionRequired: parseBool(
          required(row, index, 'license_attribution_required'),
          'license_attribution_required',
        ),
        geoRestrictions: (optional(row, index, 'license_geo_restrictions') ?? '')
          .split(';')
          .map((s) => s.trim().toUpperCase())
          .filter((s) => s.length > 0),
        expiresAt: parseInstant(required(row, index, 'license_expires_at'), 'license_expires_at'),
      };
      if (!Number.isFinite(licenseTag.cacheTtlMaxSeconds)) {
        throw new SerializationError('"license_cache_ttl_max_seconds" is not a number.');
      }

      const offer: Offer = {
        offerId: offerId(sourceId, merchantId, merchantSku),
        productId: required(row, index, 'product_id'),
        merchantId,
        sourceId,
        merchantSku,
        title: required(row, index, 'title'),
        price: parseMoney(required(row, index, 'price'), currency),
        shipping: cost('shipping', 'shipping_unknown_reason'),
        tax: cost('tax', 'tax_unknown_reason'),
        availability: parseEnum(
          required(row, index, 'availability'),
          AVAILABILITIES,
          'availability',
        ),
        url: required(row, index, 'url'),
        mediaRefs: (optional(row, index, 'media_refs') ?? '')
          .split(';')
          .map((s) => s.trim())
          .filter((s) => s.length > 0),
        freshness: {
          tier: parseEnum(required(row, index, 'freshness_tier'), TIERS, 'freshness_tier'),
          priceObservedAt: parseInstant(
            required(row, index, 'price_observed_at'),
            'price_observed_at',
          ),
          feedSyncedAt: parseInstant(required(row, index, 'feed_synced_at'), 'feed_synced_at'),
        },
        licenseTag,
      };

      const validation = validateOffer(offer, now);
      const blocking = validation.problems.filter((p) => p.problem !== 'unknown-availability');
      if (blocking.length > 0) {
        throw new SerializationError(blocking.map((p) => `${p.problem}: ${p.detail}`).join(' · '));
      }
      accepted.push(offer);
    } catch (error) {
      rejected.push({ line, reason: error instanceof Error ? error.message : String(error) });
    }
  }

  return { accepted, rejected };
}

export function exportOffersCsv(offers: readonly Offer[]): string {
  const amount = (m: Money) => toDecimalString(m);
  const rows = offers.map((o) => [
    o.sourceId,
    o.merchantId,
    o.merchantSku,
    o.productId,
    o.title,
    o.price.currency,
    amount(o.price),
    o.shipping.known ? amount(o.shipping.amount) : '',
    o.shipping.known ? '' : o.shipping.reason,
    o.tax.known ? amount(o.tax.amount) : '',
    o.tax.known ? '' : o.tax.reason,
    o.availability,
    o.url,
    o.mediaRefs.join(';'),
    o.freshness.tier,
    o.freshness.priceObservedAt,
    o.freshness.feedSyncedAt,
    o.licenseTag.source,
    o.licenseTag.acquiredVia,
    String(o.licenseTag.mayCachePrice),
    String(o.licenseTag.cacheTtlMaxSeconds),
    String(o.licenseTag.mayDisplayPrice),
    String(o.licenseTag.mayDisplayReviewText),
    String(o.licenseTag.mayRedistributeImage),
    String(o.licenseTag.attributionRequired),
    o.licenseTag.geoRestrictions.join(';'),
    o.licenseTag.expiresAt,
  ]);
  return toCsv([...OFFER_CSV_HEADER], rows);
}

/* --------------------------------------------------------------------- JSON */

/**
 * JSON import goes through the CSV row shape on purpose.
 *
 * One validation path, not two. The alternative — a separate JSON validator —
 * is how a field ends up strict in one format and lenient in the other, and
 * then an importer is chosen by whoever has the wrong file to hand.
 */
export function importOffersJson(text: string, now: Date = new Date()): ImportResult<Offer> {
  const parsed: unknown = JSON.parse(text);
  if (!Array.isArray(parsed)) {
    throw new SerializationError('Offer JSON must be an array of row objects.');
  }
  return importOffersCsv(objectsToCsv([...OFFER_CSV_HEADER], parsed), now);
}

export function importProductsJson(text: string): ImportResult<Product> {
  const parsed: unknown = JSON.parse(text);
  if (!Array.isArray(parsed)) {
    throw new SerializationError('Product JSON must be an array of row objects.');
  }
  return importProductsCsv(objectsToCsv([...PRODUCT_CSV_HEADER], parsed));
}

function objectsToCsv(header: readonly string[], objects: readonly unknown[]): string {
  const rows = objects.map((o) => {
    const record = (o ?? {}) as Record<string, unknown>;
    return header.map((column) => {
      const value = record[column];
      if (value === undefined || value === null) return '';
      if (Array.isArray(value)) return value.map(String).join(';');
      return String(value);
    });
  });
  return toCsv(header, rows);
}

/** Offers as JSON, with money as a decimal string — never as a float. */
export function exportOffersJson(offers: readonly Offer[]): string {
  const rows = parseCsv(exportOffersCsv(offers));
  return JSON.stringify(csvToObjects(rows), null, 2);
}

export function exportProductsJson(products: readonly Product[]): string {
  const rows = parseCsv(exportProductsCsv(products));
  return JSON.stringify(csvToObjects(rows), null, 2);
}

function csvToObjects(rows: readonly (readonly string[])[]): readonly Record<string, string>[] {
  if (rows.length === 0) return [];
  const header = rows[0];
  return rows.slice(1).map((row) => {
    const out: Record<string, string> = {};
    header.forEach((name, i) => {
      out[name] = row[i] ?? '';
    });
    return out;
  });
}
