import type { Pool, QueryResultRow } from 'pg';
import { Session, type SessionStatus } from '../../domain/entities/session';
import type { RefreshTokenStatus } from '../../domain/entities/refresh-token';
import { TokenHash } from '../../domain/value-objects/token-hash';
import { toSessionId, type SessionId } from '../../domain/value-objects/session-id';
import { toUserId, type UserId } from '../../domain/value-objects/user-id';
import { toDeviceId, type DeviceId } from '../../domain/value-objects/device-id';
import type { SessionRevocationReason } from '../../domain/value-objects/session-revocation-reason';
import type { SessionRepository } from '../../domain/ports/session-repository';
import { withTransaction, type SqlExecutor } from './connection';

interface SessionRow extends QueryResultRow {
  id: string;
  user_id: string;
  /** Deprecated (I-7f): opaque and unvalidated. Never read for authorization. */
  device_binding: string | null;
  device_id: string | null;
  status: string;
  revocation_reason: string | null;
  created_at: Date;
  last_used_at: Date;
  idle_expires_at: Date;
  absolute_expires_at: Date;
}

interface TokenRow extends QueryResultRow {
  token_hash: string;
  status: string;
  issued_at: Date;
}

/**
 * Postgres adapter for {@link SessionRepository}.
 *
 * The aggregate is a session plus its whole refresh-token family, so `save`
 * writes both inside one transaction. `refresh_token_hash_uk` makes a token hash
 * resolve to exactly one family across the entire table — that global uniqueness
 * is what lets `findByTokenHash` turn a stolen, already-rotated token into
 * reuse detection instead of a silent miss.
 */
export class PostgresSessionRepository implements SessionRepository {
  constructor(private readonly pool: Pool) {}

  async findById(id: SessionId): Promise<Session | null> {
    const result = await this.pool.query<SessionRow>(
      'SELECT * FROM identity.session WHERE id = $1',
      [id],
    );
    return this.hydrate(result.rows[0]);
  }

  async findByTokenHash(hash: TokenHash): Promise<Session | null> {
    const result = await this.pool.query<SessionRow>(
      `SELECT s.* FROM identity.session s
         JOIN identity.refresh_token t ON t.session_id = s.id
        WHERE t.token_hash = $1`,
      [hash.value],
    );
    return this.hydrate(result.rows[0]);
  }

  /**
   * Active sessions bound to one device. `device_id IS NOT NULL` is implicit in
   * the equality, so legacy rows — which carry no device reference — are never
   * returned and cannot be swept by a device revocation.
   */
  async listActiveByDevice(deviceId: DeviceId): Promise<Session[]> {
    const result = await this.pool.query<SessionRow>(
      `SELECT * FROM identity.session
        WHERE device_id = $1 AND status = 'active'
        ORDER BY created_at`,
      [deviceId],
    );
    const sessions: Session[] = [];
    for (const row of result.rows) {
      const session = await this.hydrate(row);
      if (session !== null) {
        sessions.push(session);
      }
    }
    return sessions;
  }

  async listByUser(userId: UserId): Promise<Session[]> {
    const result = await this.pool.query<SessionRow>(
      'SELECT * FROM identity.session WHERE user_id = $1 ORDER BY created_at',
      [userId],
    );
    const sessions: Session[] = [];
    for (const row of result.rows) {
      const session = await this.hydrate(row);
      if (session !== null) {
        sessions.push(session);
      }
    }
    return sessions;
  }

  async save(session: Session): Promise<void> {
    const snapshot = session.snapshot();
    await withTransaction(this.pool, async (tx) => {
      await tx.query(
        `INSERT INTO identity.session
           (id, user_id, device_binding, status, revocation_reason,
            created_at, last_used_at, idle_expires_at, absolute_expires_at, device_id)
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)
         -- device_id is deliberately absent from the update: the binding is
         -- fixed when the session is created, so a later write (a rotation or a
         -- revocation) can never move a session onto another device.
         ON CONFLICT (id) DO UPDATE SET
           status            = EXCLUDED.status,
           revocation_reason = EXCLUDED.revocation_reason,
           last_used_at      = EXCLUDED.last_used_at,
           idle_expires_at   = EXCLUDED.idle_expires_at`,
        [
          snapshot.id,
          snapshot.userId,
          // Legacy column: written null from I-7f onward and never read for
          // authorization. Retained so a rollback loses nothing.
          null,
          snapshot.status,
          snapshot.revocationReason,
          snapshot.createdAt,
          snapshot.lastUsedAt,
          snapshot.idleExpiresAt,
          snapshot.absoluteExpiresAt,
          snapshot.deviceId,
        ],
      );
      for (const token of session.tokens) {
        await tx.query(
          `INSERT INTO identity.refresh_token (session_id, token_hash, status, issued_at)
           VALUES ($1, $2, $3, $4)
           ON CONFLICT (session_id, token_hash) DO UPDATE SET status = EXCLUDED.status`,
          [snapshot.id, token.hash.value, token.status, token.issuedAt],
        );
      }
    });
  }

  private async hydrate(row: SessionRow | undefined): Promise<Session | null> {
    if (row === undefined) {
      return null;
    }
    return this.toAggregate(row, await this.tokensOf(this.pool, row.id));
  }

  private async tokensOf(tx: SqlExecutor, sessionId: string): Promise<TokenRow[]> {
    const result = await tx.query<TokenRow>(
      `SELECT token_hash, status, issued_at
         FROM identity.refresh_token
        WHERE session_id = $1
        ORDER BY issued_at`,
      [sessionId],
    );
    return result.rows;
  }

  private toAggregate(row: SessionRow, tokens: TokenRow[]): Session {
    return Session.reconstitute({
      id: toSessionId(row.id),
      userId: toUserId(row.user_id),
      deviceId: row.device_id === null ? null : toDeviceId(row.device_id),
      status: row.status as SessionStatus,
      revocationReason: row.revocation_reason as SessionRevocationReason | null,
      tokens: tokens.map((token) => ({
        hash: TokenHash.fromHex(token.token_hash),
        status: token.status as RefreshTokenStatus,
        issuedAt: token.issued_at,
      })),
      createdAt: row.created_at,
      lastUsedAt: row.last_used_at,
      idleExpiresAt: row.idle_expires_at,
      absoluteExpiresAt: row.absolute_expires_at,
    });
  }
}
