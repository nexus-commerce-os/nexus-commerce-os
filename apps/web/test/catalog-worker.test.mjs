/**
 * THE THREE STATES OF THE CATALOGUE ROUTES, AND WHAT EACH ONE SERVES.
 *
 * These routes run in FRONT of the asset service, which makes them capable of
 * a specific and serious mistake: shadowing a page that works. honesttotal.com
 * already serves a catalogue at /products — the specification-only records
 * that survived the source-terms audit, exported at build time — and the first
 * version of this code replaced those two genuine records with "no products
 * are published yet", because the production database has nothing published
 * in it. Both pages return 200. Only one of them is true.
 *
 * So what is asserted here is not "the page loaded" but WHICH page, for each
 * state the database can be in:
 *
 *   1. unreadable, exported page present    → step aside, and 503 on the API;
 *   2. unreadable, nothing exported         → a LOUD 503, never "nothing yet";
 *   3. migrated and empty, page present     → step aside;
 *   4. migrated and empty, nothing exported → the honest empty state, at 200;
 *   5. no binding at all, nothing exported  → a loud 503.
 *
 * 2 and 4 are the pair worth protecting: a database that has lost its schema
 * and a database with nothing published must not render the same.
 *
 * The POPULATED state is here too, and it is not mocked: the feed is imported
 * and published by the real pipeline into the same SQLite, because the claim
 * being made about this deployment — that an authorised merchant's products
 * reach honesttotal.com with no rebuild and no redeploy — rests entirely on
 * this Worker preferring the database the moment a generation goes live.
 */

import assert from 'node:assert/strict';
import { dirname, join, resolve } from 'node:path';
import { test } from 'node:test';
import { fileURLToPath, pathToFileURL } from 'node:url';

const packageRoot = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const catalogUrl = pathToFileURL(join(packageRoot, '.worker-test', 'worker', 'catalog.js'));
const { handleCatalogApi, handleCatalogPage } = await import(catalogUrl.href);

/*
 * The real pipeline, imported from the compiled catalogue rather than
 * reimplemented. `scripts/build-catalog.mjs` has already run by the time the
 * suite starts — it is the first thing `pnpm test` does in this package.
 */
const catalogDist = pathToFileURL(resolve(packageRoot, '../../services/catalog/dist/index.js'));
const { D1OfferStore, importFeedArchive, publishCatalogue } = await import(catalogDist.href);
const feedFixtures = pathToFileURL(
  resolve(packageRoot, '../../services/catalog/test/fixtures/synthetic-feed.mjs'),
);
const { buildFeed, gtin12, product, zipOf } = await import(feedFixtures.href);
const sqliteHelper = pathToFileURL(
  resolve(packageRoot, '../../services/catalog/test/helpers/sqlite-d1.mjs'),
);
const { createSqliteD1, d1Schema } = await import(sqliteHelper.href);

/*
 * A migrated, EMPTY database — the shape production is in today.
 *
 * `createSqliteD1` is the SAME harness services/catalog runs its contract
 * suite on: node:sqlite behind the real `D1Like` surface, including `batch()`
 * and `exec()`. A second hand-written fake of `prepare().bind().all()` lived
 * here for one commit and was already wrong — it had no `batch`, so the
 * importer threw the moment this file tried to publish anything. The code
 * under test is the real `PublicCatalogue`; the one thing that must not be
 * mocked is the query.
 */
const SCHEMA = await d1Schema();
const migratedEmptyD1 = () => createSqliteD1(SCHEMA);

/** A database that cannot be read at all — the state `wrangler dev --local` is in. */
function brokenD1(message = 'D1_ERROR: no such table: catalog_publication_pointer') {
  const reject = async () => {
    throw new Error(message);
  };
  const statement = { bind: () => statement, all: reject, first: reject, run: reject };
  return { prepare: () => statement };
}

/** An asset service that either has the page or does not. */
function assets(present, body = '<article data-product-slug="sennheiser-hd-600">real</article>') {
  let calls = 0;
  return {
    calls: () => calls,
    binding: {
      fetch: async () => {
        calls += 1;
        return present
          ? new Response(body, { status: 200, headers: { 'content-type': 'text/html' } })
          : new Response('not found', { status: 404 });
      },
    },
  };
}

const get = (path = '/products') => new Request(`https://honesttotal.com${path}`);
const text = async (response) => (await response.text()).toLowerCase();

/* ──────────────────── 1 and 2: the database is unreadable ──────────────────── */

test('AN UNREADABLE DATABASE DOES NOT SHADOW THE EXPORTED CATALOGUE', async () => {
  const exported = assets(true);
  const response = await handleCatalogPage(
    get(),
    { CATALOG: brokenD1(), ASSETS: exported.binding },
    'nonce',
  );
  assert.equal(response, null, 'the route must step aside so the exported page is served');
  assert.ok(exported.calls() > 0, 'and it must have ASKED whether that page exists');
});

test('but the API says 503, so the failure is never silent', async () => {
  const response = await handleCatalogApi(get('/api/catalog/products'), {
    CATALOG: brokenD1(),
    ASSETS: assets(true).binding,
  });
  assert.equal(response.status, 503, 'a machine consumer must be told the read failed');
  assert.match(response.headers.get('cache-control') ?? '', /no-store/);
  const body = await response.json();
  assert.equal(body.items, undefined, 'and must not be handed an empty list');
});

test('WITH NOTHING EXPORTED, AN UNREADABLE DATABASE IS A LOUD 503', async () => {
  const response = await handleCatalogPage(
    get(),
    { CATALOG: brokenD1(), ASSETS: assets(false).binding },
    'nonce',
  );
  assert.equal(response.status, 503);
  const body = await text(response);
  assert.match(body, /could not be read/, 'it must say the read failed');
  assert.doesNotMatch(
    body,
    /no products are published yet/,
    'a broken database must never render as an empty shop',
  );
});

/* ───────────────── 3 and 4: migrated, with nothing published ───────────────── */

test('a migrated, empty database also steps aside for the exported catalogue', async () => {
  const exported = assets(true);
  const response = await handleCatalogPage(
    get(),
    { CATALOG: migratedEmptyD1(), ASSETS: exported.binding },
    'nonce',
  );
  assert.equal(response, null);
  assert.ok(exported.calls() > 0);
});

test('AND WITH NOTHING EXPORTED IT SAYS SO, at 200, inventing no product', async () => {
  const response = await handleCatalogPage(
    get(),
    { CATALOG: migratedEmptyD1(), ASSETS: assets(false).binding },
    'nonce',
  );
  assert.equal(response.status, 200, 'an empty catalogue is not an error');
  const body = await text(response);
  assert.match(body, /no products are published yet/);
  assert.doesNotMatch(body, /could not be read/, 'empty and broken must not render the same');
  for (const forbidden of ['coming soon', 'placeholder', 'sample product', 'lorem ipsum']) {
    assert.doesNotMatch(body, new RegExp(forbidden), `must not contain "${forbidden}"`);
  }
  assert.doesNotMatch(body, /[$£€]\s?\d/, 'a currency amount on a page with no products');
});

/* ──────────────────────── 5: the binding is missing ──────────────────────── */

test('a deploy with no binding falls through, or fails loudly with nothing to fall to', async () => {
  const withPage = await handleCatalogPage(get(), { ASSETS: assets(true).binding }, 'nonce');
  assert.equal(withPage, null, 'the exported catalogue still works without a database');

  const without = await handleCatalogPage(get(), { ASSETS: assets(false).binding }, 'nonce');
  assert.equal(without.status, 503);
  assert.match(await text(without), /not connected/);
});

/* ───────────────────────────── the boundaries ───────────────────────────── */

test('a path that is not ours is not touched, and the asset service is not probed', async () => {
  const probe = assets(true);
  for (const path of ['/', '/how-we-rank', '/api/waitlist', '/products-and-more']) {
    const response = await handleCatalogPage(
      get(path),
      { CATALOG: brokenD1(), ASSETS: probe.binding },
      'nonce',
    );
    assert.equal(response, null, `${path} must fall through untouched`);
  }
  assert.equal(probe.calls(), 0, 'no asset probe should have been made for these paths');
});

test('AN UNKNOWN SLUG IS 404 AND NEVER ANOTHER PRODUCT', async () => {
  const response = await handleCatalogPage(
    get('/products/no-such-product'),
    { CATALOG: migratedEmptyD1(), ASSETS: assets(false).binding },
    'nonce',
  );
  assert.equal(response.status, 404);
  const body = await text(response);
  assert.match(body, /not published/);
  assert.doesNotMatch(body, /data-product-slug/, 'no product markup on a 404');
});

/* ────────────── the populated state: a generation is live in D1 ────────────── */

const STAMP = '2026-11-26T11:31:41.000Z';

/** One synthetic feed row, shared by the publish and the retire. */
const feedRow = (i) =>
  product({
    id: `NW-${i}`,
    title: `Northwind Item ${i}`,
    price: '19.99 USD',
    salePrice: '',
    gtin: gtin12(String(10000000000 + i)),
    mpn: `NW-MPN-${i}`,
    lastUpdated: STAMP,
    productType: 'Home > Drinkware',
  });

/**
 * A database with a real published generation in it.
 *
 * Built by running the actual import and the actual publisher — not by
 * INSERTing rows that look like their output. The interval filter, the
 * pointer and the eligibility decision are the things being relied on, and a
 * hand-written fixture would be free to disagree with all three.
 *
 * The merchant is `approved` because that is the gate: with anything else the
 * publisher records `merchant_not_approved` and publishes nothing, which is a
 * different test (and one services/catalog already has).
 */
async function publishedD1(count = 3) {
  const db = migratedEmptyD1();
  await db
    .prepare(
      "INSERT INTO catalog_merchant (id, name, network, relationship) VALUES (?,?,'test','approved')",
    )
    .bind('northwind', 'Northwind Trading')
    .run();

  const rows = Array.from({ length: count }, (_, i) => feedRow(i + 1));

  const imported = await importFeedArchive(zipOf(buildFeed(rows)), new D1OfferStore(db), {
    merchantId: 'northwind',
    sourceFeed: 'test:shopping:0000',
    now: new Date(STAMP),
  });
  assert.equal(imported.applied, true, `the import did not apply: ${JSON.stringify(imported.run)}`);

  const published = await publishCatalogue(db, { now: new Date('2026-11-26T12:00:00.000Z') });
  assert.equal(published.ran, true, `the publication did not run: ${JSON.stringify(published)}`);
  assert.equal(published.counts.products, count);
  return db;
}

test('A LIVE GENERATION TAKES THE PAGE OVER — no rebuild, no redeploy', async () => {
  const db = await publishedD1();
  const exported = assets(true);

  const response = await handleCatalogPage(get(), { CATALOG: db, ASSETS: exported.binding }, 'n');
  assert.notEqual(response, null, 'with products published, this Worker must answer');
  assert.equal(response.status, 200);
  assert.equal(
    exported.calls(),
    0,
    'and must not even ask the asset service — the database is the catalogue now',
  );

  const body = await response.text();
  assert.match(body, /Northwind Item 1/, 'the published product must be on the page');
  assert.match(body, /Northwind Item 3/);
  assert.doesNotMatch(body, /no products are published yet/i);
});

test('and the API serves the same generation, with search that narrows', async () => {
  const db = await publishedD1();
  const env = { CATALOG: db, ASSETS: assets(true).binding };

  const summary = await (await handleCatalogApi(get('/api/catalog/summary'), env)).json();
  assert.equal(summary.products, 3);
  assert.equal(typeof summary.generation, 'number', 'a live generation must be reported');

  const all = await (await handleCatalogApi(get('/api/catalog/products'), env)).json();
  assert.equal(all.total, 3);

  // Two terms that are not adjacent in the stored text: the case that
  // returned nothing before search was split per term.
  const narrowed = await (
    await handleCatalogApi(get('/api/catalog/products?q=northwind%20item%202'), env)
  ).json();
  assert.equal(narrowed.total, 1, 'a reasonable multi-word query must find the product');
  assert.match(narrowed.items[0].title, /Northwind Item 2/);

  const nothing = await (
    await handleCatalogApi(get('/api/catalog/products?q=zzzzznothing'), env)
  ).json();
  assert.equal(nothing.total, 0, 'and a nonsense query must return nothing, not everything');
});

test('A PUBLISHED PRODUCT HAS A DETAIL PAGE, and an unpublished slug still does not', async () => {
  const db = await publishedD1();
  const env = { CATALOG: db, ASSETS: assets(false).binding };

  const listed = await (await handleCatalogApi(get('/api/catalog/products'), env)).json();
  const slug = listed.items[0].slug;

  const detail = await handleCatalogPage(get(`/products/${slug}`), env, 'n');
  assert.equal(detail.status, 200);
  assert.match(await detail.text(), /Northwind Item/);

  const missing = await handleCatalogPage(get('/products/not-in-this-generation'), env, 'n');
  assert.equal(missing.status, 404, 'a live generation makes "not published" a fact, so 404');
});

test('A LIVE GENERATION MUST NOT 404 THE EXPORTED DETAIL PAGES', async () => {
  /*
   * honesttotal.com has two exported, INDEXED detail pages —
   * /products/sennheiser-hd-600 and /products/das-keyboard-4-professional.
   * They belong to a different catalogue: the specification-only records that
   * passed the source-terms audit. An unrelated merchant's first generation
   * going live would have started answering 404 for both of them, because the
   * fallback asked only whether anything was published at all.
   */
  const db = await publishedD1();
  const exported = assets(true);

  const response = await handleCatalogPage(
    get('/products/sennheiser-hd-600'),
    { CATALOG: db, ASSETS: exported.binding },
    'n',
  );
  assert.equal(response, null, 'a slug this pipeline has never published may still be exported');
  assert.ok(exported.calls() > 0);
});

test('BUT A WITHHELD RECORD DOES NOT COME BACK AS AN EXPORTED PAGE', async () => {
  /*
   * The case the check exists to refuse, built the way it really happens: a
   * product the feed stops listing is retired, its published row's interval
   * closes, and the next generation does not contain it. Serving its old
   * exported page then would publish exactly what the eligibility rules
   * withheld.
   */
  /*
   * TWENTY, not three. A publication that would retire a third of the
   * catalogue is refused by the cliff guard and the pointer does not move —
   * which is the guard working, and makes three products the wrong fixture
   * for testing an ordinary retirement.
   */
  const db = await publishedD1(20);
  const store = new D1OfferStore(db);

  const remaining = Array.from({ length: 19 }, (_, i) => feedRow(i + 1));
  const second = await importFeedArchive(zipOf(buildFeed(remaining)), store, {
    merchantId: 'northwind',
    sourceFeed: 'test:shopping:0000',
    now: new Date('2026-11-26T13:00:00.000Z'),
  });
  assert.equal(
    second.applied,
    true,
    `the second import did not apply: ${JSON.stringify(second.run)}`,
  );
  assert.equal(second.reconciliation.removed.length, 1, 'one product left the feed');

  const republished = await publishCatalogue(db, { now: new Date('2026-11-26T14:00:00.000Z') });
  assert.equal(republished.ran, true);
  // The product record survives; what it loses is its active offer, so it is
  // withheld rather than deleted. Eligibility is the figure that moves.
  assert.equal(republished.counts.eligible, 19, 'the retired product is no longer eligible');

  const closed = await db
    .prepare(
      'SELECT slug FROM catalog_published_product WHERE last_generation IS NOT NULL ORDER BY slug LIMIT 1',
    )
    .first();
  assert.ok(closed, 'a row should have been closed');

  const exported = assets(true);
  const response = await handleCatalogPage(
    get(`/products/${closed.slug}`),
    { CATALOG: db, ASSETS: exported.binding },
    'n',
  );
  assert.equal(response.status, 404, 'withheld means withheld');
  assert.equal(exported.calls(), 0, 'and the asset service is not even asked');
});
