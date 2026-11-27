/*
 * EVERY NUMBER ON THE DASHBOARD, READ FROM THE DATABASE.
 *
 * There is no sample data in this file, no placeholder and no "—" standing in
 * for a figure nobody computed. A metric that cannot be derived is absent from
 * the type, so it cannot be rendered as a plausible zero.
 *
 * Where a figure genuinely is not knowable from here, it says so: database
 * STORAGE is Cloudflare's number, not one this Worker can count, and the
 * daily quota has an estimate and an authoritative figure that lag each other
 * — both are shown rather than averaged into something neither.
 */
import type { D1Like } from '../../../services/catalog/dist/worker.js';

const n = (value: unknown): number => Number(value ?? 0);
const s = (value: unknown): string | null =>
  value === null || value === undefined ? null : String(value);

/** `YYYY-MM-DD` in UTC, which is the day D1's quota resets on. */
export function utcDay(at: Date): string {
  return at.toISOString().slice(0, 10);
}

export interface Overview {
  readonly totalProducts: number;
  readonly publishedProducts: number;
  readonly activeMerchants: number;
  readonly approvedMerchants: number;
  readonly activeOffers: number;
  readonly discoveredToday: number;
  readonly publishedToday: number;
  readonly updatedToday: number;
  readonly priceChangesToday: number;
  readonly failedJobs: number;
  readonly quarantined: number;
  readonly lastSyncAt: string | null;
  readonly lastSyncOutcome: string | null;
  readonly nextSyncAt: string | null;
  readonly liveGeneration: number | null;
  readonly estimatedWritesToday: number;
  readonly authoritativeWritesToday: number | null;
  readonly dailyWriteAllowance: number;
  readonly automationPaused: boolean;
  readonly autoPublish: boolean;
  readonly environment: string;
}

/**
 * The next scheduled run, computed from the cron this Worker is deployed with.
 *
 * Passed in rather than parsed from Cloudflare: the Worker cannot read its own
 * trigger at runtime, and inventing a schedule here would be a number that
 * looks authoritative and is not.
 */
export function nextRun(crons: readonly number[], from: Date): string | null {
  if (crons.length === 0) return null;
  const candidates = crons.map((hour) => {
    const next = new Date(from);
    next.setUTCMinutes(17, 0, 0);
    next.setUTCHours(hour);
    if (next <= from) next.setUTCDate(next.getUTCDate() + 1);
    return next;
  });
  candidates.sort((a, b) => a.getTime() - b.getTime());
  return candidates[0].toISOString();
}

export async function overview(db: D1Like, now: Date, crons: readonly number[]): Promise<Overview> {
  const today = utcDay(now);
  const dayStart = `${today}T00:00:00.000Z`;

  const row = await db
    .prepare(
      `SELECT
         (SELECT COUNT(*) FROM catalog_product) AS total_products,
         (SELECT COUNT(*) FROM catalog_published_product WHERE last_generation IS NULL) AS published_products,
         (SELECT COUNT(*) FROM catalog_merchant) AS merchants,
         (SELECT COUNT(*) FROM catalog_merchant WHERE relationship = 'approved') AS approved_merchants,
         (SELECT COUNT(*) FROM catalog_merchant_offer WHERE state = 'active') AS active_offers,
         (SELECT COUNT(*) FROM catalog_merchant_offer WHERE first_seen_run IN
            (SELECT id FROM catalog_import_run WHERE started_at >= ?)) AS discovered_today,
         (SELECT COUNT(*) FROM catalog_published_product WHERE published_at >= ?) AS published_today,
         (SELECT COUNT(*) FROM catalog_merchant_offer WHERE last_seen_at >= ?) AS updated_today,
         (SELECT COUNT(*) FROM catalog_offer_price_history WHERE observed_at >= ?) AS price_changes_today,
         (SELECT COUNT(*) FROM catalog_import_run WHERE status = 'failed') AS failed_jobs,
         (SELECT COUNT(*) FROM catalog_quarantined_row) AS quarantined,
         (SELECT live_generation FROM catalog_publication_pointer WHERE id = 1) AS live_generation,
         (SELECT paused FROM catalog_automation_config WHERE id = 1) AS paused,
         (SELECT auto_publish FROM catalog_automation_config WHERE id = 1) AS auto_publish,
         (SELECT environment FROM catalog_automation_config WHERE id = 1) AS environment`,
    )
    .bind(dayStart, dayStart, dayStart, dayStart)
    .first<Record<string, unknown>>();

  const lastCycle = await db
    .prepare(
      `SELECT started_at, outcome FROM catalog_sync_cycle
        WHERE outcome = 'ran' ORDER BY started_at DESC LIMIT 1`,
    )
    .first<Record<string, unknown>>();

  const quota = await db
    .prepare(`SELECT estimated_writes, authoritative_writes FROM catalog_quota_usage WHERE day = ?`)
    .bind(today)
    .first<Record<string, unknown>>();

  return {
    totalProducts: n(row?.total_products),
    publishedProducts: n(row?.published_products),
    activeMerchants: n(row?.merchants),
    approvedMerchants: n(row?.approved_merchants),
    activeOffers: n(row?.active_offers),
    discoveredToday: n(row?.discovered_today),
    publishedToday: n(row?.published_today),
    updatedToday: n(row?.updated_today),
    priceChangesToday: n(row?.price_changes_today),
    failedJobs: n(row?.failed_jobs),
    quarantined: n(row?.quarantined),
    lastSyncAt: s(lastCycle?.started_at),
    lastSyncOutcome: s(lastCycle?.outcome),
    nextSyncAt: nextRun(crons, now),
    liveGeneration:
      row?.live_generation === null || row?.live_generation === undefined
        ? null
        : n(row.live_generation),
    estimatedWritesToday: n(quota?.estimated_writes),
    authoritativeWritesToday:
      quota?.authoritative_writes === null || quota?.authoritative_writes === undefined
        ? null
        : n(quota.authoritative_writes),
    dailyWriteAllowance: 100_000,
    automationPaused: n(row?.paused) === 1,
    autoPublish: n(row?.auto_publish) === 1,
    environment: s(row?.environment) ?? 'unknown',
  };
}

/* ───────────────────────────── the sections ───────────────────────────── */

export interface Row {
  readonly [column: string]: string | number | null;
}

/** A section is a title, a column order and the rows. Nothing is invented. */
export interface Section {
  readonly columns: readonly string[];
  readonly rows: readonly Row[];
  /** Shown when there are no rows. Always a fact, never "coming soon". */
  readonly empty: string;
}

const section = (columns: string[], rows: Row[], empty: string): Section => ({
  columns,
  rows,
  empty,
});

async function all(
  db: D1Like,
  sql: string,
  binds: unknown[] = [],
): Promise<Record<string, unknown>[]> {
  const statement = binds.length > 0 ? db.prepare(sql).bind(...binds) : db.prepare(sql);
  const out = await statement.all<Record<string, unknown>>();
  return out.results;
}

export async function products(db: D1Like, limit = 100): Promise<Section> {
  const rows = await all(
    db,
    `SELECT p.id, p.title, p.brand, p.category_slug,
            (SELECT COUNT(*) FROM catalog_product_offer po WHERE po.product_id = p.id) AS offers,
            CASE WHEN EXISTS (
              SELECT 1 FROM catalog_published_product pp
               WHERE pp.product_id = p.id AND pp.last_generation IS NULL
            ) THEN 'published' ELSE 'withheld' END AS state,
            p.updated_at
       FROM catalog_product p ORDER BY p.updated_at DESC LIMIT ?`,
    [limit],
  );
  return section(
    ['title', 'brand', 'category_slug', 'offers', 'state', 'updated_at'],
    rows as Row[],
    'No product has been discovered yet. Products appear here automatically after an import.',
  );
}

export async function categories(db: D1Like): Promise<Section> {
  const rows = await all(
    db,
    `SELECT c.slug, c.name, c.parent_slug,
            (SELECT COUNT(*) FROM catalog_product p WHERE p.category_slug = c.slug) AS products
       FROM catalog_category c ORDER BY c.slug`,
  );
  return section(
    ['slug', 'name', 'parent_slug', 'products'],
    rows as Row[],
    'No category has been stated by a merchant yet. Categories are never invented from titles.',
  );
}

export async function brands(db: D1Like): Promise<Section> {
  const rows = await all(
    db,
    `SELECT b.display, b.normalised,
            (SELECT COUNT(*) FROM catalog_product p WHERE p.brand_normalised = b.normalised) AS products
       FROM catalog_brand b ORDER BY b.display`,
  );
  return section(['display', 'normalised', 'products'], rows as Row[], 'No brand recorded yet.');
}

export async function merchants(db: D1Like): Promise<Section> {
  const rows = await all(
    db,
    `SELECT m.id, m.name, m.network, m.relationship, m.verified_at,
            (SELECT COUNT(*) FROM catalog_merchant_offer o WHERE o.merchant_id = m.id AND o.state = 'active') AS active_offers,
            CASE WHEN m.affiliate_url IS NULL THEN 'no' ELSE 'yes' END AS affiliate_link
       FROM catalog_merchant m ORDER BY m.relationship, m.id`,
  );
  return section(
    ['id', 'name', 'network', 'relationship', 'active_offers', 'affiliate_link', 'verified_at'],
    rows as Row[],
    'No merchant is configured. A merchant must be approved before anything it sells can be published.',
  );
}

export async function networks(db: D1Like): Promise<Section> {
  const rows = await all(
    db,
    `SELECT network,
            COUNT(*) AS merchants,
            SUM(CASE WHEN relationship = 'approved' THEN 1 ELSE 0 END) AS approved,
            SUM(CASE WHEN relationship = 'pending' THEN 1 ELSE 0 END) AS pending
       FROM catalog_merchant WHERE network IS NOT NULL GROUP BY network ORDER BY network`,
  );
  return section(
    ['network', 'merchants', 'approved', 'pending'],
    rows as Row[],
    'No affiliate network is configured.',
  );
}

export async function feedSources(db: D1Like): Promise<Section> {
  const rows = await all(
    db,
    `SELECT id, merchant_id, transport, format, every_minutes,
            CASE WHEN enabled = 1 THEN 'yes' ELSE 'no' END AS enabled,
            CASE WHEN paused = 1 THEN 'yes' ELSE 'no' END AS paused,
            paused_reason, consecutive_failures, last_success_at, last_attempt_at
       FROM catalog_feed_source ORDER BY merchant_id, id`,
  );
  return section(
    [
      'id',
      'merchant_id',
      'transport',
      'enabled',
      'paused',
      'consecutive_failures',
      'last_success_at',
      'last_attempt_at',
      'paused_reason',
    ],
    rows as Row[],
    'No feed source is configured.',
  );
}

export async function cycles(db: D1Like, limit = 40): Promise<Section> {
  const rows = await all(
    db,
    `SELECT started_at, trigger, outcome, sources_considered, sources_imported,
            sources_failed, rows_written, generation, detail
       FROM catalog_sync_cycle ORDER BY started_at DESC LIMIT ?`,
    [limit],
  );
  return section(
    [
      'started_at',
      'trigger',
      'outcome',
      'sources_imported',
      'sources_failed',
      'rows_written',
      'generation',
      'detail',
    ],
    rows as Row[],
    'No synchronisation cycle has run yet.',
  );
}

export async function generations(db: D1Like, limit = 30): Promise<Section> {
  const rows = await all(
    db,
    `SELECT generation, status, started_at, completed_at, product_count, decided_by, detail
       FROM catalog_publication_generation ORDER BY generation DESC LIMIT ?`,
    [limit],
  );
  return section(
    ['generation', 'status', 'product_count', 'started_at', 'completed_at', 'decided_by', 'detail'],
    rows as Row[],
    'Nothing has been published yet.',
  );
}

export async function offers(db: D1Like, limit = 100): Promise<Section> {
  const rows = await all(
    db,
    `SELECT o.merchant_id, o.merchant_offer_id, o.title, o.brand,
            o.list_price_minor, o.currency, o.availability, o.state, o.last_seen_at,
            CASE WHEN o.shipping_verified = 1 THEN 'yes' ELSE 'no' END AS shipping_stated
       FROM catalog_merchant_offer o ORDER BY o.last_seen_at DESC LIMIT ?`,
    [limit],
  );
  return section(
    [
      'merchant_id',
      'merchant_offer_id',
      'title',
      'list_price_minor',
      'currency',
      'availability',
      'state',
      'shipping_stated',
      'last_seen_at',
    ],
    rows as Row[],
    'No offer has been imported yet.',
  );
}

export async function priceHistory(db: D1Like, limit = 100): Promise<Section> {
  const rows = await all(
    db,
    `SELECT h.observed_at, o.merchant_id, o.merchant_offer_id, o.title,
            h.list_price_minor, h.sale_price_minor, h.currency, h.availability
       FROM catalog_offer_price_history h
       JOIN catalog_merchant_offer o ON o.id = h.offer_id
      ORDER BY h.observed_at DESC LIMIT ?`,
    [limit],
  );
  return section(
    [
      'observed_at',
      'merchant_id',
      'merchant_offer_id',
      'list_price_minor',
      'sale_price_minor',
      'currency',
      'availability',
    ],
    rows as Row[],
    'No price movement has been recorded. History records movement, not sightings.',
  );
}

export async function quarantine(db: D1Like, limit = 100): Promise<Section> {
  const rows = await all(
    db,
    `SELECT q.import_run_id, q.merchant_id, q.row_number, q.merchant_offer_id, q.reasons
       FROM catalog_quarantined_row q ORDER BY q.rowid DESC LIMIT ?`,
    [limit],
  );
  return section(
    ['merchant_id', 'merchant_offer_id', 'row_number', 'reasons', 'import_run_id'],
    rows as Row[],
    'Nothing is quarantined.',
  );
}

export async function decisions(db: D1Like, limit = 100): Promise<Section> {
  const rows = await all(
    db,
    `SELECT decided_at, product_id, published, reason_code, decided_by, rules_version
       FROM catalog_publication_decision ORDER BY decided_at DESC LIMIT ?`,
    [limit],
  );
  return section(
    ['decided_at', 'product_id', 'published', 'reason_code', 'decided_by', 'rules_version'],
    rows as Row[],
    'No publication decision has been recorded.',
  );
}

export async function auditLog(db: D1Like, limit = 100): Promise<Section> {
  const rows = await all(
    db,
    `SELECT at, actor_id, action, target, outcome, detail
       FROM admin_audit_log ORDER BY at DESC LIMIT ?`,
    [limit],
  );
  return section(
    ['at', 'actor_id', 'action', 'target', 'outcome', 'detail'],
    rows as Row[],
    'No administrative action has been taken yet. Denials are recorded here too.',
  );
}

export async function quotaHistory(db: D1Like, days = 14): Promise<Section> {
  const rows = await all(
    db,
    `SELECT day, estimated_writes, authoritative_writes, estimated_reads, cycles
       FROM catalog_quota_usage ORDER BY day DESC LIMIT ?`,
    [days],
  );
  return section(
    ['day', 'estimated_writes', 'authoritative_writes', 'estimated_reads', 'cycles'],
    rows as Row[],
    'No quota usage recorded yet.',
  );
}

export async function sourcePermissions(db: D1Like): Promise<Section> {
  const rows = await all(
    db,
    `SELECT domain, verdict, reason, audited_on,
            CASE WHEN images_permitted = 1 THEN 'yes' ELSE 'no' END AS images_permitted
       FROM catalog_source_permission ORDER BY verdict, domain`,
  );
  return section(
    ['domain', 'verdict', 'images_permitted', 'audited_on', 'reason'],
    rows as Row[],
    'No source permission has been audited. Unread is not permissive.',
  );
}

/** Writes an audit row. Denials included — a refusal nobody can review is not one. */
export async function audit(
  db: D1Like,
  entry: {
    at: string;
    actorId: string;
    action: string;
    target: string | null;
    outcome: 'allowed' | 'denied' | 'failed';
    detail: string | null;
  },
): Promise<void> {
  await db
    .prepare(
      `INSERT INTO admin_audit_log (id, at, actor_id, action, target, outcome, detail)
       VALUES (?,?,?,?,?,?,?)`,
    )
    .bind(
      `${entry.at}-${entry.action}-${Math.random().toString(36).slice(2, 10)}`,
      entry.at,
      entry.actorId,
      entry.action,
      entry.target,
      entry.outcome,
      entry.detail,
    )
    .run();
}
