/*
 * THE PUBLIC CATALOGUE ON honesttotal.com.
 *
 * Every read goes through `PublicCatalogue`, which is the only code that
 * knows the generation-interval filter. This file writes no catalogue SQL of
 * its own, deliberately: a second copy of that filter is how rows that were
 * withheld — an unapproved merchant, a quarantined record, a half-built
 * generation — end up served to the public.
 *
 * WHAT THE PRODUCTION DATABASE CONTAINS TODAY: nothing. No merchant has been
 * authorised, so there is no eligible product, so the publication pointer has
 * never moved. The pages below therefore render an honest empty state rather
 * than fixtures, and that is the correct output — not a placeholder for a
 * catalogue that is coming. The populated version of exactly this code runs on
 * the staging Worker against the staging database.
 *
 * NOTHING HERE WRITES. The only write path on this Worker is the waitlist, and
 * it is untouched.
 */
/*
 * THE READ MODULE ONLY, not the package's worker entry.
 *
 * `dist/worker.js` re-exports the ingestion pipeline, which reaches
 * `publication/fingerprint` and `node:crypto` — and this Worker has no
 * `nodejs_compat` flag, so the runtime refused to start at all:
 * "Dynamic require of node:crypto is not supported". Caught by Playwright
 * before it reached the live site.
 *
 * Importing the read path directly is the right answer rather than a
 * workaround. The public site has no business bundling the importer: it is a
 * smaller bundle, it pulls in no Node builtins, and code that cannot be
 * reached cannot be a vulnerability.
 */
import type {
  ListQuery,
  ProductDetail,
  PublishedProduct,
} from '../../../services/catalog/dist/public/read.js';
import { PublicCatalogue } from '../../../services/catalog/dist/public/read.js';

/*
 * The adapter's own D1 shape, imported rather than restated.
 *
 * A local copy typechecked and was wrong in the way a local copy always is:
 * `prepare` returned `unknown`, so the compiler refused the real binding.
 * Importing the interface means a change to it is a compile error here rather
 * than a runtime surprise on the live site.
 */
import type { D1Like } from '../../../services/catalog/dist/store/d1/d1-client.js';

export interface CatalogEnv {
  readonly CATALOG?: D1Database;
}

const MAX_AGE_SECONDS = 60;

/*
 * A MISSING TABLE IS A FAILURE, NOT AN EMPTY CATALOGUE.
 *
 * `wrangler dev --local` hands the Worker a D1 with no tables, and for a
 * moment this file treated that as "nothing published" to get the browser
 * tests green. That was the wrong direction, and it is worth saying why
 * rather than just reverting it: a production database that had lost its
 * schema would then have shown a visitor a tidy "no products yet" page while
 * the real answer was "this is broken". Zero products and a broken read are
 * different facts and must not render the same.
 *
 * So every database error fails loudly, and the TEST environment is migrated
 * instead — scripts/migrate-local-d1.mjs. What the tests assert is then the
 * state production is genuinely in: a migrated database with nothing
 * published in it.
 */
/**
 * Cache headers for catalogue responses.
 *
 * SIXTY SECONDS, and `stale-while-revalidate` on top. The point of reading
 * from D1 rather than a build artefact is that a price change appears without
 * a deploy — a long cache would hand that property straight back. A minute is
 * short enough that "without redeploying" stays true in any sense a visitor
 * cares about, and long enough that a burst of traffic does not become a burst
 * of database reads.
 *
 * NOT `no-store`: that is for the nonce-bearing HTML the asset path serves,
 * and these responses carry no nonce.
 */
function cacheHeaders(): Record<string, string> {
  return {
    'cache-control': `public, max-age=0, s-maxage=${MAX_AGE_SECONDS}, stale-while-revalidate=300`,
  };
}

function json(body: unknown, status = 200, extra: Record<string, string> = {}): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: {
      'content-type': 'application/json; charset=utf-8',
      ...cacheHeaders(),
      ...extra,
    },
  });
}

/**
 * The catalogue API.
 *
 * Returns null when the path is not ours, so the caller falls through to the
 * asset service rather than this file having to know about every other route.
 */
export async function handleCatalogApi(
  request: Request,
  env: CatalogEnv,
): Promise<Response | null> {
  const url = new URL(request.url);
  if (!url.pathname.startsWith('/api/catalog/')) return null;

  if (request.method !== 'GET' && request.method !== 'HEAD') {
    return json({ error: 'method not allowed' }, 405);
  }

  /*
   * NO BINDING IS A FAILURE.
   *
   * The first version of this served an empty catalogue instead, reasoning
   * that a configuration gap should not look like an outage. That is backwards:
   * it makes an outage look like a configuration-free empty shop, and a
   * visitor cannot tell that the site simply forgot its database.
   */
  if (env.CATALOG === undefined) {
    // A deploy without the binding is a MISCONFIGURATION, not an empty shop.
    // This used to answer 200 with an empty list, which made a missing
    // database indistinguishable from a catalogue nobody has published into.
    console.error('catalogue: the CATALOG binding is absent from this deployment');
    return json({ error: 'the catalogue is not configured in this deployment' }, 503, {
      'cache-control': 'no-store',
    });
  }

  const catalogue = new PublicCatalogue(env.CATALOG as unknown as D1Like);
  const path = url.pathname.slice('/api/catalog/'.length);

  try {
    if (path === 'summary') return json(await catalogue.summary());
    if (path === 'categories') return json({ categories: await catalogue.categories() });
    if (path === 'brands') return json({ brands: await catalogue.brands() });
    if (path === 'products') return json(await catalogue.list(queryFrom(url)));
    if (path.startsWith('products/')) {
      const slug = decodeURIComponent(path.slice('products/'.length));
      const detail = await catalogue.bySlug(slug);
      return detail === null ? json({ error: 'not found' }, 404) : json(detail);
    }
  } catch (error) {
    // The message, never the query. A database error can carry a fragment of
    // SQL, and this response is public.
    console.error(`catalogue read failed: ${(error as Error).message}`);
    return json({ error: 'the catalogue is temporarily unavailable' }, 503, {
      'cache-control': 'no-store',
    });
  }

  return json({ error: 'not found' }, 404);
}

function queryFrom(url: URL): ListQuery {
  const number = (name: string): number | undefined => {
    const raw = url.searchParams.get(name);
    if (raw === null) return undefined;
    const value = Number(raw);
    return Number.isFinite(value) ? value : undefined;
  };
  const sort = url.searchParams.get('sort');
  return {
    category: url.searchParams.get('category'),
    brand: url.searchParams.get('brand'),
    q: url.searchParams.get('q'),
    limit: number('limit'),
    offset: number('offset'),
    sort: sort === 'freshest' || sort === 'cheapest' || sort === 'title' ? sort : undefined,
  };
}

/* ─────────────────────────── the rendered pages ─────────────────────────── */

export async function handleCatalogPage(
  request: Request,
  env: CatalogEnv,
  nonce: string,
): Promise<Response | null> {
  const url = new URL(request.url);
  const isList = url.pathname === '/products' || url.pathname === '/products/';
  const isDetail = url.pathname.startsWith('/products/') && !isList;
  if (!isList && !isDetail) return null;

  if (env.CATALOG === undefined) {
    return page(
      unavailableState('The catalogue database is not connected in this deployment.'),
      nonce,
      503,
    );
  }

  const catalogue = new PublicCatalogue(env.CATALOG as unknown as D1Like);

  try {
    if (isList) {
      const query = queryFrom(url);
      const [summary, listed, categories, brands] = await Promise.all([
        catalogue.summary(),
        catalogue.list({ ...query, limit: query.limit ?? 48 }),
        catalogue.categories(),
        catalogue.brands(),
      ]);
      return page(renderList({ summary, listed, categories, brands, url }), nonce, 200);
    }

    const slug = decodeURIComponent(url.pathname.slice('/products/'.length));
    const detail = await catalogue.bySlug(slug);
    if (detail === null) {
      return page(renderMissing(slug), nonce, 404);
    }
    return page(renderDetail(detail), nonce, 200);
  } catch (error) {
    console.error(`catalogue page failed: ${(error as Error).message}`);
    return page(
      unavailableState('The catalogue is temporarily unavailable. Please try again shortly.'),
      nonce,
      503,
    );
  }
}

/* ─────────────────────────────── rendering ─────────────────────────────── */

function escapeHtml(value: string): string {
  return value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

function money(value: { amountMinor: number; currency: string } | null): string {
  if (value === null) {
    return '<span class="ht-unknown">Shipping not stated</span>';
  }
  return `${escapeHtml(value.currency)}&nbsp;${(value.amountMinor / 100).toFixed(2)}`;
}

function when(iso: string): string {
  return escapeHtml(iso.slice(0, 16).replace('T', ' ')) + ' UTC';
}

/**
 * The page shell.
 *
 * Styles are inline because `style-src` already permits inline styles and
 * adding a stylesheet would mean another request for a page that is mostly
 * text. Scripts are NOT inline: these pages have none, which is why the nonce
 * is accepted and unused.
 */
function page(body: string, nonce: string, status: number): Response {
  void nonce;
  return new Response(
    `<!doctype html>
<html lang="en"><head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width,initial-scale=1">
<title>Products — Honest Total</title>
<meta name="description" content="Every price we show is one a merchant has published, with the delivered cost stated or honestly marked unknown.">
<style>${STYLE}</style>
</head><body>
<header class="ht-top">
  <a class="ht-brand" href="/">Honest&nbsp;Total</a>
  <nav class="ht-nav"><a href="/products">Products</a><a href="/how-we-rank">How we rank</a></nav>
</header>
<main class="ht-main">${body}</main>
<footer class="ht-foot">
  <a href="/how-we-rank">How we rank</a> ·
  <a href="/privacy">Privacy</a> ·
  <a href="/terms">Terms</a> ·
  <a href="/contact">Contact</a>
</footer>
</body></html>`,
    {
      status,
      headers: {
        'content-type': 'text/html; charset=utf-8',
        ...cacheHeaders(),
      },
    },
  );
}

const STYLE = `
:root{color-scheme:light dark;--fg:#14171a;--muted:#5b6471;--line:#e4e7eb;--bg:#fff;--card:#fff;--accent:#0b5cad;--warn:#8a5a00}
@media (prefers-color-scheme:dark){:root{--fg:#e8eaed;--muted:#9aa4b2;--line:#2a2f36;--bg:#101316;--card:#171b1f;--accent:#7fb2f0;--warn:#e0b25c}}
*{box-sizing:border-box}
body{margin:0;background:var(--bg);color:var(--fg);font:16px/1.6 ui-sans-serif,system-ui,-apple-system,"Segoe UI",Roboto,sans-serif}
a{color:inherit}
.ht-top{display:flex;align-items:center;justify-content:space-between;gap:16px;padding:14px 16px;border-bottom:1px solid var(--line);flex-wrap:wrap}
.ht-brand{font-weight:700;text-decoration:none;font-size:18px;letter-spacing:-.01em}
.ht-nav a{margin-left:16px;text-decoration:none;color:var(--muted);font-size:15px}
.ht-nav a:hover{color:var(--fg)}
.ht-main{max-width:1060px;margin:0 auto;padding:24px 16px 56px}
h1{font-size:26px;margin:8px 0 6px;letter-spacing:-.015em}
h2{font-size:18px;margin:30px 0 10px}
.ht-lede{color:var(--muted);margin:0 0 20px;max-width:62ch}
.ht-stats{display:flex;flex-wrap:wrap;gap:6px 20px;padding:12px 0;border-top:1px solid var(--line);border-bottom:1px solid var(--line);font-size:14px;color:var(--muted)}
.ht-stats b{color:var(--fg);font-variant-numeric:tabular-nums}
form.ht-search{display:flex;gap:8px;margin:18px 0;flex-wrap:wrap}
input[type=search]{flex:1 1 220px;min-width:0;padding:10px 12px;border:1px solid var(--line);border-radius:8px;background:var(--card);color:var(--fg);font-size:15px}
button,select{padding:10px 14px;border:1px solid var(--line);border-radius:8px;background:var(--card);color:var(--fg);font-size:15px;cursor:pointer}
button{background:var(--accent);color:#fff;border-color:transparent;font-weight:600}
.ht-chips{display:flex;flex-wrap:wrap;gap:7px;margin:0 0 18px;padding:0;list-style:none;font-size:14px}
.ht-chips a{display:inline-block;padding:5px 11px;border:1px solid var(--line);border-radius:999px;text-decoration:none}
.ht-chips a[aria-current=true]{border-color:var(--accent);color:var(--accent);font-weight:600}
.ht-grid{display:grid;grid-template-columns:repeat(auto-fill,minmax(228px,1fr));gap:12px;list-style:none;padding:0;margin:0}
.ht-card{border:1px solid var(--line);border-radius:12px;padding:14px;background:var(--card)}
.ht-card a{font-weight:600;text-decoration:none;display:block;margin-bottom:6px}
.ht-card a:hover{text-decoration:underline}
.ht-meta{color:var(--muted);font-size:13px}
.ht-price{margin-top:10px;font-size:17px;font-variant-numeric:tabular-nums}
.ht-unknown{color:var(--warn);font-size:13px;font-weight:600}
table{width:100%;border-collapse:collapse;font-size:14px;margin-top:8px}
th,td{text-align:left;padding:9px 10px;border-bottom:1px solid var(--line)}
th{color:var(--muted);font-weight:600}
.ht-empty{border:1px dashed var(--line);border-radius:12px;padding:28px;color:var(--muted);max-width:62ch}
.ht-empty strong{color:var(--fg);display:block;margin-bottom:8px;font-size:17px}
.ht-foot{border-top:1px solid var(--line);padding:18px 16px;text-align:center;color:var(--muted);font-size:14px}
.ht-foot a{color:var(--muted)}
.ht-pager{display:flex;gap:10px;margin-top:22px;align-items:center;font-size:15px}
.ht-pager a{padding:8px 14px;border:1px solid var(--line);border-radius:8px;text-decoration:none}
@media (max-width:420px){h1{font-size:22px}.ht-main{padding:18px 14px 44px}}
`;

/*
 * The FAILURE page. Deliberately not headed "Nothing is published yet",
 * which is what it said until this was noticed: a broken read would have
 * reassured the visitor that the shop was merely empty. Zero products and a
 * catalogue we cannot read are different facts and must not read the same.
 */
function unavailableState(message: string): string {
  return `<h1>Products</h1><div class="ht-empty"><strong>The catalogue could not be read.</strong>${escapeHtml(
    message,
  )}</div>`;
}

/**
 * The empty catalogue, said plainly.
 *
 * This is the state the production database is actually in, and the wording
 * matters: it says no merchant is authorised YET, because the alternative —
 * a spinner, a "coming soon", or a grid of placeholder cards — would imply a
 * catalogue exists and is merely slow.
 */
function renderEmptyCatalogue(): string {
  return `<div class="ht-empty">
  <strong>No products are published yet.</strong>
  Honest Total only lists a product once a merchant has authorised us to, and only
  with prices that merchant has actually published. No merchant authorisation is
  in place today, so this catalogue is empty rather than filled with estimates.
  <p style="margin:14px 0 0">The automation that imports, classifies and publishes a
  merchant feed is built and running; it has nothing authorised to publish.</p>
</div>`;
}

function renderList(input: {
  summary: {
    generation: number | null;
    products: number;
    categories: number;
    brands: number;
    newestVerifiedAt: string | null;
  };
  listed: {
    items: readonly PublishedProduct[];
    total: number;
    limit: number;
    offset: number;
    generation: number | null;
  };
  categories: readonly { slug: string; name: string; count: number }[];
  brands: readonly { brand: string; count: number }[];
  url: URL;
}): string {
  const { summary, listed, categories, url } = input;
  const q = url.searchParams.get('q') ?? '';
  const category = url.searchParams.get('category');
  const sort = url.searchParams.get('sort') ?? 'title';

  if (summary.products === 0 && q === '' && category === null) {
    return `<h1>Products</h1>
      <p class="ht-lede">Every price here is one a merchant has published, with the delivered
      cost stated or honestly marked unknown.</p>
      ${renderEmptyCatalogue()}`;
  }

  const stats = `<div class="ht-stats">
    <span>products <b>${summary.products}</b></span>
    <span>categories <b>${summary.categories}</b></span>
    <span>brands <b>${summary.brands}</b></span>
    ${summary.newestVerifiedAt === null ? '' : `<span>data verified <b>${when(summary.newestVerifiedAt)}</b></span>`}
  </div>`;

  const chips =
    categories.length === 0
      ? ''
      : `<ul class="ht-chips"><li><a href="/products"${category ? '' : ' aria-current="true"'}>All</a></li>` +
        categories
          .map(
            (entry) =>
              `<li><a href="/products?category=${encodeURIComponent(entry.slug)}"${
                category === entry.slug ? ' aria-current="true"' : ''
              }>${escapeHtml(entry.name)} (${entry.count})</a></li>`,
          )
          .join('') +
        '</ul>';

  const cards =
    listed.items.length === 0
      ? `<div class="ht-empty"><strong>Nothing matches that.</strong>Try a different search, or <a href="/products">see everything</a>.</div>`
      : `<ul class="ht-grid">${listed.items
          .map(
            (item) => `<li class="ht-card">
          <a href="/products/${encodeURIComponent(item.slug)}">${escapeHtml(item.title)}</a>
          <div class="ht-meta">${item.brand === null ? '—' : escapeHtml(item.brand)} · ${item.offerCount} offer${item.offerCount === 1 ? '' : 's'}</div>
          <div class="ht-price">${money(item.fromPrice)}</div>
          <div class="ht-meta">Verified ${when(item.dataVerifiedAt)}</div>
        </li>`,
          )
          .join('')}</ul>`;

  const pageSize = listed.limit;
  const prev = listed.offset - pageSize;
  const next = listed.offset + pageSize;
  const link = (offset: number, label: string): string => {
    const target = new URL(url.toString());
    target.searchParams.set('offset', String(offset));
    return `<a href="${escapeHtml(target.pathname + target.search)}">${label}</a>`;
  };
  const pager =
    listed.total <= pageSize
      ? ''
      : `<div class="ht-pager">
          ${prev >= 0 ? link(prev, '&larr; Previous') : ''}
          <span class="ht-meta">${listed.offset + 1}–${Math.min(listed.offset + pageSize, listed.total)} of ${listed.total}</span>
          ${next < listed.total ? link(next, 'Next &rarr;') : ''}
        </div>`;

  return `<h1>Products</h1>
    <p class="ht-lede">Every price here is one a merchant has published. Where a merchant has
    not stated shipping, we say so instead of guessing a total.</p>
    ${stats}
    <form class="ht-search" method="get" action="/products">
      <input type="search" name="q" placeholder="Search products" value="${escapeHtml(q)}" aria-label="Search products">
      ${category === null ? '' : `<input type="hidden" name="category" value="${escapeHtml(category)}">`}
      <select name="sort" aria-label="Sort">
        <option value="title"${sort === 'title' ? ' selected' : ''}>Name</option>
        <option value="cheapest"${sort === 'cheapest' ? ' selected' : ''}>Cheapest delivered</option>
        <option value="freshest"${sort === 'freshest' ? ' selected' : ''}>Most recently verified</option>
      </select>
      <button type="submit">Search</button>
    </form>
    ${chips}
    <p class="ht-meta">${listed.total} result${listed.total === 1 ? '' : 's'}</p>
    ${cards}
    ${pager}`;
}

function renderDetail(detail: ProductDetail): string {
  const offers =
    detail.offers.length === 0
      ? `<div class="ht-empty"><strong>No offer is purchasable right now.</strong>Every merchant that listed this product is currently out of stock, or is no longer authorised.</div>`
      : `<table><thead><tr><th>Merchant</th><th>Item price</th><th>Delivered total</th><th>Availability</th><th>Last seen</th></tr></thead><tbody>${detail.offers
          .map(
            (offer) => `<tr>
        <td>${escapeHtml(offer.merchantName ?? offer.merchantId)}</td>
        <td>${money(offer.itemPrice)}</td>
        <td>${money(offer.deliveredTotal)}</td>
        <td>${escapeHtml(offer.availability)}</td>
        <td>${when(offer.lastSeenAt)}</td>
      </tr>`,
          )
          .join('')}</tbody></table>
      <p class="ht-meta" style="margin-top:10px">A delivered total appears only where the merchant
      stated shipping <em>and</em> fees. Where it does not, no total is shown — an item price is not
      a checkout total.</p>`;

  const specs =
    detail.specifications.length === 0
      ? ''
      : `<h2>Specifications</h2><table><tbody>${detail.specifications
          .map(
            (spec) =>
              `<tr><th>${escapeHtml(spec.label)}</th><td>${escapeHtml(spec.value)}</td></tr>`,
          )
          .join('')}</tbody></table>`;

  const history =
    detail.priceHistory.length === 0
      ? ''
      : `<h2>Price history</h2><table><thead><tr><th>Observed</th><th>List</th><th>Sale</th></tr></thead><tbody>${detail.priceHistory
          .map(
            (entry) =>
              `<tr><td>${when(entry.observedAt)}</td><td>${money(entry.listPrice)}</td><td>${
                entry.salePrice === null ? '—' : money(entry.salePrice)
              }</td></tr>`,
          )
          .join('')}</tbody></table>`;

  return `<p><a href="/products">&larr; All products</a></p>
    <h1>${escapeHtml(detail.title)}</h1>
    <p class="ht-lede">${detail.brand === null ? '' : escapeHtml(detail.brand)}${
      detail.categorySlug === null ? '' : ` · ${escapeHtml(detail.categorySlug)}`
    } · Data verified ${when(detail.dataVerifiedAt)}</p>
    <h2>Offers</h2>
    ${offers}
    ${specs}
    ${history}`;
}

function renderMissing(slug: string): string {
  return `<h1>Not published</h1>
    <div class="ht-empty"><strong>No published product has that address.</strong>
    It may never have been published, or it may have been withdrawn.
    <p style="margin:14px 0 0"><a href="/products">See the catalogue</a></p></div>`;
  void slug;
}
