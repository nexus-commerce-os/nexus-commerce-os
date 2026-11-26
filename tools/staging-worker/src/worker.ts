/*
 * THE STAGING DEMONSTRATION WORKER.
 *
 * It answers one question: does the pipeline work end to end against a real
 * database, with no rebuild between catalogue updates? So it serves the
 * published catalogue out of D1 and renders it as a page a person can look at.
 *
 * WHAT IT IS NOT. Not the website. It has no custom domain and no route, so it
 * is reachable only on workers.dev and cannot serve honesttotal.com. It is
 * bound to honesttotal-catalog-staging and never to -prod. It holds no KV
 * namespace, so the production waitlist is out of reach.
 *
 * EVERY READ GOES THROUGH `PublicCatalogue`, which is the only code that knows
 * the generation-interval filter. This file writes no catalogue SQL of its
 * own: a second copy of that filter is how withheld rows get served, and the
 * point of a demonstration is that it demonstrates the real thing.
 */
/*
 * IMPORTED BY RELATIVE PATH, not as `@nexus/catalog/worker`.
 *
 * This tool sits OUTSIDE the pnpm workspace on purpose. Adding it as a
 * workspace package would require a lockfile change and new dependencies
 * (wrangler, workers-types), and this repository's supply-chain settings make
 * that a deliberate act: `minimumReleaseAge: 10080` refuses anything published
 * in the last seven days, `blockExoticSubdeps` and `trustPolicy: no-downgrade`
 * are on, and `pnpm install --frozen-lockfile` in CI would fail on a new
 * importer. A demonstration surface is not worth loosening any of that.
 *
 * So it depends on nothing, bundles the already-built worker entry, and is
 * deployed with the wrangler that the release lineage already has. The import
 * is the WORKER-SAFE entry (`dist/worker.js`), never the barrel — the barrel
 * exports the Postgres adapter, which drags `pg` into an edge bundle.
 */
import {
  PublicCatalogue,
  publishCatalogue,
  recentCycles,
  runSyncCycle,
} from '../../../services/catalog/dist/worker.js';
import type { D1Like } from '../../../services/catalog/dist/worker.js';
import { FIXTURE_MERCHANTS, buildFixtureFeed, zipOf } from './fixture-feed';

interface Env {
  readonly CATALOG: D1Database;
  /**
   * Shared secret for the demonstration endpoint that runs a publication
   * cycle. Set with `wrangler secret put`, absent by default — and when it is
   * absent the endpoint is refused rather than left open.
   */
  readonly DEMO_TOKEN?: string;
}

/*
 * The same headers the production Worker sends, minus the ones that only make
 * sense with a custom domain. HSTS is deliberately absent: workers.dev is a
 * shared domain and an HSTS header there applies to every subdomain of it.
 */
const SECURITY_HEADERS: Record<string, string> = {
  /*
   * form-action is 'self', not 'none'. The first deploy used 'none' and would
   * have blocked the page's OWN search form — a decorative search box is
   * exactly what this project refuses to ship, and a CSP that silently
   * disables one is the same defect by another route.
   */
  'content-security-policy':
    "default-src 'none'; style-src 'unsafe-inline'; img-src 'self' data:; form-action 'self'; frame-ancestors 'none'; base-uri 'none'",
  'x-content-type-options': 'nosniff',
  'x-frame-options': 'DENY',
  'referrer-policy': 'no-referrer',
  'cross-origin-opener-policy': 'same-origin',
  'cross-origin-resource-policy': 'same-origin',
  'permissions-policy': 'geolocation=(), microphone=(), camera=()',
  // A demonstration surface must not be indexed as if it were the product.
  'x-robots-tag': 'noindex, nofollow, noarchive',
  'cache-control': 'no-store',
};

function json(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body, null, 2), {
    status,
    headers: { ...SECURITY_HEADERS, 'content-type': 'application/json; charset=utf-8' },
  });
}

function html(body: string, status = 200): Response {
  return new Response(body, {
    status,
    headers: { ...SECURITY_HEADERS, 'content-type': 'text/html; charset=utf-8' },
  });
}

/** The money formatter. Minor units in, nothing invented. */
function price(value: { amountMinor: number; currency: string } | null): string {
  if (value === null) return '<span class="unknown">shipping not stated</span>';
  const major = (value.amountMinor / 100).toFixed(2);
  return `${escapeHtml(value.currency)}&nbsp;${major}`;
}

function escapeHtml(value: string): string {
  return value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

export default {
  async fetch(request: Request, env: Env): Promise<Response> {
    const url = new URL(request.url);
    const db = env.CATALOG as unknown as D1Like;
    const catalogue = new PublicCatalogue(db);

    // HEAD is a GET without a body, and refusing it returned 405 for every
    // `curl -I` and every uptime check.
    if (request.method !== 'GET' && request.method !== 'HEAD' && request.method !== 'POST') {
      return json({ error: 'method not allowed' }, 405);
    }

    // ───────────────────────────── the API ─────────────────────────────

    if (url.pathname === '/api/summary') {
      return json(await catalogue.summary());
    }

    if (url.pathname === '/api/products') {
      const page = await catalogue.list({
        category: url.searchParams.get('category'),
        brand: url.searchParams.get('brand'),
        q: url.searchParams.get('q'),
        limit: numberParam(url, 'limit'),
        offset: numberParam(url, 'offset'),
        sort: sortParam(url),
      });
      return json(page);
    }

    /*
     * THE SYNTHETIC PROVIDER.
     *
     * Served here so the scheduled cycle retrieves over REAL https and
     * exercises the SSRF guard, the conditional-request path, the size
     * limits and the ZIP reader — rather than the `fixture` transport, which
     * reads a local file and is correctly refused in production.
     *
     * An ETag derived from the hour, so an unchanged feed answers 304 and the
     * cycle costs nothing. That is the behaviour the design depends on, and
     * simulating it would prove nothing.
     */
    if (url.pathname.startsWith('/fixture/')) {
      const key = url.pathname.slice('/fixture/'.length).replace(/\.zip$/, '');
      const merchant = FIXTURE_MERCHANTS[key];
      if (merchant === undefined) return json({ error: 'no such fixture' }, 404);

      const now = new Date();
      const text = buildFixtureFeed(merchant, now);
      const etag = `"fixture-${key}-${text.length}-${new Date(now).toISOString().slice(0, 13)}"`;
      if (request.headers.get('if-none-match') === etag) {
        return new Response(null, { status: 304, headers: { ...SECURITY_HEADERS, etag } });
      }
      return new Response(zipOf(text), {
        headers: {
          ...SECURITY_HEADERS,
          'content-type': 'application/zip',
          'content-disposition': `attachment; filename="${key}-fixture.zip"`,
          etag,
        },
      });
    }

    if (url.pathname === '/api/cycles') {
      // The question a scheduler must be able to answer about itself. Refused
      // cycles are in here too, which is the whole point: a log that only
      // records successes cannot distinguish "paused" from "never ran".
      return json({ cycles: await recentCycles(db, 20) });
    }

    if (url.pathname === '/api/categories') {
      return json({ categories: await catalogue.categories() });
    }

    if (url.pathname === '/api/brands') {
      return json({ brands: await catalogue.brands() });
    }

    if (url.pathname.startsWith('/api/products/')) {
      const slug = decodeURIComponent(url.pathname.slice('/api/products/'.length));
      const detail = await catalogue.bySlug(slug);
      return detail === null ? json({ error: 'not found' }, 404) : json(detail);
    }

    /*
     * The demonstration trigger: run one publication cycle on demand.
     *
     * GATED ON A SECRET, and refused when the secret is unset rather than
     * defaulting to open — an unauthenticated endpoint that writes is exactly
     * what must not exist, demonstration or not. Compared with a
     * length-checked, constant-time comparison so the check cannot be used as
     * an oracle.
     */
    if (url.pathname === '/api/cycle' && request.method === 'POST') {
      const presented = request.headers.get('x-demo-token');
      if (!env.DEMO_TOKEN || !presented || !timingSafeEqual(presented, env.DEMO_TOKEN)) {
        return json({ error: 'forbidden' }, 403);
      }
      // `publish=only` republishes without retrieving, which is what a
      // demonstration of the pointer move needs. Otherwise it runs the SAME
      // cycle the cron runs, so a manual trigger exercises the scheduled path
      // rather than a parallel one that could drift from it.
      if (url.searchParams.get('publish') === 'only') {
        const result = await publishCatalogue(db, { now: new Date(), decidedBy: 'staging:demo' });
        return json({
          ran: result.ran,
          skipped: result.skipped,
          skippedDetail: result.skippedDetail,
          counts: result.counts,
          generation: result.generation,
          outcome: result.outcome,
          rejected: result.rejected,
        });
      }
      const cycle = await runSyncCycle(db, { now: new Date(), trigger: 'manual' });
      return json({
        id: cycle.id,
        outcome: cycle.outcome,
        detail: cycle.detail,
        budget: cycle.budget,
        sources: cycle.retrieval?.outcomes ?? [],
        publication: cycle.publication?.outcome ?? null,
        rejected: cycle.publication?.rejected ?? null,
        cost: cycle.cost,
      });
    }

    // ───────────────────────────── the page ─────────────────────────────

    if (url.pathname === '/' || url.pathname === '') {
      const q = url.searchParams.get('q');
      const category = url.searchParams.get('category');
      const [summary, page, categories] = await Promise.all([
        catalogue.summary(),
        catalogue.list({ q, category, limit: 60, sort: sortParam(url) ?? 'title' }),
        catalogue.categories(),
      ]);
      return html(renderPage({ summary, page, categories, q, category, sort: sortParam(url) }));
    }

    if (url.pathname.startsWith('/p/')) {
      const slug = decodeURIComponent(url.pathname.slice('/p/'.length));
      const detail = await catalogue.bySlug(slug);
      if (detail === null) return html(renderNotFound(slug), 404);
      return html(renderDetail(detail));
    }

    return json({ error: 'not found' }, 404);
  },
  /*
   * THE CRON HANDLER.
   *
   * Everything it needs was already built and tested; what was missing was
   * anything that called it on a timer. A retrieval loop nothing invokes is
   * not automation, however well it is tested.
   *
   * `waitUntil` is NOT used to detach the work. A scheduled Worker is allowed
   * to run to completion, and detaching would mean the cron reports success
   * the instant it starts — which is exactly the lie a log is supposed to
   * prevent.
   */
  async scheduled(event: ScheduledController, env: Env, ctx: ExecutionContext): Promise<void> {
    const db = env.CATALOG as unknown as D1Like;

    /*
     * THE HANDLER RECORDS ITS OWN FAILURE.
     *
     * `runSyncCycle` writes a row for every outcome it reaches, including the
     * refusals — but it cannot write one for a throw that happens before it
     * starts, or for a binding that is not there. That failure is INVISIBLE:
     * the cycle log stays empty, which reads exactly like a cron that never
     * fired. Found by deploying a once-a-minute schedule and watching an
     * empty log for five minutes with no way to tell which it was.
     */
    let result;
    try {
      result = await runSyncCycle(db, {
        now: new Date(event.scheduledTime),
        trigger: 'scheduled',
      });
    } catch (error) {
      const detail = error instanceof Error ? `${error.name}: ${error.message}` : String(error);
      console.log(
        JSON.stringify({
          at: new Date(event.scheduledTime).toISOString(),
          cron: event.cron,
          outcome: 'failed',
          detail,
        }),
      );
      // Best effort: if the database is the thing that is broken, this fails
      // too, and the console line above is the record.
      try {
        await db
          .prepare(
            `INSERT INTO catalog_sync_cycle
               (id, started_at, finished_at, trigger, outcome, detail)
             VALUES (?,?,?,'scheduled','failed',?)
             ON CONFLICT (id) DO UPDATE SET detail = excluded.detail`,
          )
          .bind(
            `cycle-${new Date(event.scheduledTime).toISOString()}-scheduled`,
            new Date(event.scheduledTime).toISOString(),
            new Date().toISOString(),
            detail.slice(0, 500),
          )
          .run();
      } catch {
        // Nothing further to do, and swallowing this is deliberate: throwing
        // from a cron handler buys nothing a log line has not already given.
      }
      return;
    }

    // One structured line per cycle. Carries no credential and no feed
    // content — just what happened and what it cost.
    console.log(
      JSON.stringify({
        at: new Date(event.scheduledTime).toISOString(),
        cron: event.cron,
        outcome: result.outcome,
        detail: result.detail,
        sources: result.retrieval?.outcomes.map((o) => ({
          id: o.sourceId,
          outcome: o.outcome,
          reason: o.reason,
        })),
        generation: result.publication?.outcome?.generation ?? null,
        published: result.publication?.counts.eligible ?? null,
        rowsWritten: result.cost.rowsWritten,
      }),
    );
    void ctx;
  },
} satisfies ExportedHandler<Env>;

function numberParam(url: URL, name: string): number | undefined {
  const raw = url.searchParams.get(name);
  if (raw === null) return undefined;
  const value = Number(raw);
  return Number.isFinite(value) ? value : undefined;
}

function sortParam(url: URL): 'title' | 'freshest' | 'cheapest' | undefined {
  const raw = url.searchParams.get('sort');
  return raw === 'freshest' || raw === 'cheapest' || raw === 'title' ? raw : undefined;
}

/** Constant-time over equal lengths, and length itself is not secret here. */
function timingSafeEqual(a: string, b: string): boolean {
  if (a.length !== b.length) return false;
  let diff = 0;
  for (let i = 0; i < a.length; i += 1) diff |= a.charCodeAt(i) ^ b.charCodeAt(i);
  return diff === 0;
}

/* ─────────────────────────── rendering ─────────────────────────── */

const STYLE = `
:root { color-scheme: light dark; --fg:#111; --muted:#5b6471; --line:#e3e6ea; --bg:#fff; --accent:#0b5cad; --warn:#8a5a00; }
@media (prefers-color-scheme: dark) {
  :root { --fg:#e8eaed; --muted:#9aa4b2; --line:#2a2f36; --bg:#14171a; --accent:#7fb2f0; --warn:#e0b25c; }
}
* { box-sizing: border-box; }
body { margin:0; background:var(--bg); color:var(--fg); font:16px/1.55 ui-sans-serif,system-ui,-apple-system,"Segoe UI",Roboto,sans-serif; }
.wrap { max-width: 1040px; margin:0 auto; padding: 24px 16px 64px; }
.banner { background:#8a1c1c; color:#fff; padding:10px 16px; font-size:14px; font-weight:600; }
h1 { font-size:22px; margin:20px 0 4px; }
h2 { font-size:17px; margin:28px 0 10px; }
p.lede { color:var(--muted); margin:0 0 18px; }
.stats { display:flex; flex-wrap:wrap; gap:8px 20px; padding:14px 0; border-top:1px solid var(--line); border-bottom:1px solid var(--line); font-size:14px; }
.stats b { font-variant-numeric: tabular-nums; }
form.search { display:flex; gap:8px; margin:18px 0; flex-wrap:wrap; }
input[type=search] { flex:1 1 220px; min-width:0; padding:9px 11px; border:1px solid var(--line); border-radius:7px; background:var(--bg); color:var(--fg); font-size:15px; }
button, select { padding:9px 13px; border:1px solid var(--line); border-radius:7px; background:var(--bg); color:var(--fg); font-size:15px; cursor:pointer; }
.chips { display:flex; flex-wrap:wrap; gap:7px; margin:0 0 18px; padding:0; list-style:none; font-size:14px; }
.chips a { display:inline-block; padding:4px 10px; border:1px solid var(--line); border-radius:999px; text-decoration:none; color:var(--fg); }
.chips a[aria-current=true] { border-color:var(--accent); color:var(--accent); font-weight:600; }
.grid { display:grid; grid-template-columns:repeat(auto-fill,minmax(230px,1fr)); gap:12px; list-style:none; padding:0; margin:0; }
.card { border:1px solid var(--line); border-radius:10px; padding:13px; }
.card a { color:var(--fg); text-decoration:none; font-weight:600; }
.card a:hover { text-decoration:underline; }
.meta { color:var(--muted); font-size:13px; margin-top:6px; }
.price { margin-top:9px; font-size:17px; font-variant-numeric:tabular-nums; }
.unknown { color:var(--warn); font-size:13px; font-weight:600; }
table { width:100%; border-collapse:collapse; font-size:14px; }
th, td { text-align:left; padding:8px 10px; border-bottom:1px solid var(--line); }
th { color:var(--muted); font-weight:600; }
code { font:13px/1.4 ui-monospace,SFMono-Regular,Menlo,monospace; }
.empty { border:1px dashed var(--line); border-radius:10px; padding:26px; color:var(--muted); }
a.back { font-size:14px; color:var(--accent); }
`;

function shell(title: string, body: string): string {
  return `<!doctype html>
<html lang="en"><head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width,initial-scale=1">
<meta name="robots" content="noindex,nofollow">
<title>${escapeHtml(title)} — HonestTotal staging</title>
<style>${STYLE}</style>
</head><body>
<div class="banner">STAGING DEMONSTRATION — not honesttotal.com. Fixture data, no real merchant offers.</div>
<div class="wrap">${body}</div>
</body></html>`;
}

function renderPage(input: {
  summary: {
    generation: number | null;
    products: number;
    categories: number;
    brands: number;
    newestVerifiedAt: string | null;
  };
  page: {
    items: readonly PublishedItem[];
    total: number;
    limit: number;
    offset: number;
    generation: number | null;
  };
  categories: readonly { slug: string; name: string; count: number }[];
  q: string | null;
  category: string | null;
  sort: string | undefined;
}): string {
  const { summary, page, categories } = input;

  const stats = `<div class="stats">
    <span>published products <b>${summary.products}</b></span>
    <span>categories <b>${summary.categories}</b></span>
    <span>brands <b>${summary.brands}</b></span>
    <span>live generation <b>${summary.generation === null ? '—' : summary.generation}</b></span>
    <span>data verified <b>${summary.newestVerifiedAt === null ? '—' : escapeHtml(summary.newestVerifiedAt)}</b></span>
  </div>`;

  const chips =
    categories.length === 0
      ? ''
      : `<ul class="chips"><li><a href="/"${input.category ? '' : ' aria-current="true"'}>all</a></li>` +
        categories
          .map(
            (c) =>
              `<li><a href="/?category=${encodeURIComponent(c.slug)}"${
                input.category === c.slug ? ' aria-current="true"' : ''
              }>${escapeHtml(c.name)} (${c.count})</a></li>`,
          )
          .join('') +
        '</ul>';

  const body =
    page.items.length === 0
      ? `<div class="empty">${
          summary.generation === null
            ? 'Nothing is published. The publication pointer is unset, which is what an empty catalogue looks like — not an error.'
            : 'No product matches these filters.'
        }</div>`
      : `<ul class="grid">${page.items
          .map(
            (item) => `<li class="card">
        <a href="/p/${encodeURIComponent(item.slug)}">${escapeHtml(item.title)}</a>
        <div class="meta">${item.brand === null ? '—' : escapeHtml(item.brand)} · ${
          item.offerCount
        } offer${item.offerCount === 1 ? '' : 's'}</div>
        <div class="price">${price(item.fromPrice)}</div>
        <div class="meta">verified ${escapeHtml(item.dataVerifiedAt.slice(0, 16).replace('T', ' '))}</div>
      </li>`,
          )
          .join('')}</ul>`;

  return shell(
    'Published catalogue',
    `<h1>Published catalogue</h1>
     <p class="lede">Served from Cloudflare D1 through the publication pointer. Nothing here was deployed with the code.</p>
     ${stats}
     <form class="search" method="get" action="/">
       <input type="search" name="q" placeholder="Search products" value="${escapeHtml(input.q ?? '')}">
       ${input.category ? `<input type="hidden" name="category" value="${escapeHtml(input.category)}">` : ''}
       <select name="sort">
         <option value="title"${input.sort === 'cheapest' || input.sort === 'freshest' ? '' : ' selected'}>Name</option>
         <option value="cheapest"${input.sort === 'cheapest' ? ' selected' : ''}>Cheapest delivered</option>
         <option value="freshest"${input.sort === 'freshest' ? ' selected' : ''}>Most recently verified</option>
       </select>
       <button type="submit">Search</button>
     </form>
     ${chips}
     <p class="lede">${page.total} result${page.total === 1 ? '' : 's'}${
       page.generation === null ? '' : ` · generation ${page.generation}`
     }</p>
     ${body}`,
  );
}

interface PublishedItem {
  readonly slug: string;
  readonly title: string;
  readonly brand: string | null;
  readonly dataVerifiedAt: string;
  readonly fromPrice: { amountMinor: number; currency: string } | null;
  readonly offerCount: number;
}

function renderDetail(detail: {
  slug: string;
  title: string;
  brand: string | null;
  categorySlug: string | null;
  dataVerifiedAt: string;
  fromPrice: { amountMinor: number; currency: string } | null;
  offerCount: number;
  offers: readonly {
    merchantId: string;
    merchantName: string | null;
    itemPrice: { amountMinor: number; currency: string };
    availability: string;
    shippingVerified: boolean;
    deliveredTotal: { amountMinor: number; currency: string } | null;
    lastSeenAt: string;
  }[];
  specifications: readonly { label: string; value: string }[];
  priceHistory: readonly {
    observedAt: string;
    listPrice: { amountMinor: number; currency: string };
    salePrice: { amountMinor: number; currency: string } | null;
  }[];
}): string {
  const offers =
    detail.offers.length === 0
      ? '<div class="empty">No offer is currently purchasable from an approved merchant.</div>'
      : `<table><thead><tr><th>Merchant</th><th>Item price</th><th>Delivered total</th><th>Availability</th><th>Last seen</th></tr></thead><tbody>${detail.offers
          .map(
            (offer) => `<tr>
          <td>${escapeHtml(offer.merchantName ?? offer.merchantId)}</td>
          <td>${price(offer.itemPrice)}</td>
          <td>${price(offer.deliveredTotal)}</td>
          <td>${escapeHtml(offer.availability)}</td>
          <td>${escapeHtml(offer.lastSeenAt.slice(0, 16).replace('T', ' '))}</td>
        </tr>`,
          )
          .join('')}</tbody></table>`;

  const history =
    detail.priceHistory.length === 0
      ? ''
      : `<h2>Price history</h2><table><thead><tr><th>Observed</th><th>List</th><th>Sale</th></tr></thead><tbody>${detail.priceHistory
          .map(
            (entry) => `<tr>
            <td>${escapeHtml(entry.observedAt.slice(0, 16).replace('T', ' '))}</td>
            <td>${price(entry.listPrice)}</td>
            <td>${entry.salePrice === null ? '—' : price(entry.salePrice)}</td>
          </tr>`,
          )
          .join('')}</tbody></table>`;

  const specs =
    detail.specifications.length === 0
      ? ''
      : `<h2>Specifications</h2><table><tbody>${detail.specifications
          .map(
            (spec) =>
              `<tr><th>${escapeHtml(spec.label)}</th><td>${escapeHtml(spec.value)}</td></tr>`,
          )
          .join('')}</tbody></table>`;

  return shell(
    detail.title,
    `<p><a class="back" href="/">&larr; all products</a></p>
     <h1>${escapeHtml(detail.title)}</h1>
     <p class="lede">${detail.brand === null ? '—' : escapeHtml(detail.brand)}${
       detail.categorySlug === null ? '' : ` · ${escapeHtml(detail.categorySlug)}`
     } · data verified ${escapeHtml(detail.dataVerifiedAt.slice(0, 16).replace('T', ' '))}</p>
     <h2>Offers</h2>
     ${offers}
     <p class="lede">A delivered total appears only where the merchant stated shipping AND fees. Where it does not, no total is shown — an item price is not a checkout total.</p>
     ${specs}
     ${history}`,
  );
}

function renderNotFound(slug: string): string {
  return shell(
    'Not found',
    `<h1>Not published</h1>
     <p class="lede">No published product has the slug <code>${escapeHtml(slug)}</code>.</p>
     <p><a class="back" href="/">&larr; all products</a></p>`,
  );
}
