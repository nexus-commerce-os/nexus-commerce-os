/*
 * THE PUBLIC READ PATH.
 *
 * Most of these tests are about what must NOT come back. A listing that
 * returns a withheld product is not a cosmetic bug — it publishes an
 * unapproved merchant's data, a quarantined record, or a half-built
 * generation. So the suite is built from the leaks rather than the features.
 */
import assert from 'node:assert/strict';
import { test } from 'node:test';

import {
  GenerationPublisher,
  PublicCatalogue,
  D1OfferStore,
  importFeedArchive,
  publishCatalogue,
} from '../dist/index.js';
import { createSqliteD1, d1Schema } from './helpers/sqlite-d1.mjs';
import { buildFeed, gtin12, product, zipOf } from './fixtures/synthetic-feed.mjs';

const SCHEMA = await d1Schema();
const MERCHANT = 'northwind';
const OTHER = 'contoso';
const STAMP = '2026-11-26T11:31:41.000Z';

const row = (i, over = {}) =>
  product({
    id: `NW-${i}`,
    title: over.title ?? `Northwind Item ${i}`,
    brand: over.brand ?? 'Northwind Trading',
    price: `${over.price ?? '19.99'} USD`,
    salePrice: '',
    gtin: gtin12(String(10000000000 + i)),
    mpn: `NW-MPN-${i}`,
    lastUpdated: STAMP,
    productType: over.productType ?? 'Home > Drinkware',
  });

/** A world with a published catalogue and one withheld merchant. */
async function world({ products = 6, approveOther = false } = {}) {
  const db = createSqliteD1(SCHEMA);
  for (const [id, name, relationship] of [
    [MERCHANT, 'Northwind Trading', 'approved'],
    [OTHER, 'Contoso Supply', approveOther ? 'approved' : 'pending'],
  ]) {
    await db
      .prepare(
        `INSERT INTO catalog_merchant (id, name, network, relationship, destination_url)
         VALUES (?, ?, 'test', ?, ?)`,
      )
      .bind(id, name, relationship, `https://${id}.invalid/shop`)
      .run();
  }

  const store = new D1OfferStore(db);
  const imported = await importFeedArchive(
    zipOf(buildFeed(Array.from({ length: products }, (_, i) => row(i + 1)))),
    store,
    { merchantId: MERCHANT, sourceFeed: 'test:feed', now: new Date('2026-11-26T12:00:00.000Z') },
  );
  assert.equal(imported.applied, true, `import did not apply: ${JSON.stringify(imported.run)}`);

  const published = await publishCatalogue(db, { now: new Date('2026-11-26T12:05:00.000Z') });
  assert.equal(
    published.rejected,
    null,
    `publication was refused: ${JSON.stringify(published.rejected)}`,
  );

  return { db, store, catalogue: new PublicCatalogue(db), publisher: new GenerationPublisher(db) };
}

/* ─────────────────────────── the leaks ─────────────────────────── */

test('NOTHING is published before the pointer moves', async () => {
  const db = createSqliteD1(SCHEMA);
  await db
    .prepare(
      "INSERT INTO catalog_merchant (id, name, network, relationship) VALUES (?, ?, 'test', 'approved')",
    )
    .bind(MERCHANT, 'Northwind Trading')
    .run();
  const store = new D1OfferStore(db);
  await importFeedArchive(zipOf(buildFeed([row(1)])), store, {
    merchantId: MERCHANT,
    sourceFeed: 'test:feed',
    now: new Date('2026-11-26T12:00:00.000Z'),
  });

  // Products exist, candidates are staged, the pointer has not moved.
  await publishCatalogue(db, { now: new Date('2026-11-26T12:05:00.000Z'), dryRun: true });

  const catalogue = new PublicCatalogue(db);
  const page = await catalogue.list();
  assert.deepEqual(page.items, [], 'an unpublished catalogue is an EMPTY page');
  assert.equal(page.generation, null);
  assert.equal(page.total, 0);
  assert.equal(await catalogue.bySlug('anything'), null);
  assert.deepEqual(await catalogue.categories(), []);
  assert.deepEqual(await catalogue.brands(), []);
  assert.equal((await catalogue.summary()).products, 0);
});

test('a HALF-BUILT generation is invisible while the previous one is served', async () => {
  const { db, store, catalogue } = await world({ products: 3 });
  assert.equal((await catalogue.list()).items.length, 3);

  // A generation that staged and opened its rows but never moved the pointer.
  await importFeedArchive(zipOf(buildFeed([row(1), row(2), row(3), row(4), row(5)])), store, {
    merchantId: MERCHANT,
    sourceFeed: 'test:feed',
    now: new Date('2026-11-26T13:00:00.000Z'),
  });
  const failing = {
    prepare: (sql) => db.prepare(sql),
    exec: (sql) => db.exec(sql),
    async batch(statements) {
      if (statements.length === 3) throw new Error('crashed before the commit');
      return db.batch(statements);
    },
  };
  await assert.rejects(
    () => publishCatalogue(failing, { now: new Date('2026-11-26T13:05:00.000Z') }),
    /crashed before the commit/,
  );

  const page = await catalogue.list();
  assert.equal(page.items.length, 3, 'the visitor still sees exactly the published generation');
});

test('AN UNAPPROVED MERCHANT NEVER REACHES A LISTING', async () => {
  const { db, catalogue } = await world({ products: 3 });

  // Contoso is pending. Its offers exist in the database.
  const store = new D1OfferStore(db);
  await importFeedArchive(
    zipOf(
      buildFeed([
        product({
          id: 'CT-1',
          title: 'Contoso Secret Item',
          brand: 'Contoso',
          price: '9.99 USD',
          salePrice: '',
          gtin: gtin12('09999999999'),
          mpn: 'CT-MPN-1',
          lastUpdated: STAMP,
          productType: 'Home > Drinkware',
        }),
      ]),
    ),
    store,
    { merchantId: OTHER, sourceFeed: 'test:feed-2', now: new Date('2026-11-26T13:00:00.000Z') },
  );
  await publishCatalogue(db, { now: new Date('2026-11-26T13:05:00.000Z') });

  const page = await catalogue.list({ limit: 100 });
  assert.ok(
    page.items.every((item) => item.brand !== 'Contoso'),
    'a pending merchant is in the database and not in the catalogue',
  );
  const search = await catalogue.list({ q: 'contoso secret' });
  assert.deepEqual(search.items, [], 'and cannot be found by searching for it either');
});

test('a product page does not link an offer whose merchant approval was withdrawn', async () => {
  const { db, catalogue } = await world({ products: 2, approveOther: true });
  const first = (await catalogue.list()).items[0];
  const before = await catalogue.bySlug(first.slug);
  assert.ok(before.offers.length >= 1);

  // Approval withdrawn AFTER publication. The published row is untouched.
  await db
    .prepare("UPDATE catalog_merchant SET relationship = 'suspended' WHERE id = ?")
    .bind(MERCHANT)
    .run();

  const after = await catalogue.bySlug(first.slug);
  assert.equal(
    after.offers.length,
    0,
    'an offer row outlives the publication that included it; the approval gate is re-checked on read',
  );
});

test('an inactive offer disappears from a product page without the page disappearing', async () => {
  const { db, catalogue } = await world({ products: 2 });
  const first = (await catalogue.list()).items[0];
  await db
    .prepare("UPDATE catalog_merchant_offer SET state = 'inactive', inactive_since = ?")
    .bind('2026-11-26T14:00:00.000Z')
    .run();

  const detail = await catalogue.bySlug(first.slug);
  assert.ok(detail, 'the published product is still published');
  assert.equal(detail.offers.length, 0, 'but it has nothing to buy right now');
});

/* ──────────────────────── listing behaviour ──────────────────────── */

test('a listing is paginated and totals the whole match, not the page', async () => {
  const { catalogue } = await world({ products: 10 });
  const page = await catalogue.list({ limit: 4, offset: 0 });
  assert.equal(page.items.length, 4);
  assert.equal(page.total, 10);
  assert.equal(page.limit, 4);

  const second = await catalogue.list({ limit: 4, offset: 4 });
  assert.equal(second.items.length, 4);
  const ids = new Set([...page.items, ...second.items].map((i) => i.productId));
  assert.equal(ids.size, 8, 'pages do not overlap');
});

test('a limit is clamped rather than obeyed', async () => {
  const { catalogue } = await world({ products: 3 });
  assert.equal((await catalogue.list({ limit: 100000 })).limit, 100);
  assert.equal((await catalogue.list({ limit: 0 })).limit, 1);
  assert.equal((await catalogue.list({ limit: Number.NaN })).limit, 48);
  assert.equal((await catalogue.list({ offset: -5 })).offset, 0);
});

test('a category filter matches descendants but not merely similar names', async () => {
  const db = createSqliteD1(SCHEMA);
  await db
    .prepare(
      "INSERT INTO catalog_merchant (id, name, network, relationship) VALUES (?, ?, 'test', 'approved')",
    )
    .bind(MERCHANT, 'Northwind Trading')
    .run();
  const store = new D1OfferStore(db);
  await importFeedArchive(
    zipOf(
      buildFeed([
        row(1, { productType: 'Home > Drinkware' }),
        row(2, { productType: 'Home > Drinkware > Travel Mugs' }),
        row(3, { productType: 'Homeware > Other' }),
      ]),
    ),
    store,
    { merchantId: MERCHANT, sourceFeed: 'test:feed', now: new Date('2026-11-26T12:00:00.000Z') },
  );
  await publishCatalogue(db, { now: new Date('2026-11-26T12:05:00.000Z') });
  const catalogue = new PublicCatalogue(db);

  const home = await catalogue.list({ category: 'home' });
  assert.equal(home.total, 2, 'home and its descendant, and NOT homeware');

  const exact = await catalogue.list({ category: 'home/drinkware/travel-mugs' });
  assert.equal(exact.total, 1);
});

test('search folds the query the same way the stored text was folded', async () => {
  const { catalogue } = await world({ products: 4 });
  const found = await catalogue.list({ q: '  NORTHWIND   Item 2 ' });
  assert.equal(found.total, 1, 'case, spacing and punctuation must not matter');
  assert.equal(found.items[0].title, 'Northwind Item 2');
});

test('EVERY TERM MUST MATCH, and the order does not matter', async () => {
  /*
   * A single LIKE over the whole phrase meant "northwind travel mug" found
   * nothing, because the stored text reads "northwind trading travel mug 1"
   * and those words are not contiguous. Measured on the staging site: 0
   * results for a query that should have returned five.
   */
  const { catalogue } = await world({ products: 4 });
  const exact = await catalogue.list({ q: 'Northwind Item 2' });
  assert.equal(exact.total, 1);

  // Words the title separates, and in the wrong order.
  assert.equal((await catalogue.list({ q: 'item northwind' })).total, 4, 'order must not matter');
  assert.equal((await catalogue.list({ q: '2 northwind' })).total, 1, 'gaps must not matter');

  // A term that is absent still excludes.
  assert.equal(
    (await catalogue.list({ q: 'northwind contoso' })).total,
    0,
    'every term must match',
  );
});

test('a search for a LIKE wildcard searches for the characters, not for everything', async () => {
  const { catalogue } = await world({ products: 5 });
  const page = await catalogue.list({ q: '%' });
  assert.equal(page.total, 0, 'an unescaped % would have matched the entire catalogue');
  const underscore = await catalogue.list({ q: '_' });
  assert.equal(underscore.total, 0);
});

test('CHEAPEST SORT DOES NOT LEAD WITH PRODUCTS THAT HAVE NO PRICE', async () => {
  /*
   * Most products have no verified delivered cost, and SQLite sorts NULL
   * first — so "cheapest" would otherwise open with every product whose price
   * is unknown, which reads as a list of free things.
   */
  const { db, catalogue } = await world({ products: 4 });
  const live = await catalogue.liveGeneration();
  await db
    .prepare(
      `UPDATE catalog_published_product SET from_price_minor = 2500, from_currency = 'USD'
        WHERE slug = (SELECT slug FROM catalog_published_product
                       WHERE last_generation IS NULL ORDER BY slug LIMIT 1)`,
    )
    .run();
  assert.ok(live !== null);

  const page = await catalogue.list({ sort: 'cheapest' });
  assert.equal(page.items[0].fromPrice.amountMinor, 2500, 'the only priced product leads');
  assert.equal(page.items[1].fromPrice, null);
});

test('freshest sort leads with the most recently verified product', async () => {
  const { db, catalogue } = await world({ products: 3 });
  await db
    .prepare(
      `UPDATE catalog_published_product SET data_verified_at = '2026-11-27T00:00:00.000Z'
        WHERE slug = (SELECT slug FROM catalog_published_product
                       WHERE last_generation IS NULL ORDER BY slug DESC LIMIT 1)`,
    )
    .run();
  const page = await catalogue.list({ sort: 'freshest' });
  assert.equal(page.items[0].dataVerifiedAt, '2026-11-27T00:00:00.000Z');
});

/* ──────────────────────── product detail ──────────────────────── */

test('a product page carries its offers, freshness and price history', async () => {
  const { catalogue } = await world({ products: 3 });
  const first = (await catalogue.list()).items[0];
  const detail = await catalogue.bySlug(first.slug);

  assert.equal(detail.slug, first.slug);
  assert.equal(detail.offers.length, 1);
  assert.equal(detail.offers[0].merchantName, 'Northwind Trading');
  assert.equal(detail.offers[0].itemPrice.amountMinor, 1999);
  assert.ok(detail.dataVerifiedAt, 'freshness is shown, not inferred');
  assert.equal(detail.priceHistory.length, 1, 'the opening entry from the first import');
});

test('a DELIVERED TOTAL appears only when every component is verified', async () => {
  const { db, catalogue } = await world({ products: 2 });
  const first = (await catalogue.list()).items[0];

  const unverified = await catalogue.bySlug(first.slug);
  assert.equal(
    unverified.offers[0].deliveredTotal,
    null,
    'no partial sums: an estimated total is the failure this project exists to avoid',
  );
  assert.equal(unverified.offers[0].shippingVerified, false);

  // Shipping AND fees stated. Only then is there a total.
  await db
    .prepare(
      `UPDATE catalog_merchant_offer
          SET shipping_verified = 1, shipping_cost_minor = 499, shipping_destination = 'US',
              fees_verified = 1, fees_total_minor = 120`,
    )
    .run();
  const verified = await catalogue.bySlug(first.slug);
  assert.equal(verified.offers[0].deliveredTotal.amountMinor, 1999 + 499 + 120);
  assert.equal(verified.offers[0].deliveredTotal.currency, 'USD');
});

test('a destination falls back to the plain product URL when no affiliate link exists', async () => {
  const { catalogue } = await world({ products: 2 });
  const first = (await catalogue.list()).items[0];
  const detail = await catalogue.bySlug(first.slug);
  // The merchant has a destination_url and no affiliate_url, because the CHECK
  // makes an affiliate link impossible to store for anything but an approved
  // relationship — and nothing has set one.
  assert.equal(detail.offers[0].destinationUrl, 'https://northwind.invalid/shop');
});

test('an unknown slug is null, not an error and not another product', async () => {
  const { catalogue } = await world({ products: 2 });
  assert.equal(await catalogue.bySlug('no-such-product'), null);
  assert.equal(await catalogue.bySlug(''), null);
  assert.equal(await catalogue.bySlug("' OR 1=1 --"), null);
});

/* ──────────────────────── facets and summary ──────────────────────── */

test('facets count only what is actually published', async () => {
  const { catalogue } = await world({ products: 5 });
  const categories = await catalogue.categories();
  assert.equal(categories.length, 1);
  assert.equal(categories[0].slug, 'home/drinkware');
  assert.equal(categories[0].name, 'Drinkware', 'the name the merchant stated, not the slug');
  assert.equal(categories[0].count, 5);

  const brands = await catalogue.brands();
  assert.deepEqual(brands, [{ brand: 'Northwind Trading', count: 5 }]);
});

test('the summary reports the live generation, so a caller can see it move', async () => {
  const { db, catalogue } = await world({ products: 4 });
  const before = await catalogue.summary();
  assert.equal(before.products, 4);
  assert.equal(before.categories, 1);
  assert.ok(before.generation !== null);
  assert.ok(before.newestVerifiedAt);

  const store = new D1OfferStore(db);
  await importFeedArchive(
    zipOf(buildFeed(Array.from({ length: 5 }, (_, i) => row(i + 1)))),
    store,
    { merchantId: MERCHANT, sourceFeed: 'test:feed', now: new Date('2026-11-27T12:00:00.000Z') },
  );
  await publishCatalogue(db, { now: new Date('2026-11-27T12:05:00.000Z') });

  const after = await catalogue.summary();
  assert.equal(after.products, 5);
  assert.ok(after.generation > before.generation, 'and the generation advanced');
});

test('a rollback is immediately visible to the read path', async () => {
  const { db, store, catalogue, publisher } = await world({ products: 2 });
  const firstGeneration = await catalogue.liveGeneration();

  await importFeedArchive(
    zipOf(buildFeed(Array.from({ length: 4 }, (_, i) => row(i + 1)))),
    store,
    { merchantId: MERCHANT, sourceFeed: 'test:feed', now: new Date('2026-11-27T12:00:00.000Z') },
  );
  await publishCatalogue(db, { now: new Date('2026-11-27T12:05:00.000Z') });
  assert.equal((await catalogue.list()).total, 4);

  await publisher.rollbackTo(firstGeneration, {
    at: '2026-11-27T13:00:00.000Z',
    decidedBy: 'operator:owner',
  });
  const page = await catalogue.list();
  assert.equal(page.total, 2, 'the read path follows the pointer, with no cache to invalidate');
  assert.equal(page.generation, firstGeneration);
});
