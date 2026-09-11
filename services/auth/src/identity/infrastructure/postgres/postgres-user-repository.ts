import type { Pool, QueryResultRow } from 'pg';
import { User } from '../../domain/entities/user';
import { Profile } from '../../domain/entities/profile';
import { PasswordCredential } from '../../domain/entities/password-credential';
import { PasswordHash } from '../../domain/value-objects/password-hash';
import { Email } from '../../domain/value-objects/email';
import { toUserId, type UserId } from '../../domain/value-objects/user-id';
import type { UserRepository } from '../../domain/ports/user-repository';
import { withTransaction } from './connection';

interface UserRow extends QueryResultRow {
  id: string;
  email: string;
  email_verified: boolean;
  status: string;
  residency_region: string;
  password_hash: string | null;
  password_updated_at: Date | null;
  created_at: Date;
  updated_at: Date;
  display_name: string;
  locale: string;
}

const SELECT_USER = `
  SELECT u.id, u.email, u.email_verified, u.status, u.residency_region,
         u.password_hash, u.password_updated_at, u.created_at, u.updated_at,
         p.display_name, p.locale
    FROM identity.user_account u
    JOIN identity.profile p ON p.user_id = u.id
`;

/**
 * Postgres adapter for {@link UserRepository}.
 *
 * The aggregate spans two tables (`user_account` + `profile`), so `save` writes
 * both inside one transaction — the aggregate is never half-persisted. Email
 * uniqueness is the database's job: `user_account_email_uk` indexes
 * `lower(email)`, matching the case-insensitive equality the `Email` value
 * object already guarantees.
 */
export class PostgresUserRepository implements UserRepository {
  constructor(private readonly pool: Pool) {}

  async findById(id: UserId): Promise<User | null> {
    const result = await this.pool.query<UserRow>(`${SELECT_USER} WHERE u.id = $1`, [id]);
    return this.toAggregate(result.rows[0]);
  }

  async findByEmail(email: Email): Promise<User | null> {
    const result = await this.pool.query<UserRow>(`${SELECT_USER} WHERE lower(u.email) = $1`, [
      email.value,
    ]);
    return this.toAggregate(result.rows[0]);
  }

  async existsByEmail(email: Email): Promise<boolean> {
    const result = await this.pool.query(
      'SELECT 1 FROM identity.user_account WHERE lower(email) = $1',
      [email.value],
    );
    return (result.rowCount ?? 0) > 0;
  }

  async save(user: User): Promise<void> {
    const snapshot = user.snapshot();
    const credential = user.credential;
    await withTransaction(this.pool, async (tx) => {
      await tx.query(
        `INSERT INTO identity.user_account
           (id, email, email_verified, status, residency_region,
            password_hash, password_updated_at, created_at, updated_at)
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)
         ON CONFLICT (id) DO UPDATE SET
           email               = EXCLUDED.email,
           email_verified      = EXCLUDED.email_verified,
           status              = EXCLUDED.status,
           password_hash       = EXCLUDED.password_hash,
           password_updated_at = EXCLUDED.password_updated_at,
           updated_at          = EXCLUDED.updated_at`,
        [
          snapshot.id,
          snapshot.email,
          snapshot.emailVerified,
          snapshot.status,
          snapshot.residencyRegion,
          credential === null ? null : credential.hash.encoded,
          credential === null ? null : credential.updatedAt,
          snapshot.createdAt,
          snapshot.updatedAt,
        ],
      );
      await tx.query(
        `INSERT INTO identity.profile (user_id, display_name, locale)
         VALUES ($1, $2, $3)
         ON CONFLICT (user_id) DO UPDATE SET
           display_name = EXCLUDED.display_name,
           locale       = EXCLUDED.locale`,
        [snapshot.id, snapshot.displayName, snapshot.locale],
      );
    });
  }

  private toAggregate(row: UserRow | undefined): User | null {
    if (row === undefined) {
      return null;
    }
    const email = Email.create(row.email);
    if (!email.ok) {
      throw new Error(`Corrupt row: user ${row.id} has an unparseable email.`);
    }
    return User.reconstitute({
      id: toUserId(row.id),
      email: email.value,
      emailVerified: row.email_verified,
      status: row.status === 'deactivated' ? 'deactivated' : 'active',
      residencyRegion: row.residency_region,
      profile: Profile.reconstitute({ displayName: row.display_name, locale: row.locale }),
      credential:
        row.password_hash === null || row.password_updated_at === null
          ? null
          : PasswordCredential.fromHash(
              PasswordHash.fromEncoded(row.password_hash),
              row.password_updated_at,
            ),
      createdAt: row.created_at,
      updatedAt: row.updated_at,
    });
  }
}
