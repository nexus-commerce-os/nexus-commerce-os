/*
 * The 9 and 10 November Soundcore exports, end to end.
 *
 * NEITHER ARCHIVE IS IN THIS REPOSITORY AND NEITHER MAY BE. They are CJ
 * content under the network's terms, this repository is public, and a single
 * row carries a live affiliate tracking URL. The paths come from the
 * environment and the suite skips when they are unset:
 *
 *   HONESTTOTAL_FEED_A   the earlier export  (9 November)
 *   HONESTTOTAL_FEED_B   the later export    (10 November)
 *
 * SKIPPING IS THE POINT, NOT A WEAKNESS. CI has no copy of a merchant feed and
 * must not acquire one; an operator with the archives gets the strongest test
 * in the suite, and everyone else still gets the synthetic ones that state the
 * same rules. What this file must never do is fail silently — so when the
 * variables ARE set, every count below is asserted exactly.
 *
 * The expected numbers were measured independently (python, csv, set algebra)
 * before any of this code existed, so they are a check on the implementation
 * rather than a recording of it.
 */
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { test } from 'node:test';

import { InMemoryOfferStore, importFeedArchive, readDelimitedPayload } from '../dist/index.js';

const A = process.env.HONESTTOTAL_FEED_A;
const B = process.env.HONESTTOTAL_FEED_B;
const have = Boolean(A && B);

const MERCHANT = 'soundcore';
const SOURCE = 'cj:shopping:7382109';

/** Measured 11 Nov 2026 on the two exports, before this importer existed. */
const EXPECTED = {
  rowsPerExport: 225,
  commonIds: 224,
  added: 1,
  removed: 1,
  salePriceChanges: 35,
  trackingUrlChanges: 178,
  impressionUrlChanges: 224,
};

/** Both exports were generated on the day they are named for. */
const AT_A = new Date('2026-11-09T13:30:00.000Z');
const AT_B = new Date('2026-11-10T13:30:00.000Z');

function load(path) {
  return readFileSync(path);
}

test('the two exports hold 225 rows each and differ by one product', { skip: !have }, () => {
  const pa = readDelimitedPayload(load(A));
  const pb = readDelimitedPayload(load(B));
  assert.notEqual(pa.sha256, pb.sha256, 'two different days must not hash alike');

  const rowsOf = (text) => text.trim().split(/\r?\n/).slice(1);
  assert.equal(rowsOf(pa.text).length, EXPECTED.rowsPerExport);
  assert.equal(rowsOf(pb.text).length, EXPECTED.rowsPerExport);

  const header = pa.text.split(/\r?\n/)[0].split('\t');
  const col = (name) => header.indexOf(name);
  const idIdx = col('ID');
  const idsOf = (text) => new Set(rowsOf(text).map((r) => r.split('\t')[idIdx]));
  const ia = idsOf(pa.text);
  const ib = idsOf(pb.text);
  const common = [...ia].filter((id) => ib.has(id));

  assert.equal(common.length, EXPECTED.commonIds);
  assert.equal([...ib].filter((id) => !ia.has(id)).length, EXPECTED.added);
  assert.equal([...ia].filter((id) => !ib.has(id)).length, EXPECTED.removed);

  // The three churning fields, counted straight from the files.
  const index = (text) => {
    const m = new Map();
    for (const r of rowsOf(text)) {
      const f = r.split('\t');
      m.set(f[idIdx], f);
    }
    return m;
  };
  const ma = index(pa.text);
  const mb = index(pb.text);
  const diff = (name) => {
    const i = col(name);
    return common.filter((id) => ma.get(id)[i] !== mb.get(id)[i]).length;
  };

  assert.equal(diff('SALE_PRICE'), EXPECTED.salePriceChanges, 'sale-price changes');
  assert.equal(diff('LINK'), EXPECTED.trackingUrlChanges, 'tracking URL changes');
  assert.equal(diff('IMPRESSION_URL'), EXPECTED.impressionUrlChanges, 'impression URL changes');
  assert.equal(diff('PRICE'), 0, 'no regular-price change');
  assert.equal(diff('AVAILABILITY'), 0, 'no availability change');
});

test('importing both days reconciles to 1 added and 1 removed', { skip: !have }, async () => {
  const store = new InMemoryOfferStore();

  const first = await importFeedArchive(load(A), store, {
    merchantId: MERCHANT,
    sourceFeed: SOURCE,
    now: AT_A,
  });
  assert.equal(first.applied, true, 'day one must apply');
  assert.equal(first.reconciliation.added.length, first.run.rowsTotal - first.quarantined);

  const before = await store.listOffers(MERCHANT);

  const second = await importFeedArchive(load(B), store, {
    merchantId: MERCHANT,
    sourceFeed: SOURCE,
    now: AT_B,
  });
  assert.equal(second.applied, true, 'day two must apply');

  const r = second.reconciliation;
  assert.equal(r.added.length, EXPECTED.added, 'one product arrived');
  assert.equal(r.removed.length, EXPECTED.removed, 'one product left');

  // The catalogue grew by exactly one and lost nothing: the departed product
  // is still stored, inactive, with its history.
  const after = await store.listOffers(MERCHANT);
  assert.equal(after.length, before.length + EXPECTED.added);
  assert.equal(after.filter((o) => o.state === 'inactive').length, EXPECTED.removed);
  assert.equal(
    after.filter((o) => o.state === 'active').length,
    EXPECTED.rowsPerExport - second.quarantined,
  );

  // Price movement, not sightings: only the sale-price changes are recorded.
  const salePriceMoves = r.updated.filter((u) => u.priceChange !== null);
  assert.equal(salePriceMoves.length, EXPECTED.salePriceChanges, 'price observations on day two');
  for (const move of salePriceMoves) assert.equal(move.priceChange, 'sale');

  /*
   * The exact shape of a day's churn, so a regression in the differ is visible
   * as a number rather than as "something moved". An earlier version of this
   * test asserted trackingRefreshed + priceMoves >= updated, which is simply
   * false: 31 products changed BOTH their tracking URL and their sale price,
   * so they are a price move and are NOT "tracking only".
   *
   *   productUrl only            147
   *   productUrl + salePrice      31   -> 178 tracking changes, as measured
   *   salePrice only               4   ->  35 price changes, as measured
   *   imageUrl only                1
   *                              ---
   *   updated                    183   + 41 unchanged = 224 common products
   */
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
  assert.equal(r.updated.length, 183);
  assert.equal(r.unchanged.length, 41);
  assert.equal(r.updated.length + r.unchanged.length, EXPECTED.commonIds);
  assert.equal(
    (combos.get('productUrl') ?? 0) + (combos.get('productUrl+salePrice') ?? 0),
    EXPECTED.trackingUrlChanges,
  );
});

test('every real row passes the guard — nothing is quarantined', { skip: !have }, async () => {
  // If this ever fails the feed's shape changed, and the right response is to
  // read the quarantine reasons rather than to relax the guard.
  const store = new InMemoryOfferStore();
  const result = await importFeedArchive(load(B), store, {
    merchantId: MERCHANT,
    sourceFeed: SOURCE,
    now: AT_B,
  });
  assert.equal(result.quarantined, 0);
  assert.equal(result.run.rowsTotal, EXPECTED.rowsPerExport);
});

test('IMPRESSION_URL churn on every row produces no product change', { skip: !have }, async () => {
  // 224 of 224 common rows carry a new IMPRESSION_URL on day two. The CJ
  // adapter does not map that column at all, so it cannot reach identity or
  // the diff — this asserts the property rather than trusting it.
  const store = new InMemoryOfferStore();
  await importFeedArchive(load(A), store, { merchantId: MERCHANT, sourceFeed: SOURCE, now: AT_A });
  const second = await importFeedArchive(load(B), store, {
    merchantId: MERCHANT,
    sourceFeed: SOURCE,
    now: AT_B,
  });

  const fields = new Set(second.reconciliation.updated.flatMap((u) => u.changedFields));
  assert.equal(fields.has('impressionUrl'), false);
  for (const f of fields) {
    assert.ok(
      [
        'productUrl',
        'salePrice',
        'listPrice',
        'title',
        'imageUrl',
        'availability',
        'brand',
        'gtin',
        'mpn',
        'condition',
        'shippingVerified',
        'feesVerified',
      ].includes(f),
      `unexpected changed field: ${f}`,
    );
  }
});

test('re-importing the later export changes nothing', { skip: !have }, async () => {
  const store = new InMemoryOfferStore();
  await importFeedArchive(load(A), store, { merchantId: MERCHANT, sourceFeed: SOURCE, now: AT_A });
  await importFeedArchive(load(B), store, { merchantId: MERCHANT, sourceFeed: SOURCE, now: AT_B });

  const offersBefore = (await store.listOffers(MERCHANT)).length;
  const historyBefore = store.priceHistoryCount;

  const again = await importFeedArchive(load(B), store, {
    merchantId: MERCHANT,
    sourceFeed: SOURCE,
    now: new Date(AT_B.getTime() + 60_000),
  });

  assert.equal(again.applied, false);
  assert.equal(again.run.status, 'skipped_duplicate');
  assert.equal((await store.listOffers(MERCHANT)).length, offersBefore, 'no duplicate offers');
  assert.equal(store.priceHistoryCount, historyBefore, 'no duplicate price history');
});

test(
  'no offer from the real feed is eligible for delivered-price ranking',
  { skip: !have },
  async () => {
    // Seven consecutive exports have carried no shipping on any row. If this
    // ever fails, the feed changed and the revenue question genuinely reopened.
    const store = new InMemoryOfferStore();
    await importFeedArchive(load(B), store, {
      merchantId: MERCHANT,
      sourceFeed: SOURCE,
      now: AT_B,
    });
    const offers = await store.listOffers(MERCHANT);
    assert.ok(offers.length > 0);
    assert.equal(offers.filter((o) => o.shippingVerified).length, 0, 'no verified shipping');
    assert.equal(offers.filter((o) => o.feesVerified).length, 0, 'no verified fees');
  },
);
