/*
 * The scheduling cycle.
 *
 * The test this file exists for is "a failed retrieval does not retire the
 * catalogue". Everything else here is ordinary correctness; that one is the
 * difference between a bad morning and a destroyed product line.
 */
import assert from 'node:assert/strict';
import { test } from 'node:test';

import {
  InMemoryOfferStore,
  InMemorySourceState,
  isAlreadyRunning,
  lastSuccessFor,
  runCycle,
} from '../dist/index.js';
import { buildFeed, gtin12, product, zipOf } from './fixtures/synthetic-feed.mjs';

/**
 * A ZIP'd synthetic feed of `count` distinct products, stamped with an export
 * time so the importer's 48-hour freshness guard is satisfied honestly rather
 * than bypassed with `allowStale`.
 *
 * EXPLICITLY SYNTHETIC. Every row is a fictional "Northwind Trading" product
 * on example.invalid. None of it is, or may be presented as, a real commercial
 * product.
 */
function syntheticFeedArchive(count, exportedAt) {
  const stamp = exportedAt.toISOString();
  const rows = Array.from({ length: count }, (_, i) =>
    product({
      id: `NW-${1000 + i}`,
      title: `Northwind Trading Test Item ${i}`,
      gtin: gtin12(String(10000000000 + i).slice(0, 11)),
      mpn: `NWTM-${i}`,
      lastUpdated: stamp,
    }),
  );
  return zipOf(buildFeed(rows));
}

const source = (over = {}) => ({
  id: 'soundcore-shopping',
  merchantId: 'soundcore',
  transport: 'https',
  url: 'https://feeds.example.com/products.csv',
  format: 'csv',
  schedule: { everyMinutes: 60 },
  credentialRef: null,
  enabled: true,
  ...over,
});

const AT = new Date('2026-11-26T12:00:00Z');
const clock = (d = AT) => () => d;

/** A retrieve stand-in with a fixed outcome. */
const retrieving = (outcome) => async () => outcome;

function fetchedArchive(rows, exportedAt = AT) {
  return {
    status: 'fetched',
    body: syntheticFeedArchive(rows, exportedAt),
    validators: { etag: '"v1"', sha256: `sha-${rows.length}-${exportedAt.toISOString()}` },
    fetchedAt: AT.toISOString(),
    attempts: 1,
  };
}

test('a due source is retrieved and imported', async () => {
  const store = new InMemoryOfferStore();
  const state = new InMemorySourceState();
  const report = await runCycle([source()], store, state, {
    now: clock(),
    retrieve: retrieving(fetchedArchive(3)),
  });

  assert.equal(report.considered, 1);
  const [out] = report.outcomes;
  assert.equal(out.outcome, 'imported', out.reason);
  assert.equal(out.counts.added, 3);
  assert.equal((await store.listOffers('soundcore')).length, 3);
});

test('a source that is not due is skipped, and skipping is not a failure', async () => {
  const store = new InMemoryOfferStore();
  const state = new InMemorySourceState();
  await state.set('soundcore-shopping', {
    lastSuccessAt: new Date(AT.getTime() - 5 * 60_000),
    validators: {},
  });

  const report = await runCycle([source()], store, state, {
    now: clock(),
    retrieve: async () => {
      throw new Error('retrieve must not be called for a source that is not due');
    },
  });
  assert.equal(report.outcomes[0].outcome, 'skipped');
  assert.match(report.outcomes[0].reason, /not due/);
});

test('a disabled source is never retrieved', async () => {
  const report = await runCycle([source({ enabled: false })], new InMemoryOfferStore(), new InMemorySourceState(), {
    now: clock(),
    retrieve: async () => {
      throw new Error('a disabled source must not be fetched');
    },
  });
  assert.equal(report.outcomes[0].outcome, 'skipped');
  assert.match(report.outcomes[0].reason, /disabled/);
});

test('A FAILED RETRIEVAL IMPORTS NOTHING AND RETIRES NOTHING', async () => {
  // The most important test in this file. An empty feed reconciles to "every
  // product departed"; a failed fetch must never be allowed to look like one.
  const store = new InMemoryOfferStore();
  const state = new InMemorySourceState();

  // Seed a real catalogue first.
  await runCycle([source()], store, state, {
    now: clock(),
    retrieve: retrieving(fetchedArchive(5)),
  });
  const seeded = await store.listOffers('soundcore');
  assert.equal(seeded.length, 5);

  // Now the provider goes down, an hour later so the source is due again.
  const later = new Date(AT.getTime() + 61 * 60_000);
  const report = await runCycle([source()], store, state, {
    now: clock(later),
    retrieve: retrieving({
      status: 'failed',
      reason: 'connection refused',
      retryable: true,
      fetchedAt: later.toISOString(),
      attempts: 4,
    }),
  });

  assert.equal(report.outcomes[0].outcome, 'failed');
  assert.match(report.outcomes[0].reason, /connection refused/);

  const after = await store.listOffers('soundcore');
  assert.equal(after.length, 5, 'the catalogue must be untouched');
  assert.equal(after.filter((o) => o.inactiveSince).length, 0, 'NOTHING may be retired by an outage');
});

test('an unchanged feed is recorded as unchanged, not as an import', async () => {
  const store = new InMemoryOfferStore();
  const state = new InMemorySourceState();
  const report = await runCycle([source()], store, state, {
    now: clock(),
    retrieve: retrieving({
      status: 'unchanged',
      validators: { etag: '"v1"' },
      fetchedAt: AT.toISOString(),
      attempts: 1,
    }),
  });
  assert.equal(report.outcomes[0].outcome, 'unchanged');
  assert.equal((await store.listOffers('soundcore')).length, 0);
});

test('validators are NOT remembered after a failure', async () => {
  // Otherwise the next cycle sends If-None-Match, gets a 304, and skips the
  // feed it never managed to ingest — a silent permanent stall.
  const store = new InMemoryOfferStore();
  const state = new InMemorySourceState();
  await runCycle([source()], store, state, {
    now: clock(),
    retrieve: retrieving({
      status: 'failed',
      reason: 'boom',
      retryable: true,
      fetchedAt: AT.toISOString(),
      attempts: 1,
    }),
  });
  assert.equal(await state.get('soundcore-shopping'), undefined);
});

test('one broken provider does not stop the others', async () => {
  const store = new InMemoryOfferStore();
  const state = new InMemorySourceState();
  const good = source({ id: 'good', merchantId: 'good-merchant' });
  const bad = source({ id: 'bad', merchantId: 'bad-merchant' });

  const report = await runCycle([bad, good], store, state, {
    now: clock(),
    concurrency: 1,
    retrieve: async (src) =>
      src.id === 'bad'
        ? { status: 'failed', reason: 'down', retryable: true, fetchedAt: AT.toISOString(), attempts: 1 }
        : fetchedArchive(2),
  });

  const byId = Object.fromEntries(report.outcomes.map((o) => [o.sourceId, o]));
  assert.equal(byId.bad.outcome, 'failed');
  assert.equal(byId.good.outcome, 'imported', 'the healthy source must still run');
  assert.equal((await store.listOffers('good-merchant')).length, 2);
});

test('a source already being imported is skipped, not run twice', async () => {
  const store = new InMemoryOfferStore();
  // A run someone else started a minute ago and has not finished.
  await store.beginRun({
    id: 'in-flight',
    merchantId: 'soundcore',
    sourceFeed: 'soundcore-shopping',
    contentSha256: 'abc',
    feedExportedAt: null,
    startedAt: new Date(AT.getTime() - 60_000).toISOString(),
    finishedAt: null,
    status: 'started',
    rowsTotal: null,
    offersAdded: null,
    offersRemoved: null,
    offersUpdated: null,
    offersUnchanged: null,
    rowsQuarantined: null,
    skipReason: null,
  });

  assert.equal(await isAlreadyRunning(store, source(), AT, 30), true);

  const report = await runCycle([source()], store, new InMemorySourceState(), {
    now: clock(),
    retrieve: async () => {
      throw new Error('a source already running must not be fetched again');
    },
  });
  assert.equal(report.outcomes[0].outcome, 'skipped');
  assert.match(report.outcomes[0].reason, /already running/);
});

test('a CRASHED job stops blocking its source once it is old enough', async () => {
  // A `started` run whose process died never reaches a terminal status. Without
  // an age bound it would block that source for ever.
  const store = new InMemoryOfferStore();
  await store.beginRun({
    id: 'abandoned',
    merchantId: 'soundcore',
    sourceFeed: 'soundcore-shopping',
    contentSha256: 'abc',
    feedExportedAt: null,
    startedAt: new Date(AT.getTime() - 120 * 60_000).toISOString(),
    finishedAt: null,
    status: 'started',
    rowsTotal: null,
    offersAdded: null,
    offersRemoved: null,
    offersUpdated: null,
    offersUnchanged: null,
    rowsQuarantined: null,
    skipReason: null,
  });

  assert.equal(await isAlreadyRunning(store, source(), AT, 30), false, 'two hours old is abandoned');

  const report = await runCycle([source()], store, new InMemorySourceState(), {
    now: clock(),
    retrieve: retrieving(fetchedArchive(2)),
  });
  assert.equal(report.outcomes[0].outcome, 'imported');

  // And the abandoned run is still in the ledger: "started and never finished"
  // is a fact an operator needs to see.
  const runs = await store.listRuns('soundcore');
  assert.ok(runs.some((r) => r.id === 'abandoned' && r.status === 'started'));
});

test('concurrency is bounded', async () => {
  const store = new InMemoryOfferStore();
  let inFlight = 0;
  let peak = 0;
  const sources = Array.from({ length: 6 }, (_, i) =>
    source({ id: `s${i}`, merchantId: `m${i}` }),
  );

  await runCycle(sources, store, new InMemorySourceState(), {
    now: clock(),
    concurrency: 2,
    retrieve: async () => {
      inFlight += 1;
      peak = Math.max(peak, inFlight);
      await new Promise((r) => setTimeout(r, 5));
      inFlight -= 1;
      return fetchedArchive(1);
    },
  });

  assert.ok(peak <= 2, `peak concurrency was ${peak}, expected at most 2`);
});

test('every source produces exactly one structured log line', async () => {
  const sources = [source({ id: 'a', merchantId: 'ma' }), source({ id: 'b', merchantId: 'mb' })];
  const report = await runCycle(sources, new InMemoryOfferStore(), new InMemorySourceState(), {
    now: clock(),
    retrieve: retrieving(fetchedArchive(1)),
  });
  assert.equal(report.outcomes.length, 2);
  for (const out of report.outcomes) {
    assert.ok(out.sourceId && out.merchantId && out.startedAt && out.finishedAt, 'incomplete log line');
    assert.ok(out.reason.length > 0, 'every outcome must state a reason');
  }
});

test('last success is read from the ledger when no state is remembered', async () => {
  const store = new InMemoryOfferStore();
  assert.equal(await lastSuccessFor(store, source()), null);

  await runCycle([source()], store, new InMemorySourceState(), {
    now: clock(),
    retrieve: retrieving(fetchedArchive(2)),
  });
  const last = await lastSuccessFor(store, source());
  assert.ok(last instanceof Date, 'an applied run must be findable as a success');
});
