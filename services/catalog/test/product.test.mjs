/*
 * PRODUCT INTELLIGENCE.
 *
 * The tests that matter are the refusals. Grouping offers is a Map; the value
 * is in what does NOT get grouped, because the only failure that hurts a
 * visitor is being shown "3 merchants from $19" where one of the three is a
 * different item.
 */
import assert from 'node:assert/strict';
import { test } from 'node:test';

import {
  buildProducts,
  classifyFromProductType,
  matchOffers,
  normaliseBrand,
  normaliseMpn,
  normaliseSpecification,
  productIdentity,
  productSlug,
  rankOffers,
  slugifyCategory,
  storedAsOffer,
  toGtin14,
} from '../dist/index.js';

const AT = '2026-11-26T12:00:00.000Z';
const NOW = new Date('2026-11-26T13:00:00.000Z');

/** GTIN-12 with a correct check digit, so fixtures are not rejected for the wrong reason. */
function gtin12(body11) {
  const digits = [...body11].map(Number);
  const sum = digits
    .reverse()
    .reduce((total, digit, index) => total + digit * (index % 2 === 0 ? 3 : 1), 0);
  return body11 + String((10 - (sum % 10)) % 10);
}

const money = (minor, currency = 'USD') => ({ amountMinor: minor, currency });

let seq = 0;
const offer = (over = {}) => ({
  id: over.id ?? `o-${++seq}`,
  merchantId: over.merchantId ?? 'northwind',
  merchantOfferId: over.merchantOfferId ?? 'NW-1',
  gtin: over.gtin === undefined ? gtin12('01234567890') : over.gtin,
  mpn: over.mpn === undefined ? 'NWTM-1' : over.mpn,
  brand: over.brand ?? 'Northwind Trading',
  title: over.title ?? 'Northwind Trading Travel Mug',
  listPrice: over.listPrice ?? money(2499),
  salePrice: over.salePrice === undefined ? money(1999) : over.salePrice,
  availability: over.availability ?? 'in_stock',
  condition: over.condition ?? 'new',
  productUrl: 'https://example.invalid/p/1',
  imageUrl: 'https://cdn.example.invalid/1.jpg',
  shippingVerified: over.shippingVerified ?? false,
  shippingCost: over.shippingCost ?? null,
  shippingDestination: over.shippingDestination ?? null,
  feesVerified: over.feesVerified ?? false,
  feesTotal: over.feesTotal ?? null,
  productType: over.productType === undefined ? 'Home > Drinkware' : over.productType,
  snapshotAt: over.snapshotAt ?? AT,
  sourceFeed: 'test:feed',
  firstSeenRun: 'run-1',
  lastSeenRun: 'run-1',
  lastSeenAt: over.lastSeenAt ?? AT,
  state: over.state ?? 'active',
  inactiveSince: over.inactiveSince ?? null,
});

/* ──────────────────────────── brand ──────────────────────────── */

test('brand normalisation folds spelling, not identity', () => {
  assert.equal(normaliseBrand('Sennheiser'), 'sennheiser');
  assert.equal(normaliseBrand('  SENNHEISER  '), 'sennheiser');
  assert.equal(normaliseBrand('Das Keyboard'), 'das keyboard');
  assert.equal(normaliseBrand('Procter & Gamble'), 'procter and gamble');
  assert.equal(normaliseBrand('Procter and Gamble'), 'procter and gamble');
  assert.equal(normaliseBrand('Anker Innovations Ltd.'), 'anker innovations');
  assert.equal(normaliseBrand('Logitech Inc'), 'logitech');
  // Accents are a transport artefact, not a different brand.
  assert.equal(normaliseBrand('Loewe'), normaliseBrand('Loewe'));
  assert.equal(normaliseBrand('Nestlé'), 'nestle');
});

test('brand normalisation does NOT merge different brands', () => {
  assert.notEqual(normaliseBrand('Anker'), normaliseBrand('Anker Soundcore'));
  assert.notEqual(normaliseBrand('Sony'), normaliseBrand('Sony Ericsson'));
  // An interior legal word is part of the name and is not removed.
  assert.equal(normaliseBrand('Co-op Electrical'), 'co op electrical');
});

test('a brand that is only a legal form survives as itself', () => {
  // Stripping it would leave an empty key, which would then match every other
  // brand that normalised to nothing.
  assert.equal(normaliseBrand('Limited'), 'limited');
  assert.equal(normaliseBrand(''), '');
});

test('MPN normalisation ignores separators and case, nothing else', () => {
  assert.equal(normaliseMpn('nw-tm-1'), 'NWTM1');
  assert.equal(normaliseMpn('NW TM 1'), 'NWTM1');
  assert.notEqual(normaliseMpn('NWTM-1'), normaliseMpn('NWTM-2'));
});

/* ──────────────────────────── identity ──────────────────────────── */

test('a valid GTIN identifies a product, in GTIN-14 form', () => {
  const identity = productIdentity({ gtin: gtin12('01234567890'), mpn: 'X', brand: 'Y' });
  assert.equal(identity.basis, 'gtin');
  assert.equal(identity.confidence, 'high');
  assert.equal(identity.key.length, 14);
  // A UPC-12 and the EAN-13 that is the same code with a leading zero are one
  // product, which only padding makes true.
  assert.equal(toGtin14('012345678905'), toGtin14('0012345678905'));
});

test('an INVALID GTIN is worse than none and never identifies anything', () => {
  // Fails the check digit. An invalid GTIN looks authoritative, which is the
  // danger: trusting it would merge two unrelated products under a typo.
  const bad = '012345678901';
  const identity = productIdentity({ gtin: bad, mpn: 'NWTM-1', brand: 'Northwind' });
  assert.equal(identity.basis, 'brand_mpn', 'it falls back rather than trusting the GTIN');

  const noFallback = productIdentity({ gtin: bad, mpn: null, brand: 'Northwind' });
  assert.equal(noFallback.basis, null);
  assert.equal(noFallback.reason, 'invalid_gtin_no_mpn');
});

test('brand + MPN is medium confidence, and needs both halves', () => {
  const both = productIdentity({ gtin: null, mpn: 'NWTM-1', brand: 'Northwind' });
  assert.equal(both.basis, 'brand_mpn');
  assert.equal(both.confidence, 'medium');

  assert.equal(productIdentity({ gtin: null, mpn: null, brand: 'Northwind' }).basis, null);
  assert.equal(productIdentity({ gtin: null, mpn: 'NWTM-1', brand: '' }).basis, null);
  assert.equal(
    productIdentity({ gtin: null, mpn: '-', brand: 'Northwind' }).basis,
    null,
    'an MPN of only separators normalises to nothing and is not an identifier',
  );
});

/* ──────────────────────────── matching ──────────────────────────── */

test('two merchants selling one GTIN become one product', () => {
  const g = gtin12('01234567890');
  const result = matchOffers([
    offer({ id: 'a', merchantId: 'northwind', gtin: g }),
    offer({ id: 'b', merchantId: 'contoso', gtin: g, merchantOfferId: 'CT-9' }),
  ]);
  assert.equal(result.products.length, 1);
  assert.deepEqual([...result.products[0].offerIds].sort(), ['a', 'b']);
  assert.equal(result.products[0].confidence, 'high');
  assert.equal(result.unmatched.length, 0);
});

test('a merchant who omits the GTIN still joins the product via brand + MPN', () => {
  const g = gtin12('01234567890');
  const result = matchOffers([
    offer({ id: 'a', merchantId: 'northwind', gtin: g, mpn: 'NWTM-1' }),
    offer({ id: 'b', merchantId: 'contoso', gtin: null, mpn: 'nwtm 1', merchantOfferId: 'CT-9' }),
  ]);
  assert.equal(result.products.length, 1, 'one product, two merchants');
  assert.equal(result.products[0].basis, 'gtin');
  assert.equal(
    result.products[0].confidence,
    'medium',
    'confidence is the weakest link: the join rested on brand + MPN',
  );
});

test('A BRAND+MPN SHARED BY TWO GTINS IS AMBIGUOUS AND IS NOT MERGED', () => {
  /*
   * The case this whole module exists for. A 500 ml and a 750 ml bottle can
   * share a part number and differ by GTIN, and a merchant who states only the
   * part number could be selling either. Attaching them to whichever GTIN was
   * seen first is a coin toss about a price.
   */
  const result = matchOffers([
    offer({ id: 'small', merchantId: 'northwind', gtin: gtin12('01234567890'), mpn: 'SHARED-1' }),
    offer({
      id: 'large',
      merchantId: 'northwind',
      gtin: gtin12('01234567891'),
      mpn: 'SHARED-1',
      merchantOfferId: 'NW-2',
    }),
    offer({
      id: 'unknown',
      merchantId: 'contoso',
      gtin: null,
      mpn: 'SHARED-1',
      merchantOfferId: 'CT-1',
    }),
  ]);

  assert.equal(result.products.length, 2, 'the two GTINs stay two products');
  const stranded = result.unmatched.find((u) => u.offerId === 'unknown');
  assert.ok(stranded, 'the offer with no GTIN is quarantined, not attached');
  assert.equal(stranded.reason, 'ambiguous_identity');
  assert.match(stranded.detail, /more than one GTIN/);
  assert.deepEqual(result.ambiguousKeys, ['northwind trading|SHARED1']);
});

test('matching does not depend on the order offers arrive in', () => {
  const rows = [
    offer({ id: 'small', gtin: gtin12('01234567890'), mpn: 'SHARED-1' }),
    offer({ id: 'large', gtin: gtin12('01234567891'), mpn: 'SHARED-1', merchantOfferId: 'NW-2' }),
    offer({
      id: 'unknown',
      merchantId: 'contoso',
      gtin: null,
      mpn: 'SHARED-1',
      merchantOfferId: 'CT-1',
    }),
  ];
  const forwards = matchOffers(rows);
  const backwards = matchOffers([...rows].reverse());
  assert.deepEqual(
    forwards.products.map((p) => p.productKey),
    backwards.products.map((p) => p.productKey),
    'the same feed in a different sequence must produce the same catalogue',
  );
  assert.deepEqual(forwards.ambiguousKeys, backwards.ambiguousKeys);
});

test('one merchant listing the same product twice is one offer, not two', () => {
  const g = gtin12('01234567890');
  const result = matchOffers([
    offer({ id: 'a', merchantId: 'northwind', merchantOfferId: 'NW-1', gtin: g }),
    offer({ id: 'b', merchantId: 'northwind', merchantOfferId: 'NW-DUPLICATE', gtin: g }),
  ]);
  assert.equal(result.products.length, 1);
  assert.equal(result.products[0].offerIds.length, 1, 'a duplicate must not inflate the count');
  const rejected = result.unmatched.find((u) => u.offerId === 'b');
  assert.equal(rejected.reason, 'duplicate_within_merchant');
});

test('an offer with nothing to identify it is quarantined with a reason', () => {
  const result = matchOffers([offer({ id: 'orphan', gtin: null, mpn: null })]);
  assert.equal(result.products.length, 0);
  assert.equal(result.unmatched[0].reason, 'no_identifier');
  assert.match(result.unmatched[0].detail, /no GTIN and no brand \+ MPN/);
});

/* ──────────────────────────── classification ──────────────────────────── */

test('a category comes from the stated path, and only from it', () => {
  const classified = classifyFromProductType('Home > Drinkware > Travel Mugs');
  assert.equal(classified.reason, 'classified');
  assert.deepEqual(
    classified.path.map((c) => c.slug),
    ['home', 'home/drinkware', 'home/drinkware/travel-mugs'],
  );
  assert.equal(classified.categorySlug, 'home/drinkware/travel-mugs');
  assert.equal(classified.path[2].parentSlug, 'home/drinkware');
});

test('two different paths ending in the same word stay two categories', () => {
  const audio = classifyFromProductType('Audio > Headphones');
  const gaming = classifyFromProductType('Gaming > Headphones');
  assert.notEqual(audio.categorySlug, gaming.categorySlug);
});

test('no stated path means NO category, never a guessed one', () => {
  for (const input of [null, '', '   ', '>', ' > > ']) {
    const result = classifyFromProductType(input);
    assert.equal(result.categorySlug, null, `${JSON.stringify(input)} must not classify`);
    assert.equal(result.reason, 'no_product_type');
  }
});

test('slugs are stable and URL-safe', () => {
  assert.equal(slugifyCategory('Home & Garden'), 'home-and-garden');
  assert.equal(slugifyCategory('  Café  '), 'cafe');
});

/* ──────────────────────── specifications ──────────────────────── */

test('a single measurement is normalised; anything else keeps its words', () => {
  const ml = normaliseSpecification('Capacity', '500 ml');
  assert.equal(ml.valueNum, 500);
  assert.equal(ml.unit, 'ml');
  assert.equal(ml.value, '500 ml', 'the provider wording is preserved verbatim');

  const decimal = normaliseSpecification('Weight', '1,5 kg');
  assert.equal(decimal.valueNum, 1.5, 'a comma decimal is a decimal, not a thousands separator');
});

test('a range, a triple or a sentence yields NO number', () => {
  for (const value of ['20-20000 Hz', '10 x 5 x 3 cm', 'about 2 kg', '2 pack', 'Stainless steel']) {
    const spec = normaliseSpecification('X', value);
    assert.equal(spec.valueNum, null, `${value} must not be reduced to one number`);
    assert.equal(spec.value, value, 'and the stated value survives');
  }
});

test('units are never converted', () => {
  const inches = normaliseSpecification('Screen', '27 in');
  assert.equal(inches.unit, 'in', 'the manufacturer said inches; it stays inches');
  assert.equal(inches.valueNum, 27);
});

/* ──────────────────────────── ranking ──────────────────────────── */

test('an offer with unverified shipping is listed but never ranked', () => {
  const ranking = rankOffers([offer({ id: 'a' })]);
  assert.equal(ranking.ranked.length, 0);
  assert.equal(ranking.unranked.length, 1);
  assert.deepEqual(ranking.unranked[0].eligibility.blockers, [
    'shipping-not-verified',
    'mandatory-fees-unknown',
  ]);
  assert.equal(ranking.fromDelivered, null);
  assert.equal(ranking.fromReason, 'no_eligible_offer');
});

test('a fully verified offer ranks on its DELIVERED cost, not its item price', () => {
  const cheapItemExpensiveShipping = offer({
    id: 'a',
    merchantId: 'alpha',
    listPrice: money(1000),
    salePrice: null,
    shippingVerified: true,
    shippingCost: money(900),
    shippingDestination: 'US',
    feesVerified: true,
    feesTotal: money(0),
  });
  const dearerItemFreeShipping = offer({
    id: 'b',
    merchantId: 'bravo',
    merchantOfferId: 'B-1',
    listPrice: money(1500),
    salePrice: null,
    shippingVerified: true,
    shippingCost: money(0),
    shippingDestination: 'US',
    feesVerified: true,
    feesTotal: money(0),
  });

  const ranking = rankOffers([cheapItemExpensiveShipping, dearerItemFreeShipping]);
  assert.equal(ranking.ranked.length, 2);
  assert.equal(
    ranking.ranked[0].offerId,
    'b',
    'the cheaper ITEM is the dearer purchase, and the ranking says so',
  );
  assert.equal(ranking.fromDelivered.amountMinor, 1500);
  assert.equal(ranking.fromReason, 'cheapest_verified_delivered_cost');
});

test('equal delivered costs break ties on merchant id, and commission is not an input', () => {
  const base = {
    shippingVerified: true,
    shippingCost: money(0),
    shippingDestination: 'US',
    feesVerified: true,
    feesTotal: money(0),
    listPrice: money(1000),
    salePrice: null,
  };
  const ranking = rankOffers([
    offer({ ...base, id: 'z', merchantId: 'zeta', merchantOfferId: 'Z-1' }),
    offer({ ...base, id: 'a', merchantId: 'alpha', merchantOfferId: 'A-1' }),
  ]);
  assert.deepEqual(
    ranking.ranked.map((o) => o.merchantId),
    ['alpha', 'zeta'],
  );
});

test('eligible offers in different currencies produce NO from-price', () => {
  const base = {
    shippingVerified: true,
    shippingCost: money(0),
    shippingDestination: 'US',
    feesVerified: true,
    feesTotal: money(0),
    salePrice: null,
  };
  const ranking = rankOffers([
    offer({ ...base, id: 'usd', merchantId: 'alpha', listPrice: money(1000, 'USD') }),
    offer({
      ...base,
      id: 'eur',
      merchantId: 'bravo',
      merchantOfferId: 'B-1',
      listPrice: money(900, 'EUR'),
      shippingCost: money(0, 'EUR'),
      feesTotal: money(0, 'EUR'),
    }),
  ]);
  // There is no authorised exchange rate in this system, and converting with an
  // unauthorised one would invent the number the page leads with.
  assert.equal(ranking.fromDelivered, null);
  assert.equal(ranking.fromReason, 'mixed_currency');
});

test('an out-of-stock offer is not rankable even when fully priced', () => {
  const ranking = rankOffers([
    offer({
      id: 'a',
      availability: 'out_of_stock',
      shippingVerified: true,
      shippingCost: money(0),
      shippingDestination: 'US',
      feesVerified: true,
      feesTotal: money(0),
    }),
  ]);
  assert.deepEqual(ranking.unranked[0].eligibility.blockers, ['not-purchasable']);
});

test('a stored offer claiming verified shipping without a figure is treated as UNVERIFIED', () => {
  // The store refuses to hold this, and the CHECKs pair the flag with the
  // figure in both directions — but a reader must not trust a flag it cannot
  // corroborate, because a half-known cost becoming a total is the one
  // outcome that matters.
  const reconstructed = storedAsOffer(
    offer({ shippingVerified: true, shippingCost: null, shippingDestination: null }),
  );
  assert.equal(reconstructed.shipping.kind, 'MISSING');
  assert.match(reconstructed.shipping.reason, /without a figure or destination/);
});

/* ──────────────────────── the whole pipeline ──────────────────────── */

const approved = new Set(['northwind', 'contoso']);

test('two merchants, one GTIN, one eligible product', () => {
  const g = gtin12('01234567890');
  const result = buildProducts({
    offers: [
      offer({ id: 'a', merchantId: 'northwind', gtin: g }),
      offer({ id: 'b', merchantId: 'contoso', gtin: g, merchantOfferId: 'CT-1' }),
    ],
    approvedMerchants: approved,
    productTypeByOfferId: new Map([['a', 'Home > Drinkware']]),
    now: NOW,
  });

  assert.equal(result.products.length, 1);
  const product = result.products[0];
  assert.equal(product.eligible, true);
  assert.equal(product.reasonCode, 'eligible');
  assert.equal(product.offerIds.length, 2);
  assert.equal(product.categorySlug, 'home/drinkware');
  assert.equal(product.brandNormalised, 'northwind trading');
  assert.equal(product.fromPrice, null, 'no offer verifies shipping, so there is no from-price');
  assert.match(product.searchText, /travel mug/);
  assert.deepEqual(result.counts, {
    offers: 2,
    products: 1,
    eligible: 1,
    withheld: 0,
    unmatched: 0,
  });
});

test('AN UNAPPROVED MERCHANT IS WITHHELD, and the reason is recorded', () => {
  // Possession of a feed is not approval. This is the rule that keeps a
  // pending merchant out of the public catalogue.
  const result = buildProducts({
    offers: [offer({ id: 'a', merchantId: 'soundcore' })],
    approvedMerchants: approved,
    now: NOW,
  });
  assert.equal(result.products.length, 1);
  assert.equal(result.products[0].eligible, false);
  assert.equal(result.products[0].reasonCode, 'merchant_not_approved');
  assert.equal(result.counts.eligible, 0);
  assert.equal(result.counts.withheld, 1);
});

test('stale data withholds a product rather than publishing a price nobody confirmed', () => {
  const result = buildProducts({
    offers: [offer({ id: 'a', lastSeenAt: '2026-11-20T12:00:00.000Z' })],
    approvedMerchants: approved,
    now: NOW,
  });
  assert.equal(result.products[0].reasonCode, 'stale_data');
  assert.equal(result.products[0].eligible, false);
});

test('an unreadable timestamp is stale, not "probably fine"', () => {
  const result = buildProducts({
    offers: [offer({ id: 'a', lastSeenAt: 'not a date' })],
    approvedMerchants: approved,
    now: NOW,
  });
  assert.equal(result.products[0].reasonCode, 'stale_data');
});

test('an inactive offer withholds the product but does not delete it', () => {
  const result = buildProducts({
    offers: [offer({ id: 'a', state: 'inactive', inactiveSince: AT })],
    approvedMerchants: approved,
    now: NOW,
  });
  assert.equal(result.products.length, 1, 'the product is still known');
  assert.equal(result.products[0].reasonCode, 'no_active_offer');
});

test('ONE fresh approved offer carries a product whose other offers are stale', () => {
  const g = gtin12('01234567890');
  const result = buildProducts({
    offers: [
      offer({ id: 'fresh', merchantId: 'northwind', gtin: g }),
      offer({
        id: 'stale',
        merchantId: 'contoso',
        gtin: g,
        merchantOfferId: 'CT-1',
        lastSeenAt: '2026-11-01T12:00:00.000Z',
      }),
    ],
    approvedMerchants: approved,
    now: NOW,
  });
  assert.equal(result.products[0].eligible, true);
  assert.equal(
    result.products[0].dataVerifiedAt,
    AT,
    'the freshness shown is the freshest offer that survived the filters',
  );
});

test('the title shown is the most recently confirmed one', () => {
  const g = gtin12('01234567890');
  const result = buildProducts({
    offers: [
      offer({ id: 'old', merchantId: 'northwind', gtin: g, title: 'Old Name', lastSeenAt: AT }),
      offer({
        id: 'new',
        merchantId: 'contoso',
        gtin: g,
        merchantOfferId: 'CT-1',
        title: 'Current Name',
        lastSeenAt: '2026-11-26T12:30:00.000Z',
      }),
    ],
    approvedMerchants: approved,
    now: NOW,
  });
  assert.equal(result.products[0].title, 'Current Name');
});

test('a slug carries its identity, so two products with one name both publish', () => {
  const a = productSlug('Wireless Earbuds', '00012345678905');
  const b = productSlug('Wireless Earbuds', '00012345678912');
  assert.notEqual(a, b, 'published_slug_open is unique; a title-only slug would collide');
  assert.match(a, /^wireless-earbuds-/);
  // Stable under a title the merchant edits only in the base, not the suffix.
  assert.equal(productSlug('Wireless Earbuds', '00012345678905'), a);
});

test('a product with no name still gets a usable slug', () => {
  assert.equal(productSlug('', '00012345678905'), '012345678905');
  assert.equal(productSlug('!!!', '00012345678905'), '012345678905');
});

test('variants are NOT invented when the feed states none', () => {
  const result = buildProducts({
    offers: [
      offer({ id: 'a', title: 'Travel Mug 500ml' }),
      offer({
        id: 'b',
        merchantOfferId: 'NW-2',
        gtin: gtin12('01234567891'),
        title: 'Travel Mug 750ml',
        mpn: 'NWTM-2',
      }),
    ],
    approvedMerchants: approved,
    now: NOW,
  });
  assert.equal(result.products.length, 2);
  for (const product of result.products) {
    assert.equal(
      product.variantGroupId,
      null,
      'the feed has no group column, so grouping them would be a guess about which products are the same thing',
    );
  }
});

test('an explicit variant group IS used when a feed states one', () => {
  const result = buildProducts({
    offers: [offer({ id: 'a' })],
    approvedMerchants: approved,
    variantGroupByOfferId: new Map([['a', 'NWTM-GROUP']]),
    now: NOW,
  });
  assert.equal(result.products[0].variantGroupId, 'NWTM-GROUP');
});

test('the pipeline reports ambiguity rather than resolving it', () => {
  const result = buildProducts({
    offers: [
      offer({ id: 'small', gtin: gtin12('01234567890'), mpn: 'SHARED-1' }),
      offer({ id: 'large', gtin: gtin12('01234567891'), mpn: 'SHARED-1', merchantOfferId: 'NW-2' }),
      offer({
        id: 'unknown',
        merchantId: 'contoso',
        gtin: null,
        mpn: 'SHARED-1',
        merchantOfferId: 'CT-1',
      }),
    ],
    approvedMerchants: approved,
    now: NOW,
  });
  assert.equal(result.counts.unmatched, 1);
  assert.equal(result.unmatched[0].reason, 'ambiguous_identity');
  assert.equal(result.ambiguousKeys.length, 1);
});

test('an empty catalogue is an empty result, not an error', () => {
  const result = buildProducts({ offers: [], approvedMerchants: approved, now: NOW });
  assert.deepEqual(result.products, []);
  assert.deepEqual(result.counts, {
    offers: 0,
    products: 0,
    eligible: 0,
    withheld: 0,
    unmatched: 0,
  });
});
