import type { Pool, QueryResultRow } from 'pg';
import { Session, type SessionStatus } from '../../domain/entities/session';
import type { RefreshTokenStatus } from '../../domain/entities/refresh-token';
import { TokenHash } from '../../domain/value-objects/token-hash';
import { toSessionId, type SessionId } from '../../domain/value-objects/session-id';
import { toUserId, type UserId } from '../../domain/value-objects/user-id';
import type { SessionRevocationReason } from '../../domain/value-objects/session-revocation-reason';
import type { SessionRepository } from '../../domain/ports/session-repository';
import { withTransaction, type SqlExecutor } from './connection';

interface SessionRow extends QueryResultRow {
  id: string;
  user_id: string;
  device_binding: string | null;
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
            created_at, last_used_at, idle_expires_at, absolute_expires_at)
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)
         ON CONFLICT (id) DO UPDATE SET
           status            = EXCLUDED.status,
           revocation_reason = EXCLUDED.revocation_reason,
           last_used_at      = EXCLUDED.last_used_at,
           idle_expires_at   = EXCLUDED.idle_expires_at`,
        [
          snapshot.id,
          snapshot.userId,
          snapshot.deviceBinding,
          snapshot.status,
          snapshot.revocationReason,
          snapshot.createdAt,
          snapshot.lastUsedAt,
          snapshot.idleExpiresAt,
          snapshot.absoluteExpiresAt,
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
      deviceBinding: row.device_binding,
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
