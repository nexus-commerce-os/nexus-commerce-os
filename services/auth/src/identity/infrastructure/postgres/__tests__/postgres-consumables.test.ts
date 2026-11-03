import { describe, it, expect, beforeAll, afterAll, beforeEach } from 'vitest';
import { join } from 'node:path';
import { Pool } from 'pg';
import { PostgreSqlContainer, type StartedPostgreSqlContainer } from '@testcontainers/postgresql';
import { MigrationRunner } from '../migration-runner';
import { PostgresUserRepository } from '../postgres-user-repository';
import { PostgresVerificationTokenRepository } from '../postgres-verification-token-repository';
import { PostgresWebAuthnChallengeRepository } from '../postgres-webauthn-challenge-repository';
import { PostgresOAuthAuthorizationRequestRepository } from '../postgres-oauth-authorization-request-repository';
import { PostgresPasskeyCredentialRepository } from '../postgres-passkey-credential-repository';
import { PostgresDeviceRepository } from '../postgres-device-repository';
import { PostgresFederatedIdentityRepository } from '../postgres-federated-identity-repository';
import { ConcurrentModificationError } from '../concurrency';
import { User } from '../../../domain/entities/user';
import { Profile } from '../../../domain/entities/profile';
import { PasswordCredential } from '../../../domain/entities/password-credential';
import { VerificationToken } from '../../../domain/entities/verification-token';
import { WebAuthnChallenge } from '../../../domain/entities/webauthn-challenge';
import { OAuthAuthorizationRequest } from '../../../domain/entities/oauth-authorization-request';
import { PasskeyCredential } from '../../../domain/entities/passkey-credential';
import { Device } from '../../../domain/entities/device';
import { FederatedIdentity } from '../../../domain/entities/federated-identity';
import { Email } from '../../../domain/value-objects/email';
import { PasswordHash } from '../../../domain/value-objects/password-hash';
import { TokenHash } from '../../../domain/value-objects/token-hash';
import { CredentialId } from '../../../domain/value-objects/credential-id';
import { OidcProvider } from '../../../domain/value-objects/oidc-provider';
import { toUserId } from '../../../domain/value-objects/user-id';
import { toVerificationTokenId } from '../../../domain/value-objects/verification-token-id';
import { toWebAuthnChallengeId } from '../../../domain/value-objects/webauthn-challenge-id';
import { toOAuthRequestId } from '../../../domain/value-objects/oauth-request-id';
import { toPasskeyCredentialId } from '../../../domain/value-objects/passkey-credential-id';
import { toDeviceId } from '../../../domain/value-objects/device-id';
import { toFederatedIdentityId } from '../../../domain/value-objects/federated-identity-id';
import { DefaultVerificationPolicy } from '../../../domain/value-objects/verification-policy';
import { DefaultWebAuthnPolicy } from '../../../domain/value-objects/webauthn-policy';
import { DefaultOidcPolicy } from '../../../domain/value-objects/oidc-policy';

const PG_TESTS_ENABLED = process.env['NEXUS_PG_TESTS'] === '1';
const MIGRATIONS_DIR = join(__dirname, '..', '..', '..', '..', '..', 'migrations');
const CONTAINER_TIMEOUT_MS = 180_000;

const START = new Date('2026-01-01T00:00:00.000Z');
const at = (ms: number): Date => new Date(START.getTime() + ms);

const USER = '11111111-1111-4111-8111-111111111111';
const GOOGLE = OidcProvider.fromSlug('google');

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

describe.skipIf(!PG_TESTS_ENABLED)('Postgres identity adapters (part 2)', () => {
  let container: StartedPostgreSqlContainer;
  let pool: Pool;
  let users: PostgresUserRepository;
  let tokens: PostgresVerificationTokenRepository;
  let challenges: PostgresWebAuthnChallengeRepository;
  let oauthRequests: PostgresOAuthAuthorizationRequestRepository;
  let passkeys: PostgresPasskeyCredentialRepository;
  let devices: PostgresDeviceRepository;
  let federated: PostgresFederatedIdentityRepository;

  beforeAll(async () => {
    container = await new PostgreSqlContainer('postgres:16-alpine').start();
    pool = new Pool({ connectionString: container.getConnectionUri() });
    await new MigrationRunner(pool, MIGRATIONS_DIR).migrate();
    users = new PostgresUserRepository(pool);
    tokens = new PostgresVerificationTokenRepository(pool);
    challenges = new PostgresWebAuthnChallengeRepository(pool);
    oauthRequests = new PostgresOAuthAuthorizationRequestRepository(pool);
    passkeys = new PostgresPasskeyCredentialRepository(pool);
    devices = new PostgresDeviceRepository(pool);
    federated = new PostgresFederatedIdentityRepository(pool);
  }, CONTAINER_TIMEOUT_MS);

  afterAll(async () => {
    await pool?.end();
    await container?.stop();
  }, CONTAINER_TIMEOUT_MS);

  beforeEach(async () => {
    await pool.query('TRUNCATE identity.user_account CASCADE');
    await users.save(
      User.register({
        id: toUserId(USER),
        email: email('jane@example.com'),
        credential: PasswordCredential.fromHash(PasswordHash.fromEncoded('scrypt$s$h'), START),
        profile: profile(),
        residencyRegion: 'us-east-1',
        now: START,
      }),
    );
  });

  // ── verification token ────────────────────────────────────────────────────
  describe('PostgresVerificationTokenRepository', () => {
    const ID = '22222222-2222-4222-8222-222222222222';

    const build = (hash: string, id = ID): VerificationToken =>
      VerificationToken.issue({
        id: toVerificationTokenId(id),
        userId: toUserId(USER),
        purpose: 'password_reset',
        email: email('jane@example.com'),
        tokenHash: TokenHash.fromHex(hash),
        policy: new DefaultVerificationPolicy(),
        now: START,
      });

    it('round-trips and finds by hash, latest-pending and pending list', async () => {
      await tokens.save(build('h1'));
      const found = await tokens.findByTokenHash(TokenHash.fromHex('h1'));
      expect(found?.purpose).toBe('password_reset');
      expect(found?.email.value).toBe('jane@example.com');

      expect(await tokens.listPending(toUserId(USER), 'password_reset')).toHaveLength(1);
      expect(await tokens.findLatestPending(toUserId(USER), 'password_reset')).not.toBeNull();
      expect(await tokens.findLatestPending(toUserId(USER), 'email_verification')).toBeNull();
    });

    it('persists a consume and stops listing it as pending', async () => {
      const token = build('h1');
      await tokens.save(token);
      token.consume('password_reset', email('jane@example.com'), at(1000));
      await tokens.save(token);

      const found = await tokens.findByTokenHash(TokenHash.fromHex('h1'));
      expect(found?.status).toBe('consumed');
      expect(await tokens.listPending(toUserId(USER), 'password_reset')).toHaveLength(0);
    });

    // the whole point of I-6: single-use has to hold ACROSS processes
    it('lets only one of two concurrent consumes win', async () => {
      await tokens.save(build('h1'));

      const first = await tokens.findByTokenHash(TokenHash.fromHex('h1'));
      const second = await tokens.findByTokenHash(TokenHash.fromHex('h1'));
      expect(first?.isPending() && second?.isPending()).toBe(true);

      first?.consume('password_reset', email('jane@example.com'), at(1000));
      second?.consume('password_reset', email('jane@example.com'), at(1000));

      const results = await Promise.allSettled([
        tokens.save(first as VerificationToken),
        tokens.save(second as VerificationToken),
      ]);
      const rejected = results.filter((r) => r.status === 'rejected');
      expect(results.filter((r) => r.status === 'fulfilled')).toHaveLength(1);
      expect(rejected).toHaveLength(1);
      expect((rejected[0] as PromiseRejectedResult).reason).toBeInstanceOf(
        ConcurrentModificationError,
      );
    });

    it('rejects a duplicate token hash at the database level', async () => {
      await tokens.save(build('same'));
      await expect(
        tokens.save(build('same', '33333333-3333-4333-8333-333333333333')),
      ).rejects.toThrow();
    });
  });

  // ── webauthn challenge ────────────────────────────────────────────────────
  describe('PostgresWebAuthnChallengeRepository', () => {
    const ID = '44444444-4444-4444-8444-444444444444';

    const build = (hash: string, userId: string | null = USER): WebAuthnChallenge =>
      WebAuthnChallenge.issue({
        id: toWebAuthnChallengeId(ID),
        userId: userId === null ? null : toUserId(userId),
        ceremony: 'authentication',
        challengeHash: TokenHash.fromHex(hash),
        policy: new DefaultWebAuthnPolicy(),
        now: START,
      });

    it('round-trips, including an unbound (discoverable) challenge', async () => {
      await challenges.save(build('c1', null));
      const found = await challenges.findByChallengeHash(TokenHash.fromHex('c1'));
      expect(found?.userId).toBeNull();
      expect(found?.ceremony).toBe('authentication');
    });

    it('lists pending per ceremony and drops them once consumed', async () => {
      await challenges.save(build('c1'));
      expect(await challenges.listPending(toUserId(USER), 'authentication')).toHaveLength(1);
      expect(await challenges.listPending(toUserId(USER), 'registration')).toHaveLength(0);

      const challenge = await challenges.findByChallengeHash(TokenHash.fromHex('c1'));
      challenge?.consume('authentication', toUserId(USER), at(1000));
      await challenges.save(challenge as WebAuthnChallenge);
      expect(await challenges.listPending(toUserId(USER), 'authentication')).toHaveLength(0);
    });

    it('lets only one of two concurrent consumes win', async () => {
      await challenges.save(build('c1'));
      const a = await challenges.findByChallengeHash(TokenHash.fromHex('c1'));
      const b = await challenges.findByChallengeHash(TokenHash.fromHex('c1'));
      a?.consume('authentication', toUserId(USER), at(1000));
      b?.consume('authentication', toUserId(USER), at(1000));

      const results = await Promise.allSettled([
        challenges.save(a as WebAuthnChallenge),
        challenges.save(b as WebAuthnChallenge),
      ]);
      expect(results.filter((r) => r.status === 'fulfilled')).toHaveLength(1);
    });
  });

  // ── oauth authorization request ───────────────────────────────────────────
  describe('PostgresOAuthAuthorizationRequestRepository', () => {
    const ID = '55555555-5555-4555-8555-555555555555';

    const build = (stateHash: string): OAuthAuthorizationRequest =>
      OAuthAuthorizationRequest.start({
        id: toOAuthRequestId(ID),
        provider: GOOGLE,
        stateHash: TokenHash.fromHex(stateHash),
        nonce: 'nonce-value',
        codeVerifier: 'verifier-value',
        redirectUri: 'https://nexus.example/callback',
        userId: toUserId(USER),
        policy: new DefaultOidcPolicy(),
        now: START,
      });

    it('round-trips the ceremony secrets the callback needs', async () => {
      await oauthRequests.save(build('s1'));
      const found = await oauthRequests.findByStateHash(TokenHash.fromHex('s1'));
      expect(found?.nonce).toBe('nonce-value');
      expect(found?.codeVerifier).toBe('verifier-value');
      expect(found?.provider.value).toBe('google');
      expect(found?.isLinkFlow()).toBe(true);
    });

    it('lets only one of two concurrent callbacks win', async () => {
      await oauthRequests.save(build('s1'));
      const a = await oauthRequests.findByStateHash(TokenHash.fromHex('s1'));
      const b = await oauthRequests.findByStateHash(TokenHash.fromHex('s1'));
      a?.consume(GOOGLE, at(1000));
      b?.consume(GOOGLE, at(1000));

      const results = await Promise.allSettled([
        oauthRequests.save(a as OAuthAuthorizationRequest),
        oauthRequests.save(b as OAuthAuthorizationRequest),
      ]);
      expect(results.filter((r) => r.status === 'fulfilled')).toHaveLength(1);
    });

    it('rejects a duplicate state hash at the database level', async () => {
      await oauthRequests.save(build('s1'));
      const clash = OAuthAuthorizationRequest.start({
        id: toOAuthRequestId('66666666-6666-4666-8666-666666666666'),
        provider: GOOGLE,
        stateHash: TokenHash.fromHex('s1'),
        nonce: 'n',
        codeVerifier: 'v',
        redirectUri: 'https://nexus.example/callback',
        userId: null,
        policy: new DefaultOidcPolicy(),
        now: START,
      });
      await expect(oauthRequests.save(clash)).rejects.toThrow();
    });
  });

  // ── device + passkey ──────────────────────────────────────────────────────
  describe('PostgresDeviceRepository and PostgresPasskeyCredentialRepository', () => {
    const DEVICE = '77777777-7777-4777-8777-777777777777';
    const PASSKEY = '88888888-8888-4888-8888-888888888888';

    const buildDevice = (): Device =>
      Device.register({
        id: toDeviceId(DEVICE),
        userId: toUserId(USER),
        label: 'Jane iPhone',
        platform: 'iOS',
        now: START,
      });

    const buildPasskey = (credentialId: string, id = PASSKEY): PasskeyCredential =>
      PasskeyCredential.register({
        id: toPasskeyCredentialId(id),
        userId: toUserId(USER),
        credentialId: CredentialId.fromBase64Url(credentialId),
        publicKey: 'cose-key',
        signCount: 0,
        transports: ['internal', 'hybrid'],
        aaguid: '00000000-0000-0000-0000-000000000000',
        backupEligible: true,
        backupState: false,
        label: 'Phone',
        deviceId: toDeviceId(DEVICE),
        now: START,
      });

    beforeEach(async () => {
      await devices.save(buildDevice());
    });

    it('round-trips a device and persists trust transitions', async () => {
      const device = await devices.findById(toDeviceId(DEVICE));
      expect(device?.trustState).toBe('UNKNOWN');
      device?.trust(at(1000));
      await devices.save(device as Device);

      const trusted = await devices.findById(toDeviceId(DEVICE));
      expect(trusted?.trustState).toBe('TRUSTED');
      expect(trusted?.lastSeenAt).toEqual(at(1000));
      expect(await devices.listByUser(toUserId(USER))).toHaveLength(1);
    });

    it('round-trips a passkey including its transports array and counter', async () => {
      await passkeys.save(buildPasskey('cred-AAAA'));
      const found = await passkeys.findByCredentialId(CredentialId.fromBase64Url('cred-AAAA'));
      expect(found?.transports).toEqual(['internal', 'hybrid']);
      expect(found?.signCount).toBe(0);
      expect(found?.deviceId).toBe(DEVICE);
      expect(await passkeys.listByDevice(toDeviceId(DEVICE))).toHaveLength(1);
    });

    it('persists an advanced counter and a revocation', async () => {
      await passkeys.save(buildPasskey('cred-AAAA'));
      const passkey = await passkeys.findByCredentialId(CredentialId.fromBase64Url('cred-AAAA'));
      passkey?.recordAuthentication(9007199254740991, at(1000));
      await passkeys.save(passkey as PasskeyCredential);

      const used = await passkeys.findById(toPasskeyCredentialId(PASSKEY));
      expect(used?.signCount).toBe(9007199254740991);
      expect(await passkeys.countActiveByUser(toUserId(USER))).toBe(1);

      used?.revoke(at(2000));
      await passkeys.save(used as PasskeyCredential);
      expect(await passkeys.countActiveByUser(toUserId(USER))).toBe(0);
    });

    it('rejects a duplicate authenticator id at the database level', async () => {
      await passkeys.save(buildPasskey('cred-AAAA'));
      await expect(
        passkeys.save(buildPasskey('cred-AAAA', '99999999-9999-4999-8999-999999999999')),
      ).rejects.toThrow();
    });
  });

  // ── federated identity ────────────────────────────────────────────────────
  describe('PostgresFederatedIdentityRepository', () => {
    const ID = 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa';

    const build = (subject: string, id = ID): FederatedIdentity =>
      FederatedIdentity.link({
        id: toFederatedIdentityId(id),
        userId: toUserId(USER),
        provider: GOOGLE,
        subject,
        emailAtLink: 'jane@example.com',
        now: START,
      });

    it('round-trips and resolves by (provider, subject)', async () => {
      await federated.save(build('sub-1'));
      const found = await federated.findByProviderSubject(GOOGLE, 'sub-1');
      expect(found?.userId).toBe(USER);
      expect(found?.emailAtLink).toBe('jane@example.com');
      expect(await federated.findByProviderSubject(GOOGLE, 'sub-other')).toBeNull();
      expect(await federated.countActiveByUser(toUserId(USER))).toBe(1);
    });

    it('refuses to attach one provider account to two NEXUS accounts', async () => {
      await federated.save(build('sub-1'));
      await expect(
        federated.save(build('sub-1', 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb')),
      ).rejects.toThrow();
    });

    it('keeps the uniqueness even after the link is revoked', async () => {
      const identity = build('sub-1');
      await federated.save(identity);
      identity.revoke(at(1000));
      await federated.save(identity);
      expect(await federated.countActiveByUser(toUserId(USER))).toBe(0);

      await expect(
        federated.save(build('sub-1', 'cccccccc-cccc-4ccc-8ccc-cccccccccccc')),
      ).rejects.toThrow();
    });

    it('records use and lists per user', async () => {
      const identity = build('sub-1');
      await federated.save(identity);
      identity.recordUse(at(5000));
      await federated.save(identity);

      const list = await federated.listByUser(toUserId(USER));
      expect(list).toHaveLength(1);
      expect(list[0].lastUsedAt).toEqual(at(5000));
    });
  });
});
