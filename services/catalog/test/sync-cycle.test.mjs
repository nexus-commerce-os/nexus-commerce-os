/*
 * THE SCHEDULED CYCLE.
 *
 * The order is the design, so the tests are about the order: paused before
 * any read, budget before any write, a failed source isolated from the rest,
 * and a cycle that was REFUSED recorded just as carefully as one that ran —
 * because "did the cron fire?" is the first question anybody asks, and a
 * scheduler that only writes a row on success cannot answer it.
 */
import assert from 'node:assert/strict';
import { test } from 'node:test';

import {
  CycleMeter,
  D1FeedSourceStore,
  FREE_TIER,
  PublicCatalogue,
  QuotaD1,
  assessBudget,
  meteredD1,
  recentCycles,
  runSyncCycle,
  utcDay,
} from '../dist/index.js';
import { createSqliteD1, d1Schema } from './helpers/sqlite-d1.mjs';
import { buildFeed, gtin12, product, zipOf } from './fixtures/synthetic-feed.mjs';

const SCHEMA = await d1Schema();
const MERCHANT = 'northwind';
const NOW = new Date('2026-11-26T12:00:00.000Z');
const STAMP = '2026-11-26T11:31:41.000Z';

const row = (i, price = '19.99') =>
  product({
    id: `NW-${i}`,
    title: `Northwind Item ${i}`,
    price: `${price} USD`,
    salePrice: '',
    gtin: gtin12(String(10000000000 + i)),
    mpn: `NW-MPN-${i}`,
    lastUpdated: STAMP,
    productType: 'Home > Drinkware',
  });

/** A feed served from memory, so nothing here reaches the network. */
function fixtureRetrieve(archives) {
  let call = 0;
  return async (source) => {
    const archive = archives[source.id];
    if (archive === undefined) {
      return { status: 'failed', reason: `no fixture for ${source.id}`, attempts: 1 };
    }
    if (archive === 'throw') throw new Error('provider exploded');
    call += 1;
    return { status: 'fetched', body: archive, attempts: 1, validators: { sha256: `sha-${call}` } };
  };
}

async function world({ sources = 1, paused = null, enabled = true, sourcePaused = false } = {}) {
  const db = createSqliteD1(SCHEMA);
  await db
    .prepare(
      "INSERT INTO catalog_merchant (id, name, network, relationship) VALUES (?, ?, 'test', 'approved')",
    )
    .bind(MERCHANT, 'Northwind Trading')
    .run();

  const feeds = new D1FeedSourceStore(db);
  for (let i = 0; i < sources; i += 1) {
    await feeds.upsert({
      id: `src-${i}`,
      merchantId: MERCHANT,
      transport: 'fixture',
      url: 'fixture://northwind',
      format: 'tsv',
      schedule: { everyMinutes: 360 },
      credentialRef: null,
      auth: { kind: 'none' },
      enabled,
      paused: sourcePaused,
      pausedReason: sourcePaused ? 'test pause' : null,
      pausedAt: sourcePaused ? STAMP : null,
      lastSuccessAt: null,
      lastAttemptAt: null,
      validators: {},
    });
  }

  if (paused !== null) {
    await db
      .prepare(
        `UPDATE catalog_automation_config
            SET paused = 1, paused_reason = ?, paused_at = ?, updated_at = ? WHERE id = 1`,
      )
      .bind(paused, STAMP, STAMP)
      .run();
  }
  return { db, feeds };
}

const archiveOf = (n) => zipOf(buildFeed(Array.from({ length: n }, (_, i) => row(i + 1))));

/* ───────────────────────────── the budget rule ───────────────────────────── */

test('a fresh day allows a cycle, with a capped share', () => {
  const verdict = assessBudget({
    day: '2026-11-26',
    estimatedWrites: 0,
    estimatedReads: 0,
    authoritativeWrites: null,
    authoritativeAt: null,
    cycles: 0,
  });
  assert.equal(verdict.allowed, true);
  assert.equal(verdict.remaining, 100_000);
  assert.equal(verdict.cycleCap, 10_000, 'one cycle may spend a tenth of the day');
});

test('THE HIGHER OF THE TWO NUMBERS IS SPENT, because each is wrong in a different direction', () => {
  /*
   * The estimate misses writes this process did not make; the authoritative
   * figure lags behind writes it did. Taking the larger can refuse a cycle
   * that would have fitted; taking the smaller permits one that will not.
   */
  const verdict = assessBudget({
    day: '2026-11-26',
    estimatedWrites: 10_000,
    estimatedReads: 0,
    authoritativeWrites: 97_000,
    authoritativeAt: '2026-11-26T11:00:00.000Z',
    cycles: 3,
  });
  assert.equal(verdict.allowed, false);
  assert.equal(verdict.reason, 'reserve_only');
  assert.equal(verdict.remaining, 3_000);
});

test('a lagging authoritative figure below the estimate does not reduce what is spent', () => {
  const verdict = assessBudget({
    day: '2026-11-26',
    estimatedWrites: 99_000,
    estimatedReads: 0,
    authoritativeWrites: 40_000,
    authoritativeAt: '2026-11-26T11:00:00.000Z',
    cycles: 9,
  });
  assert.equal(verdict.allowed, false, 'the estimate is the current number and it wins');
});

test('the reserve keeps room to publish what has been staged', () => {
  const verdict = assessBudget({
    day: '2026-11-26',
    estimatedWrites: 96_000,
    estimatedReads: 0,
    authoritativeWrites: null,
    authoritativeAt: null,
    cycles: 8,
  });
  assert.equal(verdict.allowed, false);
  assert.equal(verdict.reason, 'reserve_only');
  assert.match(verdict.detail, /staged with no allowance to publish/);
});

test('an exhausted day says so, and says when it resets', () => {
  const verdict = assessBudget({
    day: '2026-11-26',
    estimatedWrites: 100_500,
    estimatedReads: 0,
    authoritativeWrites: null,
    authoritativeAt: null,
    cycles: 11,
  });
  assert.equal(verdict.allowed, false);
  assert.equal(verdict.reason, 'daily_exhausted');
  assert.match(verdict.detail, /UTC midnight/);
});

test('the day is UTC, because that is when the allowance resets', () => {
  assert.equal(utcDay(new Date('2026-11-26T23:59:59.000Z')), '2026-11-26');
  assert.equal(utcDay(new Date('2026-11-27T00:00:01.000Z')), '2026-11-27');
});

/* ──────────────────────────── the meter ──────────────────────────── */

test('the meter counts what D1 reports, with no sampling', async () => {
  const db = createSqliteD1(SCHEMA);
  const meter = new CycleMeter(1_000);
  const metered = meteredD1(db, meter);

  await metered
    .prepare(
      "INSERT INTO catalog_merchant (id, name, network, relationship) VALUES (?, ?, 'test', 'approved')",
    )
    .bind('m1', 'M')
    .run();
  assert.ok(meter.rowsWritten > 0, 'a write was counted');
  assert.equal(meter.statements, 1);

  await metered.prepare('SELECT * FROM catalog_merchant').all();
  assert.equal(meter.statements, 2);
  assert.equal(meter.exhausted, false);
  assert.ok(meter.remaining > 0);
});

test('a meter at its cap reports exhausted rather than pretending to stop a statement', () => {
  const meter = new CycleMeter(10);
  meter.record({ rows_written: 10 });
  assert.equal(meter.exhausted, true);
  assert.equal(meter.remaining, 0);
});

/* ────────────────────────── the cycle itself ────────────────────────── */

test('A PAUSED SYSTEM DOES NOTHING, and the refusal is still recorded', async () => {
  const { db } = await world({ paused: 'owner stopped automation during the audit' });
  const result = await runSyncCycle(db, {
    now: NOW,
    trigger: 'scheduled',
    scheduler: { retrieve: fixtureRetrieve({ 'src-0': archiveOf(3) }) },
  });

  assert.equal(result.outcome, 'paused');
  assert.match(result.detail, /during the audit/);
  assert.equal(result.retrieval, null, 'no source was read');
  assert.equal(result.cost.rowsWritten, 0);

  // The record is the point: a scheduler that writes nothing when it refuses
  // is indistinguishable from one that never fired.
  const cycles = await recentCycles(db);
  assert.equal(cycles.length, 1);
  assert.equal(cycles[0].outcome, 'paused');
  assert.equal(cycles[0].trigger, 'scheduled');
});

test('an exhausted budget refuses before any write, and records that too', async () => {
  const { db } = await world();
  await new QuotaD1(db).add(utcDay(NOW), 100_200, 0, NOW.toISOString());

  const result = await runSyncCycle(db, {
    now: NOW,
    trigger: 'scheduled',
    scheduler: { retrieve: fixtureRetrieve({ 'src-0': archiveOf(3) }) },
  });

  assert.equal(result.outcome, 'budget_exhausted');
  assert.equal(result.retrieval, null);
  assert.equal((await new PublicCatalogue(db).summary()).products, 0);

  const cycles = await recentCycles(db);
  assert.equal(cycles[0].outcome, 'budget_exhausted');
});

test('a full cycle retrieves, imports, publishes and records its cost', async () => {
  const { db } = await world();
  const result = await runSyncCycle(db, {
    now: NOW,
    trigger: 'scheduled',
    scheduler: { retrieve: fixtureRetrieve({ 'src-0': archiveOf(5) }) },
  });

  assert.equal(result.outcome, 'ran', `detail: ${result.detail}`);
  assert.equal(result.retrieval.outcomes.length, 1);
  assert.equal(result.retrieval.outcomes[0].outcome, 'imported');
  assert.equal(result.publication.counts.eligible, 5);
  assert.equal(result.publication.outcome.opened, 5);
  assert.ok(result.cost.rowsWritten > 0, 'the cycle cost is measured, not estimated');

  const catalogue = await new PublicCatalogue(db).summary();
  assert.equal(catalogue.products, 5, 'and the products are public');

  // The cost landed in the day's budget.
  const usage = await new QuotaD1(db).usage(utcDay(NOW));
  assert.equal(usage.estimatedWrites, result.cost.rowsWritten);
  assert.equal(usage.cycles, 1);
  assert.equal(usage.authoritativeWrites, null, 'nobody has asked Cloudflare yet');

  const cycles = await recentCycles(db);
  assert.equal(cycles[0].outcome, 'ran');
  assert.equal(cycles[0].generation, result.publication.outcome.generation);
});

test('a DISABLED source is never read, and a PAUSED one is never read either', async () => {
  for (const [label, world_options] of [
    ['disabled', { enabled: false }],
    ['paused', { sourcePaused: true }],
  ]) {
    const { db } = await world(world_options);
    let touched = false;
    const result = await runSyncCycle(db, {
      now: NOW,
      trigger: 'scheduled',
      scheduler: {
        retrieve: async () => {
          touched = true;
          return { status: 'fetched', body: archiveOf(3), attempts: 1 };
        },
      },
    });
    assert.equal(touched, false, `a ${label} source must cost no retrieval`);
    assert.equal(result.retrieval, null, `a ${label} source is not even considered`);
  }
});

test('enabled and paused are SEPARATE, so an incident review can tell them apart', async () => {
  const { db, feeds } = await world();
  await feeds.pause('src-0', 'provider returned prices in the wrong currency', NOW.toISOString());

  const [source] = await feeds.all();
  assert.equal(source.enabled, true, 'it is still configured to run');
  assert.equal(source.paused, true, 'and someone stopped it');
  assert.match(source.pausedReason, /wrong currency/);
  assert.equal(source.pausedAt, NOW.toISOString());
  assert.deepEqual(await feeds.runnable(), []);

  await feeds.resume('src-0');
  const [resumed] = await feeds.all();
  assert.equal(resumed.paused, false);
  assert.equal(resumed.pausedReason, null);
  assert.equal((await feeds.runnable()).length, 1);
});

test('pausing without a reason is refused', async () => {
  const { feeds } = await world();
  await assert.rejects(() => feeds.pause('src-0', '   ', NOW.toISOString()), /needs a reason/);
});

test("ONE PROVIDER'S FAILURE DOES NOT STOP THE OTHERS, and health records it", async () => {
  const { db, feeds } = await world({ sources: 3 });
  const result = await runSyncCycle(db, {
    now: NOW,
    trigger: 'scheduled',
    scheduler: {
      concurrency: 1,
      retrieve: fixtureRetrieve({
        'src-0': archiveOf(4),
        'src-1': 'throw',
        'src-2': archiveOf(2),
      }),
    },
  });

  assert.equal(result.outcome, 'ran');
  const byId = new Map(result.retrieval.outcomes.map((o) => [o.sourceId, o.outcome]));
  assert.equal(byId.get('src-0'), 'imported');
  assert.equal(byId.get('src-1'), 'failed');
  assert.equal(byId.get('src-2'), 'imported');

  const sources = await feeds.all();
  const broken = sources.find((s) => s.id === 'src-1');
  const healthy = sources.find((s) => s.id === 'src-0');
  assert.equal(broken.consecutiveFailures ?? (await failureCount(db, 'src-1')), 1);
  assert.equal(await failureCount(db, 'src-0'), 0, 'a success resets the counter');
  assert.ok(healthy.lastAttemptAt, 'every attempt is recorded, successful or not');
});

async function failureCount(db, sourceId) {
  const row = await db
    .prepare('SELECT consecutive_failures FROM catalog_feed_source WHERE id = ?')
    .bind(sourceId)
    .first();
  return Number(row.consecutive_failures);
}

test('consecutive failures accumulate, so "broken since Tuesday" is a number', async () => {
  const { db } = await world();
  for (let i = 0; i < 3; i += 1) {
    await runSyncCycle(db, {
      now: new Date(NOW.getTime() + i * 86_400_000),
      trigger: 'scheduled',
      scheduler: { retrieve: fixtureRetrieve({}) },
    });
  }
  assert.equal(await failureCount(db, 'src-0'), 3);

  await runSyncCycle(db, {
    now: new Date(NOW.getTime() + 4 * 86_400_000),
    trigger: 'scheduled',
    scheduler: { retrieve: fixtureRetrieve({ 'src-0': archiveOf(2) }) },
  });
  assert.equal(await failureCount(db, 'src-0'), 0, 'one success clears it');
});

test('a 304 keeps the stored ETag rather than erasing it', async () => {
  /*
   * The whole saving of conditional requests is that the NEXT request is
   * conditional too. Writing the scheduler's empty validators over the stored
   * ones would make exactly one request cheap and every later one full price.
   */
  const { db, feeds } = await world();
  await runSyncCycle(db, {
    now: NOW,
    trigger: 'scheduled',
    scheduler: {
      retrieve: async () => ({
        status: 'fetched',
        body: archiveOf(2),
        attempts: 1,
        validators: { etag: 'W/"abc"', lastModified: 'Wed, 26 Nov 2026 11:00:00 GMT' },
      }),
    },
  });
  const [afterFetch] = await feeds.all();
  assert.equal(afterFetch.validators.etag, 'W/"abc"');

  await runSyncCycle(db, {
    now: new Date(NOW.getTime() + 7 * 3_600_000),
    trigger: 'scheduled',
    scheduler: { retrieve: async () => ({ status: 'unchanged', attempts: 1 }) },
  });
  const [afterNotModified] = await feeds.all();
  assert.equal(afterNotModified.validators.etag, 'W/"abc"', 'the ETag survived the 304');
});

test('a manual run and a scheduled run are distinguishable in the record', async () => {
  const { db } = await world();
  await runSyncCycle(db, {
    now: NOW,
    trigger: 'manual',
    scheduler: { retrieve: fixtureRetrieve({ 'src-0': archiveOf(2) }) },
  });
  const cycles = await recentCycles(db);
  assert.equal(cycles[0].trigger, 'manual');
  // "It only ever ran when somebody pressed it" has to be answerable.
  const scheduled = cycles.filter((c) => c.trigger === 'scheduled');
  assert.equal(scheduled.length, 0);
});

test('importOnly retrieves without publishing', async () => {
  const { db } = await world();
  const result = await runSyncCycle(db, {
    now: NOW,
    trigger: 'manual',
    importOnly: true,
    scheduler: { retrieve: fixtureRetrieve({ 'src-0': archiveOf(3) }) },
  });
  assert.equal(result.outcome, 'ran');
  assert.equal(result.publication, null);
  assert.equal((await new PublicCatalogue(db).summary()).products, 0);
});

test('running the same cycle id twice updates one row rather than failing', async () => {
  const { db } = await world();
  const options = {
    now: NOW,
    trigger: 'scheduled',
    scheduler: { retrieve: fixtureRetrieve({ 'src-0': archiveOf(2) }) },
  };
  await runSyncCycle(db, options);
  await runSyncCycle(db, options);
  const cycles = await recentCycles(db);
  assert.equal(cycles.length, 1, 'the cycle id is deterministic and the insert upserts');
});

test('the budget accumulates across cycles in a day, and resets with the day', async () => {
  const { db } = await world();
  const quota = new QuotaD1(db);
  await runSyncCycle(db, {
    now: NOW,
    trigger: 'scheduled',
    scheduler: { retrieve: fixtureRetrieve({ 'src-0': archiveOf(3) }) },
  });
  const first = await quota.usage(utcDay(NOW));

  const later = new Date('2026-11-26T20:00:00.000Z');
  await runSyncCycle(db, {
    now: later,
    trigger: 'scheduled',
    scheduler: { retrieve: fixtureRetrieve({ 'src-0': archiveOf(4) }) },
  });
  const second = await quota.usage(utcDay(later));
  assert.ok(second.estimatedWrites > first.estimatedWrites, 'the same day accumulates');
  assert.equal(second.cycles, 2);

  const tomorrow = new Date('2026-11-27T01:00:00.000Z');
  assert.equal(
    (await quota.usage(utcDay(tomorrow))).estimatedWrites,
    0,
    'a new day starts at zero',
  );
});

test("Cloudflare's own figure is stored beside the estimate, never instead of it", async () => {
  const { db } = await world();
  const quota = new QuotaD1(db);
  await quota.add('2026-11-26', 1_234, 500, NOW.toISOString());
  await quota.recordAuthoritative('2026-11-26', 1_600, '2026-11-26T13:00:00.000Z');

  const usage = await quota.usage('2026-11-26');
  assert.equal(usage.estimatedWrites, 1_234, 'the estimate is untouched');
  assert.equal(usage.authoritativeWrites, 1_600);
  assert.equal(usage.authoritativeAt, '2026-11-26T13:00:00.000Z');
  // The gap between them is the interesting number, and it is visible.
  assert.equal(usage.authoritativeWrites - usage.estimatedWrites, 366);
});

test('FREE_TIER is the documented allowance, not an invented one', () => {
  assert.equal(FREE_TIER.dailyWrites, 100_000);
  assert.ok(FREE_TIER.reserve > 0 && FREE_TIER.reserve < FREE_TIER.dailyWrites);
  assert.ok(FREE_TIER.maxCycleFraction > 0 && FREE_TIER.maxCycleFraction <= 1);
});
