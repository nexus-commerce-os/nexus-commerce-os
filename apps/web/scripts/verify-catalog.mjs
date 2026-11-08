// Guardrails for the informational catalog at /products.
//
// WHY THIS EXISTS. The catalog's honesty rests on properties that are easy to
// state and easy to lose: every record is read off the manufacturer's own
// page and cites it, it names no merchant, prints no price, claims no stock,
// ships no product photograph, links nowhere commercial, and stays out of the
// index until the founder decides otherwise. Every one of those survives for
// exactly as long as somebody remembers it. Here they fail the build instead.
//
// WHAT IT CAN AND CANNOT CHECK. The data module is exercised for real — Node
// strips TypeScript natively, so this imports it and calls
// assertCatalogIntegrity(). The page components resolve `@/` aliases that
// plain Node does not understand, so they are checked by reading their source.
// That split is stated rather than hidden: a text scan is weaker evidence than
// a behavioural test and should be labelled as such.
//
// NO MINIMUM PRODUCT COUNT IS ENFORCED. An earlier version required 20 to 50
// records, which would have failed the build the moment honesty reduced the
// set. Size is a product decision; truthfulness is the invariant. What IS
// enforced is that every declared category has at least one product, so no
// category renders an empty grid.
//
// Same reasoning, same no-new-dependency choice, as verify-merchants.mjs and
// verify-preview.mjs.
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join, resolve } from 'node:path';

const here = dirname(fileURLToPath(import.meta.url));
const webRoot = resolve(here, '..');
const read = (p) => readFileSync(join(webRoot, p), 'utf8');

/** Comments explain these rules at length; a scan matching its own prose is theatre. */
const stripComments = (src) => src.replace(/\/\*[\s\S]*?\*\//g, '').replace(/^\s*\/\/.*$/gm, '');

let failures = 0;
const ok = (label) => console.log(`  ok   ${label}`);
const fail = (label, detail) => {
  failures += 1;
  console.error(`  FAIL ${label}${detail ? ` — ${detail}` : ''}`);
};

function check(label, fn) {
  try {
    const detail = fn();
    if (detail === undefined || detail === true) ok(label);
    else fail(label, typeof detail === 'string' ? detail : 'assertion returned false');
  } catch (error) {
    fail(label, error && error.message ? error.message : String(error));
  }
}

console.log('verify-catalog:');

const data = await import('../src/data/catalog.ts');
const {
  PRODUCTS,
  CATEGORIES,
  PRICE_STATUS,
  AVAILABILITY_STATUS,
  assertCatalogIntegrity,
  displayName,
  latestDateOnEarth,
  searchProducts,
  productBySlug,
} = data;

// ---------------------------------------------------------------------------
// 1. The data module's own invariants, executed rather than read.
// ---------------------------------------------------------------------------
check('catalog integrity invariants hold', () => {
  assertCatalogIntegrity();
});

check('every category has at least one product (no empty grid)', () => {
  const empty = CATEGORIES.filter(
    (c) => PRODUCTS.filter((p) => p.categorySlug === c.slug).length === 0,
  );
  return empty.length === 0 ? true : `empty: ${empty.map((c) => c.slug).join(', ')}`;
});

check('all five declared categories are present and populated', () => {
  const want = ['headphones', 'televisions', 'storage', 'laptops', 'keyboards'];
  const missing = want.filter((slug) => !CATEGORIES.some((c) => c.slug === slug));
  if (missing.length > 0) return `category missing: ${missing.join(', ')}`;
  const bare = want.filter((slug) => PRODUCTS.filter((p) => p.categorySlug === slug).length === 0);
  return bare.length === 0 ? true : `no product in: ${bare.join(', ')}`;
});

check('product slugs are unique', () => {
  const seen = new Set();
  const dupes = PRODUCTS.filter((p) => (seen.has(p.slug) ? true : (seen.add(p.slug), false)));
  return dupes.length === 0 ? true : dupes.map((p) => p.slug).join(', ');
});

check('every product slug resolves back to its record', () => {
  const broken = PRODUCTS.filter((p) => productBySlug(p.slug)?.slug !== p.slug);
  return broken.length === 0 ? true : broken.map((p) => p.slug).join(', ');
});

// ---------------------------------------------------------------------------
// 2. Provenance. The release dataset must be real, sourced and dated.
// ---------------------------------------------------------------------------
check('NO demonstration records remain in the release dataset', () => {
  const demo = PRODUCTS.filter((p) => p.provenance !== 'manufacturer-specification');
  if (demo.length > 0) return `non-manufacturer provenance: ${demo.map((p) => p.slug).join(', ')}`;
  // Belt and braces: the words themselves must not survive in a shipped record.
  const worded = PRODUCTS.filter((p) =>
    /\bdemo(nstration)?\b/i.test(`${p.brand} ${p.name} ${p.summary}`),
  );
  return worded.length === 0 ? true : `"demo" wording in: ${worded.map((p) => p.slug).join(', ')}`;
});

check('every source URL is https and well formed', () => {
  const bad = [];
  for (const p of PRODUCTS) {
    try {
      const u = new URL(p.sourceUrl);
      if (u.protocol !== 'https:') bad.push(`${p.slug}: ${u.protocol}`);
    } catch {
      bad.push(`${p.slug}: unparseable`);
    }
  }
  return bad.length === 0 ? true : bad.join(', ');
});

check('every source host belongs to the manufacturer named in the record', () => {
  // Normalise both sides to letters and digits, then require the brand to
  // appear in the host. "Das Keyboard" -> "daskeyboard" matches
  // www.daskeyboard.com; "Sennheiser" matches us.sennheiser-hearing.com.
  const bad = [];
  for (const p of PRODUCTS) {
    const brand = p.brand.toLowerCase().replace(/[^a-z0-9]/g, '');
    const host = new URL(p.sourceUrl).hostname.toLowerCase().replace(/[^a-z0-9]/g, '');
    if (!host.includes(brand)) bad.push(`${p.slug}: ${p.brand} not in ${new URL(p.sourceUrl).hostname}`);
  }
  return bad.length === 0 ? true : bad.join('; ');
});

check('no source URL is a marketplace, reseller or affiliate link', () => {
  const banned =
    /(amazon|ebay|walmart|bestbuy|newegg|target|aliexpress|dpbolvw|anrdoezrs|jdoqocy|tkqlhce|kqzyfj|emjcd|qksrv|shareasale|awin|impact|skimresources)\./i;
  const bad = PRODUCTS.filter((p) => banned.test(new URL(p.sourceUrl).hostname));
  if (bad.length > 0) return `non-manufacturer host: ${bad.map((p) => p.slug).join(', ')}`;
  const tagged = PRODUCTS.filter((p) => /[?&](tag|aff|affid|utm_|ref|clickid|subid)=/i.test(p.sourceUrl));
  return tagged.length === 0 ? true : `tracking parameters: ${tagged.map((p) => p.slug).join(', ')}`;
});

check('every verification date is a real, non-future ISO date', () => {
  // "Not in the future" must mean "not in the future for anybody": comparing a
  // reviewer's local date against the UTC date fails honest records for up to
  // fourteen hours a day, which is how this check first failed.
  const today = latestDateOnEarth();
  const bad = [];
  for (const p of PRODUCTS) {
    if (!/^\d{4}-\d{2}-\d{2}$/.test(p.verifiedOn)) {
      bad.push(`${p.slug}: "${p.verifiedOn}" is not YYYY-MM-DD`);
      continue;
    }
    const d = new Date(`${p.verifiedOn}T00:00:00Z`);
    if (Number.isNaN(d.getTime())) bad.push(`${p.slug}: not a real date`);
    else if (p.verifiedOn > today) bad.push(`${p.slug}: dated in the future`);
    else if (p.verifiedOn < '2020-01-01') bad.push(`${p.slug}: implausibly old`);
  }
  return bad.length === 0 ? true : bad.join('; ');
});

check('no displayed title says the brand twice', () => {
  // "LG" + "LG C4 65 Inch Class…" rendered as "LG LG C4…" before displayName()
  // existed. The maker's product name is transcribed verbatim, so the fix is
  // at render time and this is its regression test.
  const bad = PRODUCTS.filter((p) => {
    const words = displayName(p).toLowerCase().split(/\s+/);
    const brand = p.brand.toLowerCase().split(/\s+/);
    return words.slice(0, brand.length).join(' ') === brand.join(' ')
      ? words.slice(brand.length, brand.length * 2).join(' ') === brand.join(' ')
      : false;
  });
  return bad.length === 0 ? true : bad.map((p) => p.slug).join(', ');
});

check('a model number is either printed exactly or honestly recorded as absent', () => {
  const bad = PRODUCTS.filter(
    (p) => p.model !== null && (typeof p.model !== 'string' || p.model.trim() === ''),
  );
  return bad.length === 0 ? true : bad.map((p) => p.slug).join(', ');
});

// ---------------------------------------------------------------------------
// 3. What a record must never carry.
// ---------------------------------------------------------------------------
check('no record carries a price, stock, rating or merchant field', () => {
  const banned = ['price', 'amount', 'currency', 'availability', 'stock', 'merchant', 'offer', 'rating', 'review', 'discount'];
  const offenders = [];
  for (const p of PRODUCTS) {
    for (const key of Object.keys(p)) {
      if (banned.some((b) => key.toLowerCase().includes(b))) offenders.push(`${p.slug}.${key}`);
    }
  }
  return offenders.length === 0 ? true : offenders.join(', ');
});

check('no specification value states a currency amount or a star rating', () => {
  const offenders = [];
  for (const p of PRODUCTS) {
    for (const s of p.specs) {
      if (/[$€£¥]\s?\d/.test(s.value) || /\bUSD\b/.test(s.value)) {
        offenders.push(`${p.slug}: ${s.label}`);
      }
      if (/\b\d(\.\d)?\s*(?:\/\s*5|stars?)\b/i.test(s.value)) offenders.push(`${p.slug}: ${s.label}`);
    }
  }
  return offenders.length === 0 ? true : offenders.join(', ');
});

check('no record carries an image URL', () => {
  const offenders = PRODUCTS.filter((p) =>
    Object.keys(p).some((k) => /image|photo|img|thumb/i.test(k)),
  );
  return offenders.length === 0 ? true : offenders.map((p) => p.slug).join(', ');
});

check('the unverified-status strings contain no number', () => {
  if (/\d/.test(PRICE_STATUS)) return `PRICE_STATUS contains a digit: ${PRICE_STATUS}`;
  if (/\d/.test(AVAILABILITY_STATUS)) return `AVAILABILITY_STATUS contains a digit`;
  return true;
});

// ---------------------------------------------------------------------------
// 4. Search behaviour.
// ---------------------------------------------------------------------------
check('search returns everything for an empty query and narrows for a real one', () => {
  if (searchProducts('').length !== PRODUCTS.length) return 'empty query did not return all';
  if (searchProducts('   ').length !== PRODUCTS.length) return 'whitespace query did not return all';
  const narrowed = searchProducts('OLED');
  if (narrowed.length === 0) return 'a query present in the data matched nothing';
  if (narrowed.length >= PRODUCTS.length) return 'a specific query did not narrow the set';
  if (searchProducts('zzzzzznothing').length !== 0) return 'a nonsense query matched something';
  return true;
});

check('search matches whole words, not letters inside other words', () => {
  // "actively cooled" contains the letters o-l-e-d. A substring search returns
  // laptops for "OLED"; this is the regression test for that.
  const oled = searchProducts('OLED');
  const wrong = oled.filter((p) => p.categorySlug !== 'televisions');
  if (wrong.length > 0) return `OLED matched non-televisions: ${wrong.map((p) => p.slug).join(', ')}`;
  if (searchProducts('sennh').length === 0) return 'a prefix query matched nothing';
  if (searchProducts('OLED nvme').length !== 0) return 'two unrelated tokens matched something';
  return true;
});

check('search finds a product by its brand and by its model number', () => {
  const withModel = PRODUCTS.find((p) => p.model);
  if (!withModel) return 'no record carries a model number to test with';
  if (!searchProducts(withModel.model).some((p) => p.slug === withModel.slug)) {
    return `model ${withModel.model} did not find ${withModel.slug}`;
  }
  if (!searchProducts(withModel.brand).some((p) => p.slug === withModel.slug)) {
    return `brand ${withModel.brand} did not find ${withModel.slug}`;
  }
  return true;
});

// ---------------------------------------------------------------------------
// 5. The pages. Source scans — weaker evidence, and labelled as such.
// ---------------------------------------------------------------------------
const listPage = stripComments(read('src/app/products/page.tsx'));
const detailPage = stripComments(read('src/app/products/[slug]/page.tsx'));
const card = stripComments(read('src/components/CatalogCard.tsx'));

check('source scan: the list page and the sitemap agree on indexability', () => {
  const noindex = /robots:\s*\{[^}]*index:\s*false/.test(listPage);
  const inSitemap = /['"`]\/products/.test(stripComments(read('src/app/sitemap.ts')));
  if (noindex && inSitemap) return 'page says noindex but the sitemap lists /products';
  if (!noindex && !inSitemap) return 'page is indexable but absent from the sitemap';
  return true;
});

check('source scan: detail pages carry the same indexing decision as the list', () => {
  const a = /robots:\s*\{[^}]*index:\s*false/.test(listPage);
  const b = /robots:\s*\{[^}]*index:\s*false/.test(detailPage);
  return a === b ? true : 'list and detail pages disagree about indexing';
});

check('source scan: the card renders no <img> and no absolute URL', () => {
  if (/<img/.test(card)) return 'the card renders an <img>';
  if (/https?:\/\//.test(card)) return 'the card contains an absolute URL';
  return true;
});

check('source scan: the detail page cites the source and the verification date', () => {
  if (!/sourceUrl/.test(detailPage)) return 'detail page never references sourceUrl';
  if (!/verifiedOn/.test(detailPage)) return 'detail page never references verifiedOn';
  if (!/nofollow/.test(detailPage)) return 'the outbound source link is not rel="nofollow"';
  return true;
});

check('source scan: no product JSON-LD asserts price or availability', () => {
  const both = `${listPage}\n${detailPage}`;
  if (/"@type":\s*['"]Product['"]/.test(both)) return 'Product JSON-LD emitted';
  if (/"@type":\s*['"]Offer['"]/.test(both)) return 'Offer JSON-LD emitted';
  return true;
});

check('source scan: the catalog pages name no merchant', () => {
  const both = `${listPage}\n${detailPage}\n${card}`;
  const names = ['soundcore', 'anker', 'eufy', 'amazon', 'best buy', 'walmart', 'ebay', 'newegg'];
  const found = names.filter((n) => both.toLowerCase().includes(n));
  return found.length === 0 ? true : `names a merchant: ${found.join(', ')}`;
});

// ---------------------------------------------------------------------------
// 6. The built output, when there is one.
// ---------------------------------------------------------------------------
let built = null;
try {
  built = read('out/products.html');
} catch {
  console.log('  note  out/ not built in this run; HTML assertions skipped');
}

if (built !== null) {
  /*
   * Scan the VISIBLE text only. Next's inline Flight payload is full of
   * `"$6"` and `"$L8"` module references, so a naive /\$\s?\d/ over the whole
   * file reports every page and means nothing — which is exactly what the
   * first version of this check did. Strip <script> blocks first.
   */
  const visibleText = (html) => html.replace(/<script\b[\s\S]*?<\/script>/gi, ' ');

  check('built HTML: every product name appears on the list page', () => {
    const missing = PRODUCTS.filter((p) => !built.includes(p.name));
    return missing.length === 0 ? true : `${missing.length} missing, e.g. ${missing[0].slug}`;
  });

  check('built HTML: a detail page exists for every product', () => {
    const missing = [];
    for (const p of PRODUCTS) {
      try {
        read(`out/products/${p.slug}.html`);
      } catch {
        missing.push(p.slug);
      }
    }
    return missing.length === 0 ? true : `missing: ${missing.slice(0, 3).join(', ')}`;
  });

  check('built HTML: every detail page prints its source URL and verification date', () => {
    const bad = [];
    for (const p of PRODUCTS) {
      const html = read(`out/products/${p.slug}.html`);
      if (!html.includes(p.sourceUrl)) bad.push(`${p.slug}: no source URL`);
      if (!html.includes(p.verifiedOn)) bad.push(`${p.slug}: no verification date`);
    }
    return bad.length === 0 ? true : bad.slice(0, 3).join('; ');
  });

  check('built HTML: every outbound source link is rel="nofollow"', () => {
    const bad = [];
    for (const p of PRODUCTS) {
      const html = read(`out/products/${p.slug}.html`);
      const anchor = new RegExp(`<a[^>]+href="${p.sourceUrl.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}"[^>]*>`);
      const m = html.match(anchor);
      if (!m) bad.push(`${p.slug}: no anchor to the source`);
      else if (!/nofollow/.test(m[0])) bad.push(`${p.slug}: anchor is not nofollow`);
    }
    return bad.length === 0 ? true : bad.slice(0, 3).join('; ');
  });

  check('built HTML: no page states a currency amount in its visible text', () => {
    const offenders = [];
    const hasCurrency = (html) => {
      const text = visibleText(html);
      return /\$\s?\d/.test(text) || /\bUSD\b/.test(text) || /[€£¥]\s?\d/.test(text);
    };
    for (const p of PRODUCTS) {
      if (hasCurrency(read(`out/products/${p.slug}.html`))) offenders.push(p.slug);
    }
    if (hasCurrency(built)) offenders.push('products.html');
    return offenders.length === 0 ? true : `currency on: ${offenders.slice(0, 3).join(', ')}`;
  });

  check('built HTML: no page claims stock, a rating or a review count', () => {
    const banned = [/\bin stock\b/i, /\bout of stock\b/i, /\b\d(\.\d)?\s*(?:\/\s*5|stars?)\b/i, /\b\d+\s+reviews?\b/i];
    const offenders = [];
    const scan = (name, html) => {
      const text = visibleText(html);
      if (banned.some((re) => re.test(text))) offenders.push(name);
    };
    for (const p of PRODUCTS) scan(p.slug, read(`out/products/${p.slug}.html`));
    scan('products.html', built);
    return offenders.length === 0 ? true : offenders.slice(0, 3).join(', ');
  });

  check('built HTML: no catalog page renders a product image', () => {
    const offenders = [];
    for (const p of PRODUCTS) {
      const html = read(`out/products/${p.slug}.html`);
      if (/<img[^>]+class="pc-img"/.test(html)) offenders.push(p.slug);
    }
    if (/<img[^>]+class="pc-img"/.test(built)) offenders.push('products.html');
    return offenders.length === 0 ? true : offenders.slice(0, 3).join(', ');
  });

  check('built HTML: no page contains an affiliate tracking domain', () => {
    const banned = /(dpbolvw|anrdoezrs|jdoqocy|tkqlhce|kqzyfj|emjcd|qksrv)\.net/i;
    const offenders = [];
    for (const p of PRODUCTS) {
      if (banned.test(read(`out/products/${p.slug}.html`))) offenders.push(p.slug);
    }
    if (banned.test(built)) offenders.push('products.html');
    return offenders.length === 0 ? true : offenders.slice(0, 3).join(', ');
  });
}

console.log(
  failures === 0
    ? `verify-catalog: OK — all checks passed, ${PRODUCTS.length} verified products, ${CATEGORIES.length} categories`
    : `verify-catalog: ${failures} check(s) failed`,
);
process.exit(failures === 0 ? 0 : 1);
