/*
 * The Postgres adapter against a real PostgreSQL server.
 *
 * WHY THIS FILE HAS TO EXIST SEPARATELY FROM import-feed.test.mjs. Three of
 * the port's promises are unprovable without a database, and they are the ones
 * an unattended daily import rests on:
 *
 *   - one applied run per (merchant, payload) ACROSS CONNECTIONS, which only a
 *     unique index can arbitrate between two processes that both looked and
 *     both saw nothing;
 *   - all-or-nothing writes, so a feed that fails on row 200 of 225 leaves no
 *     half-built catalogue;
 *   - constraints that outlive this code, so a future writer cannot record a
 *     verified delivered cost without both a figure and a destination.
 *
 * HOW IT FINDS A DATABASE, in order:
 *
 *   HONESTTOTAL_PG_DSN   an existing server — a local cluster, or CI's service
 *                        container. Used as-is.
 *   NEXUS_PG_TESTS=1     start one with Testcontainers. This is the switch
 *                        .github/workflows/ci.yml sets on the unit-tests job.
 *   neither              every test skips, printing why.
 *
 * SKIPPING IS HONEST, NOT A PASS. A machine with no container runtime cannot
 * verify a database adapter, and a suite that pretended otherwise would be
 * worse than one that says so. The counts below are asserted exactly when a
 * database IS present.
 *
 * NOTHING HERE TOUCHES A REAL FEED unless HONESTTOTAL_FEED_A/B are set, and no
 * feed, tracking URL or credential is written into this repository.
 */
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { after, test } from 'node:test';

import pg from 'pg';

import {
  CatalogMigrationRunner,
  DuplicateApplyError,
  PostgresOfferStore,
  importFeedArchive,
} from '../dist/index.js';
import { buildFeed, gtin12, product, zipOf } from './fixtures/synthetic-feed.mjs';

const { Pool } = pg;

const MIGRATIONS_DIR = join(import.meta.dirname, '..', 'migrations');
const MERCHANT = 'pg-test-merchant';
const SOURCE = 'test:shopping:0000';
const STAMP = '2026-11-10T12:31:41.000Z';
const NOW = new Date('2026-11-10T13:00:00.000Z');
const CONTAINER_TIMEOUT_MS = 180_000;

// ── finding a database ──────────────────────────────────────────────────────

async function openDatabase() {
  const dsn = process.env['HONESTTOTAL_PG_DSN'];
  if (dsn) {
    return { pool: new Pool({ connectionString: dsn }), stop: async () => {}, how: 'DSN' };
  }
  if (process.env['NEXUS_PG_TESTS'] === '1') {
    const { PostgreSqlContainer } = await import('@testcontainers/postgresql');
    const container = await new PostgreSqlContainer('postgres:16-alpine').start();
    return {
      pool: new Pool({ connectionString: container.getConnectionUri() }),
      stop: () => container.stop(),
      how: 'testcontainers',
    };
  }
  return null;
}

const db = await openDatabase();

/*
 * IN CI, A MISSING DATABASE IS A FAILURE, NOT A SKIP.
 *
 * Skipping is the right answer on a workstation with no container runtime. It
 * is the wrong answer on a runner, where it would turn "the adapter is
 * unproven" into a green build — which is exactly the bug turbo.json already
 * carries a warning about, from the time an undeclared env var let the auth
 * service's Postgres suites skip silently. The flag is set in ci.yml's
 * unit-tests job; if it ever stops being set, this stops the build instead of
 * quietly dropping the only tests that touch a real database.
 */
if (!db && process.env['CI'] === 'true') {
  throw new Error(
    'CI has no PostgreSQL for the catalog adapter suite. Expected NEXUS_PG_TESTS=1 ' +
      '(testcontainers) or HONESTTOTAL_PG_DSN. Refusing to skip: these are the only ' +
      'tests that prove the unique indexes, the transaction boundary and the ' +
      'concurrent-apply guarantee.',
  );
}

const skip = db
  ? false
  : 'no PostgreSQL: set HONESTTOTAL_PG_DSN, or NEXUS_PG_TESTS=1 with a container runtime';

if (db) {
  await new CatalogMigrationRunner(db.pool, MIGRATIONS_DIR).migrate();
  after(async () => {
    await db.pool.end();
    await db.stop();
  }, CONTAINER_TIMEOUT_MS);
}

/** A clean catalog schema between tests, without re-running the migration. */
async function reset() {
  await db.pool.query(
    'TRUNCATE catalog.import_run, catalog.merchant_offer, catalog.offer_price_history, catalog.quarantined_row',
  );
}

function store() {
  return new PostgresOfferStore(db.pool);
}

/**
 * Rows stamped as if the provider generated them half an hour before `now`.
 *
 * The stamp has to travel with the import time. A fixed one plus a `now` two
 * days later is 49 hours old, which the 48-hour freshness guard correctly
 * refuses — and a test whose second import is silently refused asserts
 * nothing. It did exactly that until this suite was first run against a real
 * engine: three lifecycle tests were advancing their own `now` while leaving
 * the feed dated 10 November, so the imports they were asserting about never
 * happened.
 */
function rowsAt(now, specs) {
  const lastUpdated = new Date(now.getTime() - 30 * 60_000).toISOString();
  return specs.map((spec) => product({ lastUpdated, ...spec }));
}

async function runImport(target, rows, now = NOW) {
  return importFeedArchive(zipOf(buildFeed(rows)), target, {
    merchantId: MERCHANT,
    sourceFeed: SOURCE,
    now,
  });
}

/** Two products, enough to show identity, history and lifecycle. */
function twoProducts(now = NOW, priceOne = '79.99 USD') {
  return rowsAt(now, [
    { id: 'SKU-1', gtin: gtin12('01234567891'), price: priceOne },
    { id: 'SKU-2', gtin: gtin12('01234567892'), price: '49.99 USD' },
  ]);
}

/** One product, for the imports that only need something to be present. */
function oneProduct(now = NOW, price = '79.99 USD') {
  return rowsAt(now, [{ id: 'SKU-1', gtin: gtin12('01234567891'), price }]);
}

async function count(table, where = '', params = []) {
  const result = await db.pool.query(
    `SELECT count(*)::int AS c FROM catalog.${table} ${where}`,
    params,
  );
  return result.rows[0].c;
}

// ── migration ───────────────────────────────────────────────────────────────

test(
  'the migration applies to a fresh database and is a no-op on a second run',
  { skip },
  async () => {
    const runner = new CatalogMigrationRunner(db.pool, MIGRATIONS_DIR);
    // It already ran above, so there is nothing outstanding — which is the
    // property worth asserting: applying twice must not try to recreate a table.
    assert.deepEqual(await runner.migrate(), []);

    const applied = (await runner.applied()).map((m) => m.version);
    assert.deepEqual(applied, await runner.available());
    assert.ok(applied.includes('0001_catalog_init'));

    const tables = (
      await db.pool.query(
        `SELECT table_name FROM information_schema.tables WHERE table_schema = 'catalog' ORDER BY table_name`,
      )
    ).rows.map((r) => r.table_name);
    assert.deepEqual(tables, [
      'import_run',
      'merchant_offer',
      'offer_price_history',
      'quarantined_row',
      'schema_migration',
    ]);
  },
);

test('every table lives in the catalog schema and nowhere else', { skip }, async () => {
  // The per-context schema IS the architectural boundary (docs/06 §4,
  // ADR-0020), so a migration that leaked a table into `public` would be a
  // boundary violation rather than an untidy name.
  const leaked = (
    await db.pool.query(
      `SELECT table_name FROM information_schema.tables
        WHERE table_schema = 'public'
          AND table_name IN ('import_run','merchant_offer','offer_price_history',
                             'quarantined_row','schema_migration')`,
    )
  ).rows;
  assert.deepEqual(leaked, []);
});

// ── constraints the in-memory adapter cannot enforce ────────────────────────

test(
  'offer identity is (merchant_id, merchant_offer_id) and the database says so',
  { skip },
  async () => {
    await reset();
    await runImport(store(), twoProducts());

    const [offer] = (await store().listOffers(MERCHANT)).filter(
      (o) => o.merchantOfferId === 'SKU-1',
    );
    await assert.rejects(
      () =>
        db.pool.query(
          `INSERT INTO catalog.merchant_offer (
           id, merchant_id, merchant_offer_id, brand, title, list_price_minor, currency,
           availability, condition, product_url, image_url, snapshot_at, source_feed,
           first_seen_run, last_seen_run, last_seen_at
         ) SELECT 'a-different-id', merchant_id, merchant_offer_id, brand, title,
                  list_price_minor, currency, availability, condition, product_url,
                  image_url, snapshot_at, source_feed, first_seen_run, last_seen_run,
                  last_seen_at
             FROM catalog.merchant_offer WHERE id = $1`,
          [offer.id],
        ),
      (error) => error.code === '23505' && error.constraint === 'merchant_offer_identity',
    );
  },
);

test(
  'a verified shipping cost without a destination is refused by the schema',
  { skip },
  async () => {
    await reset();
    await runImport(store(), twoProducts());
    const [offer] = await store().listOffers(MERCHANT);

    // This is the constraint that stops a future writer from inventing a
    // delivered total: a cost with no destination is not a verified cost.
    await assert.rejects(
      () =>
        db.pool.query(
          `UPDATE catalog.merchant_offer
            SET shipping_verified = true, shipping_cost_minor = 500
          WHERE id = $1`,
          [offer.id],
        ),
      (error) => error.code === '23514' && error.constraint === 'merchant_offer_shipping_complete',
    );

    await assert.rejects(
      () =>
        db.pool.query(`UPDATE catalog.merchant_offer SET fees_verified = true WHERE id = $1`, [
          offer.id,
        ]),
      (error) => error.code === '23514' && error.constraint === 'merchant_offer_fees_complete',
    );
  },
);

test('nothing imported from this feed carries a shipping or fee figure', { skip }, async () => {
  await reset();
  await runImport(store(), twoProducts());
  assert.equal(await count('merchant_offer', 'WHERE shipping_verified'), 0);
  assert.equal(await count('merchant_offer', 'WHERE fees_verified'), 0);
  assert.equal(
    await count(
      'merchant_offer',
      'WHERE shipping_cost_minor IS NOT NULL OR shipping_destination IS NOT NULL OR fees_total_minor IS NOT NULL',
    ),
    0,
  );
});

// ── run status handling ─────────────────────────────────────────────────────

test('a run is recorded before the work and completed after it', { skip }, async () => {
  await reset();
  const result = await runImport(store(), twoProducts());
  assert.equal(result.run.status, 'applied');

  const runs = await store().listRuns(MERCHANT);
  assert.equal(runs.length, 1);
  assert.equal(runs[0].rowsTotal, 2);
  assert.equal(runs[0].offersAdded, 2);
  assert.equal(runs[0].offersRemoved, 0);
  assert.equal(runs[0].offersUpdated, 0);
  assert.equal(runs[0].offersUnchanged, 0);
  assert.equal(runs[0].rowsQuarantined, 0);
  assert.notEqual(runs[0].finishedAt, null);
});

test('a stale export is refused and the refusal is in the ledger', { skip }, async () => {
  await reset();
  const target = store();
  // Stamped 10 November, imported on the 20th: ten days old, which is what the
  // guard is for. This stamp is pinned rather than derived from `now`.
  const stale = [
    product({ lastUpdated: STAMP, id: 'SKU-1', gtin: gtin12('01234567891'), price: '79.99 USD' }),
  ];
  const result = await runImport(target, stale, new Date('2026-11-20T13:00:00.000Z'));

  assert.equal(result.applied, false);
  assert.equal(result.run.status, 'skipped_stale');
  assert.match(result.run.skipReason, /freshness/);
  assert.equal(await count('merchant_offer'), 0, 'a refused import writes no offers');
  assert.equal(await count('import_run'), 1, 'but the attempt is recorded');
});

test(
  're-importing the same payload changes nothing and is recorded as a duplicate',
  { skip },
  async () => {
    await reset();
    const target = store();
    const rows = twoProducts();
    await runImport(target, rows);

    const offersBefore = await count('merchant_offer');
    const historyBefore = await count('offer_price_history');

    const again = await runImport(target, rows, new Date(NOW.getTime() + 60_000));
    assert.equal(again.applied, false);
    assert.equal(again.run.status, 'skipped_duplicate');

    assert.equal(await count('merchant_offer'), offersBefore, 'no duplicate offers');
    assert.equal(await count('offer_price_history'), historyBefore, 'no duplicate history');
    assert.equal(await count('import_run'), 2, 'both attempts are in the ledger');
    assert.equal(await count('import_run', "WHERE status = 'applied'"), 1);
  },
);

// ── transactions ────────────────────────────────────────────────────────────

test('a write phase that throws leaves the catalogue untouched', { skip }, async () => {
  await reset();
  const target = store();
  await runImport(target, twoProducts());

  const before = await store().listOffers(MERCHANT);
  const historyBefore = await count('offer_price_history');

  const boom = new Error('simulated failure after a partial write');
  await assert.rejects(
    () =>
      target.applyRun(async (tx) => {
        await tx.upsertOffer({ ...before[0], title: 'HALF-WRITTEN' });
        await tx.appendPriceHistory([
          {
            offerId: before[0].id,
            importRunId: before[0].lastSeenRun,
            observedAt: NOW.toISOString(),
            listPrice: { amountMinor: 1, currency: 'USD' },
            salePrice: null,
            changeKind: 'sale',
          },
        ]);
        throw boom;
      }),
    (error) => error === boom,
  );

  const after = await store().listOffers(MERCHANT);
  assert.deepEqual(after, before, 'the rollback restored every column');
  assert.equal(await count('offer_price_history'), historyBefore);
  assert.equal(await count('merchant_offer', "WHERE title = 'HALF-WRITTEN'"), 0);
});

test(
  'a failed import is recorded as failed, with no partial offers and no feed content in the reason',
  { skip },
  async () => {
    await reset();

    /*
     * The failure is injected at the LAST write of the phase, so if atomicity
     * were broken the 2 offers ahead of it would already be committed. A
     * constraint violation is used rather than a thrown Error because that is
     * the realistic failure — and because its Postgres message quotes the
     * offending row, which is what `skip_reason` must not end up holding.
     */
    const target = store();
    const broken = new Proxy(target, {
      get(inner, key, receiver) {
        if (key !== 'applyRun') return Reflect.get(inner, key, receiver);
        return (work) =>
          inner.applyRun(async (tx) => {
            await work(tx);
            await tx.recordQuarantine([
              {
                importRunId: '00000000-0000-4000-8000-000000000000',
                merchantId: MERCHANT,
                rowNumber: 1,
                merchantOfferId: 'X',
                reasons: ['injected'],
              },
            ]);
          });
      },
    });

    await assert.rejects(
      () => runImport(broken, twoProducts()),
      (error) => error.code === '23503',
    );

    assert.equal(await count('merchant_offer'), 0, 'not one offer survived the failure');
    assert.equal(await count('offer_price_history'), 0);
    const runs = await store().listRuns(MERCHANT);
    assert.equal(runs.length, 1);
    assert.equal(runs[0].status, 'failed');
    assert.match(runs[0].skipReason, /^database 23503/);
    // The reason carries a code and a constraint name. Nothing else.
    assert.ok(!/SKU-|79\.99|http/.test(runs[0].skipReason), runs[0].skipReason);
  },
);

// ── concurrency ─────────────────────────────────────────────────────────────

/*
 * THE ONE TEST IN THIS FILE THAT NEEDS A REAL SERVER, not merely a real engine.
 * It requires two backends holding two transactions at the same time, so an
 * in-process PostgreSQL build (PGlite and friends) cannot run it however
 * faithful its SQL is. A failure here on such an engine is the engine, not the
 * adapter; the deterministic half of the same guarantee is the test below.
 */
test('two simultaneous imports of one export apply exactly once', { skip }, async () => {
  await reset();
  const rows = twoProducts();

  // Separate store instances over the same pool: two connections, two
  // transactions, no shared in-process state to coordinate them. The database
  // is the only arbiter.
  const settled = await Promise.allSettled([runImport(store(), rows), runImport(store(), rows)]);

  assert.deepEqual(
    settled.map((s) => s.status),
    ['fulfilled', 'fulfilled'],
    'the loser must be a reported duplicate, not a crash',
  );
  const applied = settled.filter((s) => s.value.applied);
  const skipped = settled.filter((s) => !s.value.applied);
  assert.equal(applied.length, 1, 'exactly one application');
  assert.equal(skipped.length, 1);
  assert.equal(skipped[0].value.run.status, 'skipped_duplicate');

  assert.equal(await count('import_run', "WHERE status = 'applied'"), 1);
  assert.equal(await count('merchant_offer'), rows.length, 'no doubled offers');
  assert.equal(await count('offer_price_history'), rows.length, 'no doubled history');
});

test(
  'the applied-once index refuses a second applied run for the same payload',
  { skip },
  async () => {
    await reset();
    const target = store();
    const rows = twoProducts();
    const first = await runImport(target, rows);
    assert.equal(first.applied, true);

    // The race loser's exact path, driven deterministically: a second run that
    // did the work and only then tried to claim the payload.
    const second = '11111111-1111-4111-8111-111111111111';
    await target.beginRun({
      id: second,
      merchantId: MERCHANT,
      sourceFeed: SOURCE,
      contentSha256: first.run.contentSha256,
      feedExportedAt: first.run.feedExportedAt,
      startedAt: NOW.toISOString(),
      rowsTotal: rows.length,
      offersAdded: null,
      offersRemoved: null,
      offersUpdated: null,
      offersUnchanged: null,
      rowsQuarantined: null,
      skipReason: null,
      status: 'started',
    });

    await assert.rejects(
      () => target.applyRun((tx) => tx.finishRun(second, { status: 'applied' })),
      (error) => error instanceof DuplicateApplyError,
    );
    assert.equal(await count('import_run', "WHERE status = 'applied'"), 1);
  },
);

// ── lifecycle and history ───────────────────────────────────────────────────

test('a product that leaves the feed goes inactive and keeps its history', { skip }, async () => {
  await reset();
  const target = store();
  await runImport(target, twoProducts());
  const gone = await target.findOffer(MERCHANT, 'SKU-2');

  const dayTwo = new Date(NOW.getTime() + 86_400_000);
  const second = await runImport(target, oneProduct(dayTwo, '69.99 USD'), dayTwo);
  assert.equal(second.applied, true);
  assert.equal(second.reconciliation.removed.length, 1);

  const after = await target.findOffer(MERCHANT, 'SKU-2');
  assert.equal(after.state, 'inactive');
  assert.notEqual(after.inactiveSince, null);
  assert.equal(after.lastSeenRun, gone.lastSeenRun, 'the sighting was not refreshed');
  assert.equal((await target.listPriceHistory(gone.id)).length, 1, 'history survives');

  // …and a third import, still without SKU-2, must not move the date it went away.
  const dayThree = new Date(NOW.getTime() + 2 * 86_400_000);
  const third = await runImport(target, oneProduct(dayThree, '59.99 USD'), dayThree);
  assert.equal(third.applied, true);
  assert.equal(third.reconciliation.removed.length, 0, 'already-inactive is not re-reported');
  const later = await target.findOffer(MERCHANT, 'SKU-2');
  assert.equal(later.inactiveSince, after.inactiveSince);
});

test('a returning product is revived with inactive_since cleared', { skip }, async () => {
  await reset();
  const target = store();
  const rows = twoProducts();
  await runImport(target, rows);

  const dayTwo = new Date(NOW.getTime() + 86_400_000);
  await runImport(target, oneProduct(dayTwo), dayTwo);
  assert.equal((await target.findOffer(MERCHANT, 'SKU-2')).state, 'inactive');

  /*
   * Day three carries both products at their original prices and links, so
   * SKU-2 takes the `unchanged` branch — the one that used to set the state and
   * leave `inactive_since` behind. Only the feed's own stamp differs, and the
   * differ ignores provenance, which is the point.
   */
  const dayThree = new Date(NOW.getTime() + 2 * 86_400_000);
  const back = await runImport(target, twoProducts(dayThree), dayThree);
  assert.equal(back.applied, true);
  const revived = await target.findOffer(MERCHANT, 'SKU-2');
  assert.equal(revived.state, 'active');
  assert.equal(revived.inactiveSince, null);
});

test('price history records movement, not sightings', { skip }, async () => {
  await reset();
  const target = store();
  await runImport(target, twoProducts(NOW, '79.99 USD'));
  const offer = await target.findOffer(MERCHANT, 'SKU-1');
  assert.equal((await target.listPriceHistory(offer.id)).length, 1);

  // Same prices, a new export: the provider's stamp alone makes it a different
  // payload, and standing still must not earn a history row.
  const dayTwo = new Date(NOW.getTime() + 86_400_000);
  await runImport(target, twoProducts(dayTwo, '79.99 USD'), dayTwo);
  assert.equal((await target.listPriceHistory(offer.id)).length, 1, 'no row for standing still');

  /*
   * Day three moves the SALE price and leaves the regular one alone. That is
   * the real feed's dominant price event — 35 of 35 observed movements between
   * 9 and 10 November were sale-price moves — and the fixture keeps the two in
   * separate columns, so `price` here is the REGULAR price.
   */
  const dayThree = new Date(NOW.getTime() + 2 * 86_400_000);
  await runImport(
    target,
    rowsAt(dayThree, [
      { id: 'SKU-1', gtin: gtin12('01234567891'), price: '79.99 USD', salePrice: '14.99 USD' },
      { id: 'SKU-2', gtin: gtin12('01234567892'), price: '49.99 USD' },
    ]),
    dayThree,
  );
  const history = await target.listPriceHistory(offer.id);
  assert.equal(history.length, 2);
  assert.equal(history[0].changeKind, 'initial');
  assert.equal(history[1].changeKind, 'sale');
  assert.equal(history[1].salePrice.amountMinor, 1499);
  assert.equal(history[1].listPrice.amountMinor, 7999, 'the regular price did not move');
  assert.equal(history[1].listPrice.currency, 'USD');

  // …and a regular-price move is recorded as its own kind, so a report cannot
  // present one as the other.
  const dayFour = new Date(NOW.getTime() + 3 * 86_400_000);
  await runImport(
    target,
    rowsAt(dayFour, [
      { id: 'SKU-1', gtin: gtin12('01234567891'), price: '69.99 USD', salePrice: '14.99 USD' },
      { id: 'SKU-2', gtin: gtin12('01234567892'), price: '49.99 USD' },
    ]),
    dayFour,
  );
  const later = await target.listPriceHistory(offer.id);
  assert.equal(later.length, 3);
  assert.equal(later[2].changeKind, 'list');
  assert.equal(later[2].listPrice.amountMinor, 6999);
});

test('money survives the round trip as integer minor units', { skip }, async () => {
  await reset();
  const target = store();
  await runImport(target, oneProduct(NOW, '79.99 USD'));
  const offer = await target.findOffer(MERCHANT, 'SKU-1');
  assert.equal(offer.listPrice.amountMinor, 7999);
  assert.equal(offer.listPrice.currency, 'USD');
  assert.equal(Number.isSafeInteger(offer.listPrice.amountMinor), true);

  // The column is int8, so it can hold more than a JS number represents
  // exactly. What happens then is the next test.
  const column = await db.pool.query(
    `SELECT data_type FROM information_schema.columns
      WHERE table_schema = 'catalog' AND table_name = 'merchant_offer'
        AND column_name = 'list_price_minor'`,
  );
  assert.equal(column.rows[0].data_type, 'bigint');
});

test(
  'an amount beyond exact representation is refused on read, never rounded',
  { skip },
  async () => {
    await reset();
    const target = store();
    await runImport(target, oneProduct(NOW, '79.99 USD'));
    const offer = await target.findOffer(MERCHANT, 'SKU-1');

    /*
     * 2^53 + 1: a value int8 holds exactly and a JS number cannot. It is written
     * past the adapter on purpose — the question is what happens when a row
     * ALREADY holds such a figure, because `Number()` would hand back
     * 9007199254740992 and every total computed from it would be silently one
     * unit wrong, forever. Reading has to fail loudly instead.
     *
     * Asserting this rather than the driver's int8-to-string mapping keeps the
     * test about THIS adapter's guarantee, which is the one that matters and the
     * one that holds whatever maps the column.
     */
    await db.pool.query(
      'UPDATE catalog.merchant_offer SET list_price_minor = 9007199254740993 WHERE id = $1',
      [offer.id],
    );
    await assert.rejects(() => target.findOffer(MERCHANT, 'SKU-1'), /not a safe integer/);
  },
);

// ── what only a real server can show ────────────────────────────────────────

test('the pool opens a connection per concurrent transaction', { skip }, async () => {
  await reset();
  const target = store();

  /*
   * `applyRun` has to take its own connection, or two overlapping imports would
   * interleave BEGIN and COMMIT on one session and corrupt each other. Proving
   * that needs a real server: five transactions are opened and HELD open behind
   * a gate, and the server itself is asked how many sessions are sitting in a
   * transaction. An adapter that serialised on a single connection could never
   * reach five, and would in fact deadlock against its own gate.
   */
  let release = () => {};
  const gate = new Promise((resolve) => {
    release = resolve;
  });

  const held = Array.from({ length: 5 }, () => target.applyRun(async () => gate));

  const inTransaction = async () =>
    (
      await db.pool.query(
        `SELECT count(*)::int AS c FROM pg_stat_activity
          WHERE datname = current_database() AND state = 'idle in transaction'`,
      )
    ).rows[0].c;

  let peak = 0;
  const deadline = Date.now() + 15_000;
  while (Date.now() < deadline) {
    peak = Math.max(peak, await inTransaction());
    if (peak >= 5) break;
  }
  release();
  await Promise.all(held);

  assert.equal(peak, 5, `expected 5 concurrent transactions, saw ${peak}`);

  // And the connections go back: the pool is reusable after the burst.
  assert.equal((await store().listOffers(MERCHANT)).length, 0);
});

test('timestamps survive the round trip to the millisecond', { skip }, async () => {
  await reset();
  const target = store();

  /*
   * timestamptz keeps microseconds and JavaScript keeps milliseconds, so the
   * lossy direction is reading, not writing. A silent truncation here would
   * move a feed's export time and could make a fresh export look stale — the
   * 48-hour guard is computed from exactly this field.
   */
  const exported = '2026-11-10T12:30:00.123Z';
  const at = new Date('2026-11-10T13:00:00.456Z');
  await runImport(
    target,
    [
      product({
        lastUpdated: exported,
        id: 'SKU-1',
        gtin: gtin12('01234567891'),
        price: '79.99 USD',
      }),
    ],
    at,
  );

  const offer = await target.findOffer(MERCHANT, 'SKU-1');
  assert.equal(Date.parse(offer.snapshotAt), Date.parse(exported), 'the export stamp kept its ms');
  assert.equal(offer.lastSeenAt, at.toISOString(), 'the sighting kept its ms exactly');

  const run = (await target.listRuns(MERCHANT))[0];
  assert.equal(Date.parse(run.feedExportedAt), Date.parse(exported));
  assert.equal(run.startedAt, at.toISOString());

  // Reading twice must give the same string: no re-formatting drift.
  assert.equal((await target.findOffer(MERCHANT, 'SKU-1')).lastSeenAt, offer.lastSeenAt);
});

test('a BIGINT at the edge of exact representation reads back exactly', { skip }, async () => {
  await reset();
  const target = store();
  await runImport(target, oneProduct(NOW, '79.99 USD'));
  const offer = await target.findOffer(MERCHANT, 'SKU-1');

  /*
   * 2^53 − 1: the largest integer a JS number holds exactly, and well inside
   * int8. node-postgres hands int8 back as a STRING precisely so this does not
   * go through a float — asserting the value rather than the type keeps the
   * test about the guarantee instead of the driver's choice of representation.
   * The companion test above covers 2^53 + 1, which must be refused.
   */
  const edge = 9007199254740991;
  await db.pool.query('UPDATE catalog.merchant_offer SET list_price_minor = $1 WHERE id = $2', [
    String(edge),
    offer.id,
  ]);

  const read = await target.findOffer(MERCHANT, 'SKU-1');
  assert.equal(read.listPrice.amountMinor, edge);
  assert.equal(Number.isSafeInteger(read.listPrice.amountMinor), true);

  // The price history column is the same type and must behave the same way.
  await db.pool.query('UPDATE catalog.offer_price_history SET list_price_minor = $1', [
    String(edge),
  ]);
  const history = await target.listPriceHistory(offer.id);
  assert.equal(history[0].listPrice.amountMinor, edge);
});

// ── the real exports ────────────────────────────────────────────────────────

const FEED_A = process.env['HONESTTOTAL_FEED_A'];
const FEED_B = process.env['HONESTTOTAL_FEED_B'];
const realSkip = skip || (FEED_A && FEED_B ? false : 'HONESTTOTAL_FEED_A/B not set');

test(
  'the 9 and 10 November exports reconcile in Postgres exactly as measured',
  { skip: realSkip },
  async () => {
    await reset();
    const target = store();
    const options = { merchantId: MERCHANT, sourceFeed: SOURCE };

    const first = await importFeedArchive(readFileSync(FEED_A), target, {
      ...options,
      now: new Date('2026-11-09T13:30:00.000Z'),
    });
    assert.equal(first.applied, true);
    assert.equal(first.run.rowsTotal, 225);
    assert.equal(await count('merchant_offer'), 225);
    assert.equal(await count('offer_price_history'), 225);

    const second = await importFeedArchive(readFileSync(FEED_B), target, {
      ...options,
      now: new Date('2026-11-10T13:30:00.000Z'),
    });
    assert.equal(second.applied, true);

    const r = second.reconciliation;
    assert.equal(r.added.length, 1);
    assert.equal(r.removed.length, 1);
    assert.equal(r.updated.length, 183);
    assert.equal(r.unchanged.length, 41);
    assert.equal(second.quarantined, 0);

    const combos = new Map();
    for (const u of r.updated) {
      const key = [...u.changedFields].sort().join('+');
      combos.set(key, (combos.get(key) ?? 0) + 1);
    }
    assert.deepEqual(Object.fromEntries([...combos].sort()), {
      imageUrl: 1,
      productUrl: 147,
      'productUrl+salePrice': 31,
      salePrice: 4,
    });
    assert.equal((combos.get('productUrl') ?? 0) + (combos.get('productUrl+salePrice') ?? 0), 178);
    assert.equal(r.updated.filter((u) => u.priceChange !== null).length, 35);

    // …and the same figures read back out of the database rather than from the
    // return value, because what matters is what was stored.
    assert.equal(await count('merchant_offer'), 226);
    assert.equal(await count('merchant_offer', "WHERE state = 'active'"), 225);
    assert.equal(await count('merchant_offer', "WHERE state = 'inactive'"), 1);
    assert.equal(await count('offer_price_history'), 225 + 1 + 35);
    assert.equal(await count('quarantined_row'), 0);
    assert.equal(await count('merchant_offer', 'WHERE shipping_verified OR fees_verified'), 0);

    const runs = await target.listRuns(MERCHANT);
    assert.deepEqual(
      runs.map((run) => run.status),
      ['applied', 'applied'],
    );
    assert.equal(runs[1].offersAdded, 1);
    assert.equal(runs[1].offersRemoved, 1);
    assert.equal(runs[1].offersUpdated, 183);
    assert.equal(runs[1].offersUnchanged, 41);
  },
);
