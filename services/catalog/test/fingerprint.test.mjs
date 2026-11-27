/*
 * THE NO-OP PUBLICATION PATH, and everything it must NOT skip.
 *
 * The saving is real — about 300 row writes a cycle, measured over twelve
 * consecutive scheduled cycles on staging — but the danger is specific and
 * worth naming: a catalogue can stop being correct without any feed byte
 * changing. An offer expires. A merchant's approval is withdrawn. The rules
 * themselves change.
 *
 * So every test below is of the form "this changed, and publication still
 * happened".
 */
import assert from 'node:assert/strict';
import { test } from 'node:test';

import {
  D1OfferStore,
  PublicCatalogue,
  catalogueFingerprint,
  importFeedArchive,
  publishCatalogue,
} from '../dist/index.js';
import { createSqliteD1, d1Schema } from './helpers/sqlite-d1.mjs';
import { buildFeed, gtin12, product, zipOf } from './fixtures/synthetic-feed.mjs';

const SCHEMA = await d1Schema();
const MERCHANT = 'northwind';
const STAMP = '2026-11-26T11:31:41.000Z';

const candidate = (over = {}) => ({
  productId: over.productId ?? 'gtin:00012345678905',
  slug: over.slug ?? 'a-mug',
  title: over.title ?? 'A Mug',
  brand: over.brand === undefined ? 'Northwind' : over.brand,
  categorySlug: over.categorySlug === undefined ? 'home/drinkware' : over.categorySlug,
  dataVerifiedAt: over.dataVerifiedAt ?? STAMP,
  searchText: over.searchText ?? 'a mug northwind',
  fromPrice: over.fromPrice === undefined ? null : over.fromPrice,
  offerCount: over.offerCount ?? 1,
  eligible: over.eligible ?? true,
  reasonCode: over.reasonCode ?? 'eligible',
});

const RULES = '2026-11-26.1';

/* ─────────────────────────── the digest itself ─────────────────────────── */

test('the same catalogue in a different order has the same fingerprint', () => {
  const a = [candidate({ productId: 'p-1' }), candidate({ productId: 'p-2', slug: 'b' })];
  assert.equal(
    catalogueFingerprint(a, RULES),
    catalogueFingerprint([...a].reverse(), RULES),
    'a Map insertion order must not decide whether the catalogue republishes',
  );
});

test('every field a visitor can see changes the fingerprint', () => {
  const base = catalogueFingerprint([candidate()], RULES);
  const changes = {
    title: { title: 'A Different Mug' },
    slug: { slug: 'a-different-mug' },
    brand: { brand: 'Contoso' },
    category: { categorySlug: 'home/kitchen' },
    freshness: { dataVerifiedAt: '2026-11-27T11:31:41.000Z' },
    searchText: { searchText: 'something else' },
    price: { fromPrice: { amountMinor: 1999, currency: 'USD' } },
    offerCount: { offerCount: 2 },
  };
  for (const [name, over] of Object.entries(changes)) {
    assert.notEqual(
      catalogueFingerprint([candidate(over)], RULES),
      base,
      `${name} must change the fingerprint`,
    );
  }
});

test('A RULES CHANGE REPUBLISHES, even when every product is identical', () => {
  // The same products published under different rules is a different
  // publication, and an operator looking for the change must find a generation.
  const rows = [candidate()];
  assert.notEqual(catalogueFingerprint(rows, RULES), catalogueFingerprint(rows, '2027-01-01.1'));
});

test('a currency change is not hidden by an equal amount', () => {
  const usd = catalogueFingerprint(
    [candidate({ fromPrice: { amountMinor: 1999, currency: 'USD' } })],
    RULES,
  );
  const eur = catalogueFingerprint(
    [candidate({ fromPrice: { amountMinor: 1999, currency: 'EUR' } })],
    RULES,
  );
  assert.notEqual(usd, eur);
});

test('a product leaving the catalogue changes the fingerprint', () => {
  const two = catalogueFingerprint(
    [candidate({ productId: 'p-1' }), candidate({ productId: 'p-2', slug: 'b' })],
    RULES,
  );
  const one = catalogueFingerprint([candidate({ productId: 'p-1' })], RULES);
  assert.notEqual(two, one);
});

test('a withheld product does not move the catalogue', () => {
  /*
   * Ineligible candidates are excluded on purpose: they are not published, so
   * a change among them cannot change what anybody sees, and including them
   * would republish the whole catalogue every time a withheld product's reason
   * shifted. Their decisions are still recorded.
   */
  const withOne = catalogueFingerprint(
    [candidate(), candidate({ productId: 'p-held', eligible: false, reasonCode: 'stale_data' })],
    RULES,
  );
  const withAnother = catalogueFingerprint(
    [
      candidate(),
      candidate({ productId: 'p-held', eligible: false, reasonCode: 'merchant_not_approved' }),
    ],
    RULES,
  );
  assert.equal(withOne, withAnother);
  assert.equal(withOne, catalogueFingerprint([candidate()], RULES));
});

test('a title cannot imitate another row by containing the separator', () => {
  const sneaky = catalogueFingerprint([candidate({ title: 'A Mug\u001fb\u001fc' })], RULES);
  assert.notEqual(sneaky, catalogueFingerprint([candidate()], RULES));
});

/* ─────────────────── what it must not skip, end to end ─────────────────── */

const row = (i, price = '19.99', stamp = STAMP) =>
  product({
    id: `NW-${i}`,
    title: `Northwind Item ${i}`,
    price: `${price} USD`,
    salePrice: '',
    gtin: gtin12(String(10000000000 + i)),
    mpn: `NW-MPN-${i}`,
    lastUpdated: stamp,
    productType: 'Home > Drinkware',
  });

async function world({ approved = true } = {}) {
  const db = createSqliteD1(SCHEMA);
  await db
    .prepare(
      `INSERT INTO catalog_merchant (id, name, network, relationship) VALUES (?, ?, 'test', ?)`,
    )
    .bind(MERCHANT, 'Northwind Trading', approved ? 'approved' : 'pending')
    .run();
  return { db, store: new D1OfferStore(db) };
}

const publishedRowCount = async (db) =>
  (await db.prepare('SELECT COUNT(*) AS n FROM catalog_published_product').first()).n;
const generationCount = async (db) =>
  (await db.prepare('SELECT COUNT(*) AS n FROM catalog_publication_generation').first()).n;

async function seed(db, store, rows, at) {
  const result = await importFeedArchive(zipOf(buildFeed(rows)), store, {
    merchantId: MERCHANT,
    sourceFeed: 'test:feed',
    now: new Date(at),
  });
  return result;
}

test('an identical cycle creates no generation and writes no published rows', async () => {
  const { db, store } = await world();
  await seed(db, store, [row(1), row(2), row(3)], '2026-11-26T12:00:00.000Z');
  await publishCatalogue(db, { now: new Date('2026-11-26T12:05:00.000Z') });

  const rowsBefore = await publishedRowCount(db);
  const gensBefore = await generationCount(db);

  for (let i = 0; i < 5; i += 1) {
    const result = await publishCatalogue(db, {
      now: new Date(`2026-11-26T1${3 + i}:05:00.000Z`),
    });
    assert.equal(result.skipped, 'catalogue_unchanged', `cycle ${i} should be a no-op`);
  }

  assert.equal(await publishedRowCount(db), rowsBefore, 'not one published row');
  assert.equal(await generationCount(db), gensBefore, 'not one generation');
  assert.equal((await new PublicCatalogue(db).summary()).products, 3);
});

test('AN OFFER EXPIRING REPUBLISHES, even though the feed never changed', async () => {
  /*
   * The danger the whole design has to survive. Nothing about the feed moves;
   * the data simply gets old. Skipping on feed bytes would leave a stale
   * product published indefinitely.
   */
  const { db, store } = await world();
  await seed(db, store, [row(1), row(2)], '2026-11-26T12:00:00.000Z');
  await publishCatalogue(db, { now: new Date('2026-11-26T12:05:00.000Z') });
  assert.equal((await new PublicCatalogue(db).summary()).products, 2);

  // Four days later, with no new import at all.
  const later = new Date('2026-11-30T12:05:00.000Z');
  const result = await publishCatalogue(db, {
    now: later,
    limits: { maxShrinkFraction: 1, allowEmpty: true },
  });
  assert.notEqual(result.skipped, 'catalogue_unchanged', 'expiry must not be skipped');
  assert.equal((await new PublicCatalogue(db).summary()).products, 0);
});

test('WITHDRAWING A MERCHANT APPROVAL REPUBLISHES, with no feed change', async () => {
  const { db, store } = await world();
  await seed(db, store, [row(1), row(2), row(3)], '2026-11-26T12:00:00.000Z');
  await publishCatalogue(db, { now: new Date('2026-11-26T12:05:00.000Z') });
  assert.equal((await new PublicCatalogue(db).summary()).products, 3);

  await db
    .prepare("UPDATE catalog_merchant SET relationship = 'suspended' WHERE id = ?")
    .bind(MERCHANT)
    .run();

  const result = await publishCatalogue(db, {
    now: new Date('2026-11-26T13:05:00.000Z'),
    limits: { maxShrinkFraction: 1, allowEmpty: true },
  });
  assert.notEqual(result.skipped, 'catalogue_unchanged');
  assert.equal(
    (await new PublicCatalogue(db).summary()).products,
    0,
    'an unapproved merchant must leave the catalogue immediately',
  );
});

test('a price or availability change republishes', async () => {
  const { db, store } = await world();
  await seed(db, store, [row(1), row(2)], '2026-11-26T12:00:00.000Z');
  await publishCatalogue(db, { now: new Date('2026-11-26T12:05:00.000Z') });

  // A genuinely new feed: one price moves.
  await seed(db, store, [row(1, '9.99'), row(2)], '2026-11-26T13:00:00.000Z');
  const result = await publishCatalogue(db, { now: new Date('2026-11-26T13:05:00.000Z') });
  assert.notEqual(result.skipped, 'catalogue_unchanged');
  assert.equal(result.outcome.refreshed + result.outcome.opened > 0, true);
});

test('A REFUSED GENERATION LEAVES NO FINGERPRINT BEHIND', async () => {
  /*
   * Otherwise the next identical cycle would skip publication on the strength
   * of a publication that never happened — and the catalogue would be frozen
   * at whatever was live before the refusal, with nothing ever retrying.
   */
  const { db, store } = await world();
  await seed(db, store, [row(1), row(2), row(3), row(4)], '2026-11-26T12:00:00.000Z');
  await publishCatalogue(db, { now: new Date('2026-11-26T12:05:00.000Z') });
  const liveBefore = (await new PublicCatalogue(db).summary()).generation;

  // Everything goes away: a cliff, which the validator refuses.
  await db
    .prepare("UPDATE catalog_merchant_offer SET state = 'inactive', inactive_since = ?")
    .bind('2026-11-26T14:00:00.000Z')
    .run();

  const refused = await publishCatalogue(db, { now: new Date('2026-11-26T14:05:00.000Z') });
  assert.equal(refused.rejected.code, 'empty_catalogue');

  // The same state again. It must be REFUSED again, not skipped as unchanged.
  const again = await publishCatalogue(db, { now: new Date('2026-11-26T15:05:00.000Z') });
  assert.notEqual(again.skipped, 'catalogue_unchanged');
  assert.equal(again.rejected.code, 'empty_catalogue');
  assert.equal(
    (await new PublicCatalogue(db).summary()).generation,
    liveBefore,
    'and the live catalogue never moved',
  );
});

test('a rollback makes the next cycle publish again', async () => {
  const { db, store } = await world();
  await seed(db, store, [row(1)], '2026-11-26T12:00:00.000Z');
  const first = await publishCatalogue(db, { now: new Date('2026-11-26T12:05:00.000Z') });

  await seed(db, store, [row(1), row(2)], '2026-11-26T13:00:00.000Z');
  await publishCatalogue(db, { now: new Date('2026-11-26T13:05:00.000Z') });

  const { GenerationPublisher } = await import('../dist/index.js');
  await new GenerationPublisher(db).rollbackTo(first.outcome.generation, {
    at: '2026-11-26T13:30:00.000Z',
    decidedBy: 'operator:owner',
  });
  assert.equal((await new PublicCatalogue(db).summary()).products, 1);

  // The live fingerprint is now the OLD one, so the computed catalogue
  // disagrees with it and publication happens.
  const next = await publishCatalogue(db, { now: new Date('2026-11-26T14:05:00.000Z') });
  assert.notEqual(next.skipped, 'catalogue_unchanged');
  assert.equal((await new PublicCatalogue(db).summary()).products, 2);
});

test('a first publication is never skipped, because nothing is live', async () => {
  const { db, store } = await world();
  await seed(db, store, [row(1)], '2026-11-26T12:00:00.000Z');
  const result = await publishCatalogue(db, { now: new Date('2026-11-26T12:05:00.000Z') });
  assert.equal(result.skipped, null);
  assert.equal(result.outcome.opened, 1);
});
