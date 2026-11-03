import type { Pool, QueryResultRow } from 'pg';
import {
  WebAuthnChallenge,
  type WebAuthnChallengeStatus,
} from '../../domain/entities/webauthn-challenge';
import type { WebAuthnCeremony } from '../../domain/value-objects/webauthn-ceremony';
import { TokenHash } from '../../domain/value-objects/token-hash';
import { toUserId, type UserId } from '../../domain/value-objects/user-id';
import {
  toWebAuthnChallengeId,
  type WebAuthnChallengeId,
} from '../../domain/value-objects/webauthn-challenge-id';
import type { WebAuthnChallengeRepository } from '../../domain/ports/webauthn-challenge-repository';
import { assertClaimed } from './concurrency';

interface Row extends QueryResultRow {
  id: string;
  user_id: string | null;
  ceremony: string;
  challenge_hash: string;
  status: string;
  created_at: Date;
  expires_at: Date;
  consumed_at: Date | null;
}

const SELECT = 'SELECT * FROM identity.webauthn_challenge';

/**
 * Postgres adapter for {@link WebAuthnChallengeRepository}.
 *
 * Like the verification token, `save` only advances a row that is still
 * `pending`, so two concurrent completions of one ceremony cannot both succeed.
 */
export class PostgresWebAuthnChallengeRepository implements WebAuthnChallengeRepository {
  constructor(private readonly pool: Pool) {}

  async findById(id: WebAuthnChallengeId): Promise<WebAuthnChallenge | null> {
    const result = await this.pool.query<Row>(`${SELECT} WHERE id = $1`, [id]);
    return this.toAggregate(result.rows[0]);
  }

  async findByChallengeHash(hash: TokenHash): Promise<WebAuthnChallenge | null> {
    const result = await this.pool.query<Row>(`${SELECT} WHERE challenge_hash = $1`, [hash.value]);
    return this.toAggregate(result.rows[0]);
  }

  async listPending(userId: UserId, ceremony: WebAuthnCeremony): Promise<WebAuthnChallenge[]> {
    const result = await this.pool.query<Row>(
      `${SELECT} WHERE user_id = $1 AND ceremony = $2 AND status = 'pending' ORDER BY created_at`,
      [userId, ceremony],
    );
    return result.rows.map((row) => {
      const challenge = this.toAggregate(row);
      if (challenge === null) {
        throw new Error(`Corrupt row: webauthn challenge ${row.id}`);
      }
      return challenge;
    });
  }

  async save(challenge: WebAuthnChallenge): Promise<void> {
    const s = challenge.snapshot();
    const result = await this.pool.query(
      `INSERT INTO identity.webauthn_challenge
         (id, user_id, ceremony, challenge_hash, status, created_at, expires_at, consumed_at)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
       ON CONFLICT (id) DO UPDATE SET
         status      = EXCLUDED.status,
         consumed_at = EXCLUDED.consumed_at
       WHERE webauthn_challenge.status = 'pending'`,
      [
        s.id,
        s.userId,
        s.ceremony,
        challenge.challengeHash.value,
        s.status,
        s.createdAt,
        s.expiresAt,
        s.consumedAt,
      ],
    );
    assertClaimed(result.rowCount, 'WebAuthnChallenge', s.id);
  }

  private toAggregate(row: Row | undefined): WebAuthnChallenge | null {
    if (row === undefined) {
      return null;
    }
    return WebAuthnChallenge.reconstitute({
      id: toWebAuthnChallengeId(row.id),
      userId: row.user_id === null ? null : toUserId(row.user_id),
      ceremony: row.ceremony as WebAuthnCeremony,
      challengeHash: TokenHash.fromHex(row.challenge_hash),
      status: row.status as WebAuthnChallengeStatus,
      createdAt: row.created_at,
      expiresAt: row.expires_at,
      consumedAt: row.consumed_at,
    });
  }
}
