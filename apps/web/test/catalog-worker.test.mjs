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
 * The POPULATED state is not here. It needs the import and publication
 * pipeline, which is tested against a real SQL engine in services/catalog and
 * exercised end to end on the staging Worker; mocking it here would prove
 * nothing this file could not also get wrong.
 */

import assert from 'node:assert/strict';
import { readFileSync, readdirSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { DatabaseSync } from 'node:sqlite';
import { test } from 'node:test';
import { fileURLToPath, pathToFileURL } from 'node:url';

const packageRoot = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const catalogUrl = pathToFileURL(join(packageRoot, '.worker-test', 'worker', 'catalog.js'));
const { handleCatalogApi, handleCatalogPage } = await import(catalogUrl.href);

const MIGRATIONS = resolve(packageRoot, '../../services/catalog/migrations-d1');

/**
 * A migrated, EMPTY database — the shape production is in today.
 *
 * node:sqlite rather than a hand-written fake of `prepare().bind().all()`:
 * the code under test is the real `PublicCatalogue`, and a fake of its SQL
 * surface would be free to disagree with SQLite about what an empty catalogue
 * returns. The one thing that must not be mocked here is the query.
 */
function migratedEmptyD1() {
  const db = new DatabaseSync(':memory:');
  db.exec('PRAGMA foreign_keys = ON');
  const files = readdirSync(MIGRATIONS)
    .filter((name) => name.endsWith('.sql'))
    .sort();
  for (const file of files) {
    db.exec(readFileSync(join(MIGRATIONS, file), 'utf8'));
  }
  const statement = (sql, bound = []) => ({
    bind: (...values) => statement(sql, values),
    all: async () => {
      const results = db.prepare(sql).all(...bound);
      return { results, success: true, meta: {} };
    },
    first: async () => db.prepare(sql).get(...bound) ?? null,
    run: async () => ({ results: [], success: true, meta: {} }),
  });
  return { prepare: (sql) => statement(sql) };
}

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
