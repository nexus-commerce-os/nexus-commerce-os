import type { Pool, QueryResultRow } from 'pg';
import { FederatedIdentity } from '../../domain/entities/federated-identity';
import { OidcProvider } from '../../domain/value-objects/oidc-provider';
import { toUserId, type UserId } from '../../domain/value-objects/user-id';
import {
  toFederatedIdentityId,
  type FederatedIdentityId,
} from '../../domain/value-objects/federated-identity-id';
import type { FederatedIdentityRepository } from '../../domain/ports/federated-identity-repository';

interface Row extends QueryResultRow {
  id: string;
  user_id: string;
  provider: string;
  subject: string;
  email_at_link: string | null;
  linked_at: Date;
  last_used_at: Date | null;
  revoked_at: Date | null;
}

const SELECT = 'SELECT * FROM identity.federated_identity';

/**
 * Postgres adapter for {@link FederatedIdentityRepository}.
 *
 * `federated_identity_provider_subject_uk` is the load-bearing constraint: one
 * provider account can never be attached to two NEXUS accounts, and the database
 * enforces it even across revoked rows, so an unlinked identity cannot be
 * quietly re-homed to someone else.
 */
export class PostgresFederatedIdentityRepository implements FederatedIdentityRepository {
  constructor(private readonly pool: Pool) {}

  async findById(id: FederatedIdentityId): Promise<FederatedIdentity | null> {
    const result = await this.pool.query<Row>(`${SELECT} WHERE id = $1`, [id]);
    const row = result.rows[0];
    return row === undefined ? null : this.toAggregate(row);
  }

  async findByProviderSubject(
    provider: OidcProvider,
    subject: string,
  ): Promise<FederatedIdentity | null> {
    const result = await this.pool.query<Row>(
      `${SELECT} WHERE provider = $1 AND subject = $2`,
      [provider.value, subject],
    );
    const row = result.rows[0];
    return row === undefined ? null : this.toAggregate(row);
  }

  async listByUser(userId: UserId): Promise<FederatedIdentity[]> {
    const result = await this.pool.query<Row>(`${SELECT} WHERE user_id = $1 ORDER BY linked_at`, [
      userId,
    ]);
    return result.rows.map((row) => this.toAggregate(row));
  }

  async countActiveByUser(userId: UserId): Promise<number> {
    const result = await this.pool.query<{ count: string }>(
      `SELECT count(*)::text AS count FROM identity.federated_identity
        WHERE user_id = $1 AND revoked_at IS NULL`,
      [userId],
    );
    return Number(result.rows[0]?.count ?? '0');
  }

  async save(identity: FederatedIdentity): Promise<void> {
    const s = identity.snapshot();
    await this.pool.query(
      `INSERT INTO identity.federated_identity
         (id, user_id, provider, subject, email_at_link, linked_at, last_used_at, revoked_at)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
       ON CONFLICT (id) DO UPDATE SET
         last_used_at = EXCLUDED.last_used_at,
         revoked_at   = EXCLUDED.revoked_at`,
      [
        s.id,
        s.userId,
        s.provider,
        s.subject,
        s.emailAtLink,
        s.linkedAt,
        s.lastUsedAt,
        s.revokedAt,
      ],
    );
  }

  private toAggregate(row: Row): FederatedIdentity {
    return FederatedIdentity.reconstitute({
      id: toFederatedIdentityId(row.id),
      userId: toUserId(row.user_id),
      provider: OidcProvider.fromSlug(row.provider),
      subject: row.subject,
      emailAtLink: row.email_at_link,
      linkedAt: row.linked_at,
      lastUsedAt: row.last_used_at,
      revokedAt: row.revoked_at,
    });
  }
}
