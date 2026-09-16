import type { Pool, QueryResultRow } from 'pg';
import { VerificationToken } from '../../domain/entities/verification-token';
import type { VerificationTokenStatus } from '../../domain/entities/verification-token';
import type { VerificationPurpose } from '../../domain/value-objects/verification-purpose';
import { Email } from '../../domain/value-objects/email';
import { TokenHash } from '../../domain/value-objects/token-hash';
import { toUserId, type UserId } from '../../domain/value-objects/user-id';
import {
  toVerificationTokenId,
  type VerificationTokenId,
} from '../../domain/value-objects/verification-token-id';
import type { VerificationTokenRepository } from '../../domain/ports/verification-token-repository';
import { assertClaimed } from './concurrency';

interface Row extends QueryResultRow {
  id: string;
  user_id: string;
  purpose: string;
  email: string;
  token_hash: string;
  status: string;
  created_at: Date;
  expires_at: Date;
  consumed_at: Date | null;
}

const SELECT = 'SELECT * FROM identity.verification_token';

/**
 * Postgres adapter for {@link VerificationTokenRepository}.
 *
 * `save` is a **conditional** upsert: a state change is applied only while the
 * stored row is still `pending`. That is what makes single-use hold across
 * processes — two concurrent redemptions of one link cannot both win, because
 * the second update matches no row and raises `ConcurrentModificationError`.
 */
export class PostgresVerificationTokenRepository implements VerificationTokenRepository {
  constructor(private readonly pool: Pool) {}

  async findById(id: VerificationTokenId): Promise<VerificationToken | null> {
    const result = await this.pool.query<Row>(`${SELECT} WHERE id = $1`, [id]);
    return this.toAggregate(result.rows[0]);
  }

  async findByTokenHash(hash: TokenHash): Promise<VerificationToken | null> {
    const result = await this.pool.query<Row>(`${SELECT} WHERE token_hash = $1`, [hash.value]);
    return this.toAggregate(result.rows[0]);
  }

  async listPending(userId: UserId, purpose: VerificationPurpose): Promise<VerificationToken[]> {
    const result = await this.pool.query<Row>(
      `${SELECT} WHERE user_id = $1 AND purpose = $2 AND status = 'pending' ORDER BY created_at`,
      [userId, purpose],
    );
    return result.rows.map((row) => this.mustAggregate(row));
  }

  async findLatestPending(
    userId: UserId,
    purpose: VerificationPurpose,
  ): Promise<VerificationToken | null> {
    const result = await this.pool.query<Row>(
      `${SELECT} WHERE user_id = $1 AND purpose = $2 AND status = 'pending'
        ORDER BY created_at DESC LIMIT 1`,
      [userId, purpose],
    );
    return this.toAggregate(result.rows[0]);
  }

  async save(token: VerificationToken): Promise<void> {
    const s = token.snapshot();
    const result = await this.pool.query(
      `INSERT INTO identity.verification_token
         (id, user_id, purpose, email, token_hash, status, created_at, expires_at, consumed_at)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)
       ON CONFLICT (id) DO UPDATE SET
         status      = EXCLUDED.status,
         consumed_at = EXCLUDED.consumed_at
       WHERE verification_token.status = 'pending'`,
      [
        s.id,
        s.userId,
        s.purpose,
        s.email,
        token.tokenHash.value,
        s.status,
        s.createdAt,
        s.expiresAt,
        s.consumedAt,
      ],
    );
    assertClaimed(result.rowCount, 'VerificationToken', s.id);
  }

  private mustAggregate(row: Row): VerificationToken {
    const token = this.toAggregate(row);
    if (token === null) {
      throw new Error(`Corrupt row: verification token ${row.id}`);
    }
    return token;
  }

  private toAggregate(row: Row | undefined): VerificationToken | null {
    if (row === undefined) {
      return null;
    }
    const email = Email.create(row.email);
    if (!email.ok) {
      throw new Error(`Corrupt row: verification token ${row.id} has an unparseable email.`);
    }
    return VerificationToken.reconstitute({
      id: toVerificationTokenId(row.id),
      userId: toUserId(row.user_id),
      purpose: row.purpose as VerificationPurpose,
      email: email.value,
      tokenHash: TokenHash.fromHex(row.token_hash),
      status: row.status as VerificationTokenStatus,
      createdAt: row.created_at,
      expiresAt: row.expires_at,
      consumedAt: row.consumed_at,
    });
  }
}
