/*
 * CJ'S PUBLISHER PRODUCT FEED, OVER HTTPS, WITHOUT THE EMAIL.
 *
 * The recurring Soundcore subscription arrives as a ZIP attached to an email
 * from datatransfer@cj.com. Ingesting that would mean building a mail
 * integration — a mailbox credential or an OAuth refresh token to hold,
 * sender and DKIM checks to get right, and an attachment from the public
 * internet to open. CJ documents a publisher-facing alternative that needs
 * none of it:
 *
 *   https://ads.api.cj.com/query — "This feature allows publishers to query
 *   the product feed once and receive the products from that feed as a
 *   streaming HTTP response."
 *
 * Authentication is one header, `Authorization: Bearer <personal access
 * token>`, which is a Worker secret like any other feed credential. There is
 * no mailbox, no attachment, and therefore no attachment to validate.
 *
 * WHAT THIS FILE DOES NOT DO, deliberately: it does not parse products, build
 * identities, reconcile offers or decide publication. It produces the SAME
 * tab-separated bytes the emailed ZIP contains, and hands them to the
 * retrieval result that `importFeedArchive` already consumes. That parser was
 * measured against seven real provider exports; replacing it with a second
 * JSON path for the same data would mean the code that reads CJ's products is
 * no longer the code that was measured.
 *
 * So the whole downstream pipeline — quarantine, GTIN identity, content-hash
 * deduplication, reconciliation, price history, eligibility, publication —
 * runs unchanged, and this is a transport.
 */
import { createHash } from 'node:crypto';

import type { FeedValidators, RetrievalOutcome } from './retrieve';

/** The documented endpoint. Not configurable: a different host is a different API. */
export const CJ_QUERY_URL = 'https://ads.api.cj.com/query';

/** Documented: "Call limit: 500 calls per 5 minutes." Two calls per cycle is not near it. */
export const CJ_CALL_BUDGET_PER_5_MIN = 500;

/**
 * What a `catalog_feed_source` row carries in `auth_detail` for this transport.
 *
 * Identifiers only. The personal access token is named by `credential_ref`
 * and resolved at fetch time, exactly as for every other source — a config
 * row is copied into tickets, backups and dashboards, so a token in one has
 * leaked.
 */
export interface CjFeedConfig {
  /** Discriminates this transport from any other `api` source. */
  readonly provider: 'cj';
  /** The PUBLISHER's CJ company id (CID). Required by every query. */
  readonly companyId: string;
  /** The feed's ad id, from `productFeeds { resultList { adId } }`. */
  readonly adId: string;
  /** The advertiser's CID, used to narrow the summary query. */
  readonly advertiserId?: string;
  /**
   * The promotional property id used to mint tracking links.
   *
   * OPTIONAL, AND THE CHOICE MATTERS. With a pid, `linkCode` is requested and
   * its `clickUrl` becomes the LINK column — the same value the emailed feed
   * carries. Without one, the product's own `link` is used and no tracking
   * link is ingested at all, which is the right setting while a merchant
   * relationship is unconfirmed: the publication rules already refuse to
   * publish an unapproved merchant, and not fetching the link is one fewer
   * thing that could be published by mistake.
   */
  readonly pid?: string;
}

export class CjConfigError extends Error {}

/** Reads and CHECKS the config. A half-filled row must fail here, not at the API. */
export function parseCjFeedConfig(authDetail: string | null | undefined): CjFeedConfig {
  if (authDetail === null || authDetail === undefined || authDetail.trim() === '') {
    throw new CjConfigError('this source has no auth_detail, so there is no companyId or adId');
  }
  let raw: unknown;
  try {
    raw = JSON.parse(authDetail);
  } catch {
    throw new CjConfigError('auth_detail is not JSON');
  }
  if (typeof raw !== 'object' || raw === null) {
    throw new CjConfigError('auth_detail is not an object');
  }
  const record = raw as Record<string, unknown>;
  if (record.provider !== 'cj') {
    throw new CjConfigError(`auth_detail.provider is ${String(record.provider)}, not "cj"`);
  }
  const text = (key: string, required: boolean): string | undefined => {
    const value = record[key];
    if (value === undefined || value === null || value === '') {
      if (required) throw new CjConfigError(`auth_detail.${key} is required`);
      return undefined;
    }
    if (typeof value !== 'string' && typeof value !== 'number') {
      throw new CjConfigError(`auth_detail.${key} must be a string`);
    }
    return String(value);
  };
  return {
    provider: 'cj',
    companyId: text('companyId', true) as string,
    adId: text('adId', true) as string,
    advertiserId: text('advertiserId', false),
    pid: text('pid', false),
  };
}

/* ────────────────────────────── the queries ────────────────────────────── */

/**
 * The summary query, which is how a cycle avoids transferring an unchanged feed.
 *
 * `lastUpdated` is the conditional request this API does not otherwise have:
 * no ETag, no Last-Modified, no 304. Comparing it against the validator kept
 * from the previous run costs ONE small call and skips the whole catalogue
 * transfer when nothing has been published since.
 */
export function feedSummaryQuery(config: CjFeedConfig): string {
  const partners =
    config.advertiserId === undefined
      ? ''
      : `, partnerIds: ["${escapeGraphql(config.advertiserId)}"]`;
  return `{ productFeeds(companyId: "${escapeGraphql(config.companyId)}"${partners}) { totalCount count resultList { adId feedName advertiserId advertiserName productCount advertiserCountry currency language lastUpdated sourceFeedType } } }`;
}

/**
 * The catalogue query — the documented way to take a whole feed in one request.
 *
 * The field list is the intersection of what CJ's `Shopping` type offers and
 * what the tab-separated feed carries, because the output of this module has
 * to be readable by the existing parser. Asking for fields nothing downstream
 * reads would be bytes over the wire for no purpose.
 */
export function catalogQuery(config: CjFeedConfig): string {
  const linkCode =
    config.pid === undefined ? '' : ` linkCode(pid: "${escapeGraphql(config.pid)}") { clickUrl }`;
  return `subscription { shoppingProductCatalog(companyId: "${escapeGraphql(
    config.companyId,
  )}", adId: "${escapeGraphql(config.adId)}") { id title description brand gtin mpn availability condition link imageLink lastUpdated productType targetCountry serviceableAreas isDeleted price { amount currency } salePrice { amount currency } shipping { country region service price { amount currency } }${linkCode} } }`;
}

/**
 * GraphQL strings are double-quoted, so a quote or backslash in an identifier
 * would end the string early. These values are account identifiers and should
 * never contain either — which is exactly why a value that does must be
 * refused rather than escaped into a query that then means something else.
 */
function escapeGraphql(value: string): string {
  if (/["\\\n\r]/.test(value)) {
    throw new CjConfigError(`"${value}" contains a character an identifier may not contain`);
  }
  return value;
}

/* ───────────────────────────── the rendering ───────────────────────────── */

/**
 * The column order of the emailed export, reproduced exactly.
 *
 * `parseShoppingFeed` matches on header NAME, not position, so the order is
 * not load-bearing — but a file that reads the same as the one CJ sends is a
 * file a human can diff against the one CJ sends, and that is worth keeping.
 */
export const FEED_HEADERS = [
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
] as const;

interface CjAmount {
  readonly amount?: string | number | null;
  readonly currency?: string | null;
}

export interface CjProduct {
  readonly id?: string | null;
  readonly title?: string | null;
  readonly description?: string | null;
  readonly brand?: string | null;
  readonly gtin?: string | null;
  readonly mpn?: string | null;
  readonly availability?: string | null;
  readonly condition?: string | null;
  readonly link?: string | null;
  readonly imageLink?: string | null;
  readonly lastUpdated?: string | null;
  readonly productType?: readonly string[] | string | null;
  readonly targetCountry?: string | null;
  readonly isDeleted?: boolean | null;
  readonly price?: CjAmount | null;
  readonly salePrice?: CjAmount | null;
  readonly shipping?: {
    readonly country?: string | null;
    readonly region?: string | null;
    readonly service?: string | null;
    readonly price?: CjAmount | null;
  } | null;
  readonly linkCode?: { readonly clickUrl?: string | null } | null;
}

/** `{amount, currency}` back to the `"24.99 USD"` the feed spells. */
function money(value: CjAmount | null | undefined): string {
  if (value === null || value === undefined) return '';
  const amount = value.amount;
  if (amount === null || amount === undefined || amount === '') return '';
  const currency = (value.currency ?? '').trim();
  return currency === '' ? String(amount) : `${String(amount)} ${currency}`;
}

/**
 * A tab-separated field.
 *
 * Quoted ONLY when it has to be, and the parser's own rule is the one
 * followed: a field containing a tab, a newline or a quote is wrapped and its
 * quotes are doubled. A product description with a tab in it would otherwise
 * silently become two columns and the whole row would be quarantined as a
 * column-count mismatch — the kind of corruption that looks like a provider
 * problem and is not.
 */
function field(value: string): string {
  if (!/["\t\r\n]/.test(value)) return value;
  return `"${value.replace(/"/g, '""')}"`;
}

export interface RenderOptions {
  /*
   * WHEN THIS EXPORT WAS GENERATED, which is NOT when each product last
   * changed — and the difference is the whole reason this option exists.
   *
   * The feed's LAST_UPDATED column dates the EXPORT RUN. `assessFeedFreshness`
   * reads it that way: it refuses a file whose row timestamps span too wide a
   * window, because a spread means the column is dating products rather than
   * the generation, and the guard can then no longer tell a fresh export from
   * a year-old one.
   *
   * CJ's API field of the same name means the other thing. Measured on the
   * real Soundcore feed: 203 distinct values across 219 rows, spanning
   * 2025-09-02 to 2026-11-27 — 450 days. Rendering those into LAST_UPDATED
   * made a perfectly current export read as stale, and the import was
   * correctly refused with `skipped_stale`.
   *
   * So every row is stamped with the feed's own `lastUpdated` from the summary
   * query, which is exactly "when CJ last generated this feed" — the same
   * meaning the emailed export's column carries. Nothing is invented: it is a
   * value CJ reported about this file.
   */
  readonly exportedAt?: string;
}

/** Renders the API's products as the tab-separated export the parser reads. */
export function renderShoppingFeed(
  products: readonly CjProduct[],
  options: RenderOptions = {},
): string {
  const lines = [FEED_HEADERS.join('\t')];
  for (const product of products) {
    /*
     * A DELETED PRODUCT IS NOT A PRODUCT. `includeDeletedProducts` is left
     * unset so CJ should not send any, but the field exists and a row that
     * carries it must not be imported as live: reconciliation retires what is
     * absent from a feed, which is the correct handling for a deletion.
     */
    if (product.isDeleted === true) continue;

    const productType = Array.isArray(product.productType)
      ? product.productType.join(' > ')
      : (product.productType ?? '');
    const shipping = product.shipping ?? null;
    const shippingPrice = money(shipping?.price);
    const packed =
      shipping === null
        ? ''
        : [
            shipping.country ?? '',
            shipping.region ?? '',
            shipping.service ?? '',
            shippingPrice,
          ].join(':');

    lines.push(
      [
        product.id ?? '',
        product.title ?? '',
        product.description ?? '',
        product.brand ?? '',
        product.gtin ?? '',
        product.mpn ?? '',
        money(product.price),
        money(product.salePrice),
        product.availability ?? '',
        product.condition ?? '',
        // The tracking link when a pid was configured, the landing page
        // otherwise. Never both, and never a link this module invented.
        product.linkCode?.clickUrl ?? product.link ?? '',
        product.imageLink ?? '',
        options.exportedAt ?? product.lastUpdated ?? '',
        productType,
        packed === ':::' ? '' : packed,
        shippingPrice,
        shipping?.country ?? '',
      ]
        .map((value) => field(String(value)))
        .join('\t'),
    );
  }
  return `${lines.join('\n')}\n`;
}

/* ───────────────────────────── the retrieval ───────────────────────────── */

export interface CjRetrieveOptions {
  /** The resolved personal access token. Never read from the config row. */
  readonly token: string;
  readonly previous?: FeedValidators;
  readonly now?: () => Date;
  readonly fetchImpl?: typeof fetch;
  readonly timeoutMs?: number;
  /** Refuses a response larger than this, as the HTTP transport does. */
  readonly maxBytes?: number;
}

const DEFAULT_TIMEOUT_MS = 120_000;
const DEFAULT_MAX_BYTES = 256 * 1024 * 1024;

interface GraphqlError {
  readonly message?: string;
}

/**
 * One cycle's retrieval: ask whether the feed moved, and only then take it.
 *
 * A FAILURE IS A FAILURE, never an empty feed. Every path that cannot produce
 * the catalogue returns `failed`, because the importer retires products that
 * a feed stops listing and a transport that reported "zero products" on a bad
 * token would empty the catalogue on the next publication.
 */
export async function retrieveCjFeed(
  config: CjFeedConfig,
  options: CjRetrieveOptions,
): Promise<RetrievalOutcome> {
  const now = options.now ?? (() => new Date());
  const doFetch = options.fetchImpl ?? fetch;
  const at = () => now().toISOString();

  if (options.token.trim() === '') {
    return {
      status: 'failed',
      reason: 'no personal access token was resolved for this source',
      retryable: false,
      fetchedAt: at(),
      attempts: 0,
    };
  }

  const post = async (query: string): Promise<Response> => {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), options.timeoutMs ?? DEFAULT_TIMEOUT_MS);
    try {
      return await doFetch(CJ_QUERY_URL, {
        method: 'POST',
        headers: {
          // The token, and nothing that identifies the operator.
          authorization: `Bearer ${options.token}`,
          'content-type': 'application/json',
          accept: 'application/json',
        },
        body: JSON.stringify({ query }),
        signal: controller.signal,
        redirect: 'error',
      });
    } finally {
      clearTimeout(timer);
    }
  };

  // ── 1. has it moved? ──
  let summary: Response;
  try {
    summary = await post(feedSummaryQuery(config));
  } catch (error) {
    return {
      status: 'failed',
      reason: `the feed summary request failed: ${message(error)}`,
      retryable: true,
      fetchedAt: at(),
      attempts: 1,
    };
  }
  if (!summary.ok) {
    return {
      status: 'failed',
      // The status, never the body: a GraphQL error body can echo the query,
      // and the query carries account identifiers.
      reason: `CJ answered ${summary.status} to the feed summary`,
      retryable: summary.status >= 500 || summary.status === 429,
      fetchedAt: at(),
      attempts: 1,
    };
  }

  const summaryBody = (await summary.json()) as {
    data?: { productFeeds?: { resultList?: readonly Record<string, unknown>[] } };
    errors?: readonly GraphqlError[];
  };
  if (summaryBody.errors !== undefined && summaryBody.errors.length > 0) {
    return {
      status: 'failed',
      reason: `CJ refused the feed summary: ${summaryBody.errors[0]?.message ?? 'no message'}`,
      retryable: false,
      fetchedAt: at(),
      attempts: 1,
    };
  }

  const feeds = summaryBody.data?.productFeeds?.resultList ?? [];
  const feed = feeds.find((row) => String(row.adId) === config.adId);
  if (feed === undefined) {
    /*
     * The feed this row names is not among the ones this publisher may see.
     * That is a REFUSAL and not an empty catalogue: it is what a withdrawn
     * relationship looks like from here, and retiring every product because
     * the advertiser stopped sharing the feed is precisely the behaviour the
     * importer is built to avoid.
     */
    return {
      status: 'failed',
      reason:
        `feed ${config.adId} is not in this publisher's product feed list ` +
        `(${feeds.length} feed(s) visible) — the relationship may have changed`,
      retryable: false,
      fetchedAt: at(),
      attempts: 1,
    };
  }

  const lastUpdated = feed.lastUpdated === undefined ? undefined : String(feed.lastUpdated);
  if (lastUpdated !== undefined && options.previous?.lastModified === lastUpdated) {
    return {
      status: 'unchanged',
      validators: { ...options.previous, lastModified: lastUpdated },
      fetchedAt: at(),
      attempts: 1,
    };
  }

  // ── 2. take it ──
  let catalogue: Response;
  try {
    catalogue = await post(catalogQuery(config));
  } catch (error) {
    return {
      status: 'failed',
      reason: `the catalogue request failed: ${message(error)}`,
      retryable: true,
      fetchedAt: at(),
      attempts: 2,
    };
  }
  if (!catalogue.ok) {
    return {
      status: 'failed',
      reason: `CJ answered ${catalogue.status} to the catalogue request`,
      retryable: catalogue.status >= 500 || catalogue.status === 429,
      fetchedAt: at(),
      attempts: 2,
    };
  }

  const text = await readWithLimit(catalogue, options.maxBytes ?? DEFAULT_MAX_BYTES);
  if (text === null) {
    return {
      status: 'failed',
      reason: 'the catalogue response exceeded the size limit',
      retryable: false,
      fetchedAt: at(),
      attempts: 2,
    };
  }

  let parsed: {
    data?: { shoppingProductCatalog?: readonly CjProduct[] };
    errors?: readonly GraphqlError[];
  };
  try {
    parsed = JSON.parse(text);
  } catch {
    return {
      status: 'failed',
      reason: 'the catalogue response was not JSON',
      retryable: true,
      fetchedAt: at(),
      attempts: 2,
    };
  }
  if (parsed.errors !== undefined && parsed.errors.length > 0) {
    return {
      status: 'failed',
      reason: `CJ refused the catalogue: ${parsed.errors[0]?.message ?? 'no message'}`,
      retryable: false,
      fetchedAt: at(),
      attempts: 2,
    };
  }

  const products = parsed.data?.shoppingProductCatalog;
  if (products === undefined) {
    return {
      status: 'failed',
      reason: 'the catalogue response carried no shoppingProductCatalog',
      retryable: false,
      fetchedAt: at(),
      attempts: 2,
    };
  }

  const body = Buffer.from(
    renderShoppingFeed(products, lastUpdated === undefined ? {} : { exportedAt: lastUpdated }),
    'utf8',
  );

  /*
   * THE DIGEST IGNORES THE EXPORT STAMP, and that is the point of taking it
   * separately rather than hashing `body`.
   *
   * Every row carries the feed's generation instant, so a re-export of
   * byte-identical products produces different bytes — and hashing those
   * would make the cheap "nothing changed" skip fire never. Hashing the
   * products alone asks the question actually worth asking: are these the
   * same products as last time? If they are, the cycle stops here, and the
   * stamp that would have differed never mattered.
   */
  const sha256 = createHash('sha256').update(renderShoppingFeed(products), 'utf8').digest('hex');
  const validators: FeedValidators = { lastModified: lastUpdated, sha256 };

  /*
   * The same bytes again. CJ's `lastUpdated` moves when the advertiser
   * re-imports, which is not the same as the products having changed, so this
   * second check is not redundant — it is the one that stops a nightly
   * re-import of identical data costing a publication generation.
   */
  if (options.previous?.sha256 !== undefined && options.previous.sha256 === sha256) {
    return { status: 'unchanged', validators, fetchedAt: at(), attempts: 2 };
  }

  return { status: 'fetched', body, validators, fetchedAt: at(), attempts: 2 };
}

/** Reads the body, refusing anything over the limit rather than buffering it. */
async function readWithLimit(response: Response, maxBytes: number): Promise<string | null> {
  const declared = Number(response.headers.get('content-length') ?? '0');
  if (Number.isFinite(declared) && declared > maxBytes) return null;

  const body = response.body;
  if (body === null) return '';

  const reader = body.getReader();
  const chunks: Uint8Array[] = [];
  let total = 0;
  for (;;) {
    const { done, value } = await reader.read();
    if (done) break;
    if (value === undefined) continue;
    total += value.byteLength;
    if (total > maxBytes) {
      await reader.cancel();
      return null;
    }
    chunks.push(value);
  }
  return Buffer.concat(chunks.map((chunk) => Buffer.from(chunk))).toString('utf8');
}

function message(error: unknown): string {
  return error instanceof Error ? `${error.name}: ${error.message}` : String(error);
}
