import type { Pool, QueryResultRow } from 'pg';
import {
  OAuthAuthorizationRequest,
  type OAuthRequestStatus,
} from '../../domain/entities/oauth-authorization-request';
import { OidcProvider } from '../../domain/value-objects/oidc-provider';
import { TokenHash } from '../../domain/value-objects/token-hash';
import { toUserId, type UserId } from '../../domain/value-objects/user-id';
import { toOAuthRequestId, type OAuthRequestId } from '../../domain/value-objects/oauth-request-id';
import type { OAuthAuthorizationRequestRepository } from '../../domain/ports/oauth-authorization-request-repository';
import { assertClaimed } from './concurrency';

interface Row extends QueryResultRow {
  id: string;
  provider: string;
  state_hash: string;
  nonce: string;
  code_verifier: string;
  redirect_uri: string;
  user_id: string | null;
  status: string;
  created_at: Date;
  expires_at: Date;
  consumed_at: Date | null;
}

const SELECT = 'SELECT * FROM identity.oauth_authorization_request';

/**
 * Postgres adapter for {@link OAuthAuthorizationRequestRepository}.
 *
 * `save` advances only a still-`pending` row, so two callbacks carrying the same
 * `state` cannot both complete. `nonce` and `code_verifier` are stored because
 * the callback needs them, and they leave again only through this adapter —
 * never through a snapshot or an event.
 */
export class PostgresOAuthAuthorizationRequestRepository
  implements OAuthAuthorizationRequestRepository
{
  constructor(private readonly pool: Pool) {}

  async findById(id: OAuthRequestId): Promise<OAuthAuthorizationRequest | null> {
    const result = await this.pool.query<Row>(`${SELECT} WHERE id = $1`, [id]);
    return this.toAggregate(result.rows[0]);
  }

  async findByStateHash(hash: TokenHash): Promise<OAuthAuthorizationRequest | null> {
    const result = await this.pool.query<Row>(`${SELECT} WHERE state_hash = $1`, [hash.value]);
    return this.toAggregate(result.rows[0]);
  }

  async listPending(userId: UserId, provider: OidcProvider): Promise<OAuthAuthorizationRequest[]> {
    const result = await this.pool.query<Row>(
      `${SELECT} WHERE user_id = $1 AND provider = $2 AND status = 'pending' ORDER BY created_at`,
      [userId, provider.value],
    );
    return result.rows.map((row) => {
      const request = this.toAggregate(row);
      if (request === null) {
        throw new Error(`Corrupt row: oauth request ${row.id}`);
      }
      return request;
    });
  }

  async save(request: OAuthAuthorizationRequest): Promise<void> {
    const s = request.snapshot();
    const result = await this.pool.query(
      `INSERT INTO identity.oauth_authorization_request
         (id, provider, state_hash, nonce, code_verifier, redirect_uri,
          user_id, status, created_at, expires_at, consumed_at)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11)
       ON CONFLICT (id) DO UPDATE SET
         status      = EXCLUDED.status,
         consumed_at = EXCLUDED.consumed_at
       WHERE oauth_authorization_request.status = 'pending'`,
      [
        s.id,
        s.provider,
        request.stateHash.value,
        request.nonce,
        request.codeVerifier,
        s.redirectUri,
        s.userId,
        s.status,
        s.createdAt,
        s.expiresAt,
        s.consumedAt,
      ],
    );
    assertClaimed(result.rowCount, 'OAuthAuthorizationRequest', s.id);
  }

  private toAggregate(row: Row | undefined): OAuthAuthorizationRequest | null {
    if (row === undefined) {
      return null;
    }
    return OAuthAuthorizationRequest.reconstitute({
      id: toOAuthRequestId(row.id),
      provider: OidcProvider.fromSlug(row.provider),
      stateHash: TokenHash.fromHex(row.state_hash),
      nonce: row.nonce,
      codeVerifier: row.code_verifier,
      redirectUri: row.redirect_uri,
      userId: row.user_id === null ? null : toUserId(row.user_id),
      status: row.status as OAuthRequestStatus,
      createdAt: row.created_at,
      expiresAt: row.expires_at,
      consumedAt: row.consumed_at,
    });
  }
}
