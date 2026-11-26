/*
 * FEED SOURCES, READ FROM AND WRITTEN BACK TO D1.
 *
 * The scheduler already works against any `OfferStore`, and `D1OfferStore` is
 * one — so connecting it to D1 is not about the scheduler. It is about the two
 * things it took from somewhere else: WHICH sources exist, and what it
 * remembered about each one between runs.
 *
 * Both now live in `catalog_feed_source`, which means a source can be added,
 * paused or disabled WITHOUT A DEPLOY. That is the point: an operator who has
 * to ship code to stop a misbehaving feed will instead leave it running.
 *
 * TWO SEPARATE OFF SWITCHES, deliberately. `enabled` is configuration — this
 * source is not ready, or is being set up. `paused` is an operator action with
 * a reason and a timestamp — this source WAS running and someone stopped it.
 * Collapsing them into one boolean loses the question an incident review
 * always asks: was this off on purpose, and who turned it off?
 */
import type { FeedSource } from '../retrieval/feed-source';
import type { FeedValidators } from '../retrieval/retrieve';
import type { SourceState, SourceStateStore } from '../retrieval/scheduler';
import type { D1Like, D1PreparedStatement } from '../store/d1/d1-client';
import { fromInt, toInt } from '../store/d1/d1-client';

export interface FeedSourceRow extends FeedSource {
  /** Operator pause, separate from `enabled`. */
  readonly paused: boolean;
  readonly pausedReason: string | null;
  readonly pausedAt: string | null;
  readonly lastSuccessAt: string | null;
  readonly lastAttemptAt: string | null;
  readonly validators: FeedValidators;
}

const text = (value: unknown): string | null =>
  value === null || value === undefined ? null : String(value);

function toRow(row: Record<string, unknown>): FeedSourceRow {
  const authKind = text(row.auth_kind);
  const authDetail = text(row.auth_detail);

  return {
    id: String(row.id),
    merchantId: String(row.merchant_id),
    transport: String(row.transport) as FeedSource['transport'],
    url: String(row.url),
    format: String(row.format) as FeedSource['format'],
    schedule: {
      everyMinutes: Number(row.every_minutes),
      ...(row.min_interval_minutes === null || row.min_interval_minutes === undefined
        ? {}
        : { minIntervalMinutes: Number(row.min_interval_minutes) }),
    },
    credentialRef: text(row.credential_ref),
    auth: toAuth(authKind, authDetail),
    enabled: fromInt(row.enabled),
    paused: fromInt(row.paused),
    pausedReason: text(row.paused_reason),
    pausedAt: text(row.paused_at),
    lastSuccessAt: text(row.last_success_at),
    lastAttemptAt: text(row.last_attempt_at),
    validators: {
      ...(text(row.etag) === null ? {} : { etag: String(row.etag) }),
      ...(text(row.last_modified) === null ? {} : { lastModified: String(row.last_modified) }),
      ...(text(row.payload_sha256) === null ? {} : { sha256: String(row.payload_sha256) }),
    },
  };
}

function toAuth(kind: string | null, detail: string | null): FeedSource['auth'] {
  switch (kind) {
    case 'bearer':
      return { kind: 'bearer' };
    case 'basic':
      // Without a username there is nothing to send; treating it as `none`
      // would quietly make an authenticated source anonymous.
      return detail === null ? { kind: 'none' } : { kind: 'basic', username: detail };
    case 'query':
      return detail === null ? { kind: 'none' } : { kind: 'query', parameter: detail };
    case 'none':
    default:
      return { kind: 'none' };
  }
}

export class D1FeedSourceStore implements SourceStateStore {
  constructor(private readonly db: D1Like) {}

  /** Every source, whatever its state. For the dashboard. */
  async all(): Promise<readonly FeedSourceRow[]> {
    const out = await this.db
      .prepare(`SELECT * FROM catalog_feed_source ORDER BY merchant_id, id`)
      .all<Record<string, unknown>>();
    return out.results.map(toRow);
  }

  /**
   * The sources a cycle may actually run: enabled AND not paused.
   *
   * Filtered in SQL rather than in the loop, so a paused source costs no
   * retrieval, no credential lookup and no quota — and so the filter cannot be
   * forgotten by a caller.
   */
  async runnable(): Promise<readonly FeedSourceRow[]> {
    const out = await this.db
      .prepare(
        `SELECT * FROM catalog_feed_source
          WHERE enabled = 1 AND paused = 0
          ORDER BY merchant_id, id`,
      )
      .all<Record<string, unknown>>();
    return out.results.map(toRow);
  }

  /* ───────────────── the SourceStateStore contract ───────────────── */

  async get(sourceId: string): Promise<SourceState | undefined> {
    const row = await this.db
      .prepare(
        `SELECT last_success_at, etag, last_modified, payload_sha256
           FROM catalog_feed_source WHERE id = ?`,
      )
      .bind(sourceId)
      .first<Record<string, unknown>>();
    if (!row) return undefined;

    const lastSuccess = text(row.last_success_at);
    const validators: FeedValidators = {
      ...(text(row.etag) === null ? {} : { etag: String(row.etag) }),
      ...(text(row.last_modified) === null ? {} : { lastModified: String(row.last_modified) }),
      ...(text(row.payload_sha256) === null ? {} : { sha256: String(row.payload_sha256) }),
    };
    return {
      lastSuccessAt: lastSuccess === null ? null : new Date(lastSuccess),
      validators,
    };
  }

  /**
   * Persists what the cycle learned.
   *
   * COALESCE on the validators, not assignment. A 304 means "unchanged", and
   * the scheduler reports it with no new ETag — overwriting the stored one
   * with NULL would make the NEXT request unconditional, so the saving that
   * conditional requests exist for would evaporate after the first 304.
   */
  async set(sourceId: string, state: SourceState): Promise<void> {
    const validators = state.validators ?? {};
    await this.db
      .prepare(
        `UPDATE catalog_feed_source
            SET last_success_at = COALESCE(?, last_success_at),
                etag            = COALESCE(?, etag),
                last_modified   = COALESCE(?, last_modified),
                payload_sha256  = COALESCE(?, payload_sha256)
          WHERE id = ?`,
      )
      .bind(
        state.lastSuccessAt === null ? null : state.lastSuccessAt.toISOString(),
        validators.etag ?? null,
        validators.lastModified ?? null,
        validators.sha256 ?? null,
        sourceId,
      )
      .run();
  }

  /** Every attempt, successful or not. This is what "last seen trying" means. */
  async recordAttempt(sourceId: string, at: string): Promise<void> {
    await this.db
      .prepare('UPDATE catalog_feed_source SET last_attempt_at = ? WHERE id = ?')
      .bind(at, sourceId)
      .run();
  }

  /* ───────────────────────── operator actions ───────────────────────── */

  /**
   * Pausing REQUIRES a reason — the schema enforces it too
   * (`CHECK (paused = 0 OR paused_reason IS NOT NULL)`). An unexplained pause
   * is the thing nobody can safely undo six weeks later.
   */
  async pause(sourceId: string, reason: string, at: string): Promise<void> {
    if (reason.trim() === '') {
      throw new TypeError(
        'pausing a source needs a reason; an unexplained pause cannot be undone safely',
      );
    }
    await this.db
      .prepare(
        `UPDATE catalog_feed_source SET paused = 1, paused_reason = ?, paused_at = ? WHERE id = ?`,
      )
      .bind(reason, at, sourceId)
      .run();
  }

  async resume(sourceId: string): Promise<void> {
    await this.db
      .prepare(
        `UPDATE catalog_feed_source SET paused = 0, paused_reason = NULL, paused_at = NULL WHERE id = ?`,
      )
      .bind(sourceId)
      .run();
  }

  async setEnabled(sourceId: string, enabled: boolean): Promise<void> {
    await this.db
      .prepare('UPDATE catalog_feed_source SET enabled = ? WHERE id = ?')
      .bind(toInt(enabled), sourceId)
      .run();
  }

  /** Upserts a source definition. Used by onboarding and by tests. */
  async upsert(source: FeedSourceRow): Promise<void> {
    const statements: D1PreparedStatement[] = [
      this.db
        .prepare(
          `INSERT INTO catalog_feed_source
             (id, merchant_id, transport, url, format, every_minutes, min_interval_minutes,
              credential_ref, auth_kind, auth_detail, enabled, paused, paused_reason, paused_at,
              last_success_at, last_attempt_at, etag, last_modified, payload_sha256)
           VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)
           ON CONFLICT (id) DO UPDATE SET
             merchant_id = excluded.merchant_id,
             transport = excluded.transport,
             url = excluded.url,
             format = excluded.format,
             every_minutes = excluded.every_minutes,
             min_interval_minutes = excluded.min_interval_minutes,
             credential_ref = excluded.credential_ref,
             auth_kind = excluded.auth_kind,
             auth_detail = excluded.auth_detail,
             enabled = excluded.enabled`,
        )
        .bind(
          source.id,
          source.merchantId,
          source.transport,
          source.url,
          source.format,
          source.schedule.everyMinutes,
          source.schedule.minIntervalMinutes ?? null,
          source.credentialRef,
          source.auth?.kind ?? 'none',
          authDetailOf(source.auth),
          toInt(source.enabled),
          toInt(source.paused),
          source.pausedReason,
          source.pausedAt,
          source.lastSuccessAt,
          source.lastAttemptAt,
          source.validators.etag ?? null,
          source.validators.lastModified ?? null,
          source.validators.sha256 ?? null,
        ),
    ];
    await this.db.batch(statements);
  }
}

function authDetailOf(auth: FeedSource['auth']): string | null {
  if (auth === undefined) return null;
  if (auth.kind === 'basic') return auth.username;
  if (auth.kind === 'query') return auth.parameter;
  return null;
}
