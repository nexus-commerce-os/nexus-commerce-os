/*
 * Reader for the CJ "Shopping (Google Format)" product export.
 *
 * This is the ADAPTER half of the ingestion boundary (ADR-0010): it turns one
 * delimited file into rows of named strings and says what it could not read.
 * It makes no domain decisions — no Offer is constructed here, nothing is
 * accepted or rejected on business grounds. That is `catalog-guard.ts`, and
 * the split is deliberate: a parser that also judges tends to drop rows for
 * reasons nobody can audit afterwards.
 *
 * MEASURED, NOT ASSUMED. The column set comes from the real export (87 headers,
 * documented in provider-access/research/SOUNDCORE-FEED-MEASUREMENT.md). Three
 * facts from that measurement drive the code below:
 *   • prices arrive as "79.99 USD" — amount, space, ISO code;
 *   • there is no plain `shipping` column, only structured variants; and
 *   • all of those variants are empty in 227/227 records.
 * A logical field with no matching column is reported in `missingColumns`
 * rather than silently mapped to a similarly named one.
 *
 * SAFETY. Nothing here logs, and no returned value echoes a field's contents.
 * Product links in this feed are CJ tracking URLs; a parser that printed a bad
 * row would spill them into CI output, so diagnostics carry a row number and a
 * column name and nothing else.
 */

/** Logical field names this adapter knows how to find, in priority order. */
const COLUMN_CANDIDATES = {
  id: ['id', 'offer_id', 'sku'],
  gtin: ['gtin', 'upc', 'ean'],
  mpn: ['mpn'],
  brand: ['brand', 'manufacturer'],
  title: ['title', 'name'],
  description: ['description'],
  price: ['price'],
  salePrice: ['sale_price'],
  availability: ['availability'],
  condition: ['condition'],
  link: ['link', 'product_url', 'buy_url'],
  imageLink: ['image_link', 'image_url'],
  lastUpdated: ['last_updated'],
  productType: ['product_type', 'google_product_category_name', 'google_product_category'],
  // CJ splits the Google `shipping` attribute across several structured
  // columns instead of emitting a packed one, so all the shapes are tried.
  shippingPacked: [
    'shipping',
    'shipping(country:region:service:price)',
    'shipping(country:postal_code:service:price)',
    'shipping(country:location_id:service:price)',
    'shipping(country:location_group_name:service:price)',
  ],
  shippingPrice: ['shipping(price)'],
  shippingCountry: ['shipping(country)'],
} as const;

export type LogicalField = keyof typeof COLUMN_CANDIDATES;

const LOGICAL_FIELDS = Object.keys(COLUMN_CANDIDATES) as readonly LogicalField[];

export interface RawShoppingRow {
  /** 1-based line number in the file, counting the header as line 1. */
  readonly rowNumber: number;
  /** Logical field -> trimmed cell value. Absent columns read as ''. */
  readonly fields: Readonly<Record<LogicalField, string>>;
}

export type MalformedReason = 'column-count-mismatch' | 'blank-line';

export interface MalformedRow {
  readonly rowNumber: number;
  readonly reason: MalformedReason;
  /** How many columns the line actually had. No cell contents are retained. */
  readonly columns: number;
}

export interface ShoppingFeedParse {
  readonly headers: readonly string[];
  readonly columnCount: number;
  readonly rows: readonly RawShoppingRow[];
  readonly malformed: readonly MalformedRow[];
  /** Logical fields with no column in this file — a schema change, loudly. */
  readonly missingColumns: readonly LogicalField[];
}

/*
 * Quote-aware, CRLF-tolerant split of a tab-delimited file.
 *
 * Hand-written rather than pulled from a CSV library: this runs over provider
 * content, and a zero-dependency reader is a smaller attack surface than a
 * parser with its own transitive tree. The rules are the usual ones — a doubled
 * quote inside a quoted field is a literal quote, newlines inside quotes do not
 * end the record — and the function cannot throw on any input, including
 * unbalanced quotes, which simply run to end of file as one field.
 */
function splitDelimited(source: string, delimiter: string): string[][] {
  const rows: string[][] = [];
  let row: string[] = [];
  let field = '';
  let inQuotes = false;

  for (let i = 0; i < source.length; i += 1) {
    const char = source[i] as string;

    if (inQuotes) {
      if (char === '"') {
        if (source[i + 1] === '"') {
          field += '"';
          i += 1;
        } else {
          inQuotes = false;
        }
      } else {
        field += char;
      }
      continue;
    }

    if (char === '"') {
      inQuotes = true;
    } else if (char === delimiter) {
      row.push(field);
      field = '';
    } else if (char === '\n') {
      row.push(field);
      rows.push(row);
      row = [];
      field = '';
    } else if (char !== '\r') {
      field += char;
    }
  }

  if (field !== '' || row.length > 0) {
    row.push(field);
    rows.push(row);
  }
  return rows;
}

export interface ParseOptions {
  /** Field separator. The CJ export is tab-delimited; overridable for tests. */
  readonly delimiter?: string;
}

/**
 * Read a Shopping-format export. Never throws on content: a file that is
 * empty, truncated mid-quote, header-only, or missing columns entirely comes
 * back as a parse result describing exactly that.
 */
export function parseShoppingFeed(text: string, options: ParseOptions = {}): ShoppingFeedParse {
  if (typeof text !== 'string') {
    // A non-string here is a caller bug, not bad provider data.
    throw new TypeError('parseShoppingFeed expects the feed as a string');
  }
  const delimiter = options.delimiter ?? '\t';

  // A UTF-8 BOM would otherwise become part of the first header's name and
  // silently break every lookup against it.
  const body = text.charCodeAt(0) === 0xfeff ? text.slice(1) : text;
  const lines = splitDelimited(body, delimiter);

  if (lines.length === 0) {
    return {
      headers: [],
      columnCount: 0,
      rows: [],
      malformed: [],
      missingColumns: LOGICAL_FIELDS,
    };
  }

  const headers = (lines[0] as string[]).map((h) => h.trim());
  const columnCount = headers.length;

  const indexByHeader = new Map<string, number>();
  headers.forEach((header, index) => {
    const key = header.toLowerCase();
    // First occurrence wins: a duplicated header is a provider fault, and
    // preferring the later column would change meaning without warning.
    if (!indexByHeader.has(key)) indexByHeader.set(key, index);
  });

  const columnIndex = {} as Record<LogicalField, number>;
  const missingColumns: LogicalField[] = [];
  for (const field of LOGICAL_FIELDS) {
    const found = COLUMN_CANDIDATES[field].find((name) => indexByHeader.has(name));
    if (found === undefined) {
      columnIndex[field] = -1;
      missingColumns.push(field);
    } else {
      columnIndex[field] = indexByHeader.get(found) as number;
    }
  }

  const rows: RawShoppingRow[] = [];
  const malformed: MalformedRow[] = [];

  for (let i = 1; i < lines.length; i += 1) {
    const cells = lines[i] as string[];
    const rowNumber = i + 1;

    if (cells.every((c) => c.trim() === '')) {
      malformed.push({ rowNumber, reason: 'blank-line', columns: cells.length });
      continue;
    }
    if (cells.length !== columnCount) {
      // A short or long line means the quoting or escaping is wrong somewhere,
      // so every cell after the fault is suspect. Reading it anyway would
      // assign one product's price to another's title.
      malformed.push({ rowNumber, reason: 'column-count-mismatch', columns: cells.length });
      continue;
    }

    const fields = {} as Record<LogicalField, string>;
    for (const field of LOGICAL_FIELDS) {
      const index = columnIndex[field];
      fields[field] = index === -1 ? '' : (cells[index] ?? '').trim();
    }
    rows.push({ rowNumber, fields });
  }

  return { headers, columnCount, rows, malformed, missingColumns };
}

/**
 * Why mandatory fees are unknown for everything this adapter produces. Stated
 * once, here, because it is a property of the FORMAT rather than of any
 * merchant: the Shopping spec has no unavoidable-fee column at all.
 */
export const SHOPPING_FEED_NO_FEE_COLUMN =
  'Shopping (Google Format) defines no mandatory-fee column; checkout fees are unknown';
