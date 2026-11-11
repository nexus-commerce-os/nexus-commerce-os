/*
 * Reconciliation and idempotency, on synthetic feeds.
 *
 * The real exports are exercised separately in import-real-feeds.test.mjs,
 * which reads them from outside this repository. These tests own their inputs
 * so they state the rule rather than the measurement: a tracking URL that
 * changes must not create a product, a product that vanishes must not lose its
 * history, and the same payload twice must change nothing the second time.
 */
import assert from 'node:assert/strict';
import { test } from 'node:test';

import { InMemoryOfferStore, importFeedArchive, reconcile } from '../dist/index.js';
import { HEADERS, buildFeed, gtin12, product, zipOf } from './fixtures/synthetic-feed.mjs';

const MERCHANT = 'test-merchant';
const SOURCE = 'test:shopping:0000';

const STAMP = '2026-11-10T12:31:41.000Z';
const NOW = new Date('2026-11-10T13:00:00.000Z');

/*
 * `product()` fills its own `lastUpdated` (29 Oct), so a post-hoc `?? STAMP`
 * never fired and every feed these tests built was three weeks stale — which
 * the freshness guard correctly refused. The default has to be applied when
 * the row is created, not afterwards.
 */
function row(overrides = {}) {
  return product({ lastUpdated: STAMP, ...overrides });
}

function feed(rows) {
  return buildFeed(rows);
}

async function runImport(store, text, now = NOW) {
  return importFeedArchive(zipOf(text), store, {
    merchantId: MERCHANT,
    sourceFeed: SOURCE,
    now,
  });
}

test('a first import adds every offer and opens its price history', async () => {
  const store = new InMemoryOfferStore();
  const result = await runImport(
    store,
    feed([
      row({ id: 'SKU-1', gtin: gtin12('01234567891'), price: '79.99 USD' }),
      row({ id: 'SKU-2', gtin: gtin12('01234567892'), price: '49.99 USD' }),
    ]),
  );

  assert.equal(result.applied, true);
  assert.equal(result.run.status, 'applied');
  assert.equal(result.reconciliation.added.length, 2);
  assert.equal(result.reconciliation.updated.length, 0);

  const offers = await store.listOffers(MERCHANT);
  assert.equal(offers.length, 2);
  const history = await store.listPriceHistory(offers[0].id);
  assert.equal(history.length, 1);
  assert.equal(history[0].changeKind, 'initial');
});

test('the SAME payload twice is applied once and writes no second history row', async () => {
  const store = new InMemoryOfferStore();
  const text = feed([row({ id: 'SKU-1', gtin: gtin12('01234567891'), price: '79.99 USD' })]);

  const first = await runImport(store, text);
  const offersAfterFirst = (await store.listOffers(MERCHANT)).length;
  const historyAfterFirst = store.priceHistoryCount;

  const second = await runImport(store, text);

  assert.equal(first.applied, true);
  assert.equal(second.applied, false);
  assert.equal(second.run.status, 'skipped_duplicate');
  assert.match(second.run.skipReason, /already applied/);

  assert.equal((await store.listOffers(MERCHANT)).length, offersAfterFirst, 'no duplicate offer');
  assert.equal(store.priceHistoryCount, historyAfterFirst, 'no duplicate history row');

  // Both attempts are in the ledger: "looked and declined" is not "never ran".
  assert.equal((await store.listRuns(MERCHANT)).length, 2);
});

test('a changed tracking URL refreshes the offer and creates no new product', async () => {
  const store = new InMemoryOfferStore();
  const before = row({ id: 'SKU-1', gtin: gtin12('01234567891'), price: '79.99 USD' });
  await runImport(store, feed([before]));

  const after = {
    ...before,
    link: 'https://example.test/track?v=2&url=https%3A%2F%2Fshop.test%2Fp',
  };
  const result = await runImport(store, feed([after]));

  assert.equal(result.reconciliation.added.length, 0);
  assert.equal(result.reconciliation.removed.length, 0);
  assert.equal(result.reconciliation.updated.length, 1);
  assert.equal(result.reconciliation.trackingRefreshed.length, 1);
  assert.deepEqual(result.reconciliation.updated[0].changedFields, ['productUrl']);
  assert.equal(result.reconciliation.updated[0].priceChange, null);

  assert.equal((await store.listOffers(MERCHANT)).length, 1, 'still one product');
  assert.equal(store.priceHistoryCount, 1, 'a link change is not a price observation');
});

test('a price move appends exactly one history row, and an unchanged price appends none', async () => {
  const store = new InMemoryOfferStore();
  const base = row({ id: 'SKU-1', gtin: gtin12('01234567891'), price: '79.99 USD' });
  await runImport(store, feed([base]));

  await runImport(store, feed([{ ...base, salePrice: '67.99 USD' }]));
  const offer = (await store.listOffers(MERCHANT))[0];
  let history = await store.listPriceHistory(offer.id);
  assert.equal(history.length, 2);
  assert.equal(history[1].changeKind, 'sale');

  // Same prices again, only the generation stamp moves: no new history.
  await runImport(
    store,
    feed([{ ...base, salePrice: '67.99 USD', lastUpdated: '2026-11-10T12:40:00.000Z' }]),
  );
  history = await store.listPriceHistory(offer.id);
  assert.equal(history.length, 2, 'an unchanged price is not an observation');
});

test('a product missing from a new export goes inactive and keeps its history', async () => {
  const store = new InMemoryOfferStore();
  const keep = row({ id: 'SKU-1', gtin: gtin12('01234567891'), price: '79.99 USD' });
  const drop = row({ id: 'SKU-2', gtin: gtin12('01234567892'), price: '49.99 USD' });
  await runImport(store, feed([keep, drop]));

  const dropped = await store.findOffer(MERCHANT, 'SKU-2');
  const result = await runImport(store, feed([keep]));

  assert.equal(result.reconciliation.removed.length, 1);
  const after = await store.findOffer(MERCHANT, 'SKU-2');
  assert.notEqual(after, null, 'the row is kept, not deleted');
  assert.equal(after.state, 'inactive');
  assert.ok(after.inactiveSince);
  assert.equal((await store.listPriceHistory(dropped.id)).length, 1, 'history survives');
});

test('a returning product is revived rather than duplicated', async () => {
  const store = new InMemoryOfferStore();
  const a = row({ id: 'SKU-1', gtin: gtin12('01234567891'), price: '79.99 USD' });
  const b = row({ id: 'SKU-2', gtin: gtin12('01234567892'), price: '49.99 USD' });
  // Each import is a separate generation, as real exports are: LAST_UPDATED
  // moved on 224 of 224 common products between 9 and 10 November, so no two
  // generations hash alike and none is refused as a duplicate.
  await runImport(store, feed([a, b]));
  await runImport(store, feed([{ ...a, lastUpdated: '2026-11-10T12:35:00.000Z' }]));
  await runImport(
    store,
    feed([
      { ...a, lastUpdated: '2026-11-10T12:40:00.000Z' },
      { ...b, lastUpdated: '2026-11-10T12:40:00.000Z' },
    ]),
  );

  const offers = await store.listOffers(MERCHANT);
  assert.equal(offers.length, 2, 'no duplicate on return');
  const revived = await store.findOffer(MERCHANT, 'SKU-2');
  assert.equal(revived.state, 'active');
  assert.equal(revived.inactiveSince, null);
});

test('a stale export is refused and the store is left untouched', async () => {
  const store = new InMemoryOfferStore();
  await runImport(
    store,
    feed([row({ id: 'SKU-1', gtin: gtin12('01234567891'), price: '79.99 USD' })]),
  );
  const before = (await store.listOffers(MERCHANT)).length;

  // Same feed stamp, read three days later.
  const late = new Date('2026-11-13T13:00:00.000Z');
  const result = await importFeedArchive(
    zipOf(feed([row({ id: 'SKU-9', gtin: gtin12('01234567899'), price: '9.99 USD' })])),
    store,
    { merchantId: MERCHANT, sourceFeed: SOURCE, now: late },
  );

  assert.equal(result.applied, false);
  assert.equal(result.run.status, 'skipped_stale');
  assert.equal((await store.listOffers(MERCHANT)).length, before, 'nothing was written');
});

test('reconcile keys on the merchant SKU alone', () => {
  const stored = [
    {
      id: 'offer-1',
      merchantId: MERCHANT,
      merchantOfferId: 'SKU-1',
      gtin: null,
      mpn: null,
      brand: 'B',
      title: 'T',
      listPrice: { amountMinor: 7999, currency: 'USD' },
      salePrice: null,
      availability: 'in_stock',
      condition: 'new',
      productUrl: 'https://old.test/track',
      imageUrl: 'https://img.test/a.jpg',
      shippingVerified: false,
      feesVerified: false,
      snapshotAt: STAMP,
      sourceFeed: SOURCE,
      firstSeenRun: 'r1',
      lastSeenRun: 'r1',
      lastSeenAt: STAMP,
      state: 'active',
      inactiveSince: null,
    },
  ];
  const incoming = [
    {
      offerId: 'ignored',
      merchantId: MERCHANT,
      merchantOfferId: 'SKU-1',
      gtin: null,
      mpn: null,
      brand: 'B',
      title: 'T',
      listPrice: { amountMinor: 7999, currency: 'USD' },
      salePrice: null,
      availability: 'in_stock',
      condition: 'new',
      productUrl: 'https://new.test/track',
      imageUrl: 'https://img.test/a.jpg',
      shipping: { kind: 'missing', reason: 'none stated' },
      mandatoryFees: { kind: 'missing', reason: 'none stated' },
      snapshotAt: STAMP,
      sourceFeed: SOURCE,
    },
  ];

  const result = reconcile(stored, incoming);
  assert.equal(result.added.length, 0, 'a different offerId must not add a product');
  assert.equal(result.removed.length, 0);
  assert.equal(result.trackingRefreshed.length, 1);
});

void HEADERS;
