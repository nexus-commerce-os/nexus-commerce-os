/*
 * THE PUBLIC READ PATH — the only code allowed to answer "what is published?".
 *
 * ONE PLACE, ON PURPOSE. Every query here resolves the publication pointer and
 * then filters by generation interval:
 *
 *     first_generation <= :live AND (last_generation IS NULL OR last_generation >= :live)
 *
 * Getting that wrong exposes rows that were deliberately withheld —
 * unapproved merchants, quarantined records, a half-built generation. So the
 * filter exists exactly once, in `LIVE_WINDOW` below, and every function here
 * uses it. A second copy somewhere else is the defect this file is shaped to
 * prevent, which is also why the website must call this rather than write its
 * own SQL.
 *
 * NO WRITES. Nothing in this file writes, and nothing takes a decision. It
 * reads what publication already decided.
 */
import type { D1Like } from '../store/d1/d1-client';
import { exactInteger } from '../store/d1/d1-client';
import type { Money } from '../money';

/**
 * The interval filter. Both placeholders bind the live generation.
 *
 * Written once and interpolated into every query below rather than repeated,
 * because a typo in a repetition would be a disclosure rather than a bug.
 */
const LIVE_WINDOW = 'first_generation <= ? AND (last_generation IS NULL OR last_generation >= ?)';

/** The columns the list page needs, denormalised so a listing needs no join. */
const LIST_COLUMNS =
  'product_id, slug, title, brand, category_slug, data_verified_at, from_price_minor, from_currency, offer_count';

export interface PublishedProduct {
  readonly productId: string;
  readonly slug: string;
  readonly title: string;
  readonly brand: string | null;
  readonly categorySlug: string | null;
  /** Shown to the visitor. The newest offer confirmation behind this row. */
  readonly dataVerifiedAt: string;
  /**
   * The cheapest VERIFIED delivered cost, or null.
   *
   * Null is the normal case today and must be rendered as "shipping not
   * stated" rather than as a missing price — an item price shown where a
   * delivered cost belongs is the half-truth the catalogue refuses to publish.
   */
  readonly fromPrice: Money | null;
  readonly offerCount: number;
}

export interface Page<T> {
  readonly items: readonly T[];
  /** Total matching the filters, for pagination. */
  readonly total: number;
  readonly limit: number;
  readonly offset: number;
  /** The generation these rows came from. Lets a caller detect a move. */
  readonly generation: number | null;
}

export interface ListQuery {
  readonly category?: string | null;
  readonly brand?: string | null;
  /** Free text. Matched against the denormalised search column. */
  readonly q?: string | null;
  readonly limit?: number;
  readonly offset?: number;
  readonly sort?: 'title' | 'freshest' | 'cheapest';
}

/** 48 rows is one screen of cards; 100 is the ceiling a URL may ask for. */
const DEFAULT_LIMIT = 48;
const MAX_LIMIT = 100;

export interface PublicOffer {
  readonly offerId: string;
  readonly merchantId: string;
  readonly merchantName: string | null;
  readonly merchantOfferId: string;
  readonly itemPrice: Money;
  readonly availability: string;
  readonly condition: string;
  /**
   * Where the visitor is sent.
   *
   * The merchant's own affiliate URL when the relationship is APPROVED, and
   * the plain product URL otherwise — the database CHECK makes an affiliate
   * link impossible to store for an unapproved merchant, so this cannot leak
   * one by accident.
   */
  readonly destinationUrl: string;
  readonly shippingVerified: boolean;
  readonly shippingCost: Money | null;
  readonly shippingDestination: string | null;
  readonly feesVerified: boolean;
  /** Null unless every component is verified. Never a partial sum. */
  readonly deliveredTotal: Money | null;
  readonly lastSeenAt: string;
}

export interface ProductDetail extends PublishedProduct {
  readonly offers: readonly PublicOffer[];
  readonly specifications: readonly { label: string; value: string }[];
  readonly priceHistory: readonly {
    readonly offerId: string;
    readonly observedAt: string;
    readonly listPrice: Money;
    readonly salePrice: Money | null;
  }[];
}

export class PublicCatalogue {
  constructor(private readonly db: D1Like) {}

  /** The generation the public is being served, or null if nothing is. */
  async liveGeneration(): Promise<number | null> {
    const row = await this.db
      .prepare('SELECT live_generation FROM catalog_publication_pointer WHERE id = 1')
      .first<{ live_generation: number | null }>();
    const value = row?.live_generation;
    return value === null || value === undefined ? null : exactInteger(value, 'live_generation');
  }

  async list(query: ListQuery = {}): Promise<Page<PublishedProduct>> {
    const live = await this.liveGeneration();
    const limit = clamp(query.limit);
    const offset = Math.max(0, Math.floor(query.offset ?? 0));

    // Nothing published is an EMPTY PAGE, not an error. A catalogue with no
    // authorised data in it is a legitimate state for this project.
    if (live === null) {
      return { items: [], total: 0, limit, offset, generation: null };
    }

    const where: string[] = [LIVE_WINDOW];
    const bind: unknown[] = [live, live];

    if (query.category) {
      // Prefix match, so `home` also returns `home/drinkware`. The trailing
      // separator stops `home` matching `homeware`.
      where.push('(category_slug = ? OR category_slug LIKE ?)');
      bind.push(query.category, `${escapeLike(query.category)}/%`);
    }
    if (query.brand) {
      where.push('brand = ?');
      bind.push(query.brand);
    }
    if (query.q && query.q.trim() !== '') {
      /*
       * NORMALISE FIRST, THEN DECIDE.
       *
       * The folding that built `search_text` keeps only a-z, 0-9 and spaces,
       * so a query of `%` normalises to nothing — and binding `%%` then
       * matched the ENTIRE CATALOGUE for a search the visitor typed. Escaping
       * the wildcard was not enough: normalisation had already removed the
       * character before the escape could see it.
       *
       * A query with no searchable content matches NOTHING. Treating it as
       * "no filter" is the dangerous reading, because it answers a search with
       * everything.
       */
      /*
       * EVERY TERM MUST MATCH, not the whole phrase as one substring.
       *
       * A single LIKE over the joined query means "northwind travel mug"
       * finds nothing, because the product's search text reads "northwind
       * trading travel mug 1 fixture" and those words are not contiguous.
       * Measured on staging: a reasonable query returned 0 of 5 matching
       * products. A search box that fails on a reasonable query is the
       * decorative control this project refuses to ship.
       *
       * So the query is split and each term becomes its own LIKE, ANDed
       * together. Order stops mattering and extra words in the title stop
       * hurting, which is what somebody typing a product name expects.
       *
       * Capped at eight terms: each one is another LIKE over the same column,
       * and an unbounded query would let a visitor choose how much work the
       * database does.
       */
      const terms = normaliseQuery(query.q)
        .split(' ')
        .filter((term) => term !== '');
      if (terms.length === 0) {
        return { items: [], total: 0, limit, offset, generation: live };
      }
      for (const term of terms.slice(0, 8)) {
        where.push("search_text LIKE ? ESCAPE '\\'");
        bind.push(`%${escapeLike(term)}%`);
      }
    }

    const clause = where.join(' AND ');
    const order = orderBy(query.sort);

    const counted = await this.db
      .prepare(`SELECT COUNT(*) AS n FROM catalog_published_product WHERE ${clause}`)
      .bind(...bind)
      .first<{ n: number }>();

    const rows = await this.db
      .prepare(
        `SELECT ${LIST_COLUMNS} FROM catalog_published_product
          WHERE ${clause} ORDER BY ${order} LIMIT ? OFFSET ?`,
      )
      .bind(...bind, limit, offset)
      .all<Record<string, unknown>>();

    return {
      items: rows.results.map(toPublished),
      total: exactInteger(counted?.n ?? 0, 'total'),
      limit,
      offset,
      generation: live,
    };
  }

  /** The categories that actually have published products, with counts. */
  async categories(): Promise<readonly { slug: string; name: string; count: number }[]> {
    const live = await this.liveGeneration();
    if (live === null) return [];
    const rows = await this.db
      .prepare(
        `SELECT p.category_slug AS slug, COALESCE(c.name, p.category_slug) AS name,
                COUNT(*) AS n
           FROM catalog_published_product AS p
           LEFT JOIN catalog_category AS c ON c.slug = p.category_slug
          WHERE ${LIVE_WINDOW} AND p.category_slug IS NOT NULL
          GROUP BY p.category_slug, name
          ORDER BY name`,
      )
      .bind(live, live)
      .all<Record<string, unknown>>();
    return rows.results.map((row) => ({
      slug: String(row.slug),
      name: String(row.name),
      count: exactInteger(row.n, 'count'),
    }));
  }

  /** The brands that actually have published products, with counts. */
  async brands(): Promise<readonly { brand: string; count: number }[]> {
    const live = await this.liveGeneration();
    if (live === null) return [];
    const rows = await this.db
      .prepare(
        `SELECT brand, COUNT(*) AS n FROM catalog_published_product
          WHERE ${LIVE_WINDOW} AND brand IS NOT NULL
          GROUP BY brand ORDER BY brand`,
      )
      .bind(live, live)
      .all<Record<string, unknown>>();
    return rows.results.map((row) => ({
      brand: String(row.brand),
      count: exactInteger(row.n, 'count'),
    }));
  }

  /**
   * One product by slug, with its offers.
   *
   * THE OFFER QUERY IS GATED TWICE. The product must be inside the live
   * window, and each offer must still be active and belong to an APPROVED
   * merchant — because an offer row outlives the publication that included it,
   * and a merchant whose approval was withdrawn this morning must not still
   * be linked from a page published last night.
   */
  /**
   * Has this slug EVER been published, in any generation?
   *
   * Not the same question as `bySlug`, and the difference is what makes it
   * safe to fall back to an exported page. A slug with no row at all has
   * never been through this pipeline, so an exported page for it is a
   * different catalogue, not a stale copy of a record the pipeline withheld.
   * A slug that was published and later closed DOES have a row, answers true,
   * and must keep 404ing — serving its old exported page would be publishing
   * something the eligibility rules have since refused.
   *
   * Deliberately ignores the interval filter, which is the only query here
   * that may.
   */
  async everPublished(slug: string): Promise<boolean> {
    const row = await this.db
      .prepare('SELECT 1 AS present FROM catalog_published_product WHERE slug = ? LIMIT 1')
      .bind(slug)
      .first<{ present: number }>();
    return row !== null && row !== undefined;
  }

  async bySlug(slug: string): Promise<ProductDetail | null> {
    const live = await this.liveGeneration();
    if (live === null) return null;

    const row = await this.db
      .prepare(
        `SELECT ${LIST_COLUMNS} FROM catalog_published_product
          WHERE slug = ? AND ${LIVE_WINDOW} LIMIT 1`,
      )
      .bind(slug, live, live)
      .first<Record<string, unknown>>();
    if (!row) return null;

    const productId = String(row.product_id);

    const offers = await this.db
      .prepare(
        `SELECT o.id, o.merchant_id, m.name AS merchant_name, o.merchant_offer_id,
                o.list_price_minor, o.sale_price_minor, o.currency,
                o.availability, o.condition, o.product_url,
                o.shipping_verified, o.shipping_cost_minor, o.shipping_destination,
                o.fees_verified, o.fees_total_minor, o.last_seen_at,
                m.affiliate_url, m.destination_url, m.relationship
           FROM catalog_product_offer AS po
           JOIN catalog_merchant_offer AS o ON o.id = po.offer_id
           JOIN catalog_merchant AS m ON m.id = o.merchant_id
          WHERE po.product_id = ?
            AND o.state = 'active'
            AND m.relationship = 'approved'
          ORDER BY o.merchant_id`,
      )
      .bind(productId)
      .all<Record<string, unknown>>();

    const specifications = await this.db
      .prepare(
        `SELECT label, value FROM catalog_specification
          WHERE product_id = ? ORDER BY position, label`,
      )
      .bind(productId)
      .all<Record<string, unknown>>();

    const history = await this.db
      .prepare(
        `SELECT h.offer_id, h.observed_at, h.list_price_minor, h.sale_price_minor, h.currency
           FROM catalog_offer_price_history AS h
           JOIN catalog_product_offer AS po ON po.offer_id = h.offer_id
          WHERE po.product_id = ?
          ORDER BY h.observed_at DESC
          LIMIT 50`,
      )
      .bind(productId)
      .all<Record<string, unknown>>();

    return {
      ...toPublished(row),
      offers: offers.results.map(toPublicOffer),
      specifications: specifications.results.map((spec) => ({
        label: String(spec.label),
        value: String(spec.value),
      })),
      priceHistory: history.results.map((entry) => {
        const currency = String(entry.currency);
        return {
          offerId: String(entry.offer_id),
          observedAt: String(entry.observed_at),
          listPrice: {
            amountMinor: exactInteger(entry.list_price_minor, 'list_price_minor'),
            currency,
          },
          salePrice:
            entry.sale_price_minor === null || entry.sale_price_minor === undefined
              ? null
              : {
                  amountMinor: exactInteger(entry.sale_price_minor, 'sale_price_minor'),
                  currency,
                },
        };
      }),
    };
  }

  /** Counts for a status page. Reads only the published side. */
  async summary(): Promise<{
    generation: number | null;
    products: number;
    categories: number;
    brands: number;
    newestVerifiedAt: string | null;
  }> {
    const live = await this.liveGeneration();
    if (live === null) {
      return {
        generation: null,
        products: 0,
        categories: 0,
        brands: 0,
        newestVerifiedAt: null,
      };
    }
    const row = await this.db
      .prepare(
        `SELECT COUNT(*) AS products,
                COUNT(DISTINCT category_slug) AS categories,
                COUNT(DISTINCT brand) AS brands,
                MAX(data_verified_at) AS newest
           FROM catalog_published_product WHERE ${LIVE_WINDOW}`,
      )
      .bind(live, live)
      .first<Record<string, unknown>>();
    return {
      generation: live,
      products: exactInteger(row?.products ?? 0, 'products'),
      categories: exactInteger(row?.categories ?? 0, 'categories'),
      brands: exactInteger(row?.brands ?? 0, 'brands'),
      newestVerifiedAt:
        row?.newest === null || row?.newest === undefined ? null : String(row.newest),
    };
  }
}

/* ──────────────────────────── helpers ──────────────────────────── */

function clamp(limit: number | undefined): number {
  if (limit === undefined || !Number.isFinite(limit)) return DEFAULT_LIMIT;
  return Math.min(MAX_LIMIT, Math.max(1, Math.floor(limit)));
}

function orderBy(sort: ListQuery['sort']): string {
  switch (sort) {
    case 'freshest':
      return 'data_verified_at DESC, title ASC';
    case 'cheapest':
      /*
       * NULLS LAST, explicitly. Most products have no verified delivered cost,
       * and SQLite sorts NULL first — so "cheapest" would otherwise lead with
       * every product whose price is unknown, which reads as a list of free
       * things.
       */
      return 'from_price_minor IS NULL, from_price_minor ASC, title ASC';
    case 'title':
    default:
      return 'title ASC';
  }
}

/** Escapes LIKE wildcards so a search for `50%` is not a search for anything. */
function escapeLike(value: string): string {
  return value.replace(/[\\%_]/g, (char) => `\\${char}`);
}

/** The same folding `searchText` was built with, so a query can match it. */
function normaliseQuery(value: string): string {
  return value
    .normalize('NFKD')
    .replace(/\p{M}+/gu, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, ' ')
    .trim();
}

function toPublished(row: Record<string, unknown>): PublishedProduct {
  const minor = row.from_price_minor;
  return {
    productId: String(row.product_id),
    slug: String(row.slug),
    title: String(row.title),
    brand: row.brand === null || row.brand === undefined ? null : String(row.brand),
    categorySlug:
      row.category_slug === null || row.category_slug === undefined
        ? null
        : String(row.category_slug),
    dataVerifiedAt: String(row.data_verified_at),
    fromPrice:
      minor === null || minor === undefined
        ? null
        : {
            amountMinor: exactInteger(minor, 'from_price_minor'),
            currency: String(row.from_currency),
          },
    offerCount: exactInteger(row.offer_count ?? 0, 'offer_count'),
  };
}

function toPublicOffer(row: Record<string, unknown>): PublicOffer {
  const currency = String(row.currency);
  const money = (value: unknown, field: string): Money | null =>
    value === null || value === undefined
      ? null
      : { amountMinor: exactInteger(value, field), currency };

  const list = { amountMinor: exactInteger(row.list_price_minor, 'list_price_minor'), currency };
  const sale = money(row.sale_price_minor, 'sale_price_minor');
  // The lower of list and sale, matching itemPrice() in offer.ts.
  const item = sale !== null && sale.amountMinor < list.amountMinor ? sale : list;

  const shippingVerified = row.shipping_verified === 1 || row.shipping_verified === true;
  const feesVerified = row.fees_verified === 1 || row.fees_verified === true;
  const shippingCost = money(row.shipping_cost_minor, 'shipping_cost_minor');
  const feesTotal = money(row.fees_total_minor, 'fees_total_minor');

  /*
   * A delivered total only when EVERY component is verified and in one
   * currency. No partial sums and no best effort: an "estimated total" is the
   * failure mode this whole project exists to avoid, and a reader is the
   * easiest place for one to appear.
   */
  const deliveredTotal =
    shippingVerified &&
    feesVerified &&
    shippingCost !== null &&
    feesTotal !== null &&
    shippingCost.currency === currency &&
    feesTotal.currency === currency
      ? {
          amountMinor: item.amountMinor + shippingCost.amountMinor + feesTotal.amountMinor,
          currency,
        }
      : null;

  const affiliate = row.affiliate_url;
  const destination = row.destination_url;
  return {
    offerId: String(row.id),
    merchantId: String(row.merchant_id),
    merchantName:
      row.merchant_name === null || row.merchant_name === undefined
        ? null
        : String(row.merchant_name),
    merchantOfferId: String(row.merchant_offer_id),
    itemPrice: item,
    availability: String(row.availability),
    condition: String(row.condition),
    destinationUrl:
      affiliate !== null && affiliate !== undefined && String(affiliate) !== ''
        ? String(affiliate)
        : destination !== null && destination !== undefined && String(destination) !== ''
          ? String(destination)
          : String(row.product_url),
    shippingVerified,
    shippingCost,
    shippingDestination:
      row.shipping_destination === null || row.shipping_destination === undefined
        ? null
        : String(row.shipping_destination),
    feesVerified,
    deliveredTotal,
    lastSeenAt: String(row.last_seen_at),
  };
}
