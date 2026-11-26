/*
 * THE WHOLE PIPELINE, END TO END.
 *
 * Feed bytes in, a searchable public catalogue out, through the real import,
 * the real matcher and the real publisher against a real SQL engine. The three
 * cycles below are the ones that matter in production:
 *
 *   1. eligible products are created and published automatically;
 *   2. an unchanged feed changes nothing and publishes nothing new;
 *   3. a new product appears and an existing price moves.
 *
 * Plus the refusals, which are the reason automatic publication is allowed to
 * exist at all: a paused system, a withheld merchant, a feed that retrieved
 * nothing, and a half-built generation.
 */
import assert from 'node:assert/strict';
import { test } from 'node:test';

import {
  GenerationPublisher,
  importFeedArchive,
  D1OfferStore,
  publishCatalogue,
} from '../dist/index.js';
import { createSqliteD1, d1Schema } from './helpers/sqlite-d1.mjs';
import { buildFeed, gtin12, product, zipOf } from './fixtures/synthetic-feed.mjs';

const SCHEMA = await d1Schema();
const MERCHANT = 'northwind';
const SOURCE = 'test:shopping:0000';
const STAMP = '2026-11-26T11:31:41.000Z';

async function world({ approved = true, autoPublish = true, paused = null } = {}) {
  const db = createSqliteD1(SCHEMA);
  await db
    .prepare(
      `INSERT INTO catalog_merchant (id, name, network, relationship) VALUES (?, ?, 'test', ?)`,
    )
    .bind(MERCHANT, 'Northwind Trading', approved ? 'approved' : 'pending')
    .run();
  if (paused !== null) {
    await db
      .prepare(
        `UPDATE catalog_automation_config
            SET paused = 1, paused_reason = ?, paused_at = ?, updated_at = ?
          WHERE id = 1`,
      )
      .bind(paused, STAMP, STAMP)
      .run();
  }
  if (!autoPublish) {
    await db
      .prepare('UPDATE catalog_automation_config SET auto_publish = 0, updated_at = ? WHERE id = 1')
      .bind(STAMP)
      .run();
  }
  return { db, store: new D1OfferStore(db), publisher: new GenerationPublisher(db) };
}

const row = (i, price, over = {}) =>
  product({
    id: `NW-${i}`,
    title: `Northwind Item ${i}`,
    price: `${price} USD`,
    salePrice: '',
    gtin: gtin12(String(10000000000 + i)),
    mpn: `NW-MPN-${i}`,
    lastUpdated: STAMP,
    productType: 'Home > Drinkware',
    ...over,
  });

const feedOf = (rows) => zipOf(buildFeed(rows));

async function runImport(store, rows, now) {
  return importFeedArchive(feedOf(rows), store, {
    merchantId: MERCHANT,
    sourceFeed: SOURCE,
    now,
  });
}

/** What a visitor would see: resolve the pointer, then filter by interval. */
async function publicCatalogue(db) {
  const pointer = await db
    .prepare('SELECT live_generation FROM catalog_publication_pointer WHERE id = 1')
    .first();
  const live = pointer?.live_generation;
  if (live === null || live === undefined) return [];
  const out = await db
    .prepare(
      `SELECT slug, title, brand, category_slug, from_price_minor, offer_count, data_verified_at
         FROM catalog_published_product
        WHERE first_generation <= ?
          AND (last_generation IS NULL OR last_generation >= ?)
        ORDER BY slug`,
    )
    .bind(live, live)
    .all();
  return out.results;
}

/* ─────────────────────── the three cycles ─────────────────────── */

test('CYCLE 1: a feed becomes a published, searchable catalogue with no human approval', async () => {
  const { db, store } = await world();
  const imported = await runImport(
    store,
    Array.from({ length: 12 }, (_, i) => row(i + 1, '19.99')),
    new Date('2026-11-26T12:00:00.000Z'),
  );
  assert.equal(imported.applied, true, `import did not apply: ${JSON.stringify(imported.run)}`);

  const result = await publishCatalogue(db, { now: new Date('2026-11-26T12:05:00.000Z') });

  assert.equal(result.ran, true);
  assert.equal(result.skipped, null);
  assert.equal(result.rejected, null);
  assert.equal(result.counts.offers, 12);
  assert.equal(result.counts.products, 12, 'one product per GTIN');
  assert.equal(result.counts.eligible, 12);
  assert.equal(result.outcome.opened, 12);

  const live = await publicCatalogue(db);
  assert.equal(live.length, 12, 'and a visitor can see all twelve');
  assert.equal(live[0].category_slug, 'home/drinkware', 'classified from the stated path');
  assert.equal(live[0].brand, 'Northwind Trading');
  assert.equal(live[0].offer_count, 1);
  assert.equal(
    live[0].from_price_minor,
    null,
    'no offer verifies shipping, so there is no from-price to show',
  );

  // Searchable: the denormalised text is what a listing query matches on.
  const found = await db
    .prepare(
      `SELECT slug FROM catalog_published_product
        WHERE search_text LIKE ? AND last_generation IS NULL ORDER BY slug LIMIT 3`,
    )
    .bind('%northwind item 1%')
    .all();
  assert.ok(found.results.length > 0, 'and find them by name');
});

test('CYCLE 2: an unchanged feed publishes nothing new and writes no published rows', async () => {
  const { db, store } = await world();
  const rows = Array.from({ length: 12 }, (_, i) => row(i + 1, '19.99'));
  await runImport(store, rows, new Date('2026-11-26T12:00:00.000Z'));
  await publishCatalogue(db, { now: new Date('2026-11-26T12:05:00.000Z') });

  const before = await db.prepare('SELECT COUNT(*) AS n FROM catalog_published_product').first();
  const decisionsBefore = await db
    .prepare('SELECT COUNT(*) AS n FROM catalog_publication_decision')
    .first();

  // The identical bytes again.
  const again = await runImport(store, rows, new Date('2026-11-26T13:00:00.000Z'));
  assert.equal(again.run.status, 'skipped_duplicate', 'the import refuses on the content hash');

  const second = await publishCatalogue(db, { now: new Date('2026-11-26T13:05:00.000Z') });
  assert.equal(second.outcome.unchanged, 12);
  assert.equal(second.outcome.opened, 0);
  assert.equal(second.outcome.closed, 0);

  const after = await db.prepare('SELECT COUNT(*) AS n FROM catalog_published_product').first();
  assert.equal(after.n, before.n, 'not one published row was rewritten');

  const decisionsAfter = await db
    .prepare('SELECT COUNT(*) AS n FROM catalog_publication_decision')
    .first();
  assert.equal(
    decisionsAfter.n,
    decisionsBefore.n,
    'and no decision was re-recorded, because none of them changed',
  );
  assert.equal((await publicCatalogue(db)).length, 12);
});

test('CYCLE 3: a new product is published and a price change reaches the catalogue', async () => {
  const { db, store } = await world();
  await runImport(
    store,
    Array.from({ length: 12 }, (_, i) => row(i + 1, '19.99')),
    new Date('2026-11-26T12:00:00.000Z'),
  );
  await publishCatalogue(db, { now: new Date('2026-11-26T12:05:00.000Z') });

  const changed = [
    ...Array.from({ length: 11 }, (_, i) => row(i + 1, '19.99')),
    row(12, '12.49'),
    row(13, '29.99'),
  ];
  const third = await runImport(store, changed, new Date('2026-11-26T14:00:00.000Z'));
  assert.equal(third.applied, true);
  assert.equal(third.reconciliation.added.length, 1);
  assert.equal(third.reconciliation.removed.length, 0, 'nothing retired');

  const published = await publishCatalogue(db, { now: new Date('2026-11-26T14:05:00.000Z') });
  assert.equal(published.counts.products, 13);
  assert.equal(published.outcome.opened, 1, 'the new product');
  assert.equal(published.outcome.unchanged, 12, 'and the rest cost nothing');

  const live = await publicCatalogue(db);
  assert.equal(live.length, 13);

  // The price change is in the offer, and the catalogue's freshness moved with
  // it. The published row carries no price because shipping is unverified —
  // which is the honest answer, not a missing feature.
  const offer = await db
    .prepare('SELECT list_price_minor FROM catalog_merchant_offer WHERE merchant_offer_id = ?')
    .bind('NW-12')
    .first();
  assert.equal(offer.list_price_minor, 1249, 'the price moved in the database');
});

test('no rebuild happens between cycles: the catalogue changes while the code does not', async () => {
  /*
   * The claim this test exists for is that new products become visible WITHOUT
   * a deploy. There is nothing to deploy here, so what it can honestly check
   * is the mechanism that makes that true: the public read resolves a pointer
   * and reads rows, and nothing in the path is generated at build time.
   */
  const { db, store } = await world();
  await runImport(store, [row(1, '19.99')], new Date('2026-11-26T12:00:00.000Z'));
  await publishCatalogue(db, { now: new Date('2026-11-26T12:05:00.000Z') });
  const first = await publicCatalogue(db);

  await runImport(store, [row(1, '19.99'), row(2, '24.99')], new Date('2026-11-26T13:00:00.000Z'));
  await publishCatalogue(db, { now: new Date('2026-11-26T13:05:00.000Z') });
  const second = await publicCatalogue(db);

  assert.equal(first.length, 1);
  assert.equal(second.length, 2);
  // Same query, same code, different answer. That is the whole requirement.
});

test('FRESHNESS MOVES WITHOUT VERSIONING THE ROW', async () => {
  /*
   * The bug this locks down. `data_verified_at` is the newest `last_seen_at`
   * among a product's offers, so it moves on EVERY cycle whether or not the
   * product changed. Counting it as content closed and reopened every
   * published row every cycle, which destroys the one property the interval
   * design exists for. Cycle 3 reported 13 rows opened where 1 product was
   * new, and that is how it was found.
   */
  const { db, store } = await world();
  const rows = Array.from({ length: 6 }, (_, i) => row(i + 1, '19.99'));
  await runImport(store, rows, new Date('2026-11-26T12:00:00.000Z'));
  await publishCatalogue(db, { now: new Date('2026-11-26T12:05:00.000Z') });

  const countRows = async () =>
    (await db.prepare('SELECT COUNT(*) AS n FROM catalog_published_product').first()).n;
  const before = await countRows();
  const firstSeen = await db
    .prepare(
      'SELECT data_verified_at FROM catalog_published_product WHERE last_generation IS NULL LIMIT 1',
    )
    .first();

  // The SAME products, re-read later. Only the timestamps differ, which is
  // what a second daily retrieval of an unchanged catalogue looks like.
  const laterStamp = '2026-11-27T11:31:41.000Z';
  const later = rows.map((r) => ({ ...r, lastUpdated: laterStamp }));
  const imported = await runImport(store, later, new Date('2026-11-27T12:00:00.000Z'));
  assert.equal(imported.applied, true, 'different bytes, so this is a real import');

  const second = await publishCatalogue(db, { now: new Date('2026-11-27T12:05:00.000Z') });
  assert.equal(second.outcome.opened, 0, 'NOTHING was versioned');
  assert.equal(second.outcome.closed, 0);
  assert.equal(second.outcome.refreshed, 6, 'all six had their freshness updated in place');
  assert.equal(second.outcome.unchanged, 6);
  assert.equal(await countRows(), before, 'and the row count did not grow');

  const afterSeen = await db
    .prepare(
      'SELECT data_verified_at FROM catalog_published_product WHERE last_generation IS NULL LIMIT 1',
    )
    .first();
  assert.notEqual(
    afterSeen.data_verified_at,
    firstSeen.data_verified_at,
    'the visitor sees the newer verification time',
  );
  assert.equal((await publicCatalogue(db)).length, 6);
});

/* ─────────────────────── the refusals ─────────────────────── */

test('a PAUSED system does no work and spends no quota', async () => {
  const { db, store } = await world({ paused: 'owner stopped automation during the audit' });
  await runImport(store, [row(1, '19.99')], new Date('2026-11-26T12:00:00.000Z'));

  const result = await publishCatalogue(db, { now: new Date('2026-11-26T12:05:00.000Z') });
  assert.equal(result.ran, false);
  assert.equal(result.skipped, 'automation_paused');
  assert.match(result.skippedDetail, /during the audit/);
  assert.equal(result.counts.products, 0, 'nothing was even read');
  assert.deepEqual(await publicCatalogue(db), []);
});

test('AN UNAPPROVED MERCHANT IS COMPUTED, RECORDED AND WITHHELD', async () => {
  // Possession of a feed is not approval. The products exist in the database
  // with a recorded reason; none of them is public.
  const { db, store } = await world({ approved: false });
  await runImport(
    store,
    Array.from({ length: 5 }, (_, i) => row(i + 1, '19.99')),
    new Date('2026-11-26T12:00:00.000Z'),
  );

  const result = await publishCatalogue(db, { now: new Date('2026-11-26T12:05:00.000Z') });
  assert.equal(result.counts.products, 5);
  assert.equal(result.counts.eligible, 0);
  assert.equal(result.counts.withheld, 5);
  // Zero eligible products is an empty generation, which the validator refuses.
  assert.equal(result.rejected.code, 'empty_catalogue');
  assert.deepEqual(await publicCatalogue(db), [], 'nothing unapproved is public');

  const decisions = await db
    .prepare('SELECT reason_code, published FROM catalog_publication_decision LIMIT 1')
    .first();
  assert.equal(decisions.reason_code, 'merchant_not_approved');
  assert.equal(decisions.published, 0, 'and the reason is on the record');
});

test('a feed that retrieved nothing cannot empty a live catalogue', async () => {
  const { db, store } = await world();
  await runImport(
    store,
    Array.from({ length: 10 }, (_, i) => row(i + 1, '19.99')),
    new Date('2026-11-26T12:00:00.000Z'),
  );
  await publishCatalogue(db, { now: new Date('2026-11-26T12:05:00.000Z') });
  assert.equal((await publicCatalogue(db)).length, 10);

  // Every offer vanishes — a retrieval failure that still produced a feed.
  await db
    .prepare("UPDATE catalog_merchant_offer SET state = 'inactive', inactive_since = ?")
    .bind('2026-11-26T14:00:00.000Z')
    .run();

  const result = await publishCatalogue(db, { now: new Date('2026-11-26T14:05:00.000Z') });
  assert.equal(result.rejected.code, 'empty_catalogue');
  assert.equal((await publicCatalogue(db)).length, 10, 'the live catalogue is untouched');

  // AND the next cycle is not blocked by the refusal.
  const generation = await new GenerationPublisher(db).buildingGeneration();
  assert.equal(generation, null, 'the rejected generation was abandoned, not left building');
});

test('a cliff is refused, and a deliberate large retirement can be allowed', async () => {
  const { db, store } = await world();
  await runImport(
    store,
    Array.from({ length: 10 }, (_, i) => row(i + 1, '19.99')),
    new Date('2026-11-26T12:00:00.000Z'),
  );
  await publishCatalogue(db, { now: new Date('2026-11-26T12:05:00.000Z') });

  // Seven of ten go away: 70%, over the 20% default.
  await db
    .prepare(
      `UPDATE catalog_merchant_offer SET state = 'inactive', inactive_since = ?
        WHERE merchant_offer_id IN ('NW-4','NW-5','NW-6','NW-7','NW-8','NW-9','NW-10')`,
    )
    .bind('2026-11-26T14:00:00.000Z')
    .run();

  const refused = await publishCatalogue(db, { now: new Date('2026-11-26T14:05:00.000Z') });
  assert.equal(refused.rejected.code, 'catalogue_cliff');
  assert.equal((await publicCatalogue(db)).length, 10);

  const allowed = await publishCatalogue(db, {
    now: new Date('2026-11-26T15:05:00.000Z'),
    limits: { maxShrinkFraction: 0.9, allowEmpty: false },
    decidedBy: 'operator:owner',
  });
  assert.equal(allowed.rejected, null);
  assert.equal((await publicCatalogue(db)).length, 3, 'the operator decision is honoured');
});

test('auto_publish = 0 computes and records everything but moves nothing', async () => {
  const { db, store } = await world({ autoPublish: false });
  await runImport(
    store,
    Array.from({ length: 4 }, (_, i) => row(i + 1, '19.99')),
    new Date('2026-11-26T12:00:00.000Z'),
  );

  const result = await publishCatalogue(db, { now: new Date('2026-11-26T12:05:00.000Z') });
  assert.equal(result.ran, true);
  assert.equal(result.skipped, 'auto_publish_disabled');
  assert.equal(result.counts.eligible, 4, 'an operator can see exactly what WOULD be published');
  assert.equal(result.counts.decisionsRecorded, 4);
  assert.deepEqual(await publicCatalogue(db), [], 'and nothing is');
  assert.equal(await new GenerationPublisher(db).liveGeneration(), null);
});

test('a dry run previews without touching configuration', async () => {
  const { db, store } = await world();
  await runImport(store, [row(1, '19.99')], new Date('2026-11-26T12:00:00.000Z'));

  const preview = await publishCatalogue(db, {
    now: new Date('2026-11-26T12:05:00.000Z'),
    dryRun: true,
  });
  assert.equal(preview.counts.eligible, 1);
  assert.deepEqual(await publicCatalogue(db), []);

  // And a real run afterwards still works, because the dry run left no
  // half-built generation behind.
  const real = await publishCatalogue(db, { now: new Date('2026-11-26T12:10:00.000Z') });
  assert.equal(real.outcome.opened, 1);
});

test('a half-built generation is reported, never taken over', async () => {
  const { db, store } = await world();
  await runImport(store, [row(1, '19.99')], new Date('2026-11-26T12:00:00.000Z'));
  const stuck = await new GenerationPublisher(db).beginGeneration({
    at: '2026-11-26T11:00:00.000Z',
  });

  const result = await publishCatalogue(db, { now: new Date('2026-11-26T12:05:00.000Z') });
  assert.equal(result.ran, false);
  assert.equal(result.skipped, 'generation_in_progress');
  assert.equal(result.generation, stuck);
  assert.match(result.skippedDetail, /publish or abandon it/);
});

test('an unmigrated database fails CLOSED', async () => {
  // A missing configuration row means the schema is not what this code
  // expects. Treating that as "not paused" would run automation against a
  // database nobody has migrated, which is exactly when it should not.
  const db = createSqliteD1(SCHEMA);
  await db.prepare('DELETE FROM catalog_automation_config').run();
  const result = await publishCatalogue(db, { now: new Date('2026-11-26T12:05:00.000Z') });
  assert.equal(result.ran, false);
  assert.equal(result.skipped, 'automation_paused');
  assert.match(result.skippedDetail, /schema is not initialised/);
});

test('products, categories, brands and offer links are all idempotent', async () => {
  const { db, store } = await world();
  await runImport(
    store,
    Array.from({ length: 3 }, (_, i) => row(i + 1, '19.99')),
    new Date('2026-11-26T12:00:00.000Z'),
  );
  await publishCatalogue(db, { now: new Date('2026-11-26T12:05:00.000Z') });

  const snapshot = async () => {
    const out = await db
      .prepare(
        `SELECT (SELECT COUNT(*) FROM catalog_product) p,
                (SELECT COUNT(*) FROM catalog_category) c,
                (SELECT COUNT(*) FROM catalog_brand) b,
                (SELECT COUNT(*) FROM catalog_product_offer) po`,
      )
      .first();
    return out;
  };
  const before = await snapshot();
  await publishCatalogue(db, { now: new Date('2026-11-26T13:05:00.000Z') });
  await publishCatalogue(db, { now: new Date('2026-11-26T14:05:00.000Z') });
  assert.deepEqual(await snapshot(), before, 'running it three times produces the same rows');
});

test('a rolled-back catalogue is what the public sees, and the next cycle still works', async () => {
  const { db, store, publisher } = await world();
  await runImport(store, [row(1, '19.99')], new Date('2026-11-26T12:00:00.000Z'));
  const first = await publishCatalogue(db, { now: new Date('2026-11-26T12:05:00.000Z') });

  await runImport(store, [row(1, '19.99'), row(2, '24.99')], new Date('2026-11-26T13:00:00.000Z'));
  await publishCatalogue(db, { now: new Date('2026-11-26T13:05:00.000Z') });
  assert.equal((await publicCatalogue(db)).length, 2);

  await publisher.rollbackTo(first.generation, {
    at: '2026-11-26T13:30:00.000Z',
    decidedBy: 'operator:owner',
    detail: 'the second product looked wrong',
  });
  assert.equal((await publicCatalogue(db)).length, 1, 'back to one');

  // And automation continues from there rather than being stuck.
  const next = await publishCatalogue(db, { now: new Date('2026-11-26T14:05:00.000Z') });
  assert.equal(
    next.rejected,
    null,
    `expected a clean publish, got ${JSON.stringify(next.rejected)}`,
  );
  assert.equal((await publicCatalogue(db)).length, 2);
});
