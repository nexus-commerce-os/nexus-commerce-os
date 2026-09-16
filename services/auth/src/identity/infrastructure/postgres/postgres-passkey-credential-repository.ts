import type { Pool, QueryResultRow } from 'pg';
import { PasskeyCredential } from '../../domain/entities/passkey-credential';
import { CredentialId } from '../../domain/value-objects/credential-id';
import { toDeviceId, type DeviceId } from '../../domain/value-objects/device-id';
import { toUserId, type UserId } from '../../domain/value-objects/user-id';
import {
  toPasskeyCredentialId,
  type PasskeyCredentialId,
} from '../../domain/value-objects/passkey-credential-id';
import type { PasskeyCredentialRepository } from '../../domain/ports/passkey-credential-repository';

interface Row extends QueryResultRow {
  id: string;
  user_id: string;
  credential_id: string;
  public_key: string;
  sign_count: string;
  transports: string[];
  aaguid: string;
  backup_eligible: boolean;
  backup_state: boolean;
  label: string;
  device_id: string | null;
  created_at: Date;
  last_used_at: Date | null;
  revoked_at: Date | null;
}

const SELECT = 'SELECT * FROM identity.passkey_credential';

/**
 * Postgres adapter for {@link PasskeyCredentialRepository}.
 *
 * `passkey_credential_credential_id_uk` is what makes an authenticator-chosen id
 * resolve to exactly one credential, so a duplicate registration is refused by
 * the database rather than only by an application check.
 *
 * `sign_count` is a `bigint`, which node-postgres returns as a string to avoid
 * silent precision loss; it is parsed back here at the boundary.
 */
export class PostgresPasskeyCredentialRepository implements PasskeyCredentialRepository {
  constructor(private readonly pool: Pool) {}

  async findById(id: PasskeyCredentialId): Promise<PasskeyCredential | null> {
    const result = await this.pool.query<Row>(`${SELECT} WHERE id = $1`, [id]);
    const row = result.rows[0];
    return row === undefined ? null : this.toAggregate(row);
  }

  async findByCredentialId(credentialId: CredentialId): Promise<PasskeyCredential | null> {
    const result = await this.pool.query<Row>(`${SELECT} WHERE credential_id = $1`, [
      credentialId.value,
    ]);
    const row = result.rows[0];
    return row === undefined ? null : this.toAggregate(row);
  }

  async listByUser(userId: UserId): Promise<PasskeyCredential[]> {
    const result = await this.pool.query<Row>(
      `${SELECT} WHERE user_id = $1 ORDER BY created_at`,
      [userId],
    );
    return result.rows.map((row) => this.toAggregate(row));
  }

  async listByDevice(deviceId: DeviceId): Promise<PasskeyCredential[]> {
    const result = await this.pool.query<Row>(
      `${SELECT} WHERE device_id = $1 ORDER BY created_at`,
      [deviceId],
    );
    return result.rows.map((row) => this.toAggregate(row));
  }

  async countActiveByUser(userId: UserId): Promise<number> {
    const result = await this.pool.query<{ count: string }>(
      `SELECT count(*)::text AS count FROM identity.passkey_credential
        WHERE user_id = $1 AND revoked_at IS NULL`,
      [userId],
    );
    return Number(result.rows[0]?.count ?? '0');
  }

  async save(credential: PasskeyCredential): Promise<void> {
    const s = credential.snapshot();
    await this.pool.query(
      `INSERT INTO identity.passkey_credential
         (id, user_id, credential_id, public_key, sign_count, transports, aaguid,
          backup_eligible, backup_state, label, device_id, created_at, last_used_at, revoked_at)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14)
       ON CONFLICT (id) DO UPDATE SET
         sign_count   = EXCLUDED.sign_count,
         backup_state = EXCLUDED.backup_state,
         label        = EXCLUDED.label,
         device_id    = EXCLUDED.device_id,
         last_used_at = EXCLUDED.last_used_at,
         revoked_at   = EXCLUDED.revoked_at`,
      [
        s.id,
        s.userId,
        s.credentialId,
        credential.publicKey,
        s.signCount,
        [...s.transports],
        s.aaguid,
        s.backupEligible,
        s.backupState,
        s.label,
        s.deviceId,
        s.createdAt,
        s.lastUsedAt,
        s.revokedAt,
      ],
    );
  }

  private toAggregate(row: Row): PasskeyCredential {
    return PasskeyCredential.reconstitute({
      id: toPasskeyCredentialId(row.id),
      userId: toUserId(row.user_id),
      credentialId: CredentialId.fromBase64Url(row.credential_id),
      publicKey: row.public_key,
      signCount: Number(row.sign_count),
      transports: row.transports,
      aaguid: row.aaguid,
      backupEligible: row.backup_eligible,
      backupState: row.backup_state,
      label: row.label,
      deviceId: row.device_id === null ? null : toDeviceId(row.device_id),
      createdAt: row.created_at,
      lastUsedAt: row.last_used_at,
      revokedAt: row.revoked_at,
    });
  }
}
