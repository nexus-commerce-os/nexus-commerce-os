/*
 * PUBLICATION.
 *
 * `applyRun` is not atomic on D1. Everything in this file is the reason that
 * is survivable, so the tests that matter most are the ones that interrupt it:
 * a crash immediately before the pointer moves must leave the public
 * catalogue exactly as it was, and a crash immediately after must leave it
 * exactly as the new generation intended. There is no third outcome, because
 * the commit is one batch.
 *
 * Run on a real SQL engine (node:sqlite) through the same `D1Like` interface
 * the Worker uses, against the real migrations. The platform-specific half —
 * that a batch really is atomic, that the partial indexes really fire — is
 * checked against Cloudflare in d1-remote.test.mjs.
 */
import assert from 'node:assert/strict';
import { test } from 'node:test';

import {
  ConcurrentPublicationError,
  GenerationPublisher,
  GenerationRejectedError,
  PointerMovedError,
  validateGeneration,
} from '../dist/index.js';
import { createSqliteD1, d1Schema } from './helpers/sqlite-d1.mjs';

const SCHEMA = await d1Schema();
const AT = '2026-11-26T12:00:00.000Z';

/** A publisher over a fresh database, plus the raw handle for assertions. */
async function fresh() {
  const db = createSqliteD1(SCHEMA);
  return { db, pub: new GenerationPublisher(db) };
}

let productSeq = 0;
async function makeProduct(db, slug) {
  const id = `p-${++productSeq}`;
  await db
    .prepare(
      `INSERT INTO catalog_product (id, slug, title, created_at, updated_at)
       VALUES (?, ?, ?, ?, ?)`,
    )
    .bind(id, slug, `Product ${slug}`, AT, AT)
    .run();
  return id;
}

const candidate = (productId, over = {}) => ({
  productId,
  slug: over.slug ?? `slug-${productId}`,
  title: over.title ?? `Title ${productId}`,
  brand: over.brand ?? 'Northwind',
  categorySlug: over.categorySlug ?? 'drinkware',
  dataVerifiedAt: over.dataVerifiedAt ?? AT,
  searchText: over.searchText ?? `title ${productId} northwind`,
  fromPrice: over.fromPrice === undefined ? { amountMinor: 1999, currency: 'USD' } : over.fromPrice,
  offerCount: over.offerCount ?? 1,
  eligible: over.eligible ?? true,
  reasonCode: over.reasonCode ?? 'eligible',
});

/** What a visitor would see: resolve the pointer, then filter by interval. */
async function visible(db) {
  const row = await db
    .prepare('SELECT live_generation FROM catalog_publication_pointer WHERE id = 1')
    .first();
  const live = row?.live_generation;
  if (live === null || live === undefined) return [];
  const out = await db
    .prepare(
      `SELECT product_id, slug, title, from_price_minor FROM catalog_published_product
        WHERE first_generation <= ?
          AND (last_generation IS NULL OR last_generation >= ?)
        ORDER BY slug`,
    )
    .bind(live, live)
    .all();
  return out.results;
}

async function stageAndPublish(pub, db, candidates, options = {}) {
  const generation = await pub.beginGeneration({ at: options.at ?? AT });
  await pub.stageCandidates(generation, candidates);
  const outcome = await pub.publish(generation, { at: options.at ?? AT, ...options });
  return { generation, outcome };
}

/* ───────────────────────── the rule, on its own ───────────────────────── */

test('an empty generation is refused, because a failed retrieval looks exactly like one', () => {
  const verdict = validateGeneration({
    generation: 1,
    status: 'building',
    eligibleCount: 0,
    liveCount: 0,
  });
  assert.equal(verdict.ok, false);
  assert.equal(verdict.code, 'empty_catalogue');
});

test('an empty generation IS allowed when the caller says it means it', () => {
  const verdict = validateGeneration(
    { generation: 1, status: 'building', eligibleCount: 0, liveCount: 0 },
    { maxShrinkFraction: 0.2, allowEmpty: true },
  );
  assert.equal(verdict.ok, true);
});

test('a generation that would remove most of the catalogue is refused', () => {
  const verdict = validateGeneration({
    generation: 2,
    status: 'building',
    eligibleCount: 10,
    liveCount: 100,
  });
  assert.equal(verdict.ok, false);
  assert.equal(verdict.code, 'catalogue_cliff');
  assert.match(verdict.detail, /90 of 100/);
});

test('a small retirement is not a cliff', () => {
  const verdict = validateGeneration({
    generation: 2,
    status: 'building',
    eligibleCount: 95,
    liveCount: 100,
  });
  assert.equal(verdict.ok, true);
});

test('GROWTH is never a cliff, however large', () => {
  // A negative shrink fraction must not trip a comparison written for shrinkage.
  const verdict = validateGeneration({
    generation: 2,
    status: 'building',
    eligibleCount: 5000,
    liveCount: 10,
  });
  assert.equal(verdict.ok, true);
});

/* ──────────────────────── building and publishing ──────────────────────── */

test('nothing is published until the pointer moves', async () => {
  const { db, pub } = await fresh();
  const id = await makeProduct(db, 'mug');

  const generation = await pub.beginGeneration({ at: AT });
  await pub.stageCandidates(generation, [candidate(id, { slug: 'mug' })]);

  assert.deepEqual(await visible(db), [], 'a staged generation is invisible');
  assert.equal(await pub.liveGeneration(), null);

  await pub.publish(generation, { at: AT });
  assert.equal((await visible(db)).length, 1, 'and visible the moment the pointer moves');
  assert.equal(await pub.liveGeneration(), generation);
});

test('a candidate marked ineligible is never published, and keeps its reason', async () => {
  const { db, pub } = await fresh();
  const good = await makeProduct(db, 'good');
  const held = await makeProduct(db, 'held');

  await stageAndPublish(pub, db, [
    candidate(good, { slug: 'good' }),
    candidate(held, { slug: 'held', eligible: false, reasonCode: 'merchant_not_approved' }),
  ]);

  const rows = await visible(db);
  assert.deepEqual(
    rows.map((r) => r.slug),
    ['good'],
    'the withheld product is absent from the public catalogue',
  );

  const reason = await db
    .prepare(
      'SELECT reason_code FROM catalog_publication_candidate WHERE product_id = ? AND eligible = 0',
    )
    .bind(held)
    .first();
  assert.equal(
    reason.reason_code,
    'merchant_not_approved',
    'and the reason survives, so the absence can be explained without re-running the rules',
  );
});

test('an unchanged catalogue writes NO published rows at all', async () => {
  const { db, pub } = await fresh();
  const ids = [];
  for (let i = 0; i < 5; i += 1) ids.push(await makeProduct(db, `p${i}`));
  const rows = ids.map((id, i) => candidate(id, { slug: `p${i}` }));

  await stageAndPublish(pub, db, rows);
  const before = await db.prepare('SELECT COUNT(*) AS n FROM catalog_published_product').first();

  const second = await stageAndPublish(pub, db, rows, { at: '2026-11-26T18:00:00.000Z' });
  const after = await db.prepare('SELECT COUNT(*) AS n FROM catalog_published_product').first();

  assert.equal(second.outcome.unchanged, 5, 'all five recognised as unchanged');
  assert.equal(second.outcome.opened, 0);
  assert.equal(second.outcome.closed, 0);
  // THE WHOLE REASON FOR INTERVALS. A generation-per-row or table-swap design
  // would have rewritten every row here.
  assert.equal(after.n, before.n, 'not one published row was written');
  assert.equal((await visible(db)).length, 5);
});

test('a changed product closes its old row and opens a new one, so the old content survives', async () => {
  const { db, pub } = await fresh();
  const id = await makeProduct(db, 'mug');

  const first = await stageAndPublish(pub, db, [
    candidate(id, { slug: 'mug', fromPrice: { amountMinor: 1999, currency: 'USD' } }),
  ]);
  const second = await stageAndPublish(
    pub,
    db,
    [candidate(id, { slug: 'mug', fromPrice: { amountMinor: 1499, currency: 'USD' } })],
    { at: '2026-11-27T12:00:00.000Z' },
  );

  assert.equal(second.outcome.opened, 1);
  assert.equal(second.outcome.closed, 1);

  const now = await visible(db);
  assert.equal(now.length, 1, 'one product, not two');
  assert.equal(now[0].from_price_minor, 1499);

  const all = await db
    .prepare(
      'SELECT first_generation, last_generation, from_price_minor FROM catalog_published_product ORDER BY first_generation',
    )
    .all();
  assert.equal(all.results.length, 2, 'both versions are on disk');
  assert.equal(
    all.results[0].last_generation,
    first.generation,
    'the old one closed at generation 1',
  );
  assert.equal(all.results[1].last_generation, null, 'the new one is open');
});

test('a product that leaves the feed is removed from the catalogue but not from history', async () => {
  const { db, pub } = await fresh();
  const stays = await makeProduct(db, 'stays');
  const goes = await makeProduct(db, 'goes');

  await stageAndPublish(pub, db, [
    candidate(stays, { slug: 'stays' }),
    candidate(goes, { slug: 'goes' }),
  ]);
  const second = await stageAndPublish(pub, db, [candidate(stays, { slug: 'stays' })], {
    at: '2026-11-27T12:00:00.000Z',
    // One of two is 50%, over the default cliff limit, and that refusal is
    // tested separately. Here the caller is deliberately allowing it.
    limits: { maxShrinkFraction: 0.75, allowEmpty: false },
  });

  assert.equal(second.outcome.closed, 1);
  assert.deepEqual(
    (await visible(db)).map((r) => r.slug),
    ['stays'],
  );
  const history = await db
    .prepare('SELECT COUNT(*) AS n FROM catalog_published_product WHERE product_id = ?')
    .bind(goes)
    .first();
  assert.equal(history.n, 1, 'the row is closed, never deleted');
});

/* ───────────────────────────── the refusals ───────────────────────────── */

test('a failed feed cannot empty the website', async () => {
  const { db, pub } = await fresh();
  const ids = [];
  for (let i = 0; i < 10; i += 1) ids.push(await makeProduct(db, `p${i}`));
  await stageAndPublish(
    pub,
    db,
    ids.map((id, i) => candidate(id, { slug: `p${i}` })),
  );

  // The shape an import that retrieved nothing produces: a perfectly
  // well-formed generation containing nothing.
  const empty = await pub.beginGeneration({ at: '2026-11-27T12:00:00.000Z' });
  await assert.rejects(
    () => pub.publish(empty, { at: '2026-11-27T12:00:00.000Z' }),
    (error) => {
      assert.ok(error instanceof GenerationRejectedError);
      assert.equal(error.code, 'empty_catalogue');
      return true;
    },
  );

  assert.equal((await visible(db)).length, 10, 'the published catalogue is untouched');
  assert.equal(await pub.liveGeneration(), 1);
});

test('two concurrent publishers cannot both start a generation', async () => {
  const { pub } = await fresh();
  await pub.beginGeneration({ at: AT });
  await assert.rejects(
    () => pub.beginGeneration({ at: AT }),
    (error) => {
      assert.ok(error instanceof ConcurrentPublicationError);
      assert.equal(error.existingGeneration, 1, 'and the refusal names the generation in the way');
      return true;
    },
  );
});

test('a publisher whose pointer moved under it refuses to commit', async () => {
  /*
   * WHAT CAN ACTUALLY MOVE THE POINTER MID-PUBLISH. Not a second publisher:
   * `publication_one_building` makes two simultaneous builds impossible, and
   * two earlier drafts of this test failed for exactly that reason — first
   * with `UNIQUE constraint failed` (the diff was filtering open rows by the
   * pointer, now fixed in publisher.ts), then with ConcurrentPublicationError
   * when it tried to build a rival generation.
   *
   * The real case is an OPERATOR ROLLING BACK while a generation is in flight.
   * That is also why a rollback marks a 'building' generation 'rolled_back':
   * an operator who has decided to return to an older catalogue has decided
   * against the one being built.
   */
  const { db, pub } = await fresh();
  const a = await makeProduct(db, 'a');
  const b = await makeProduct(db, 'b');
  const c = await makeProduct(db, 'c');

  const one = await stageAndPublish(pub, db, [candidate(a, { slug: 'a' })]);
  await stageAndPublish(pub, db, [candidate(a, { slug: 'a' }), candidate(b, { slug: 'b' })], {
    at: '2026-11-27T11:00:00.000Z',
  });
  assert.equal(await pub.liveGeneration(), 2);

  let intervened = false;
  const racing = {
    prepare: (sql) => db.prepare(sql),
    exec: (sql) => db.exec(sql),
    async batch(statements) {
      // The three-statement commit is the window.
      if (statements.length === 3 && !intervened) {
        intervened = true;
        await pub.rollbackTo(one.generation, {
          at: '2026-11-27T11:45:00.000Z',
          decidedBy: 'operator:owner',
          detail: 'prices looked wrong',
        });
      }
      return db.batch(statements);
    },
  };

  const victim = new GenerationPublisher(racing);
  const generation = await victim.beginGeneration({ at: '2026-11-27T12:00:00.000Z' });
  await victim.stageCandidates(generation, [
    candidate(a, { slug: 'a' }),
    candidate(b, { slug: 'b' }),
    candidate(c, { slug: 'c' }),
  ]);

  await assert.rejects(
    () => victim.publish(generation, { at: '2026-11-27T12:00:00.000Z' }),
    (error) => {
      assert.ok(error instanceof PointerMovedError, `got ${error}`);
      assert.equal(error.expected, 2, 'and it names the pointer it expected to replace');
      return true;
    },
    'finishing would silently discard the operator decision',
  );

  // THE OPERATOR WINS. The catalogue is the one they rolled back to, and the
  // in-flight generation published nothing.
  assert.deepEqual(
    (await visible(db)).map((r) => r.slug),
    ['a'],
  );
  assert.equal(await pub.liveGeneration(), one.generation);
});

/* ──────────────────────── crashes, exactly where it matters ──────────────────────── */

test('a crash IMMEDIATELY BEFORE the commit leaves the published catalogue untouched', async () => {
  const { db, pub } = await fresh();
  const old = await makeProduct(db, 'old');
  const fresh1 = await makeProduct(db, 'new');
  await stageAndPublish(pub, db, [candidate(old, { slug: 'old' })]);
  const before = await visible(db);

  // Fail the LAST batch — the three-statement commit — and nothing else.
  let batches = 0;
  const failing = {
    prepare: (sql) => db.prepare(sql),
    exec: (sql) => db.exec(sql),
    async batch(statements) {
      batches += 1;
      if (statements.length === 3 && batches > 1) throw new Error('crashed before the commit');
      return db.batch(statements);
    },
  };
  const crashing = new GenerationPublisher(failing);

  const generation = await crashing.beginGeneration({ at: '2026-11-27T12:00:00.000Z' });
  await crashing.stageCandidates(generation, [
    candidate(old, { slug: 'old' }),
    candidate(fresh1, { slug: 'new' }),
  ]);
  await assert.rejects(
    () => crashing.publish(generation, { at: '2026-11-27T12:00:00.000Z' }),
    /crashed before the commit/,
  );

  assert.deepEqual(await visible(db), before, 'the visitor sees exactly what they saw before');
  assert.equal(await pub.liveGeneration(), 1, 'the pointer did not move');

  // And the generation can simply be published again. The open phase already
  // ran, so this is the idempotence claim being exercised, not restated.
  const retry = await pub.publish(generation, { at: '2026-11-27T12:05:00.000Z' });
  assert.equal(retry.alreadyLive, false);
  assert.equal((await visible(db)).length, 2, 'and converges on the intended catalogue');
});

test('a crash IMMEDIATELY AFTER the commit is already correct, and the retry writes nothing', async () => {
  const { db, pub } = await fresh();
  const id = await makeProduct(db, 'mug');

  const { generation } = await stageAndPublish(pub, db, [candidate(id, { slug: 'mug' })]);
  // The commit landed. A publisher that died here and came back must not
  // publish twice, and must not report work it did not do.
  const retry = await pub.publish(generation, { at: '2026-11-26T12:30:00.000Z' });

  assert.equal(retry.alreadyLive, true, 'recognised as already done');
  assert.equal(retry.opened, 0);
  assert.equal(retry.closed, 0);
  assert.equal(retry.publishedCount, 1);
  assert.equal((await visible(db)).length, 1, 'and the catalogue is unchanged');
});

test('a commit that half-landed is FINISHED, not rejected forever', async () => {
  /*
   * The commit is one batch, and a batch is documented as atomic — but this
   * repository has not measured that, because the D1 HTTP API cannot express
   * a batch with bindings at all. So the state it would produce is simulated
   * directly: the generation marked live, the pointer never moved.
   *
   * Without the resume branch in publisher.ts this is a DEAD GENERATION.
   * validateGeneration refuses anything that is not 'building', so the
   * catalogue could never be published and could never be rolled back to
   * either, and the only repair would be hand-editing production.
   */
  const { db, pub } = await fresh();
  const first = await makeProduct(db, 'first');
  const second = await makeProduct(db, 'second');

  const one = await stageAndPublish(pub, db, [candidate(first, { slug: 'first' })]);

  const generation = await pub.beginGeneration({ at: '2026-11-27T12:00:00.000Z' });
  await pub.stageCandidates(generation, [
    candidate(first, { slug: 'first' }),
    candidate(second, { slug: 'second' }),
  ]);

  // Fail only the commit, so phases 1 and 2 complete exactly as they would.
  const stalling = {
    prepare: (sql) => db.prepare(sql),
    exec: (sql) => db.exec(sql),
    async batch(statements) {
      if (statements.length === 3) throw new Error('commit interrupted');
      return db.batch(statements);
    },
  };
  await assert.rejects(
    () => new GenerationPublisher(stalling).publish(generation, { at: '2026-11-27T12:00:00.000Z' }),
    /commit interrupted/,
  );

  // Now the half-landed state: statement 1 applied, statement 3 did not.
  await db
    .prepare(
      `UPDATE catalog_publication_generation
          SET status = 'live', completed_at = ?, product_count = 2
        WHERE generation = ?`,
    )
    .bind('2026-11-27T12:00:00.000Z', generation)
    .run();

  assert.equal(await pub.liveGeneration(), one.generation, 'the public still sees the old one');
  assert.equal((await visible(db)).length, 1);

  const finished = await pub.publish(generation, { at: '2026-11-27T12:10:00.000Z' });
  assert.equal(finished.alreadyLive, false, 'work was done, so this is not a no-op');
  assert.equal(await pub.liveGeneration(), generation, 'the pointer finally moved');
  assert.deepEqual(
    (await visible(db)).map((r) => r.slug),
    ['first', 'second'],
    'and the catalogue the generation intended is live',
  );

  // And once more, which must now be the plain idempotent case.
  const again = await pub.publish(generation, { at: '2026-11-27T12:20:00.000Z' });
  assert.equal(again.alreadyLive, true);
});

test('an abandoned generation does not poison the next one', async () => {
  const { db, pub } = await fresh();
  const id = await makeProduct(db, 'mug');

  // A generation that opened its rows and then died before the pointer moved.
  const dead = await pub.beginGeneration({ at: AT });
  await pub.stageCandidates(dead, [candidate(id, { slug: 'mug' })]);
  const failing = {
    prepare: (sql) => db.prepare(sql),
    exec: (sql) => db.exec(sql),
    async batch(statements) {
      if (statements.length === 3) throw new Error('crashed before the commit');
      return db.batch(statements);
    },
  };
  await assert.rejects(
    () => new GenerationPublisher(failing).publish(dead, { at: AT }),
    /crashed before the commit/,
  );

  await pub.abandon(dead, { at: AT, detail: 'operator abandoned a stuck generation' });

  /*
   * THE POINT. The abandoned generation had already opened a row with
   * last_generation IS NULL. If abandon() left it, `published_product_open`
   * would refuse the next generation's row for the same product, and one
   * failure would block that product forever.
   */
  const { outcome } = await stageAndPublish(pub, db, [candidate(id, { slug: 'mug' })], {
    at: '2026-11-27T12:00:00.000Z',
  });
  assert.equal(outcome.opened, 1);
  assert.equal((await visible(db)).length, 1);
});

/* ────────────────────────────── rollback ────────────────────────────── */

test('rollback restores the previous catalogue without reconstructing it', async () => {
  const { db, pub } = await fresh();
  const kept = await makeProduct(db, 'kept');
  const added = await makeProduct(db, 'added');

  const one = await stageAndPublish(pub, db, [
    candidate(kept, { slug: 'kept', fromPrice: { amountMinor: 1999, currency: 'USD' } }),
  ]);
  const before = await visible(db);

  await stageAndPublish(
    pub,
    db,
    [
      candidate(kept, { slug: 'kept', fromPrice: { amountMinor: 999, currency: 'USD' } }),
      candidate(added, { slug: 'added' }),
    ],
    { at: '2026-11-27T12:00:00.000Z' },
  );
  assert.equal((await visible(db)).length, 2);

  const back = await pub.rollbackTo(one.generation, {
    at: '2026-11-27T13:00:00.000Z',
    decidedBy: 'operator:owner',
    detail: 'prices looked wrong',
  });

  assert.equal(back.to, one.generation);
  assert.deepEqual(await visible(db), before, 'byte for byte what was live before');

  // And the rolled-back generation cannot be returned to, because the rows it
  // opened were discarded.
  await assert.rejects(
    () => pub.rollbackTo(2, { at: '2026-11-27T14:00:00.000Z', decidedBy: 'operator:owner' }),
    (error) => {
      assert.ok(error instanceof GenerationRejectedError);
      return true;
    },
  );
});

test('rolling back and then publishing again works, which is where the invariant breaks if rollback is lazy', async () => {
  const { db, pub } = await fresh();
  const id = await makeProduct(db, 'mug');
  const extra = await makeProduct(db, 'extra');

  const one = await stageAndPublish(pub, db, [candidate(id, { slug: 'mug' })]);
  await stageAndPublish(
    pub,
    db,
    [candidate(id, { slug: 'mug', title: 'Changed' }), candidate(extra, { slug: 'extra' })],
    { at: '2026-11-27T12:00:00.000Z' },
  );
  await pub.rollbackTo(one.generation, {
    at: '2026-11-27T13:00:00.000Z',
    decidedBy: 'operator:owner',
  });

  // Generation 3. If rollback had left generation 2's open rows behind, the
  // partial unique index would refuse this and the product would be stuck.
  const third = await stageAndPublish(
    pub,
    db,
    [candidate(id, { slug: 'mug', title: 'Corrected' })],
    { at: '2026-11-27T14:00:00.000Z' },
  );
  assert.equal(third.outcome.opened, 1);
  const rows = await visible(db);
  assert.equal(rows.length, 1);
  assert.equal(rows[0].title, 'Corrected');
});

test('rollback refuses a generation that never served traffic', async () => {
  const { db, pub } = await fresh();
  const id = await makeProduct(db, 'mug');
  await stageAndPublish(pub, db, [candidate(id, { slug: 'mug' })]);

  const building = await pub.beginGeneration({ at: '2026-11-27T12:00:00.000Z' });
  await assert.rejects(
    () => pub.rollbackTo(building, { at: '2026-11-27T12:00:00.000Z', decidedBy: 'operator:owner' }),
    (error) => {
      assert.ok(error instanceof GenerationRejectedError);
      assert.match(error.message, /only a generation that was published/);
      return true;
    },
  );
  await assert.rejects(
    () => pub.rollbackTo(99, { at: AT, decidedBy: 'operator:owner' }),
    /no such generation/,
  );
});

/* ───────────────────────────── retention ───────────────────────────── */

test('pruning keeps what rollback needs and stops at its cap', async () => {
  const { db, pub } = await fresh();
  const ids = [];
  for (let i = 0; i < 6; i += 1) ids.push(await makeProduct(db, `p${i}`));

  // Six generations, each changing one product's title so each closes a row.
  for (let g = 0; g < 6; g += 1) {
    await stageAndPublish(
      pub,
      db,
      ids.map((id, i) => candidate(id, { slug: `p${i}`, title: `Title ${i} v${g}` })),
      { at: `2026-11-${String(20 + g).padStart(2, '0')}T12:00:00.000Z` },
    );
  }

  const beforeRows = await db
    .prepare('SELECT COUNT(*) AS n FROM catalog_published_product')
    .first();
  const outcome = await pub.prune({ keep: 2, maxDeletes: 1000 });

  assert.equal(outcome.oldestKept, 5, 'the live generation and one behind it');
  assert.ok(outcome.publishedDeleted > 0, 'old closed rows were removed');
  const afterRows = await db.prepare('SELECT COUNT(*) AS n FROM catalog_published_product').first();
  assert.ok(afterRows.n < beforeRows.n);

  // The catalogue is untouched and the kept generation is still reachable.
  assert.equal((await visible(db)).length, 6);
  const back = await pub.rollbackTo(5, { at: AT, decidedBy: 'operator:owner' });
  assert.equal(
    (await visible(db)).length,
    6,
    `rollback to ${back.to} still serves a full catalogue`,
  );
});

test('pruning refuses to keep nothing, because that would delete rollback', async () => {
  const { pub } = await fresh();
  await assert.rejects(() => pub.prune({ keep: 0, maxDeletes: 10 }), /at least 1/);
});

test('pruning a catalogue that was never published does nothing', async () => {
  const { pub } = await fresh();
  const outcome = await pub.prune({ keep: 3, maxDeletes: 100 });
  assert.equal(outcome.oldestKept, null);
  assert.equal(outcome.publishedDeleted, 0);
});
