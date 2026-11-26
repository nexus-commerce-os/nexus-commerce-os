/*
 * THE REAL CLOUDFLARE D1, over its actual HTTP API.
 *
 * The SQLite contract harness proves the adapter's logic. It cannot prove the
 * platform: its own header lists three things it does not know, and this file
 * exists to stop those being assumptions. Everything asserted below was first
 * MEASURED against a live database in APAC/SIN and only then written down as a
 * test, so a future change in D1's behaviour fails here instead of in an
 * import.
 *
 * ISOLATION. Each run creates its own throwaway database and deletes it at the
 * end. Nothing here can touch honesttotal-catalog-staging or -prod, which is
 * worth more than the two seconds the creation costs.
 *
 * OPT-IN. Without HONESTTOTAL_D1_ACCOUNT_ID and HONESTTOTAL_D1_API_TOKEN every
 * test below is SKIPPED AND REPORTED, never silently omitted — the same rule
 * the Postgres suite follows.
 */
import assert from 'node:assert/strict';
import { after, before, test } from 'node:test';

import {
  D1OfferStore,
  DuplicateApplyError,
  GenerationPublisher,
  GenerationRejectedError,
  importFeedArchive,
} from '../dist/index.js';
import { d1Schema } from './helpers/sqlite-d1.mjs';
import {
  D1HttpError,
  UsageMeter,
  createRemoteD1,
  createThrowawayDatabase,
  deleteDatabase,
  remoteD1Config,
} from './helpers/remote-d1.mjs';
import { buildFeed, gtin12, product, zipOf } from './fixtures/synthetic-feed.mjs';

const config = remoteD1Config();
const skip = config
  ? false
  : 'set HONESTTOTAL_D1_ACCOUNT_ID and HONESTTOTAL_D1_API_TOKEN to run against real D1';

let databaseId;
let db;

before(async () => {
  if (skip) return;
  // A name that says what it is and when, so an abandoned one is identifiable
  // rather than mysterious.
  const stamp = new Date()
    .toISOString()
    .replace(/[^0-9]/g, '')
    .slice(0, 14);
  databaseId = await createThrowawayDatabase(config, `honesttotal-catalog-ci-${stamp}`);
  db = createRemoteD1(config, databaseId);
  // exec() is the one shape the HTTP API runs as a unit: many statements, no
  // bindings. That it applies the real migrations is the point.
  await db.exec(await d1Schema());
});

after(async () => {
  if (skip || !databaseId) return;
  await deleteDatabase(config, databaseId);
});

const MERCHANT = 'northwind';

const run = (over = {}) => ({
  id: 'run-1',
  merchantId: MERCHANT,
  sourceFeed: 'test:feed',
  contentSha256: 'sha-aaa',
  feedExportedAt: '2026-11-26T11:00:00.000Z',
  startedAt: '2026-11-26T12:00:00.000Z',
  status: 'started',
  ...over,
});

const offer = (over = {}) => ({
  id: 'o-1',
  merchantId: MERCHANT,
  merchantOfferId: 'NW-1',
  gtin: '0012345678905',
  mpn: 'NWTM-1',
  brand: 'Northwind Trading',
  title: 'Northwind Trading Travel Mug',
  listPrice: { amountMinor: 2499, currency: 'USD' },
  salePrice: { amountMinor: 1999, currency: 'USD' },
  availability: 'in stock',
  condition: 'new',
  productUrl: 'https://example.invalid/p/1',
  imageUrl: 'https://cdn.example.invalid/1.jpg',
  shippingVerified: false,
  shippingCost: null,
  shippingDestination: null,
  feesVerified: false,
  feesTotal: null,
  snapshotAt: '2026-11-26T12:00:00.000Z',
  sourceFeed: 'test:feed',
  firstSeenRun: 'run-1',
  lastSeenRun: 'run-1',
  lastSeenAt: '2026-11-26T12:00:00.000Z',
  state: 'active',
  inactiveSince: null,
  ...over,
});

/** Empties only the tables these tests write, in dependency order. */
async function reset() {
  await db.exec(
    [
      'DELETE FROM catalog_offer_price_history;',
      'DELETE FROM catalog_quarantined_row;',
      'DELETE FROM catalog_merchant_offer;',
      'DELETE FROM catalog_import_run;',
    ].join('\n'),
  );
}

// ───────────────────────────── transport facts ─────────────────────────────

test('the 100-bound-parameter ceiling is the platform, not a guess', { skip }, async () => {
  const hundred = Array.from({ length: 100 }, (_, i) => i);
  const ok = await db
    .prepare(`SELECT ${hundred.map(() => '?').join(',')}`)
    .bind(...hundred)
    .all();
  assert.equal(ok.success, true, '100 parameters is accepted');

  await assert.rejects(
    () =>
      db
        .prepare(`SELECT ${[...hundred, 100].map(() => '?').join(',')}`)
        .bind(...hundred, 100)
        .all(),
    (error) => {
      assert.ok(error instanceof D1HttpError);
      assert.equal(error.status, 400);
      // MAX_BOUND_PARAMS = 100 in d1-client.ts is this error, not folklore.
      assert.match(error.message, /too many SQL variables/);
      return true;
    },
    '101 parameters is refused by D1 itself',
  );
});

test('an error carries the statement but never the bindings', { skip }, async () => {
  await assert.rejects(
    () => db.prepare('SELECT * FROM no_such_table WHERE secret = ?').bind('s3cret-value').all(),
    (error) => {
      assert.match(error.sql, /no_such_table/);
      assert.ok(
        !JSON.stringify({ m: error.message, s: error.sql }).includes('s3cret-value'),
        'a bound value must not reach the error, which is the easiest place to leak a credential',
      );
      return true;
    },
  );
});

test('a multi-statement request IS atomic on D1', { skip }, async () => {
  await db.exec('CREATE TABLE IF NOT EXISTS _atomicity (id INTEGER PRIMARY KEY, v TEXT NOT NULL)');
  await db.exec("DELETE FROM _atomicity;\nINSERT INTO _atomicity (id, v) VALUES (1, 'before');");

  await assert.rejects(
    () =>
      db.exec(
        [
          "INSERT INTO _atomicity (id, v) VALUES (2, 'second');",
          "INSERT INTO _atomicity (id, v) VALUES (1, 'clash');",
        ].join('\n'),
      ),
    /UNIQUE constraint failed/,
  );

  const rows = await db.prepare('SELECT id FROM _atomicity ORDER BY id').all();
  // The FIRST statement rolled back too. This is what makes exec() usable for
  // schema and for the publication pointer, and it is measured, not assumed.
  assert.deepEqual(
    rows.results.map((r) => r.id),
    [1],
    'the statement before the failure must not survive it',
  );
  await db.exec('DROP TABLE _atomicity');
});

test('foreign keys are enforced, and cannot be turned off per query', { skip }, async () => {
  await reset();
  const store = new D1OfferStore(db);
  await assert.rejects(
    () => store.upsertOffer(offer({ firstSeenRun: 'no-such-run', lastSeenRun: 'no-such-run' })),
    /FOREIGN KEY constraint failed/,
    'the SQLite harness claims D1 enforces these; this is the claim being checked',
  );
  const pragma = await db.prepare('PRAGMA foreign_keys').all();
  assert.equal(pragma.results[0].foreign_keys, 1);
});

test('the CHECKs that make a half-known cost unrecordable really fire', { skip }, async () => {
  await reset();
  const store = new D1OfferStore(db);
  await store.beginRun(run());

  await assert.rejects(
    () => store.upsertOffer(offer({ shippingVerified: true })),
    /CHECK constraint failed/,
    'verified shipping with no cost and no destination is not a fact',
  );
});

test('identity, not the primary key, is what cannot duplicate', { skip }, async () => {
  await reset();
  const store = new D1OfferStore(db);
  await store.beginRun(run());
  await store.upsertOffer(offer({ id: 'pk-A' }));

  // Same (merchant, merchant_offer_id), different generated id. The upsert
  // must land on the existing row rather than create a second one.
  await store.upsertOffer(offer({ id: 'pk-B', title: 'Renamed By The Feed' }));

  const count = await db
    .prepare('SELECT COUNT(*) AS n FROM catalog_merchant_offer WHERE merchant_id = ?')
    .bind(MERCHANT)
    .all();
  assert.equal(count.results[0].n, 1, 'one identity is one row');
  const found = await store.findOffer(MERCHANT, 'NW-1');
  assert.equal(found.title, 'Renamed By The Feed');
});

// ────────────────────── import, re-import, recovery ──────────────────────

const feedOf = (rows) => zipOf(buildFeed(rows));

/*
 * The feed's own stamp, an hour before NOW. product() fills lastUpdated with
 * 29 Oct, so a row built without this override is three weeks stale and the
 * freshness guard refuses the whole import — the same trap already recorded
 * at the top of import-feed.test.mjs.
 */
const STAMP = '2026-11-26T11:31:41.000Z';
const catalogueRow = (i, price) =>
  product({
    id: `NW-${i}`,
    title: `Northwind Item ${i}`,
    price: `${price} USD`,
    salePrice: '',
    gtin: gtin12(String(10000000000 + i)),
    mpn: `NW-MPN-${i}`,
    lastUpdated: STAMP,
  });

test(
  'a real import writes a real catalogue, and the write cost is measured',
  { skip },
  async () => {
    await reset();
    const meter = new UsageMeter();
    const store = new D1OfferStore(createRemoteD1(config, databaseId, meter));

    const rows = Array.from({ length: 25 }, (_, i) => catalogueRow(i + 1, '19.99'));
    const result = await importFeedArchive(feedOf(rows), store, {
      merchantId: MERCHANT,
      sourceFeed: 'test:feed',
      now: new Date('2026-11-26T12:00:00.000Z'),
    });

    assert.equal(result.applied, true, `import did not apply: ${JSON.stringify(result.run)}`);
    assert.equal(result.run.status, 'applied');
    assert.equal(result.quarantined, 0, 'no row was quarantined for an unexpected reason');
    assert.equal(result.reconciliation.added.length, 25, 'every eligible row became an offer');

    const count = await db
      .prepare('SELECT COUNT(*) AS n FROM catalog_merchant_offer WHERE state = ?')
      .bind('active')
      .all();
    assert.equal(count.results[0].n, 25, 'the rows are in Cloudflare, not in a fixture');

    // Logged rather than asserted to a number: this is the figure the daily
    // write budget in docs/engineering/d1-database.md is derived from, and
    // pinning it would turn an index change into a test failure.
    console.log(
      `      measured: 25 new offers cost rows_written=${meter.rowsWritten}, ` +
        `rows_read=${meter.rowsRead}, requests=${meter.requests}`,
    );
    assert.ok(meter.rowsWritten > 0, 'a write that reported nothing written would be a lie');
  },
);

test(
  're-importing the identical feed applies nothing and duplicates nothing',
  { skip },
  async () => {
    const rows = Array.from({ length: 25 }, (_, i) => catalogueRow(i + 1, '19.99'));
    const meter = new UsageMeter();
    const store = new D1OfferStore(createRemoteD1(config, databaseId, meter));

    const again = await importFeedArchive(feedOf(rows), store, {
      merchantId: MERCHANT,
      sourceFeed: 'test:feed',
      now: new Date('2026-11-26T13:00:00.000Z'),
    });

    assert.equal(again.applied, false);
    assert.equal(again.run.status, 'skipped_duplicate', 'the same bytes are the same import');
    const count = await db.prepare('SELECT COUNT(*) AS n FROM catalog_merchant_offer').all();
    assert.equal(count.results[0].n, 25, 'and nothing was duplicated');
    console.log(`      measured: an unchanged feed cost rows_written=${meter.rowsWritten}`);
  },
);

test('a changed feed moves one price and adds one row, retiring nothing', { skip }, async () => {
  const rows = [
    ...Array.from({ length: 24 }, (_, i) => catalogueRow(i + 1, '19.99')),
    catalogueRow(25, '14.99'),
    catalogueRow(26, '29.99'),
  ];
  const meter = new UsageMeter();
  const store = new D1OfferStore(createRemoteD1(config, databaseId, meter));

  const third = await importFeedArchive(feedOf(rows), store, {
    merchantId: MERCHANT,
    sourceFeed: 'test:feed',
    now: new Date('2026-11-26T14:00:00.000Z'),
  });

  assert.equal(third.applied, true, `import did not apply: ${JSON.stringify(third.run)}`);
  assert.equal(third.reconciliation.added.length, 1, 'one new offer');
  assert.equal(
    third.reconciliation.removed.length,
    0,
    'and NOTHING retired — the other 24 were still present',
  );

  const changed = await store.findOffer(MERCHANT, 'NW-25');
  assert.equal(changed.listPrice.amountMinor, 1499, 'the price moved in Cloudflare');

  const history = await db
    .prepare('SELECT COUNT(*) AS n FROM catalog_offer_price_history WHERE offer_id = ?')
    .bind(changed.id)
    .all();
  // TWO rows, not one: a first import OPENS the history (see
  // import-feed.test.mjs, 'a first import adds every offer and opens its price
  // history') and this is the first movement after it. Asserting 1 here was a
  // misreading of the design, not a defect in it.
  assert.equal(history.results[0].n, 2, 'the opening entry plus one movement');
  console.log(
    `      measured: 1 price change + 1 new offer cost rows_written=${meter.rowsWritten}`,
  );
});

test('two concurrent imports of one payload apply exactly once, on real D1', { skip }, async () => {
  await reset();
  const rows = Array.from({ length: 5 }, (_, i) => catalogueRow(i + 1, '9.99'));
  const archive = feedOf(rows);
  const store = new D1OfferStore(db);
  const options = {
    merchantId: MERCHANT,
    sourceFeed: 'test:feed',
    now: new Date('2026-11-26T15:00:00.000Z'),
  };

  const both = await Promise.allSettled([
    importFeedArchive(archive, store, options),
    importFeedArchive(archive, store, options),
  ]);

  const applied = await db
    .prepare('SELECT COUNT(*) AS n FROM catalog_import_run WHERE status = ?')
    .bind('applied')
    .all();
  assert.equal(
    applied.results[0].n,
    1,
    'the partial unique index is the arbiter, and there is exactly one winner',
  );

  const offers = await db.prepare('SELECT COUNT(*) AS n FROM catalog_merchant_offer').all();
  assert.equal(offers.results[0].n, 5, 'the loser contributed no duplicate rows');

  const loser = both.find((r) => r.status === 'rejected' || r.value?.applied !== true);
  assert.ok(loser, 'one of the two must not have applied');
  if (loser.status === 'rejected') {
    assert.ok(
      loser.reason instanceof DuplicateApplyError || /UNIQUE/.test(String(loser.reason)),
      `the loser should lose for the right reason, got: ${loser.reason}`,
    );
  }
});

test('an import interrupted mid-write converges when it is run again', { skip }, async () => {
  await reset();
  const rows = Array.from({ length: 10 }, (_, i) => catalogueRow(i + 1, '12.49'));

  /*
   * Commit HALF the statements and then fail, which is the shape of a Worker
   * hitting its time limit mid-flush: some writes landed, some did not, and
   * nothing rolled them back.
   *
   * The first attempt at this failed on the SECOND batch call — but ten offers
   * at three rows per statement is well inside one 40-statement batch, so a
   * second call never came and the test passed by not running. Splitting the
   * statement list is independent of how the adapter happens to chunk.
   */
  let interrupted = false;
  const flaky = {
    prepare: (sql) => db.prepare(sql),
    exec: (sql) => db.exec(sql),
    async batch(statements) {
      if (interrupted) return db.batch(statements);
      interrupted = true;
      await db.batch(statements.slice(0, Math.floor(statements.length / 2)));
      throw new Error('simulated interruption mid-flush');
    },
  };

  await assert.rejects(
    () =>
      importFeedArchive(feedOf(rows), new D1OfferStore(flaky), {
        merchantId: MERCHANT,
        sourceFeed: 'test:feed',
        now: new Date('2026-11-26T16:00:00.000Z'),
      }),
    /simulated interruption/,
  );

  const midway = await db
    .prepare('SELECT COUNT(*) AS n FROM catalog_import_run WHERE status = ?')
    .bind('applied')
    .all();
  assert.equal(midway.results[0].n, 0, 'an interrupted import is NOT an applied one');

  /*
   * The written rows are STILL THERE, and that is the finding, not a defect:
   * D1 gave applyRun no transaction to roll back, so a dead run leaves its
   * writes behind. How many survive depends on where in the statement list the
   * interruption fell, so the count is reported rather than pinned — an
   * earlier version asserted "fewer than ten" and failed when all ten landed,
   * which proved only that the bound was invented.
   *
   * What must be true is that the leftovers are STAGED, not published, and
   * that the retry converges on them. Both are asserted below.
   */
  const partial = await db.prepare('SELECT COUNT(*) AS n FROM catalog_merchant_offer').all();
  assert.ok(
    partial.results[0].n > 0,
    'an interrupted D1 import leaves its committed writes behind; nothing undoes them',
  );
  console.log(`      measured: ${partial.results[0].n} of 10 offers survived the interruption`);

  // The same feed again, with nothing cleaned up by hand.
  const retry = await importFeedArchive(feedOf(rows), new D1OfferStore(db), {
    merchantId: MERCHANT,
    sourceFeed: 'test:feed',
    now: new Date('2026-11-26T16:05:00.000Z'),
  });
  assert.equal(retry.applied, true, 'the retry succeeds without manual repair');

  const offers = await db
    .prepare('SELECT COUNT(*) AS n FROM catalog_merchant_offer WHERE state = ?')
    .bind('active')
    .all();
  assert.equal(offers.results[0].n, 10, 'and converges on the full catalogue, with no duplicates');
});

// ───────────────── publication, on the real platform ─────────────────

/*
 * publication.test.mjs proves the LOGIC on SQLite. What it cannot prove is
 * that D1's partial indexes behave as the design depends on them to — and the
 * whole concurrency story rests on exactly that: `publication_one_building` is
 * the mutex, and `published_product_open` is what guarantees one live row per
 * product. If either is a no-op on Cloudflare, the design has no mutex and no
 * invariant.
 */

async function resetPublication() {
  await db.exec(
    [
      'DELETE FROM catalog_published_product;',
      'DELETE FROM catalog_publication_candidate;',
      'UPDATE catalog_publication_pointer SET live_generation = NULL WHERE id = 1;',
      'DELETE FROM catalog_publication_generation;',
      'DELETE FROM catalog_product;',
    ].join('\n'),
  );
}

async function makeProduct(id, slug) {
  await db
    .prepare(
      `INSERT INTO catalog_product (id, slug, title, created_at, updated_at)
       VALUES (?, ?, ?, ?, ?)`,
    )
    .bind(id, slug, `Product ${slug}`, '2026-11-26T12:00:00.000Z', '2026-11-26T12:00:00.000Z')
    .run();
  return id;
}

const pubCandidate = (productId, over = {}) => ({
  productId,
  slug: over.slug ?? `slug-${productId}`,
  title: over.title ?? `Title ${productId}`,
  brand: 'Northwind',
  categorySlug: 'drinkware',
  dataVerifiedAt: '2026-11-26T12:00:00.000Z',
  searchText: `title ${productId}`,
  fromPrice: over.fromPrice === undefined ? { amountMinor: 1999, currency: 'USD' } : over.fromPrice,
  offerCount: 1,
  eligible: over.eligible ?? true,
  reasonCode: 'eligible',
});

/** What a visitor would see: resolve the pointer, then filter by interval. */
async function publicCatalogue() {
  const row = await db
    .prepare('SELECT live_generation FROM catalog_publication_pointer WHERE id = 1')
    .first();
  const live = row?.live_generation;
  if (live === null || live === undefined) return [];
  const out = await db
    .prepare(
      `SELECT slug, title, from_price_minor FROM catalog_published_product
        WHERE first_generation <= ?
          AND (last_generation IS NULL OR last_generation >= ?)
        ORDER BY slug`,
    )
    .bind(live, live)
    .all();
  return out.results;
}

test('publication_one_building is a real mutex on D1, not a comment', { skip }, async () => {
  await resetPublication();
  const pub = new GenerationPublisher(db);
  await pub.beginGeneration({ at: '2026-11-26T12:00:00.000Z' });
  await assert.rejects(
    () => pub.beginGeneration({ at: '2026-11-26T12:00:00.000Z' }),
    /already being built/,
    'the partial unique index over status = building has to refuse the second one',
  );
});

test('published_product_open is a real invariant on D1', { skip }, async () => {
  await resetPublication();
  const pub = new GenerationPublisher(db);
  const id = await makeProduct('p-open', 'open');
  const g = await pub.beginGeneration({ at: '2026-11-26T12:00:00.000Z' });
  await pub.stageCandidates(g, [pubCandidate(id, { slug: 'open' })]);
  await pub.publish(g, { at: '2026-11-26T12:00:00.000Z' });

  // A second OPEN row for the same product, inserted behind the publisher's
  // back. Only the partial index can stop this.
  await assert.rejects(
    () =>
      db
        .prepare(
          `INSERT INTO catalog_published_product
             (product_id, first_generation, last_generation, published_at, slug, title,
              data_verified_at, search_text)
           VALUES (?, ?, NULL, ?, ?, ?, ?, ?)`,
        )
        .bind(id, g, '2026-11-26T13:00:00.000Z', 'open-again', 't', '2026-11-26T12:00:00.000Z', 't')
        .run(),
    /UNIQUE constraint failed/,
  );
});

test('the pointer move is what makes a catalogue public, on real D1', { skip }, async () => {
  await resetPublication();
  const meter = new UsageMeter();
  const measured = createRemoteD1(config, databaseId, meter);
  const pub = new GenerationPublisher(measured);

  const ids = [];
  for (let i = 0; i < 5; i += 1) ids.push(await makeProduct(`p-${i}`, `s-${i}`));
  const rows = ids.map((id, i) => pubCandidate(id, { slug: `s-${i}` }));

  const g1 = await pub.beginGeneration({ at: '2026-11-26T12:00:00.000Z' });
  await pub.stageCandidates(g1, rows);
  assert.deepEqual(await publicCatalogue(), [], 'staged and invisible');

  await pub.publish(g1, { at: '2026-11-26T12:00:00.000Z' });
  assert.equal((await publicCatalogue()).length, 5, 'and public the moment the pointer moved');
  const firstCost = meter.rowsWritten;

  // Cycle 2: the identical catalogue. The interval design exists so this
  // writes nothing, and on Cloudflare that is a measurement, not a claim.
  const before = await db.prepare('SELECT COUNT(*) AS n FROM catalog_published_product').first();
  meter.rowsWritten = 0;
  const g2 = await pub.beginGeneration({ at: '2026-11-26T13:00:00.000Z' });
  await pub.stageCandidates(g2, rows);
  const second = await pub.publish(g2, { at: '2026-11-26T13:00:00.000Z' });
  const after = await db.prepare('SELECT COUNT(*) AS n FROM catalog_published_product').first();

  assert.equal(second.unchanged, 5);
  assert.equal(second.opened, 0);
  assert.equal(after.n, before.n, 'not one published row was rewritten');
  console.log(
    `      measured: first publication of 5 products cost rows_written=${firstCost}; ` +
      `an unchanged republication cost ${meter.rowsWritten}`,
  );
});

test('a failed feed cannot empty the live catalogue, on real D1', { skip }, async () => {
  const pub = new GenerationPublisher(db);
  const liveBefore = await pub.liveGeneration();
  const countBefore = (await publicCatalogue()).length;
  assert.ok(countBefore > 0, 'this test needs a published catalogue to protect');

  const empty = await pub.beginGeneration({ at: '2026-11-26T14:00:00.000Z' });
  await assert.rejects(
    () => pub.publish(empty, { at: '2026-11-26T14:00:00.000Z' }),
    (error) => {
      assert.ok(error instanceof GenerationRejectedError);
      assert.equal(error.code, 'empty_catalogue');
      return true;
    },
  );
  assert.equal((await publicCatalogue()).length, countBefore);
  assert.equal(await pub.liveGeneration(), liveBefore);
  await pub.abandon(empty, { at: '2026-11-26T14:00:00.000Z', detail: 'test cleanup' });
});

test(
  'rollback restores the previous catalogue on real D1, without rebuilding it',
  { skip },
  async () => {
    await resetPublication();
    const pub = new GenerationPublisher(db);
    const kept = await makeProduct('p-kept', 'kept');
    const added = await makeProduct('p-added', 'added');

    const g1 = await pub.beginGeneration({ at: '2026-11-26T12:00:00.000Z' });
    await pub.stageCandidates(g1, [
      pubCandidate(kept, { slug: 'kept', fromPrice: { amountMinor: 1999, currency: 'USD' } }),
    ]);
    await pub.publish(g1, { at: '2026-11-26T12:00:00.000Z' });
    const before = await publicCatalogue();

    const g2 = await pub.beginGeneration({ at: '2026-11-26T13:00:00.000Z' });
    await pub.stageCandidates(g2, [
      pubCandidate(kept, { slug: 'kept', fromPrice: { amountMinor: 999, currency: 'USD' } }),
      pubCandidate(added, { slug: 'added' }),
    ]);
    await pub.publish(g2, { at: '2026-11-26T13:00:00.000Z' });
    assert.equal((await publicCatalogue()).length, 2);

    await pub.rollbackTo(g1, { at: '2026-11-26T14:00:00.000Z', decidedBy: 'test:operator' });
    assert.deepEqual(await publicCatalogue(), before, 'byte for byte what was live before');
  },
);
