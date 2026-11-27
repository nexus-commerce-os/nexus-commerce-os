/*
 * CJ'S PUBLISHER API AS A TRANSPORT.
 *
 * Two things are being protected here, and they are different kinds of thing.
 *
 * 1. WHAT THIS MODULE PRODUCES MUST BE WHAT THE PARSER READS. The point of
 *    rendering the API's products back into the tab-separated export is that
 *    no second reader of CJ's data comes into existence — the parser measured
 *    against seven real provider exports stays the only one. A renderer that
 *    drifts from it would quietly quarantine rows, so the central test here
 *    feeds its own output straight into `parseShoppingFeed` and checks the
 *    values come back.
 *
 * 2. A FAILURE MUST NEVER LOOK LIKE AN EMPTY FEED. Reconciliation retires
 *    products a feed stops listing. So a bad token, a GraphQL error, a feed
 *    that is no longer shared, or a truncated response must all be `failed`,
 *    never `fetched` with zero products — the one bug in this file that would
 *    empty a live catalogue.
 *
 * No network. Every response is a recorded shape taken from CJ's own
 * documented samples.
 */
import assert from 'node:assert/strict';
import { test } from 'node:test';

import {
  assessFeedWindow,
  catalogQuery,
  feedSummaryQuery,
  parseCjFeedConfig,
  parseShoppingFeed,
  feedExportWindow,
  readDelimitedPayload,
  renderShoppingFeed,
  retrieveCjFeed,
  verifyAdvertiserRelationship,
} from '../dist/index.js';

const CONFIG = {
  provider: 'cj',
  companyId: '999',
  adId: '12345678',
  advertiserId: '111',
  pid: '9999999',
};
const DETAIL = JSON.stringify(CONFIG);

const product = (over = {}) => ({
  id: 'SC-1001',
  title: 'Soundcore Life Q30 Headphones',
  description: 'Hybrid active noise cancelling, 40h playtime',
  brand: 'Soundcore',
  gtin: '0194644048310',
  mpn: 'A3028011',
  availability: 'IN_STOCK',
  condition: 'new',
  link: 'https://example.invalid/q30',
  imageLink: 'https://example.invalid/q30.jpg',
  lastUpdated: '2026-11-26T04:00:00.000Z',
  productType: ['Electronics', 'Audio', 'Headphones'],
  targetCountry: 'US',
  isDeleted: false,
  price: { amount: '79.99', currency: 'USD' },
  salePrice: { amount: '59.99', currency: 'USD' },
  shipping: {
    country: 'US',
    region: '',
    service: 'Ground',
    price: { amount: '0.00', currency: 'USD' },
  },
  linkCode: {
    clickUrl:
      'https://www.kqzyfj.com/click-9999999-00000000?url=https%3A%2F%2Fexample.invalid%2Fq30&cjsku=SC-1001',
  },
  ...over,
});

/** A fetch that answers the summary query first and the catalogue second. */
function stubFetch(responses) {
  const calls = [];
  const queue = [...responses];
  return {
    calls: () => calls,
    fetch: async (url, init) => {
      calls.push({ url: String(url), body: JSON.parse(String(init.body)).query, init });
      const next = queue.shift();
      if (next === undefined) throw new Error('unexpected extra request');
      if (typeof next === 'function') return next();
      return new Response(JSON.stringify(next.body), {
        status: next.status ?? 200,
        headers: { 'content-type': 'application/json' },
      });
    },
  };
}

const summaryBody = (over = {}) => ({
  data: {
    productFeeds: {
      totalCount: 1,
      count: 1,
      resultList: [
        {
          adId: '12345678',
          feedName: 'Soundcore catalog',
          advertiserId: '111',
          advertiserName: 'Soundcore',
          productCount: 228,
          advertiserCountry: 'US',
          currency: 'USD',
          language: 'en',
          lastUpdated: '2026-11-26T04:05:00.000Z',
          sourceFeedType: 'GOOGLE',
          ...over,
        },
      ],
    },
  },
});

const catalogueBody = (products) => ({ data: { shoppingProductCatalog: products } });

/* ──────────────────────────── the configuration ──────────────────────────── */

test('a config row that is missing an identifier fails HERE, not at the API', () => {
  assert.throws(() => parseCjFeedConfig(null), /no auth_detail/);
  assert.throws(() => parseCjFeedConfig('not json'), /not JSON/);
  assert.throws(() => parseCjFeedConfig('{"provider":"impact"}'), /not "cj"/);
  assert.throws(() => parseCjFeedConfig('{"provider":"cj","adId":"1"}'), /companyId is required/);
  assert.throws(() => parseCjFeedConfig('{"provider":"cj","companyId":"9"}'), /adId is required/);

  const ok = parseCjFeedConfig(DETAIL);
  assert.equal(ok.companyId, '999');
  assert.equal(ok.adId, '12345678');
  assert.equal(ok.pid, '9999999');
});

test('AN IDENTIFIER THAT COULD BREAK OUT OF THE QUERY IS REFUSED, not escaped', () => {
  // Escaping it would produce a query that still runs and means something
  // else. An account identifier never contains a quote, so one that does is
  // a configuration error or an attempt, and both deserve a refusal.
  const hostile = JSON.stringify({ provider: 'cj', companyId: '999" ', adId: '1' });
  assert.throws(() => feedSummaryQuery(parseCjFeedConfig(hostile)), /may not contain/);
});

test('the queries name the documented operations and carry no secret', () => {
  const config = parseCjFeedConfig(DETAIL);

  const summary = feedSummaryQuery(config);
  assert.match(summary, /productFeeds\(companyId: "999", partnerIds: \["111"\]\)/);
  assert.match(summary, /lastUpdated/);

  const catalogue = catalogQuery(config);
  assert.match(
    catalogue,
    /subscription \{ shoppingProductCatalog\(companyId: "999", adId: "12345678"\)/,
  );
  assert.match(catalogue, /linkCode\(pid: "9999999"\) \{ clickUrl \}/);
  // The fields the feed carries, so the renderer has something to render.
  for (const field of ['gtin', 'mpn', 'salePrice', 'shipping', 'availability', 'productType']) {
    assert.match(catalogue, new RegExp(field), `the catalogue query should ask for ${field}`);
  }
});

test('without a pid, no tracking link is requested at all', () => {
  const catalogue = catalogQuery(parseCjFeedConfig(JSON.stringify({ ...CONFIG, pid: undefined })));
  assert.doesNotMatch(catalogue, /linkCode/);
});

/* ───────────────────────────── the rendering ───────────────────────────── */

test('WHAT THIS RENDERS IS WHAT THE MEASURED PARSER READS', () => {
  const feed = renderShoppingFeed([product()]);
  const parsed = parseShoppingFeed(feed);

  assert.deepEqual(parsed.malformed, [], 'the rendered feed must contain no malformed row');
  assert.deepEqual(parsed.missingColumns, [], 'every logical column must be present');
  assert.equal(parsed.rows.length, 1);

  const fields = parsed.rows[0].fields;
  assert.equal(fields.id, 'SC-1001');
  assert.equal(fields.gtin, '0194644048310');
  assert.equal(fields.mpn, 'A3028011');
  assert.equal(fields.brand, 'Soundcore');
  assert.equal(fields.price, '79.99 USD', 'the amount and its currency, as the feed spells it');
  assert.equal(fields.salePrice, '59.99 USD');
  assert.equal(fields.availability, 'IN_STOCK');
  assert.equal(fields.productType, 'Electronics > Audio > Headphones');
  assert.equal(fields.shippingPrice, '0.00 USD');
  assert.equal(fields.shippingCountry, 'US');
  assert.equal(fields.link, product().linkCode.clickUrl, 'the tracking link, when a pid was set');
});

test('a tab, a newline or a quote in a description does not become a broken row', () => {
  const nasty = product({
    description: 'Two\tcolumns?\nNo.\tHe said "loud".',
    title: 'Quote " in a title',
  });
  const parsed = parseShoppingFeed(renderShoppingFeed([nasty]));

  assert.deepEqual(parsed.malformed, [], 'quoting must keep this one row');
  assert.equal(parsed.rows.length, 1);
  assert.equal(parsed.rows[0].fields.description, 'Two\tcolumns?\nNo.\tHe said "loud".');
  assert.equal(parsed.rows[0].fields.title, 'Quote " in a title');
});

test('a deleted product is not rendered at all', () => {
  const feed = renderShoppingFeed([product(), product({ id: 'SC-GONE', isDeleted: true })]);
  const parsed = parseShoppingFeed(feed);
  assert.equal(parsed.rows.length, 1);
  assert.equal(parsed.rows[0].fields.id, 'SC-1001');
});

test('a product with no shipping block states no shipping, rather than zero', () => {
  // Measured on the real Soundcore export: shipping was absent on every row.
  // "Absent" and "free" are different facts and the delivered-total machinery
  // depends on telling them apart.
  const parsed = parseShoppingFeed(renderShoppingFeed([product({ shipping: null })]));
  assert.equal(parsed.rows[0].fields.shippingPrice, '');
  assert.equal(parsed.rows[0].fields.shippingPacked, '');
  assert.equal(parsed.rows[0].fields.shippingCountry, '');
});

/* ───────────────────────────── the retrieval ───────────────────────────── */

test('an unchanged lastUpdated costs ONE call and transfers no catalogue', async () => {
  const stub = stubFetch([{ body: summaryBody() }]);
  const result = await retrieveCjFeed(parseCjFeedConfig(DETAIL), {
    token: 'pat',
    previous: { lastModified: '2026-11-26T04:05:00.000Z' },
    fetchImpl: stub.fetch,
  });

  assert.equal(result.status, 'unchanged');
  assert.equal(stub.calls().length, 1, 'the catalogue must not be requested');
  assert.match(stub.calls()[0].body, /productFeeds/);
});

test('a moved feed is fetched and rendered', async () => {
  const stub = stubFetch([
    { body: summaryBody() },
    { body: catalogueBody([product(), product({ id: 'SC-2' })]) },
  ]);
  const result = await retrieveCjFeed(parseCjFeedConfig(DETAIL), {
    token: 'pat',
    previous: { lastModified: '2026-11-25T04:05:00.000Z' },
    fetchImpl: stub.fetch,
  });

  assert.equal(result.status, 'fetched');
  assert.equal(result.validators.lastModified, '2026-11-26T04:05:00.000Z');
  assert.ok(result.validators.sha256, 'the rendered bytes must be hashed for the next run');

  const parsed = parseShoppingFeed(result.body.toString('utf8'));
  assert.equal(parsed.rows.length, 2);

  // The token goes in the header and nowhere else.
  for (const call of stub.calls()) {
    assert.equal(call.init.headers.authorization, 'Bearer pat');
    assert.doesNotMatch(call.body, /pat/);
  }
});

test('IDENTICAL PRODUCTS WITH A NEW TIMESTAMP ARE STILL UNCHANGED', async () => {
  // CJ's lastUpdated moves when the advertiser re-imports, which is not the
  // same as the products having changed. Without this, a nightly re-import of
  // identical data would cost a publication generation every night.
  const first = stubFetch([{ body: summaryBody() }, { body: catalogueBody([product()]) }]);
  const fetched = await retrieveCjFeed(parseCjFeedConfig(DETAIL), {
    token: 'pat',
    fetchImpl: first.fetch,
  });
  assert.equal(fetched.status, 'fetched');

  const second = stubFetch([
    { body: summaryBody({ lastUpdated: '2026-11-27T04:05:00.000Z' }) },
    { body: catalogueBody([product()]) },
  ]);
  const again = await retrieveCjFeed(parseCjFeedConfig(DETAIL), {
    token: 'pat',
    previous: fetched.validators,
    fetchImpl: second.fetch,
  });
  assert.equal(again.status, 'unchanged', 'the same bytes are the same feed');
});

test('A FEED THAT IS NO LONGER SHARED IS A FAILURE, NEVER AN EMPTY CATALOGUE', async () => {
  const stub = stubFetch([
    { body: { data: { productFeeds: { totalCount: 0, count: 0, resultList: [] } } } },
  ]);
  const result = await retrieveCjFeed(parseCjFeedConfig(DETAIL), {
    token: 'pat',
    fetchImpl: stub.fetch,
  });

  assert.equal(result.status, 'failed');
  assert.match(result.reason, /not in this publisher's product feed list/);
  assert.equal(result.retryable, false, 'a withdrawn feed does not come back by retrying');
});

test('every other way this can go wrong is also a failure', async () => {
  const cases = [
    {
      name: 'no token',
      options: { token: '   ', fetchImpl: stubFetch([]).fetch },
      expect: /no personal access token/,
      retryable: false,
    },
    {
      name: 'an unauthorised token',
      options: { token: 'bad', fetchImpl: stubFetch([{ status: 401, body: {} }]).fetch },
      expect: /answered 401/,
      retryable: false,
    },
    {
      name: 'a GraphQL refusal',
      options: {
        token: 'pat',
        fetchImpl: stubFetch([{ body: { errors: [{ message: 'not permitted' }] } }]).fetch,
      },
      expect: /refused the feed summary: not permitted/,
      retryable: false,
    },
    {
      name: 'the network',
      options: {
        token: 'pat',
        fetchImpl: stubFetch([
          () => {
            throw new Error('ECONNRESET');
          },
        ]).fetch,
      },
      expect: /summary request failed/,
      retryable: true,
    },
    {
      name: 'a catalogue refusal',
      options: {
        token: 'pat',
        fetchImpl: stubFetch([
          { body: summaryBody() },
          { body: { errors: [{ message: 'feed too large' }] } },
        ]).fetch,
      },
      expect: /refused the catalogue: feed too large/,
      retryable: false,
    },
    {
      name: 'a response with no catalogue in it',
      options: {
        token: 'pat',
        fetchImpl: stubFetch([{ body: summaryBody() }, { body: { data: {} } }]).fetch,
      },
      expect: /no shoppingProductCatalog/,
      retryable: false,
    },
  ];

  for (const testCase of cases) {
    const result = await retrieveCjFeed(parseCjFeedConfig(DETAIL), testCase.options);
    assert.equal(result.status, 'failed', `${testCase.name} must fail`);
    assert.match(result.reason, testCase.expect, testCase.name);
    assert.equal(result.retryable, testCase.retryable, `${testCase.name} retryable`);
  }
});

test('an oversized catalogue is refused rather than buffered', async () => {
  const huge = JSON.stringify(catalogueBody([product({ description: 'x'.repeat(5000) })]));
  const stub = stubFetch([
    { body: summaryBody() },
    () => new Response(huge, { status: 200, headers: { 'content-type': 'application/json' } }),
  ]);
  const result = await retrieveCjFeed(parseCjFeedConfig(DETAIL), {
    token: 'pat',
    fetchImpl: stub.fetch,
    maxBytes: 1000,
  });
  assert.equal(result.status, 'failed');
  assert.match(result.reason, /exceeded the size limit/);
});

/* ─────────────────────── the relationship, verified ─────────────────────── */

const lookupXml = (over = {}) => `<?xml version="1.0" encoding="UTF-8"?>
<cj-api>
  <advertisers total-matched="1" records-returned="1" page-number="1">
    <advertiser>
      <advertiser-id>${over.id ?? '111'}</advertiser-id>
      <account-status>${over.account ?? 'Active'}</account-status>
      <advertiser-name>Soundcore</advertiser-name>
      <program-url>https://example.invalid</program-url>
      <relationship-status>${over.relationship ?? 'joined'}</relationship-status>
    </advertiser>
  </advertisers>
</cj-api>`;

const lookupFetch =
  (xml, status = 200) =>
  async (url, init) => {
    lookupFetch.lastUrl = String(url);
    lookupFetch.lastAuth = init.headers.authorization;
    return new Response(xml, { status, headers: { 'content-type': 'application/xml' } });
  };

test('JOINED AND ACTIVE IS THE ONLY YES', async () => {
  const verdict = await verifyAdvertiserRelationship({
    token: 'pat',
    requestorCid: '999',
    advertiserId: '111',
    fetchImpl: lookupFetch(lookupXml()),
    now: () => new Date('2026-11-27T14:00:00.000Z'),
  });

  assert.equal(verdict.ok, true);
  assert.equal(verdict.advertiser.relationshipStatus, 'joined');
  assert.equal(verdict.advertiser.accountStatus, 'active');
  assert.match(verdict.evidence, /relationship-status=joined account-status=active/);
  assert.match(lookupFetch.lastUrl, /requestor-cid=999/);
  assert.match(lookupFetch.lastUrl, /advertiser-ids=111/);
  assert.equal(lookupFetch.lastAuth, 'Bearer pat');
});

test('every other answer is a NO, including the ones that are not answers', async () => {
  const cases = [
    { xml: lookupXml({ relationship: 'notjoined' }), expect: /relationship-status is "notjoined"/ },
    { xml: lookupXml({ account: 'Deactivated' }), expect: /account-status is "deactivated"/ },
    { xml: lookupXml({ id: '222' }), expect: /was not in the lookup response/ },
    { xml: '<cj-api><advertisers/></cj-api>', expect: /was not in the lookup response/ },
    { xml: 'not xml at all', expect: /was not in the lookup response/ },
  ];
  for (const testCase of cases) {
    const verdict = await verifyAdvertiserRelationship({
      token: 'pat',
      requestorCid: '999',
      advertiserId: '111',
      fetchImpl: lookupFetch(testCase.xml),
    });
    assert.equal(verdict.ok, false);
    assert.match(verdict.reason, testCase.expect);
  }

  const unauthorised = await verifyAdvertiserRelationship({
    token: 'pat',
    requestorCid: '999',
    advertiserId: '111',
    fetchImpl: lookupFetch('', 403),
  });
  assert.equal(unauthorised.ok, false);
  assert.match(unauthorised.reason, /answered 403/);

  const noToken = await verifyAdvertiserRelationship({
    token: '',
    requestorCid: '999',
    advertiserId: '111',
    fetchImpl: lookupFetch(lookupXml()),
  });
  assert.equal(noToken.ok, false);
  assert.match(noToken.reason, /no personal access token/);
});

test('A RECURRING DELIVERY IS NOT EVIDENCE — only the lookup is', async () => {
  /*
   * The subscription can keep arriving after a relationship ends: CJ is
   * serving a subscription that was created while one existed. So a feed
   * that retrieves perfectly well still yields no authorisation on its own,
   * and this test states that as a property rather than as a comment: the
   * retrieval succeeds, and the verdict is still a refusal.
   */
  const stub = stubFetch([{ body: summaryBody() }, { body: catalogueBody([product()]) }]);
  const retrieved = await retrieveCjFeed(parseCjFeedConfig(DETAIL), {
    token: 'pat',
    fetchImpl: stub.fetch,
  });
  assert.equal(retrieved.status, 'fetched', 'the feed arrives');

  const verdict = await verifyAdvertiserRelationship({
    token: 'pat',
    requestorCid: '999',
    advertiserId: '111',
    fetchImpl: lookupFetch(lookupXml({ relationship: 'notjoined' })),
  });
  assert.equal(verdict.ok, false, 'and it authorises nothing');
});

/* ────────── LAST_UPDATED dates the export, not the product ────────── */

test('EVERY ROW CARRIES THE EXPORT INSTANT, because that is what the column means', () => {
  /*
   * Measured on the real Soundcore feed: CJ's per-product `lastUpdated` had
   * 203 distinct values across 219 rows, spanning 2025-09-02 to 2026-11-27.
   * Rendering those into LAST_UPDATED made a current export read as stale and
   * `importFeedArchive` refused it with `skipped_stale` — correctly, because
   * the freshness guard reads that column as the date of the GENERATION RUN
   * and a 450-day spread means it is dating products instead.
   */
  const products = [
    product({ id: 'A', lastUpdated: '2025-09-02T16:14:46.455Z' }),
    product({ id: 'B', lastUpdated: '2026-03-01T15:05:26.686Z' }),
    product({ id: 'C', lastUpdated: '2026-11-27T12:00:20.517Z' }),
  ];
  const exportedAt = '2026-11-27T12:00:20.530Z';
  const parsed = parseShoppingFeed(renderShoppingFeed(products, { exportedAt }));

  const stamps = new Set(parsed.rows.map((row) => row.fields.lastUpdated));
  assert.deepEqual([...stamps], [exportedAt], 'one export, one timestamp');

  // The guard reads the whole window: one instant, no spread, not stale.
  const freshness = assessFeedWindow(feedExportWindow(parsed.rows), new Date(exportedAt));
  assert.equal(freshness.kind, 'fresh', 'the guard reads it as one fresh export');

  // And the shape the guard refuses, for contrast: product dates, not export
  // dates. This is what the real Soundcore feed looked like before the fix.
  const unstamped = parseShoppingFeed(renderShoppingFeed(products));
  const spread = assessFeedWindow(feedExportWindow(unstamped.rows), new Date(exportedAt));
  assert.equal(spread.kind, 'inconsistent', 'a 14-month spread is not one export');
});

test('with no export instant, the product timestamp is still used', () => {
  const parsed = parseShoppingFeed(renderShoppingFeed([product()]));
  assert.equal(parsed.rows[0].fields.lastUpdated, '2026-11-26T04:00:00.000Z');
});

test('the retrieval stamps the rows with the feed lastUpdated it reported', async () => {
  const stub = stubFetch([
    { body: summaryBody() },
    {
      body: catalogueBody([
        product(),
        product({ id: 'B', lastUpdated: '2025-01-01T00:00:00.000Z' }),
      ]),
    },
  ]);
  const result = await retrieveCjFeed(parseCjFeedConfig(DETAIL), {
    token: 'pat',
    fetchImpl: stub.fetch,
  });

  assert.equal(result.status, 'fetched');
  const parsed = parseShoppingFeed(result.body.toString('utf8'));
  const stamps = new Set(parsed.rows.map((row) => row.fields.lastUpdated));
  assert.deepEqual([...stamps], ['2026-11-26T04:05:00.000Z'], 'the feed instant, on every row');
});

/* ──────────── a feed that is not in a ZIP is still a feed ──────────── */

test('PLAIN DELIMITED BYTES ARE READ, not refused as "not a zip"', () => {
  // The API transport has nothing to compress its render into, and a feed
  // fetched as plain text over https is ordinary. This used to throw.
  const text = renderShoppingFeed([product()], { exportedAt: '2026-11-27T12:00:20.530Z' });
  const payload = readDelimitedPayload(Buffer.from(text, 'utf8'));

  assert.equal(payload.memberName, '(unarchived)');
  assert.match(payload.text, /SC-1001/);
  assert.equal(payload.sha256.length, 64);
  assert.equal(parseShoppingFeed(payload.text).rows.length, 1);
});

test('a BOM is stripped from plain bytes too', () => {
  const text = renderShoppingFeed([product()]);
  const payload = readDelimitedPayload(Buffer.from('﻿' + text, 'utf8'));
  assert.equal(payload.text.charCodeAt(0) === 0xfeff, false);
  assert.equal(parseShoppingFeed(payload.text).rows.length, 1);
});

test('BUT ANYTHING CLAIMING TO BE AN ARCHIVE IS STILL READ AS ONE, and still fails loudly', () => {
  // A truncated ZIP still begins with the local-file-header signature, so
  // it must not be mistaken for text and silently parsed as a feed with no
  // rows. Only bytes that never claimed to be an archive are read as one.
  const corrupt = Buffer.concat([Buffer.from([0x50, 0x4b, 0x03, 0x04]), Buffer.from('nonsense')]);
  assert.throws(() => readDelimitedPayload(corrupt), /not-a-zip|no-delimited-member/);

  const blank = Buffer.from(['   ', ''].join(String.fromCharCode(10)), 'utf8');
  assert.throws(() => readDelimitedPayload(blank), /no-delimited-member/);
});
