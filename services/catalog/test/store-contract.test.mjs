/*
 * ONE SUITE, EVERY STORE.
 *
 * The point of a storage interface is that callers cannot tell which
 * implementation they have. That claim is only worth something if the same
 * assertions run against each one, so these tests are written once and
 * executed against the in-memory double and the D1 adapter (on a real SQLite
 * engine). The Postgres adapter joins the same list when a database is
 * available — `HONESTTOTAL_PG_DSN` — and is reported as skipped otherwise
 * rather than silently omitted.
 *
 * Where the implementations legitimately DIFFER, the difference is asserted
 * rather than hidden. D1 has no transaction spanning batches, so `applyRun`
 * is not atomic there; that is stated in `d1-offer-store.ts` and the test for
 * it says so out loud.
 */
import assert from 'node:assert/strict';
import { test } from 'node:test';

import { D1OfferStore, DuplicateApplyError, InMemoryOfferStore } from '../dist/index.js';
import { createSqliteD1, d1Schema } from './helpers/sqlite-d1.mjs';

const SCHEMA = await d1Schema();

/** Each entry builds a FRESH store, so no test can lean on another's state. */
const implementations = [
  { name: 'in-memory', make: async () => new InMemoryOfferStore() },
  { name: 'd1 (sqlite)', make: async () => new D1OfferStore(createSqliteD1(SCHEMA)) },
];

const MERCHANT = 'northwind';
const money = (minor, currency = 'USD') => ({ amountMinor: minor, currency });

const offer = (over = {}) => ({
  id: 'o-1',
  merchantId: MERCHANT,
  merchantOfferId: 'NW-1',
  gtin: '0012345678905',
  mpn: 'NWTM-1',
  brand: 'Northwind Trading',
  title: 'Northwind Trading Travel Mug',
  listPrice: money(2499),
  salePrice: money(1999),
  availability: 'in stock',
  condition: 'new',
  productUrl: 'https://example.invalid/p/1',
  imageUrl: 'https://cdn.example.invalid/1.jpg',
  shippingVerified: false,
  feesVerified: false,
  snapshotAt: '2026-11-26T12:00:00.000Z',
  sourceFeed: 'test:feed',
  firstSeenRun: 'run-1',
  lastSeenRun: 'run-1',
  lastSeenAt: '2026-11-26T12:00:00.000Z',
  state: 'active',
  inactiveSince: null,
  ...over,
});

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

for (const impl of implementations) {
  const only = (name, fn) => test(`[${impl.name}] ${name}`, fn);

  only('an offer round-trips with its money intact', async () => {
    const store = await impl.make();
    await store.beginRun(run());
    await store.applyRun(async (tx) => {
      await tx.upsertOffer(offer());
      await tx.finishRun('run-1', { status: 'applied' });
    });

    const found = await store.findOffer(MERCHANT, 'NW-1');
    assert.ok(found, 'the offer should be findable by identity');
    // Money is the thing most likely to be silently wrong across engines.
    assert.equal(found.listPrice.amountMinor, 2499);
    assert.equal(found.listPrice.currency, 'USD');
    assert.equal(found.salePrice.amountMinor, 1999);
    assert.equal(found.title, 'Northwind Trading Travel Mug');
    assert.equal(found.state, 'active');
  });

  only('a second import of the same identity UPDATES rather than duplicating', async () => {
    const store = await impl.make();
    await store.beginRun(run());
    await store.applyRun(async (tx) => {
      await tx.upsertOffer(offer());
      await tx.finishRun('run-1', { status: 'applied' });
    });
    await store.beginRun(run({ id: 'run-2', contentSha256: 'sha-bbb' }));
    await store.applyRun(async (tx) => {
      // Same identity, different generated id and a moved price.
      await tx.upsertOffer(
        offer({ id: 'o-DIFFERENT', listPrice: money(2599), lastSeenRun: 'run-2' }),
      );
      await tx.finishRun('run-2', { status: 'applied' });
    });

    const all = await store.listOffers(MERCHANT);
    assert.equal(
      all.length,
      1,
      'identity is (merchant, merchant_offer_id) — this must not duplicate',
    );
    assert.equal(all[0].listPrice.amountMinor, 2599, 'the price should have moved');
  });

  only('absence marks an offer inactive and never deletes it', async () => {
    const store = await impl.make();
    await store.beginRun(run());
    await store.applyRun(async (tx) => {
      await tx.upsertOffer(offer());
      await tx.finishRun('run-1', { status: 'applied' });
    });
    await store.beginRun(run({ id: 'run-2', contentSha256: 'sha-bbb' }));
    await store.applyRun(async (tx) => {
      await tx.markInactive(['o-1'], '2026-11-27T12:00:00.000Z', 'run-2');
      await tx.finishRun('run-2', { status: 'applied' });
    });

    const all = await store.listOffers(MERCHANT);
    assert.equal(all.length, 1, 'the row must survive — absence is not deletion');
    assert.equal(all[0].state, 'inactive');
    assert.equal(all[0].inactiveSince, '2026-11-27T12:00:00.000Z');
  });

  only('price history records one observation per run, and a repeat is a no-op', async () => {
    const store = await impl.make();
    await store.beginRun(run());
    await store.applyRun(async (tx) => {
      await tx.upsertOffer(offer());
      const entry = {
        offerId: 'o-1',
        importRunId: 'run-1',
        observedAt: '2026-11-26T12:00:00.000Z',
        listPrice: money(2499),
        salePrice: money(1999),
        changeKind: 'initial',
      };
      await tx.appendPriceHistory([entry]);
      // The same observation twice in one run must not produce two rows.
      await tx.appendPriceHistory([entry]);
      await tx.finishRun('run-1', { status: 'applied' });
    });

    const history = await store.listPriceHistory('o-1');
    assert.equal(history.length, 1, 'once per offer per run, enforced by the store');
    assert.equal(history[0].listPrice.amountMinor, 2499);
  });

  only('an applied payload is found again, which is what makes re-import cheap', async () => {
    const store = await impl.make();
    await store.beginRun(run());
    await store.applyRun(async (tx) => {
      await tx.upsertOffer(offer());
      await tx.finishRun('run-1', { status: 'applied' });
    });

    const found = await store.findAppliedRun(MERCHANT, 'sha-aaa');
    assert.ok(found, 'the applied run should be findable by payload hash');
    assert.equal(found.status, 'applied');
    assert.equal(await store.findAppliedRun(MERCHANT, 'sha-never-seen'), null);
  });

  only('TWO CONCURRENT IMPORTS OF ONE PAYLOAD APPLY EXACTLY ONCE', async () => {
    /*
     * The guarantee the whole design rests on. Both runs pass the cheap
     * pre-flight check; the loser must be refused at commit, not politely
     * allowed to write a second copy of the catalogue.
     */
    const store = await impl.make();
    await store.beginRun(run({ id: 'run-a' }));
    await store.beginRun(run({ id: 'run-b' }));

    await store.applyRun(async (tx) => {
      // The run ids must be the ones that exist: an offer references its runs,
      // and D1 enforces that foreign key. The first version of this test left
      // the fixture pointing at `run-1` and failed with a FOREIGN KEY error
      // that looked, for a moment, like a broken duplicate guard.
      await tx.upsertOffer(offer({ firstSeenRun: 'run-a', lastSeenRun: 'run-a' }));
      await tx.finishRun('run-a', { status: 'applied' });
    });

    await assert.rejects(
      () =>
        store.applyRun(async (tx) => {
          await tx.upsertOffer(
            offer({
              id: 'o-2',
              merchantOfferId: 'NW-2',
              firstSeenRun: 'run-b',
              lastSeenRun: 'run-b',
            }),
          );
          await tx.finishRun('run-b', { status: 'applied' });
        }),
      (error) => error instanceof DuplicateApplyError,
      'the second apply of an identical payload must be refused',
    );

    const runs = await store.listRuns(MERCHANT);
    const applied = runs.filter((r) => r.status === 'applied');
    assert.equal(applied.length, 1, 'exactly one run may be applied for one payload');
  });

  only('a quarantined row keeps its reasons', async () => {
    const store = await impl.make();
    await store.beginRun(run());
    await store.applyRun(async (tx) => {
      await tx.recordQuarantine([
        {
          importRunId: 'run-1',
          merchantId: MERCHANT,
          rowNumber: 7,
          merchantOfferId: 'NW-BAD',
          reasons: ['missing gtin', 'price unparseable'],
        },
      ]);
      await tx.finishRun('run-1', { status: 'applied' });
    });

    const quarantine = await store.listQuarantine('run-1');
    assert.equal(quarantine.length, 1);
    // Quarantine is a question, not rubbish: the reasons must survive.
    assert.deepEqual([...quarantine[0].reasons], ['missing gtin', 'price unparseable']);
    assert.equal(quarantine[0].merchantOfferId, 'NW-BAD');
  });

  only('a failed run is recorded as failed, with its reason and no offers', async () => {
    const store = await impl.make();
    await store.beginRun(run());
    await store.applyRun(async (tx) => {
      await tx.finishRun('run-1', { status: 'failed', skipReason: 'provider returned 503' });
    });

    const runs = await store.listRuns(MERCHANT);
    assert.equal(runs[0].status, 'failed');
    assert.match(runs[0].skipReason, /503/);
    assert.equal((await store.listOffers(MERCHANT)).length, 0, 'a failed run writes no catalogue');
  });

  only('the ledger distinguishes "we looked and declined" from "we never ran"', async () => {
    const store = await impl.make();
    await store.beginRun(run());
    await store.applyRun(async (tx) => {
      await tx.finishRun('run-1', {
        status: 'skipped_duplicate',
        skipReason: 'payload already applied',
      });
    });
    const runs = await store.listRuns(MERCHANT);
    assert.equal(runs.length, 1);
    assert.equal(runs[0].status, 'skipped_duplicate');
  });
}

/*
 * Where the engines legitimately differ. Asserted, not hidden.
 */
test('[d1] applyRun is NOT one transaction, and the design depends on knowing that', async () => {
  /*
   * D1 operates in auto-commit and `batch()` is capped by a 100-bound-
   * parameter limit, so a large write phase is several batches. Each batch is
   * atomic; the sequence is not.
   *
   * This is safe ONLY because nothing public reads these tables — publication
   * is a separate pointer move. If that ever stops being true, this test is
   * the place that says so.
   */
  const d1 = createSqliteD1(SCHEMA);
  const store = new D1OfferStore(d1);
  await store.beginRun(run());

  // The run row is committed on its own, before any write phase, which is
  // what the job lease reads.
  const started = await store.listRuns(MERCHANT);
  assert.equal(started.length, 1);
  assert.equal(started[0].status, 'started');
  assert.equal((await store.listOffers(MERCHANT)).length, 0, 'no offers yet');
});

test('[d1] a write phase that throws leaves the catalogue untouched', async () => {
  const store = new D1OfferStore(createSqliteD1(SCHEMA));
  await store.beginRun(run());

  await assert.rejects(() =>
    store.applyRun(async (tx) => {
      await tx.upsertOffer(offer());
      throw new Error('interrupted midway');
    }),
  );

  // Statements are collected and only executed at the end, so an interruption
  // during the work function writes nothing at all.
  assert.equal((await store.listOffers(MERCHANT)).length, 0);
});

test('[d1] re-running an interrupted import converges rather than duplicating', async () => {
  // Resumability: every statement is an upsert keyed on identity, so the
  // safe recovery from a half-finished import is simply to run it again.
  const d1 = createSqliteD1(SCHEMA);
  const store = new D1OfferStore(d1);

  for (const id of ['run-1', 'run-2']) {
    await store.beginRun(run({ id, contentSha256: `sha-${id}` }));
    await store.applyRun(async (tx) => {
      await tx.upsertOffer(offer({ firstSeenRun: 'run-1', lastSeenRun: id }));
      await tx.finishRun(id, { status: 'applied' });
    });
  }

  const all = await store.listOffers(MERCHANT);
  assert.equal(all.length, 1, 'converged on one row');
  assert.equal(all[0].lastSeenRun, 'run-2');
});

test('[d1] the harness really does enforce foreign keys', async () => {
  /*
   * D1 enforces foreign keys by default and they cannot be switched off per
   * query, so the contract tests lean on that. A harness that quietly did not
   * enforce them would make every reference in this file meaningless — so it
   * is checked rather than assumed.
   */
  const store = new D1OfferStore(createSqliteD1(SCHEMA));
  await assert.rejects(
    () => store.upsertOffer(offer({ firstSeenRun: 'no-such-run', lastSeenRun: 'no-such-run' })),
    /FOREIGN KEY constraint failed/,
    'an offer referencing a run that does not exist must be refused',
  );
});
