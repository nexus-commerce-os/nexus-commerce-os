/*
 * THE D1 READS AND WRITES THE AUTOMATION NEEDS, and nothing else.
 *
 * Kept apart from the pipeline so `publishCatalogue` has no SQL in it: the
 * decision logic is already pure and testable in product/build.ts, and the
 * part that talks to a database should be small enough to read in one sitting.
 */
import type { D1Like, D1PreparedStatement } from '../store/d1/d1-client';
import { exactInteger, fromInt, toInt } from '../store/d1/d1-client';
import type { Availability, ItemCondition } from '../offer';
import type { StoredOffer } from '../store/offer-store';
import type { Category } from '../product/classify';
import type { ProductDraft } from '../product/build';

export interface AutomationConfig {
  readonly paused: boolean;
  readonly pausedReason: string | null;
  readonly autoPublish: boolean;
}

export interface MerchantRow {
  readonly id: string;
  readonly name: string;
  readonly relationship: 'pending' | 'approved' | 'declined' | 'suspended';
}

const str = (value: unknown): string => String(value);
const nullable = (value: unknown): string | null =>
  value === null || value === undefined ? null : String(value);

export class CatalogD1 {
  constructor(private readonly db: D1Like) {}

  /* ───────────────────────────── config ───────────────────────────── */

  async automationConfig(): Promise<AutomationConfig> {
    const row = await this.db
      .prepare(
        'SELECT paused, paused_reason, auto_publish FROM catalog_automation_config WHERE id = 1',
      )
      .first<Record<string, unknown>>();
    if (!row) {
      /*
       * Migration 0002 seeds this row, so its absence means the schema is not
       * what this code expects. FAIL CLOSED: treating a missing configuration
       * as "not paused" would let automation run against a database nobody has
       * migrated, which is precisely when it should not.
       */
      return {
        paused: true,
        pausedReason: 'catalog_automation_config has no row 1; the schema is not initialised',
        autoPublish: false,
      };
    }
    return {
      paused: fromInt(row.paused),
      pausedReason: nullable(row.paused_reason),
      autoPublish: fromInt(row.auto_publish),
    };
  }

  /** Merchants whose relationship is approved. Nothing else may be published. */
  async approvedMerchants(): Promise<ReadonlySet<string>> {
    const out = await this.db
      .prepare("SELECT id FROM catalog_merchant WHERE relationship = 'approved'")
      .all<{ id: string }>();
    return new Set(out.results.map((r) => r.id));
  }

  async merchants(): Promise<readonly MerchantRow[]> {
    const out = await this.db
      .prepare('SELECT id, name, relationship FROM catalog_merchant ORDER BY id')
      .all<Record<string, unknown>>();
    return out.results.map((row) => ({
      id: str(row.id),
      name: str(row.name),
      relationship: str(row.relationship) as MerchantRow['relationship'],
    }));
  }

  /* ───────────────────────────── offers ───────────────────────────── */

  /**
   * Every offer the catalogue knows, active or not.
   *
   * INACTIVE ONES ARE INCLUDED ON PURPOSE. The pipeline has to be able to say
   * `no_active_offer` about a product it still knows, which it cannot do from
   * a query that already filtered them out — and a product silently absent is
   * exactly the kind of absence this project insists on being able to explain.
   */
  async allOffers(): Promise<readonly StoredOffer[]> {
    const out = await this.db
      .prepare(
        `SELECT id, merchant_id, merchant_offer_id, gtin, mpn, brand, title,
                list_price_minor, sale_price_minor, currency, availability, condition,
                product_url, image_url,
                shipping_verified, shipping_cost_minor, shipping_destination,
                fees_verified, fees_total_minor, product_type,
                snapshot_at, source_feed, first_seen_run, last_seen_run, last_seen_at,
                state, inactive_since
           FROM catalog_merchant_offer`,
      )
      .all<Record<string, unknown>>();

    return out.results.map((row) => {
      const currency = str(row.currency);
      const minor = (value: unknown, field: string) =>
        value === null || value === undefined
          ? null
          : { amountMinor: exactInteger(value, field), currency };
      return {
        id: str(row.id),
        merchantId: str(row.merchant_id),
        merchantOfferId: str(row.merchant_offer_id),
        gtin: nullable(row.gtin),
        mpn: nullable(row.mpn),
        brand: str(row.brand),
        title: str(row.title),
        listPrice: {
          amountMinor: exactInteger(row.list_price_minor, 'list_price_minor'),
          currency,
        },
        salePrice: minor(row.sale_price_minor, 'sale_price_minor'),
        availability: str(row.availability) as Availability,
        condition: str(row.condition) as ItemCondition,
        productUrl: str(row.product_url),
        imageUrl: str(row.image_url),
        shippingVerified: fromInt(row.shipping_verified),
        shippingCost: minor(row.shipping_cost_minor, 'shipping_cost_minor'),
        shippingDestination: nullable(row.shipping_destination),
        feesVerified: fromInt(row.fees_verified),
        feesTotal: minor(row.fees_total_minor, 'fees_total_minor'),
        productType: nullable(row.product_type),
        snapshotAt: str(row.snapshot_at),
        sourceFeed: str(row.source_feed),
        firstSeenRun: str(row.first_seen_run),
        lastSeenRun: str(row.last_seen_run),
        lastSeenAt: str(row.last_seen_at),
        state: str(row.state) as StoredOffer['state'],
        inactiveSince: nullable(row.inactive_since),
      } satisfies StoredOffer;
    });
  }

  /* ──────────────────────── products and links ──────────────────────── */

  /**
   * Writes the products, their categories, brands and offer links.
   *
   * Everything here is an upsert keyed on something derived from the data, so
   * running it twice writes the same rows rather than new ones. That is what
   * makes an interrupted automation run safe to repeat.
   */
  async upsertProducts(products: readonly ProductDraft[], at: string): Promise<number> {
    if (products.length === 0) return 0;

    const statements: D1PreparedStatement[] = [];
    const categories = new Map<string, Category>();
    const brands = new Map<string, string>();

    for (const product of products) {
      for (const category of product.categoryPath) categories.set(category.slug, category);
      if (product.brandNormalised !== null && product.brand !== null) {
        brands.set(product.brandNormalised, product.brand);
      }
    }

    // Categories first: catalog_product.category_slug has no FK, but
    // catalog_category.parent_slug does, so parents must precede children.
    for (const category of [...categories.values()].sort(
      (a, b) => a.slug.length - b.slug.length || (a.slug < b.slug ? -1 : 1),
    )) {
      statements.push(
        this.db
          .prepare(
            `INSERT INTO catalog_category (slug, name, parent_slug) VALUES (?, ?, ?)
             ON CONFLICT (slug) DO UPDATE SET name = excluded.name`,
          )
          .bind(category.slug, category.name, category.parentSlug),
      );
    }

    for (const [normalised, display] of brands) {
      statements.push(
        this.db
          .prepare(
            `INSERT INTO catalog_brand (normalised, display) VALUES (?, ?)
             ON CONFLICT (normalised) DO UPDATE SET display = excluded.display`,
          )
          .bind(normalised, display),
      );
    }

    for (const product of products) {
      statements.push(
        this.db
          .prepare(
            `INSERT INTO catalog_product
               (id, slug, title, brand, brand_normalised, category_slug,
                gtin, mpn, variant_group_id, summary, created_at, updated_at)
             VALUES (?,?,?,?,?,?,?,?,?,NULL,?,?)
             ON CONFLICT (id) DO UPDATE SET
               slug = excluded.slug,
               title = excluded.title,
               brand = excluded.brand,
               brand_normalised = excluded.brand_normalised,
               category_slug = excluded.category_slug,
               gtin = excluded.gtin,
               mpn = excluded.mpn,
               variant_group_id = excluded.variant_group_id,
               updated_at = excluded.updated_at`,
          )
          .bind(
            productIdOf(product),
            product.slug,
            product.title,
            product.brand,
            product.brandNormalised,
            product.categorySlug,
            product.gtin,
            product.mpn,
            product.variantGroupId,
            at,
            at,
          ),
      );

      /*
       * Offer links are REPLACED for this product, not merged: an offer that
       * stopped matching has to lose its link, and a merge would leave the old
       * row behind claiming a relationship the matcher no longer believes.
       */
      statements.push(
        this.db
          .prepare('DELETE FROM catalog_product_offer WHERE product_id = ?')
          .bind(productIdOf(product)),
      );
      for (const offerId of product.offerIds) {
        statements.push(
          this.db
            .prepare(
              `INSERT INTO catalog_product_offer
                 (product_id, offer_id, match_basis, confidence, matched_at)
               VALUES (?,?,?,?,?)
               ON CONFLICT (product_id, offer_id) DO UPDATE SET
                 match_basis = excluded.match_basis,
                 confidence = excluded.confidence,
                 matched_at = excluded.matched_at`,
            )
            .bind(productIdOf(product), offerId, product.basis, product.confidence, at),
        );
      }
    }

    await this.flush(statements);
    return products.length;
  }

  /**
   * Records why each product is or is not public.
   *
   * ONLY ON CHANGE. The decision log is append-only and a row per product per
   * cycle would grow by the catalogue size twice a day while saying the same
   * thing — so a decision is written when it DIFFERS from the last one
   * recorded for that product, which is also the only time it is interesting.
   */
  async recordDecisions(
    products: readonly ProductDraft[],
    at: string,
    rulesVersion: string,
  ): Promise<number> {
    if (products.length === 0) return 0;

    // A join against the max per product. The first version of this used a
    // correlated subquery that referenced the outer table from inside its own
    // FROM, which is not the query it looks like. And no .catch(): swallowing
    // a failure here would silently rewrite every decision every cycle.
    const latest = await this.db
      .prepare(
        `SELECT d.product_id, d.published, d.reason_code
           FROM catalog_publication_decision AS d
           JOIN (
                  SELECT product_id, MAX(decided_at) AS newest
                    FROM catalog_publication_decision
                   GROUP BY product_id
                ) AS m
             ON m.product_id = d.product_id AND m.newest = d.decided_at`,
      )
      .all<Record<string, unknown>>();

    const previous = new Map(
      latest.results.map((row) => [
        str(row.product_id),
        `${fromInt(row.published) ? 1 : 0}:${str(row.reason_code)}`,
      ]),
    );

    const statements: D1PreparedStatement[] = [];
    for (const product of products) {
      const id = productIdOf(product);
      const signature = `${product.eligible ? 1 : 0}:${product.reasonCode}`;
      if (previous.get(id) === signature) continue;
      statements.push(
        this.db
          .prepare(
            `INSERT INTO catalog_publication_decision
               (id, product_id, decided_at, published, reason_code, detail, decided_by, rules_version)
             VALUES (?,?,?,?,?,?,'automatic',?)`,
          )
          .bind(
            `${id}@${at}`,
            id,
            at,
            toInt(product.eligible),
            product.reasonCode,
            `confidence=${product.confidence} basis=${product.basis} offers=${product.offerIds.length}`,
            rulesVersion,
          ),
      );
    }
    await this.flush(statements);
    return statements.length;
  }

  /** The newest decision per product, for the dashboard and for tests. */
  async latestDecisions(
    limit = 200,
  ): Promise<readonly { productId: string; published: boolean; reasonCode: string; at: string }[]> {
    const out = await this.db
      .prepare(
        `SELECT product_id, decided_at, published, reason_code
           FROM catalog_publication_decision
          ORDER BY decided_at DESC, product_id ASC LIMIT ?`,
      )
      .bind(limit)
      .all<Record<string, unknown>>();
    return out.results.map((row) => ({
      productId: str(row.product_id),
      published: fromInt(row.published),
      reasonCode: str(row.reason_code),
      at: str(row.decided_at),
    }));
  }

  private async flush(statements: readonly D1PreparedStatement[]): Promise<void> {
    const BATCH = 40;
    for (let i = 0; i < statements.length; i += BATCH) {
      await this.db.batch(statements.slice(i, i + BATCH));
    }
  }
}

/**
 * The row id for a product.
 *
 * Derived from the identity, never from a sequence, so the same product gets
 * the same id in every environment and across every run — which is what makes
 * every write in this file an idempotent upsert rather than an insert that
 * needs a lookup first. The prefix says which kind of identity it is, so a row
 * id is readable without consulting another table.
 */
export function productIdOf(product: { basis: string; productKey: string }): string {
  return `${product.basis}:${product.productKey}`;
}
