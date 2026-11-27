/*
 * THE ADMINISTRATION DASHBOARD.
 *
 * Seventeen sections, every figure read from the database. There is no sample
 * data here and no control that does nothing: a button either performs the
 * operation it names or it is not on the page. A decorative control is worse
 * than a missing one, because an operator will believe it worked.
 *
 * LONG WORK IS NOT DONE INSIDE THE REQUEST. "Run synchronisation" enqueues a
 * job and returns; the scheduled handler drains it. An import that retrieves
 * several merchant feeds can take a minute, and holding an admin HTTP request
 * open for that long means a timeout looks identical to a failure.
 *
 * EVERY STATE-CHANGING ROUTE IS: authenticated, role-checked, same-origin
 * checked, CSRF-checked, and audited — including when it is refused.
 */
import {
  AdminDenied,
  assertCsrf,
  assertSameOrigin,
  authenticate,
  csrfToken,
  requireRole,
  type AdminEnv,
  type AdminPrincipal,
} from './admin-auth';
import * as data from './admin-data';
import type { D1Like } from '../../../services/catalog/dist/worker.js';

export interface AdminContext {
  readonly db: D1Like;
  readonly env: AdminEnv & { readonly ADMIN_CSRF_SECRET?: string };
  readonly environment: 'development' | 'staging' | 'production';
  readonly now: Date;
  /** UTC hours the cron fires, for "next synchronisation". */
  readonly cronHours: readonly number[];
}

const SECTIONS = [
  ['overview', 'Overview'],
  ['products', 'Products'],
  ['categories', 'Categories'],
  ['brands', 'Brands'],
  ['merchants', 'Merchants'],
  ['networks', 'Affiliate Networks'],
  ['sources', 'Feed Sources'],
  ['automation', 'Automation'],
  ['publication', 'Publication'],
  ['offers', 'Offers'],
  ['prices', 'Price History'],
  ['quarantine', 'Quarantine'],
  ['analytics', 'Analytics'],
  ['health', 'System Health'],
  ['audit', 'Audit Logs'],
  ['users', 'Users and Roles'],
  ['settings', 'Settings'],
] as const;

type SectionId = (typeof SECTIONS)[number][0];

const HEADERS: Record<string, string> = {
  'content-type': 'text/html; charset=utf-8',
  'cache-control': 'no-store',
  'x-robots-tag': 'noindex, nofollow, noarchive',
  'x-content-type-options': 'nosniff',
  'x-frame-options': 'DENY',
  /*
   * `same-origin`, NOT `no-referrer`.
   *
   * `no-referrer` strips the Referer AND makes Chrome serialise the Origin of
   * a form POST as the literal string "null" — so the CSRF check could never
   * be satisfied by the dashboard's own forms. The pause button returned
   * "a state-changing request must state its origin", caused by this header
   * rather than by anything the browser did wrong.
   *
   * `same-origin` sends the Referer to this origin and strips it for every
   * other, which is what a surface with real forms needs: nothing leaks
   * outward, and the request can still prove where it came from.
   */
  'referrer-policy': 'same-origin',
  // No inline script on any admin page, so no nonce is needed and none is
  // granted. `form-action 'self'` is required: the controls are real forms.
  'content-security-policy':
    "default-src 'none'; style-src 'unsafe-inline'; img-src 'self' data:; form-action 'self'; frame-ancestors 'none'; base-uri 'none'",
};

export async function handleAdmin(
  request: Request,
  context: AdminContext,
): Promise<Response | null> {
  const url = new URL(request.url);
  if (url.pathname !== '/admin' && !url.pathname.startsWith('/admin/')) return null;

  let principal: AdminPrincipal;
  try {
    principal = await authenticate(request, context.env, context.environment);
  } catch (error) {
    if (error instanceof AdminDenied) {
      // Recorded before the response, so a probe leaves a trail even though it
      // never reached anything.
      await data
        .audit(context.db, {
          at: context.now.toISOString(),
          actorId: 'anonymous',
          action: `admin:${url.pathname}`,
          target: null,
          outcome: 'denied',
          detail: `${error.reason}: ${error.message}`,
        })
        .catch(() => undefined);
      return deny(error);
    }
    throw error;
  }

  if (request.method === 'POST') return action(request, context, principal, url);
  if (request.method !== 'GET' && request.method !== 'HEAD') {
    return new Response('method not allowed', { status: 405, headers: HEADERS });
  }

  const section = (url.searchParams.get('section') ?? 'overview') as SectionId;
  return render(context, principal, section, url);
}

function deny(error: AdminDenied): Response {
  return new Response(
    `<!doctype html><html lang="en"><head><meta charset="utf-8"><title>Not authorised</title>
     <style>${STYLE}</style></head><body><main class="ad-shell" style="padding:40px">
     <h1>Not authorised</h1><p class="ad-muted">${escape(error.message)}</p>
     <p class="ad-muted">Reason code: <code>${escape(error.reason)}</code></p>
     </main></body></html>`,
    { status: error.status, headers: HEADERS },
  );
}

/* ───────────────────────────── the controls ───────────────────────────── */

async function action(
  request: Request,
  context: AdminContext,
  principal: AdminPrincipal,
  url: URL,
): Promise<Response> {
  const secret = context.env.ADMIN_CSRF_SECRET ?? context.env.DEV_ADMIN_TOKEN ?? '';
  const form = await request.formData();
  const op = String(form.get('op') ?? '');
  const at = context.now.toISOString();

  const record = (
    outcome: 'allowed' | 'denied' | 'failed',
    detail: string,
    target: string | null,
  ) =>
    data
      .audit(context.db, {
        at,
        actorId: principal.email,
        action: `op:${op}`,
        target,
        outcome,
        detail,
      })
      .catch(() => undefined);

  try {
    assertSameOrigin(request);
    await assertCsrf(String(form.get('csrf') ?? ''), principal, secret);
    // Everything that changes state needs at least `operator`. `viewer` can
    // look at all of it and change none of it.
    requireRole(principal, 'operator');
  } catch (error) {
    if (error instanceof AdminDenied) {
      await record('denied', `${error.reason}: ${error.message}`, null);
      return deny(error);
    }
    throw error;
  }

  try {
    const outcome = await perform(op, form, context, principal);
    await record('allowed', outcome.detail, outcome.target);
    return redirect(url, outcome.section, outcome.detail);
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    await record('failed', message, null);
    return redirect(url, 'overview', `Failed: ${message}`);
  }
}

interface Outcome {
  readonly section: SectionId;
  readonly target: string | null;
  readonly detail: string;
}

async function perform(
  op: string,
  form: FormData,
  context: AdminContext,
  principal: AdminPrincipal,
): Promise<Outcome> {
  const at = context.now.toISOString();
  const db = context.db;

  switch (op) {
    case 'pause-automation': {
      const reason = String(form.get('reason') ?? '').trim();
      if (reason === '') throw new Error('a pause needs a reason');
      await db
        .prepare(
          `UPDATE catalog_automation_config
              SET paused = 1, paused_reason = ?, paused_by = ?, paused_at = ?, updated_at = ?
            WHERE id = 1`,
        )
        .bind(reason, principal.email, at, at)
        .run();
      return { section: 'automation', target: 'global', detail: `Automation paused: ${reason}` };
    }

    case 'resume-automation': {
      await db
        .prepare(
          `UPDATE catalog_automation_config
              SET paused = 0, paused_reason = NULL, paused_by = NULL, paused_at = NULL, updated_at = ?
            WHERE id = 1`,
        )
        .bind(at)
        .run();
      return { section: 'automation', target: 'global', detail: 'Automation resumed' };
    }

    case 'set-auto-publish': {
      const on = String(form.get('value') ?? '') === 'on';
      await db
        .prepare(
          'UPDATE catalog_automation_config SET auto_publish = ?, updated_at = ? WHERE id = 1',
        )
        .bind(on ? 1 : 0, at)
        .run();
      return {
        section: 'automation',
        target: 'global',
        detail: `Automatic publication ${on ? 'enabled' : 'disabled'}`,
      };
    }

    case 'pause-source': {
      const id = String(form.get('id') ?? '');
      const reason = String(form.get('reason') ?? '').trim();
      if (reason === '') throw new Error('pausing a source needs a reason');
      await db
        .prepare(
          'UPDATE catalog_feed_source SET paused = 1, paused_reason = ?, paused_at = ? WHERE id = ?',
        )
        .bind(reason, at, id)
        .run();
      return { section: 'sources', target: id, detail: `Source ${id} paused: ${reason}` };
    }

    case 'resume-source': {
      const id = String(form.get('id') ?? '');
      await db
        .prepare(
          'UPDATE catalog_feed_source SET paused = 0, paused_reason = NULL, paused_at = NULL WHERE id = ?',
        )
        .bind(id)
        .run();
      return { section: 'sources', target: id, detail: `Source ${id} resumed` };
    }

    case 'set-source-enabled': {
      const id = String(form.get('id') ?? '');
      const on = String(form.get('value') ?? '') === 'on';
      await db
        .prepare('UPDATE catalog_feed_source SET enabled = ? WHERE id = ?')
        .bind(on ? 1 : 0, id)
        .run();
      return {
        section: 'sources',
        target: id,
        detail: `Source ${id} ${on ? 'enabled' : 'disabled'}`,
      };
    }

    case 'reset-source-failures': {
      const id = String(form.get('id') ?? '');
      await db
        .prepare(
          'UPDATE catalog_feed_source SET consecutive_failures = 0, last_failure_reason = NULL WHERE id = ?',
        )
        .bind(id)
        .run();
      return { section: 'sources', target: id, detail: `Failure count for ${id} reset` };
    }

    case 'request-sync': {
      /*
       * A JOB REQUEST, NOT AN IMPORT.
       *
       * Retrieving several merchant feeds takes far longer than an admin
       * request should be held open, and a timeout there is indistinguishable
       * from a failure. The scheduled handler drains this on its next run, and
       * the request row is what makes "I asked for a sync" visible in the
       * meantime.
       */
      await db
        .prepare(
          `INSERT INTO catalog_sync_request (id, requested_at, requested_by, status)
           VALUES (?,?,?, 'queued')
           ON CONFLICT (id) DO UPDATE SET requested_at = excluded.requested_at`,
        )
        .bind(`req-${at}`, at, principal.email)
        .run();
      return {
        section: 'automation',
        target: null,
        detail: 'Synchronisation requested; the next scheduled run will drain it',
      };
    }

    case 'set-merchant-relationship': {
      const id = String(form.get('id') ?? '');
      const value = String(form.get('value') ?? '');
      if (!['pending', 'approved', 'declined', 'suspended'].includes(value)) {
        throw new Error(`not a relationship: ${value}`);
      }
      // `owner` only. Approving a merchant is the decision that lets that
      // merchant's prices onto the public site.
      requireRole(principal, 'owner');
      await db
        .prepare('UPDATE catalog_merchant SET relationship = ?, verified_at = ? WHERE id = ?')
        .bind(value, value === 'approved' ? at : null, id)
        .run();
      return { section: 'merchants', target: id, detail: `${id} set to ${value}` };
    }

    case 'rollback': {
      requireRole(principal, 'owner');
      const generation = Number(form.get('generation'));
      if (!Number.isInteger(generation)) throw new Error('not a generation');
      const { GenerationPublisher } = await import('../../../services/catalog/dist/worker.js');
      const result = await new GenerationPublisher(db).rollbackTo(generation, {
        at,
        decidedBy: `admin:${principal.email}`,
        detail: String(form.get('reason') ?? 'rolled back from the dashboard'),
      });
      return {
        section: 'publication',
        target: String(generation),
        detail: `Rolled back to generation ${result.to}; ${result.publishedCount} products live`,
      };
    }

    default:
      throw new Error(`unknown operation: ${op}`);
  }
}

function redirect(url: URL, section: SectionId, message: string): Response {
  const target = new URL(url.toString());
  target.pathname = '/admin';
  target.search = `?section=${section}&msg=${encodeURIComponent(message)}`;
  return new Response(null, {
    status: 303,
    headers: { ...HEADERS, location: target.pathname + target.search },
  });
}

/* ───────────────────────────── rendering ───────────────────────────── */

function escape(value: unknown): string {
  return String(value ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

async function render(
  context: AdminContext,
  principal: AdminPrincipal,
  section: SectionId,
  url: URL,
): Promise<Response> {
  const secret = context.env.ADMIN_CSRF_SECRET ?? context.env.DEV_ADMIN_TOKEN ?? '';
  const csrf = await csrfToken(principal, secret);
  const message = url.searchParams.get('msg');

  let body: string;
  try {
    body = await renderSection(section, context, csrf, principal);
  } catch (error) {
    body = `<div class="ad-empty"><strong>That section could not be read.</strong>${escape(
      (error as Error).message,
    )}</div>`;
  }

  const nav = SECTIONS.map(
    ([id, label]) =>
      `<a href="/admin?section=${id}"${id === section ? ' aria-current="page"' : ''}>${escape(label)}</a>`,
  ).join('');

  return new Response(
    `<!doctype html><html lang="en"><head>
<meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">
<meta name="robots" content="noindex,nofollow">
<title>${escape(SECTIONS.find(([id]) => id === section)?.[1] ?? 'Admin')} — Honest Total</title>
<style>${STYLE}</style></head><body>
<div class="ad-banner">${escape(context.environment.toUpperCase())} · signed in as ${escape(
      principal.email,
    )} (${escape(principal.role)}) via ${escape(principal.via)}</div>
<div class="ad-shell">
  <nav class="ad-nav">${nav}</nav>
  <main class="ad-main">
    ${message === null ? '' : `<div class="ad-flash">${escape(message)}</div>`}
    ${body}
  </main>
</div></body></html>`,
    { status: 200, headers: HEADERS },
  );
}

function table(section: data.Section): string {
  if (section.rows.length === 0) {
    return `<div class="ad-empty">${escape(section.empty)}</div>`;
  }
  const head = section.columns.map((c) => `<th>${escape(c.replace(/_/g, ' '))}</th>`).join('');
  const rows = section.rows
    .map(
      (row) =>
        `<tr>${section.columns
          .map((c) => `<td>${row[c] === null || row[c] === undefined ? '—' : escape(row[c])}</td>`)
          .join('')}</tr>`,
    )
    .join('');
  return `<div class="ad-scroll"><table><thead><tr>${head}</tr></thead><tbody>${rows}</tbody></table></div>
    <p class="ad-muted">${section.rows.length} row${section.rows.length === 1 ? '' : 's'}</p>`;
}

function hidden(csrf: string, op: string): string {
  return `<input type="hidden" name="csrf" value="${escape(csrf)}"><input type="hidden" name="op" value="${escape(op)}">`;
}

async function renderSection(
  section: SectionId,
  context: AdminContext,
  csrf: string,
  principal: AdminPrincipal,
): Promise<string> {
  const db = context.db;

  switch (section) {
    case 'overview': {
      const o = await data.overview(db, context.now, context.cronHours);
      const card = (label: string, value: string | number, note = '') =>
        `<li class="ad-stat"><span>${escape(label)}</span><b>${escape(value)}</b>${
          note === '' ? '' : `<em>${escape(note)}</em>`
        }</li>`;
      const quotaNote =
        o.authoritativeWritesToday === null
          ? 'Cloudflare has not been asked yet'
          : `Cloudflare reports ${o.authoritativeWritesToday}`;
      return `<h1>Overview</h1>
        <p class="ad-muted">Every figure below is counted from the database at the moment this page was built.</p>
        <ul class="ad-stats">
          ${card('Total products', o.totalProducts)}
          ${card('Published products', o.publishedProducts)}
          ${card('Merchants', o.activeMerchants, `${o.approvedMerchants} approved`)}
          ${card('Active offers', o.activeOffers)}
          ${card('Discovered today', o.discoveredToday)}
          ${card('Published today', o.publishedToday)}
          ${card('Offers updated today', o.updatedToday)}
          ${card('Price changes today', o.priceChangesToday)}
          ${card('Failed imports', o.failedJobs)}
          ${card('Quarantined rows', o.quarantined)}
          ${card('Live generation', o.liveGeneration ?? 'none')}
          ${card('Writes today', `${o.estimatedWritesToday} / ${o.dailyWriteAllowance}`, quotaNote)}
          ${card('Last synchronisation', o.lastSyncAt ?? 'never', o.lastSyncOutcome ?? '')}
          ${card('Next synchronisation', o.nextSyncAt ?? 'no schedule')}
        </ul>
        <h2>Database storage</h2>
        <div class="ad-empty">Storage is Cloudflare's figure, not one this Worker can count.
        It is read from the D1 API rather than guessed, and is shown on System Health.</div>
        <h2>State</h2>
        <ul class="ad-stats">
          ${card('Automation', o.automationPaused ? 'PAUSED' : 'running')}
          ${card('Automatic publication', o.autoPublish ? 'on' : 'off')}
          ${card('Environment', o.environment)}
        </ul>`;
    }

    case 'products':
      return `<h1>Products</h1>${table(await data.products(db))}`;
    case 'categories':
      return `<h1>Categories</h1>
        <p class="ad-muted">Derived from the category path a merchant stated. Never inferred from a title.</p>
        ${table(await data.categories(db))}`;
    case 'brands':
      return `<h1>Brands</h1>${table(await data.brands(db))}`;

    case 'merchants': {
      const merchants = await data.merchants(db);
      const canApprove = principal.role === 'owner';
      const controls = merchants.rows
        .map(
          (row) => `<form method="post" action="/admin" class="ad-row">
            ${hidden(csrf, 'set-merchant-relationship')}
            <input type="hidden" name="id" value="${escape(row.id)}">
            <span class="ad-rowlabel">${escape(row.name)}</span>
            <select name="value" ${canApprove ? '' : 'disabled'}>
              ${['pending', 'approved', 'declined', 'suspended']
                .map(
                  (value) =>
                    `<option value="${value}"${row.relationship === value ? ' selected' : ''}>${value}</option>`,
                )
                .join('')}
            </select>
            <button type="submit" ${canApprove ? '' : 'disabled'}>Set</button>
          </form>`,
        )
        .join('');
      return `<h1>Merchants</h1>
        <p class="ad-muted">Approving a merchant is what lets that merchant's prices onto the public
        site, so it needs the owner role. Possession of a feed is not approval.</p>
        ${table(merchants)}
        ${merchants.rows.length === 0 ? '' : `<h2>Relationship</h2>${controls}`}
        ${canApprove ? '' : '<p class="ad-muted">Your role cannot change a relationship.</p>'}`;
    }

    case 'networks':
      return `<h1>Affiliate Networks</h1>${table(await data.networks(db))}
        <h2>Source permissions</h2>
        <p class="ad-muted">What each source's terms actually permit. Unread is not permissive.</p>
        ${table(await data.sourcePermissions(db))}`;

    case 'sources': {
      const sources = await data.feedSources(db);
      const controls = sources.rows
        .map((row) => {
          const id = escape(row.id);
          const paused = row.paused === 'yes';
          const enabled = row.enabled === 'yes';
          return `<div class="ad-card">
            <div class="ad-rowlabel">${id} <span class="ad-muted">· ${escape(row.merchant_id)} · ${escape(row.transport)}</span></div>
            <form method="post" action="/admin" class="ad-row">
              ${hidden(csrf, paused ? 'resume-source' : 'pause-source')}
              <input type="hidden" name="id" value="${id}">
              ${paused ? '' : `<input name="reason" placeholder="Reason for pausing" required>`}
              <button type="submit">${paused ? 'Resume' : 'Pause'}</button>
            </form>
            <form method="post" action="/admin" class="ad-row">
              ${hidden(csrf, 'set-source-enabled')}
              <input type="hidden" name="id" value="${id}">
              <input type="hidden" name="value" value="${enabled ? 'off' : 'on'}">
              <button type="submit">${enabled ? 'Disable' : 'Enable'}</button>
            </form>
            ${
              Number(row.consecutive_failures ?? 0) > 0
                ? `<form method="post" action="/admin" class="ad-row">
                     ${hidden(csrf, 'reset-source-failures')}
                     <input type="hidden" name="id" value="${id}">
                     <button type="submit">Reset ${escape(row.consecutive_failures)} failure(s)</button>
                   </form>`
                : ''
            }
          </div>`;
        })
        .join('');
      return `<h1>Feed Sources</h1>
        <p class="ad-muted"><strong>Enabled</strong> is configuration; <strong>paused</strong> is an
        operator action with a reason and a timestamp. They are kept apart so an incident review can
        tell "not ready" from "somebody stopped it".</p>
        ${table(sources)}
        ${sources.rows.length === 0 ? '' : `<h2>Controls</h2>${controls}`}`;
    }

    case 'automation': {
      const o = await data.overview(db, context.now, context.cronHours);
      return `<h1>Automation</h1>
        <div class="ad-card">
          <div class="ad-rowlabel">Global automation — ${o.automationPaused ? 'PAUSED' : 'running'}</div>
          <p class="ad-muted">Checked before anything is read, so a paused system does no work and
          spends no quota.</p>
          ${
            o.automationPaused
              ? `<form method="post" action="/admin" class="ad-row">${hidden(csrf, 'resume-automation')}<button type="submit">Resume automation</button></form>`
              : `<form method="post" action="/admin" class="ad-row">${hidden(csrf, 'pause-automation')}<input name="reason" placeholder="Reason for pausing" required><button type="submit">Pause automation</button></form>`
          }
        </div>
        <div class="ad-card">
          <div class="ad-rowlabel">Automatic publication — ${o.autoPublish ? 'on' : 'off'}</div>
          <p class="ad-muted">With this off, every cycle still computes and records its decisions;
          it simply does not move the publication pointer. That is how you see what WOULD be
          published before allowing it.</p>
          <form method="post" action="/admin" class="ad-row">
            ${hidden(csrf, 'set-auto-publish')}
            <input type="hidden" name="value" value="${o.autoPublish ? 'off' : 'on'}">
            <button type="submit">Turn ${o.autoPublish ? 'off' : 'on'}</button>
          </form>
        </div>
        <div class="ad-card">
          <div class="ad-rowlabel">Manual synchronisation</div>
          <p class="ad-muted">This queues a request rather than running the import inside this page.
          Retrieving several merchant feeds takes longer than a request should be held open, and a
          timeout there is indistinguishable from a failure.</p>
          <form method="post" action="/admin" class="ad-row">${hidden(csrf, 'request-sync')}<button type="submit">Request synchronisation</button></form>
          <p class="ad-muted">Next scheduled run: ${escape(o.nextSyncAt ?? 'no schedule')}</p>
        </div>
        <h2>Recent cycles</h2>
        ${table(await data.cycles(db))}`;
    }

    case 'publication': {
      const gens = await data.generations(db);
      const rollback = gens.rows
        .filter((row) => row.status === 'superseded')
        .slice(0, 5)
        .map(
          (row) => `<form method="post" action="/admin" class="ad-row">
            ${hidden(csrf, 'rollback')}
            <input type="hidden" name="generation" value="${escape(row.generation)}">
            <input name="reason" placeholder="Why roll back?" required>
            <button type="submit">Roll back to ${escape(row.generation)}</button>
          </form>`,
        )
        .join('');
      return `<h1>Publication</h1>
        <p class="ad-muted">Publication is one atomic pointer move. Rolling back is the same move in
        reverse — the rows that generation served are still there, so nothing is rebuilt.</p>
        ${table(gens)}
        ${rollback === '' ? '' : `<h2>Roll back</h2><p class="ad-muted">Owner only.</p>${rollback}`}
        <h2>Decisions</h2>
        <p class="ad-muted">Why each product is or is not public, recorded when it changes.</p>
        ${table(await data.decisions(db))}`;
    }

    case 'offers':
      return `<h1>Offers</h1>${table(await data.offers(db))}`;
    case 'prices':
      return `<h1>Price History</h1>
        <p class="ad-muted">A row exists because a price moved, not because a feed was read.</p>
        ${table(await data.priceHistory(db))}`;
    case 'quarantine':
      return `<h1>Quarantine</h1>
        <p class="ad-muted">Rows refused during import, and products whose identity was ambiguous.
        An ambiguous identity is never merged: picking one is a coin toss about a price.</p>
        ${table(await data.quarantine(db))}`;

    case 'analytics': {
      const o = await data.overview(db, context.now, context.cronHours);
      return `<h1>Analytics</h1>
        <p class="ad-muted">Counts from the catalogue itself. Visitor analytics are not collected by
        this Worker, and an empty chart would imply they were.</p>
        <ul class="ad-stats">
          <li class="ad-stat"><span>Products discovered today</span><b>${o.discoveredToday}</b></li>
          <li class="ad-stat"><span>Products published today</span><b>${o.publishedToday}</b></li>
          <li class="ad-stat"><span>Offers updated today</span><b>${o.updatedToday}</b></li>
          <li class="ad-stat"><span>Price changes today</span><b>${o.priceChangesToday}</b></li>
        </ul>
        <h2>Write quota, by day</h2>
        <p class="ad-muted">The estimate is what this system counted; the authoritative figure is
        Cloudflare's and lags. Both are shown rather than averaged into something neither.</p>
        ${table(await data.quotaHistory(db))}`;
    }

    case 'health': {
      const o = await data.overview(db, context.now, context.cronHours);
      const sources = await data.feedSources(db);
      const broken = sources.rows.filter((row) => Number(row.consecutive_failures ?? 0) > 0);
      return `<h1>System Health</h1>
        <ul class="ad-stats">
          <li class="ad-stat"><span>Last successful cycle</span><b>${escape(o.lastSyncAt ?? 'never')}</b></li>
          <li class="ad-stat"><span>Sources failing</span><b>${broken.length}</b></li>
          <li class="ad-stat"><span>Failed imports (all time)</span><b>${o.failedJobs}</b></li>
          <li class="ad-stat"><span>Quarantined rows</span><b>${o.quarantined}</b></li>
          <li class="ad-stat"><span>Writes today</span><b>${o.estimatedWritesToday} / ${o.dailyWriteAllowance}</b></li>
        </ul>
        ${
          broken.length === 0
            ? '<div class="ad-empty">No source is currently failing.</div>'
            : table({ ...sources, rows: broken })
        }
        <h2>Cycle log</h2>
        <p class="ad-muted">Refused cycles are recorded too: a log that only records successes
        cannot tell "paused" from "never ran".</p>
        ${table(await data.cycles(db, 20))}`;
    }

    case 'audit':
      return `<h1>Audit Logs</h1>
        <p class="ad-muted">Append-only. Denials are recorded as well as grants — an authorisation
        check whose refusals are invisible cannot be reviewed.</p>
        ${table(await data.auditLog(db))}`;

    case 'users':
      return `<h1>Users and Roles</h1>
        <p class="ad-muted">The allowlist is a deployment variable, so revoking somebody does not
        require an Access policy change. Access answers <em>who</em>; the role decides <em>what</em>.</p>
        <ul class="ad-stats">
          <li class="ad-stat"><span>You</span><b>${escape(principal.email)}</b><em>${escape(principal.role)}</em></li>
          <li class="ad-stat"><span>Authenticated via</span><b>${escape(principal.via)}</b></li>
        </ul>
        <table><thead><tr><th>Role</th><th>May</th></tr></thead><tbody>
          <tr><td>viewer</td><td>read every section, change nothing</td></tr>
          <tr><td>operator</td><td>pause and resume, request a sync, enable and disable sources</td></tr>
          <tr><td>owner</td><td>everything, plus merchant approval and rollback</td></tr>
        </tbody></table>`;

    case 'settings': {
      const o = await data.overview(db, context.now, context.cronHours);
      const accessConfigured =
        (context.env.ACCESS_TEAM_DOMAIN ?? '') !== '' && (context.env.ACCESS_AUD ?? '') !== '';
      return `<h1>Settings</h1>
        <table><tbody>
          <tr><th>Environment (from the database)</th><td>${escape(o.environment)}</td></tr>
          <tr><th>Cloudflare Access</th><td>${accessConfigured ? 'configured' : 'NOT configured — the development fallback is in use, and it is refused in production'}</td></tr>
          <tr><th>Automatic publication</th><td>${o.autoPublish ? 'on' : 'off'}</td></tr>
          <tr><th>Automation</th><td>${o.automationPaused ? 'paused' : 'running'}</td></tr>
          <tr><th>Daily write allowance</th><td>${o.dailyWriteAllowance}</td></tr>
          <tr><th>Next scheduled run</th><td>${escape(o.nextSyncAt ?? 'no schedule')}</td></tr>
        </tbody></table>
        <p class="ad-muted">Nothing on this page is editable from here: the environment comes from
        the database so it travels with the data, and the Access configuration is a deploy variable
        so that a compromised dashboard cannot grant itself a different identity provider.</p>`;
    }

    default:
      return `<h1>Not found</h1><div class="ad-empty">No such section.</div>`;
  }
}

const STYLE = `
:root{color-scheme:light dark;--fg:#14171a;--muted:#5b6471;--line:#e4e7eb;--bg:#f7f8fa;--card:#fff;--accent:#0b5cad;--warn:#8a5a00}
@media (prefers-color-scheme:dark){:root{--fg:#e8eaed;--muted:#9aa4b2;--line:#2a2f36;--bg:#0f1215;--card:#171b1f;--accent:#7fb2f0;--warn:#e0b25c}}
*{box-sizing:border-box}
body{margin:0;background:var(--bg);color:var(--fg);font:15px/1.55 ui-sans-serif,system-ui,-apple-system,"Segoe UI",Roboto,sans-serif}
.ad-banner{background:#243041;color:#fff;padding:9px 16px;font-size:13px;font-weight:600;letter-spacing:.02em}
.ad-shell{display:flex;align-items:flex-start;gap:0;min-height:calc(100vh - 36px)}
.ad-nav{flex:0 0 212px;display:flex;flex-direction:column;padding:14px 10px;border-right:1px solid var(--line);background:var(--card);position:sticky;top:0}
.ad-nav a{padding:8px 11px;border-radius:7px;text-decoration:none;color:var(--muted);font-size:14px}
.ad-nav a:hover{background:var(--bg);color:var(--fg)}
.ad-nav a[aria-current=page]{background:var(--accent);color:#fff;font-weight:600}
.ad-main{flex:1 1 auto;min-width:0;padding:22px 24px 60px}
h1{font-size:23px;margin:4px 0 8px;letter-spacing:-.015em}
h2{font-size:17px;margin:28px 0 10px}
.ad-muted{color:var(--muted);font-size:14px;max-width:72ch}
.ad-flash{background:var(--card);border:1px solid var(--accent);border-radius:8px;padding:11px 14px;margin-bottom:16px;font-size:14px}
.ad-stats{display:grid;grid-template-columns:repeat(auto-fill,minmax(188px,1fr));gap:10px;list-style:none;padding:0;margin:16px 0}
.ad-stat{background:var(--card);border:1px solid var(--line);border-radius:10px;padding:12px 14px;display:flex;flex-direction:column;gap:2px}
.ad-stat span{color:var(--muted);font-size:13px}
.ad-stat b{font-size:22px;font-variant-numeric:tabular-nums;letter-spacing:-.02em}
.ad-stat em{color:var(--muted);font-size:12px;font-style:normal}
.ad-scroll{overflow-x:auto;background:var(--card);border:1px solid var(--line);border-radius:10px}
table{width:100%;border-collapse:collapse;font-size:13.5px}
th,td{text-align:left;padding:8px 11px;border-bottom:1px solid var(--line);white-space:nowrap}
th{color:var(--muted);font-weight:600;text-transform:capitalize}
tbody tr:last-child td{border-bottom:none}
.ad-empty{background:var(--card);border:1px dashed var(--line);border-radius:10px;padding:22px;color:var(--muted);max-width:72ch}
.ad-empty strong{display:block;color:var(--fg);margin-bottom:6px}
.ad-card{background:var(--card);border:1px solid var(--line);border-radius:10px;padding:14px;margin:12px 0}
.ad-rowlabel{font-weight:600;margin-bottom:6px}
.ad-row{display:flex;gap:8px;align-items:center;flex-wrap:wrap;margin:8px 0}
input,select{padding:8px 10px;border:1px solid var(--line);border-radius:7px;background:var(--bg);color:var(--fg);font-size:14px;min-width:0}
input[name=reason]{flex:1 1 240px}
button{padding:8px 14px;border:1px solid transparent;border-radius:7px;background:var(--accent);color:#fff;font-size:14px;font-weight:600;cursor:pointer}
button[disabled],select[disabled]{opacity:.5;cursor:not-allowed}
code{font:12.5px ui-monospace,SFMono-Regular,Menlo,monospace}
@media (max-width:760px){.ad-shell{flex-direction:column}.ad-nav{flex:1 1 auto;width:100%;flex-direction:row;overflow-x:auto;position:static;border-right:none;border-bottom:1px solid var(--line)}.ad-nav a{white-space:nowrap}.ad-main{padding:16px 14px 48px}}
`;
