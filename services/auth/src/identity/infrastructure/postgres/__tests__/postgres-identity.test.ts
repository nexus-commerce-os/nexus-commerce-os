import { describe, it, expect, beforeAll, afterAll, beforeEach } from 'vitest';
import { join } from 'node:path';
import { Pool } from 'pg';
import { PostgreSqlContainer, type StartedPostgreSqlContainer } from '@testcontainers/postgresql';
import { MigrationRunner } from '../migration-runner';
import { PostgresUserRepository } from '../postgres-user-repository';
import { PostgresSessionRepository } from '../postgres-session-repository';
import { User } from '../../../domain/entities/user';
import { Profile } from '../../../domain/entities/profile';
import { PasswordCredential } from '../../../domain/entities/password-credential';
import { Session } from '../../../domain/entities/session';
import { Email } from '../../../domain/value-objects/email';
import { PasswordHash } from '../../../domain/value-objects/password-hash';
import { TokenHash } from '../../../domain/value-objects/token-hash';
import { toUserId } from '../../../domain/value-objects/user-id';
import { toSessionId } from '../../../domain/value-objects/session-id';
import { DefaultSessionPolicy } from '../../../domain/value-objects/session-policy';

/**
 * These exercise the guarantees the in-memory adapters cannot provide — real
 * unique indexes and real concurrent behaviour — so they need a real database.
 *
 * They are **enforced in CI** (`NEXUS_PG_TESTS=1`) and skipped on a workstation
 * without Docker, with the reason printed rather than silently passing.
 */
const PG_TESTS_ENABLED = process.env['NEXUS_PG_TESTS'] === '1';
const MIGRATIONS_DIR = join(__dirname, '..', '..', '..', '..', '..', 'migrations');
const CONTAINER_TIMEOUT_MS = 180_000;

const START = new Date('2026-01-01T00:00:00.000Z');
const at = (ms: number): Date => new Date(START.getTime() + ms);

function email(raw: string): Email {
  const parsed = Email.create(raw);
  if (!parsed.ok) {
    throw new Error('fixture invariant broken');
  }
  return parsed.value;
}

function profile(): Profile {
  const created = Profile.create({ displayName: 'Jane', locale: 'en-US' });
  if (!created.ok) {
    throw new Error('fixture invariant broken');
  }
  return created.value;
}

function credential(encoded = 'scrypt$salt$hash'): PasswordCredential {
  return PasswordCredential.fromHash(PasswordHash.fromEncoded(encoded), START);
}

function buildUser(id: string, address: string, withPassword = true): User {
  if (!withPassword) {
    return User.registerFederated({
      id: toUserId(id),
      email: email(address),
      profile: profile(),
      residencyRegion: 'us-east-1',
      provider: 'google',
      emailVerified: true,
      now: START,
    });
  }
  return User.register({
    id: toUserId(id),
    email: email(address),
    credential: credential(),
    profile: profile(),
    residencyRegion: 'us-east-1',
    now: START,
  });
}

describe.skipIf(!PG_TESTS_ENABLED)('Postgres identity adapters', () => {
  let container: StartedPostgreSqlContainer;
  let pool: Pool;
  let users: PostgresUserRepository;
  let sessions: PostgresSessionRepository;

  beforeAll(async () => {
    container = await new PostgreSqlContainer('postgres:16-alpine').start();
    pool = new Pool({ connectionString: container.getConnectionUri() });
    await new MigrationRunner(pool, MIGRATIONS_DIR).migrate();
    users = new PostgresUserRepository(pool);
    sessions = new PostgresSessionRepository(pool);
  }, CONTAINER_TIMEOUT_MS);

  afterAll(async () => {
    await pool?.end();
    await container?.stop();
  }, CONTAINER_TIMEOUT_MS);

  beforeEach(async () => {
    // sessions/profiles cascade from user_account
    await pool.query('TRUNCATE identity.user_account CASCADE');
  });

  // ── migrations ────────────────────────────────────────────────────────────
  describe('MigrationRunner', () => {
    it('records what it applied and is a no-op on a second run', async () => {
      const runner = new MigrationRunner(pool, MIGRATIONS_DIR);
      expect(await runner.migrate()).toEqual([]);

      const applied = await runner.applied();
      expect(applied.map((m) => m.version)).toEqual(await runner.available());
      expect(applied.length).toBeGreaterThan(0);
    });

    it('created every identity table the adapters rely on', async () => {
      const result = await pool.query<{ table_name: string }>(
        `SELECT table_name FROM information_schema.tables WHERE table_schema = 'identity'`,
      );
      const tables = result.rows.map((r) => r.table_name);
      for (const expected of [
        'user_account',
        'profile',
        'session',
        'refresh_token',
        'verification_token',
        'webauthn_challenge',
        'device',
        'passkey_credential',
        'oauth_authorization_request',
        'federated_identity',
      ]) {
        expect(tables).toContain(expected);
      }
    });

    it('created no table outside the identity schema', async () => {
      const result = await pool.query<{ count: string }>(
        `SELECT count(*)::text AS count FROM information_schema.tables
          WHERE table_schema NOT IN ('identity', 'pg_catalog', 'information_schema')`,
      );
      expect(result.rows[0]?.count).toBe('0');
    });
  });

  // ── user ──────────────────────────────────────────────────────────────────
  describe('PostgresUserRepository', () => {
    const ID = '11111111-1111-4111-8111-111111111111';

    it('round-trips a user with its profile and password', async () => {
      await users.save(buildUser(ID, 'jane@example.com'));

      const found = await users.findById(toUserId(ID));
      expect(found).not.toBeNull();
      expect(found?.email.value).toBe('jane@example.com');
      expect(found?.profile.displayName).toBe('Jane');
      expect(found?.hasPasswordFactor()).toBe(true);
      expect(found?.credential?.hash.encoded).toBe('scrypt$salt$hash');
    });

    it('round-trips a federated-only user with no password factor', async () => {
      await users.save(buildUser(ID, 'jane@example.com', false));
      const found = await users.findById(toUserId(ID));
      expect(found?.hasPasswordFactor()).toBe(false);
      expect(found?.credential).toBeNull();
      expect(found?.emailVerified).toBe(true);
    });

    it('finds by email case-insensitively, as the domain compares', async () => {
      await users.save(buildUser(ID, 'jane@example.com'));
      expect(await users.findByEmail(email('JANE@EXAMPLE.COM'))).not.toBeNull();
      expect(await users.existsByEmail(email('Jane@Example.com'))).toBe(true);
      expect(await users.existsByEmail(email('ghost@example.com'))).toBe(false);
    });

    it('lets the database reject a duplicate address', async () => {
      await users.save(buildUser(ID, 'jane@example.com'));
      const clash = buildUser('22222222-2222-4222-8222-222222222222', 'JANE@example.com');
      await expect(users.save(clash)).rejects.toThrow();
    });

    it('persists mutations without duplicating the row', async () => {
      const user = buildUser(ID, 'jane@example.com');
      await users.save(user);

      user.verifyEmail(at(1000));
      user.changePassword(credential('scrypt$s2$h2'), at(2000));
      await users.save(user);

      const found = await users.findById(toUserId(ID));
      expect(found?.emailVerified).toBe(true);
      expect(found?.credential?.hash.encoded).toBe('scrypt$s2$h2');
      const count = await pool.query('SELECT 1 FROM identity.user_account');
      expect(count.rowCount).toBe(1);
    });

    it('returns null for an unknown id', async () => {
      expect(await users.findById(toUserId('33333333-3333-4333-8333-333333333333'))).toBeNull();
    });
  });

  // ── session ───────────────────────────────────────────────────────────────
  describe('PostgresSessionRepository', () => {
    const USER = '11111111-1111-4111-8111-111111111111';
    const SESSION = '44444444-4444-4444-8444-444444444444';
    const policy = new DefaultSessionPolicy();

    beforeEach(async () => {
      await users.save(buildUser(USER, 'jane@example.com'));
    });

    function newSession(hash: string): Session {
      return Session.start({
        id: toSessionId(SESSION),
        userId: toUserId(USER),
        deviceBinding: 'device-1',
        initialTokenHash: TokenHash.fromHex(hash),
        policy,
        now: START,
      });
    }

    it('round-trips a session with its token family', async () => {
      await sessions.save(newSession('gen1'));

      const found = await sessions.findById(toSessionId(SESSION));
      expect(found?.status).toBe('active');
      expect(found?.deviceBinding).toBe('device-1');
      expect(found?.tokens.map((t) => t.hash.value)).toEqual(['gen1']);
    });

    it('resolves ANY generation by hash, which is what enables reuse detection', async () => {
      const session = newSession('gen1');
      session.rotate(TokenHash.fromHex('gen1'), TokenHash.fromHex('gen2'), policy, at(1000));
      await sessions.save(session);

      const viaOld = await sessions.findByTokenHash(TokenHash.fromHex('gen1'));
      const viaNew = await sessions.findByTokenHash(TokenHash.fromHex('gen2'));
      expect(viaOld?.id).toBe(SESSION);
      expect(viaNew?.id).toBe(SESSION);
      expect(viaOld?.tokens.map((t) => t.status)).toEqual(['consumed', 'active']);
    });

    it('persists a revocation across the whole family', async () => {
      const session = newSession('gen1');
      session.rotate(TokenHash.fromHex('gen1'), TokenHash.fromHex('gen2'), policy, at(1000));
      await sessions.save(session);

      session.revoke('reuse_detected', at(2000));
      await sessions.save(session);

      const found = await sessions.findByTokenHash(TokenHash.fromHex('gen2'));
      expect(found?.status).toBe('revoked');
      expect(found?.revocationReason).toBe('reuse_detected');
      expect(found?.tokens.every((t) => t.status !== 'active')).toBe(true);
    });

    it('lets the database reject the same token hash in two families', async () => {
      await sessions.save(newSession('shared-hash'));
      const other = Session.start({
        id: toSessionId('55555555-5555-4555-8555-555555555555'),
        userId: toUserId(USER),
        deviceBinding: null,
        initialTokenHash: TokenHash.fromHex('shared-hash'),
        policy,
        now: START,
      });
      await expect(sessions.save(other)).rejects.toThrow();
    });

    it('lists a user’s sessions and returns null for an unknown hash', async () => {
      await sessions.save(newSession('gen1'));
      expect(await sessions.listByUser(toUserId(USER))).toHaveLength(1);
      expect(await sessions.findByTokenHash(TokenHash.fromHex('never-issued'))).toBeNull();
    });
  });
});

describe('Postgres adapter suite gating', () => {
  /**
   * A skipped suite reports green, so the gate itself has to be asserted.
   *
   * This already caught one false pass: CI set `NEXUS_PG_TESTS=1`, but turbo
   * strips environment variables a task has not declared, so vitest never saw
   * it and all 14 database tests skipped inside a green build. The variable is
   * now declared in `turbo.json`, and this test makes any future regression of
   * that plumbing a hard failure instead of a silent skip.
   */
  it('runs the database tests whenever it is running in CI', () => {
    if (process.env['CI'] === 'true') {
      expect(
        PG_TESTS_ENABLED,
        'NEXUS_PG_TESTS did not reach vitest — check the turbo `test` task env allowlist',
      ).toBe(true);
    } else {
      expect(typeof PG_TESTS_ENABLED).toBe('boolean');
    }
  });
});
