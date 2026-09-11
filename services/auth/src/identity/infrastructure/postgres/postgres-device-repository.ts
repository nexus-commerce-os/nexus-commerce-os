import type { Pool, QueryResultRow } from 'pg';
import { Device } from '../../domain/entities/device';
import type { DeviceTrustState } from '../../domain/value-objects/device-trust-state';
import { toDeviceId, type DeviceId } from '../../domain/value-objects/device-id';
import { toUserId, type UserId } from '../../domain/value-objects/user-id';
import type { DeviceRepository } from '../../domain/ports/device-repository';

interface Row extends QueryResultRow {
  id: string;
  user_id: string;
  label: string;
  platform: string;
  trust_state: string;
  first_seen_at: Date;
  last_seen_at: Date;
  revoked_at: Date | null;
}

/**
 * Postgres adapter for {@link DeviceRepository}.
 *
 * A plain upsert: a device has no single-use transition to arbitrate, and its
 * own aggregate refuses to un-revoke itself, so last-writer-wins is safe here.
 * The table deliberately carries no network, geo or audit columns — that data
 * belongs to the Audit context.
 */
export class PostgresDeviceRepository implements DeviceRepository {
  constructor(private readonly pool: Pool) {}

  async findById(id: DeviceId): Promise<Device | null> {
    const result = await this.pool.query<Row>('SELECT * FROM identity.device WHERE id = $1', [id]);
    const row = result.rows[0];
    return row === undefined ? null : this.toAggregate(row);
  }

  async listByUser(userId: UserId): Promise<Device[]> {
    const result = await this.pool.query<Row>(
      'SELECT * FROM identity.device WHERE user_id = $1 ORDER BY first_seen_at',
      [userId],
    );
    return result.rows.map((row) => this.toAggregate(row));
  }

  async save(device: Device): Promise<void> {
    const s = device.snapshot();
    await this.pool.query(
      `INSERT INTO identity.device
         (id, user_id, label, platform, trust_state, first_seen_at, last_seen_at, revoked_at)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
       ON CONFLICT (id) DO UPDATE SET
         label        = EXCLUDED.label,
         trust_state  = EXCLUDED.trust_state,
         last_seen_at = EXCLUDED.last_seen_at,
         revoked_at   = EXCLUDED.revoked_at`,
      [
        s.id,
        s.userId,
        s.label,
        s.platform,
        s.trustState,
        s.firstSeenAt,
        s.lastSeenAt,
        s.revokedAt,
      ],
    );
  }

  private toAggregate(row: Row): Device {
    return Device.reconstitute({
      id: toDeviceId(row.id),
      userId: toUserId(row.user_id),
      label: row.label,
      platform: row.platform,
      trustState: row.trust_state as DeviceTrustState,
      firstSeenAt: row.first_seen_at,
      lastSeenAt: row.last_seen_at,
      revokedAt: row.revoked_at,
    });
  }
}
