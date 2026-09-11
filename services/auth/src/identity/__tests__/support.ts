import { RegisterUser } from '../application/register-user';
import { toUserId } from '../domain/value-objects/user-id';
import { DefaultPasswordPolicy } from '../domain/value-objects/password-policy';
import { DefaultSessionPolicy, type SessionPolicy } from '../domain/value-objects/session-policy';
import {
  DefaultVerificationPolicy,
  type VerificationPolicy,
} from '../domain/value-objects/verification-policy';
import {
  DefaultWebAuthnPolicy,
  type WebAuthnPolicy,
} from '../domain/value-objects/webauthn-policy';
import { ok } from '../../kernel/result';
import { InMemoryUserRepository } from '../infrastructure/in-memory-user-repository';
import { InMemoryWebAuthnChallengeRepository } from '../infrastructure/in-memory-webauthn-challenge-repository';
import { InMemoryPasskeyCredentialRepository } from '../infrastructure/in-memory-passkey-credential-repository';
import { InMemoryDeviceRepository } from '../infrastructure/in-memory-device-repository';
import { InMemoryFederatedIdentityRepository } from '../infrastructure/in-memory-federated-identity-repository';
import {
  StubWebAuthnVerifier,
  verifiedRegistration,
  verifiedAuthentication,
} from './webauthn-doubles';
import { InMemorySessionRepository } from '../infrastructure/in-memory-session-repository';
import { InMemoryVerificationTokenRepository } from '../infrastructure/in-memory-verification-token-repository';
import { InMemoryEventPublisher } from '../infrastructure/in-memory-event-publisher';
import { ScryptPasswordHasher } from '../infrastructure/scrypt-password-hasher';
import { Sha256TokenHasher } from '../infrastructure/sha256-token-hasher';
import { HmacTokenHasher } from '../infrastructure/hmac-token-hasher';
import { RandomTokenGenerator } from '../infrastructure/random-token-generator';
import { UuidIdGenerator } from '../infrastructure/uuid-id-generator';
import { StubOidcTokenExchanger, StubOidcTokenVerifier, verifiedIdToken } from './oidc-doubles';
import { DefaultOidcPolicy, type OidcPolicy } from '../domain/value-objects/oidc-policy';
import { InMemoryOAuthAuthorizationRequestRepository } from '../infrastructure/in-memory-oauth-authorization-request-repository';
import { FakeClock } from './fake-clock';

export { FakeClock } from './fake-clock';

export const STRONG_PASSWORD = 'Sup3rSecret-Pw!';
export const OTHER_STRONG_PASSWORD = 'An0ther-Str0ng-Pw!';

export interface SessionFixture {
  users: InMemoryUserRepository;
  sessions: InMemorySessionRepository;
  devices: InMemoryDeviceRepository;
  events: InMemoryEventPublisher;
  tokens: RandomTokenGenerator;
  tokenHasher: Sha256TokenHasher;
  ids: UuidIdGenerator;
  clock: FakeClock;
  policy: SessionPolicy;
  userId: string;
}

/**
 * Wire the session use cases against real in-memory adapters and register one
 * active user, returning the collaborators the session suites share. Keeps the
 * per-suite setup to a single call instead of repeating the graph four times.
 */
export async function buildSessionFixture(
  options: { now?: Date; policy?: SessionPolicy } = {},
): Promise<SessionFixture> {
  const clock = new FakeClock(options.now ?? new Date('2026-01-01T00:00:00.000Z'));
  const users = new InMemoryUserRepository();
  const sessions = new InMemorySessionRepository();
  const events = new InMemoryEventPublisher();
  const ids = new UuidIdGenerator();

  const registered = await new RegisterUser({
    users,
    hasher: new ScryptPasswordHasher(),
    policy: new DefaultPasswordPolicy(),
    ids,
    clock,
    events,
  }).execute({ email: 'jane@example.com', password: STRONG_PASSWORD, displayName: 'Jane' });

  if (!registered.ok) {
    throw new Error('fixture invariant broken: user registration failed');
  }
  events.drain();

  return {
    users,
    sessions,
    devices: new InMemoryDeviceRepository(),
    events,
    tokens: new RandomTokenGenerator(),
    tokenHasher: new Sha256TokenHasher(),
    ids,
    clock,
    policy: options.policy ?? new DefaultSessionPolicy(),
    userId: registered.value.id,
  };
}

export interface PasskeyFixture {
  users: InMemoryUserRepository;
  challenges: InMemoryWebAuthnChallengeRepository;
  passkeys: InMemoryPasskeyCredentialRepository;
  devices: InMemoryDeviceRepository;
  federatedIdentities: InMemoryFederatedIdentityRepository;
  events: InMemoryEventPublisher;
  secrets: RandomTokenGenerator;
  tokenHasher: HmacTokenHasher;
  verifier: StubWebAuthnVerifier;
  webauthnPolicy: WebAuthnPolicy;
  ids: UuidIdGenerator;
  clock: FakeClock;
  userId: string;
  email: string;
}

/**
 * Wire the passkey/device use cases against real in-memory adapters plus the
 * WebAuthn verifier double, and register one active user. Shared by the I-4
 * suites so the object graph is built in exactly one place.
 */
export async function buildPasskeyFixture(
  options: { now?: Date; webauthnPolicy?: WebAuthnPolicy } = {},
): Promise<PasskeyFixture> {
  const clock = new FakeClock(options.now ?? new Date('2026-01-01T00:00:00.000Z'));
  const users = new InMemoryUserRepository();
  const events = new InMemoryEventPublisher();
  const ids = new UuidIdGenerator();

  const registered = await new RegisterUser({
    users,
    hasher: new ScryptPasswordHasher(),
    policy: new DefaultPasswordPolicy(),
    ids,
    clock,
    events,
  }).execute({ email: 'jane@example.com', password: STRONG_PASSWORD, displayName: 'Jane' });

  if (!registered.ok) {
    throw new Error('fixture invariant broken: user registration failed');
  }
  events.drain();

  return {
    users,
    challenges: new InMemoryWebAuthnChallengeRepository(),
    passkeys: new InMemoryPasskeyCredentialRepository(),
    devices: new InMemoryDeviceRepository(),
    federatedIdentities: new InMemoryFederatedIdentityRepository(),
    events,
    secrets: new RandomTokenGenerator(),
    tokenHasher: new HmacTokenHasher(TEST_TOKEN_PEPPER),
    verifier: new StubWebAuthnVerifier(ok(verifiedRegistration()), ok(verifiedAuthentication())),
    webauthnPolicy: options.webauthnPolicy ?? new DefaultWebAuthnPolicy(),
    ids,
    clock,
    userId: registered.value.id,
    email: registered.value.email,
  };
}

/** Non-secret pepper used only by the test suite (see HmacTokenHasher). */
export const TEST_TOKEN_PEPPER = 'test-only-pepper-not-a-real-secret-000000';

export interface VerificationFixture {
  users: InMemoryUserRepository;
  tokens: InMemoryVerificationTokenRepository;
  events: InMemoryEventPublisher;
  secrets: RandomTokenGenerator;
  tokenHasher: HmacTokenHasher;
  hasher: ScryptPasswordHasher;
  policy: VerificationPolicy;
  passwordPolicy: DefaultPasswordPolicy;
  ids: UuidIdGenerator;
  clock: FakeClock;
  userId: string;
  email: string;
}

/**
 * Wire the verification/reset use cases against real in-memory adapters and
 * register one active, unverified user. Shared by the I-3 suites so the object
 * graph is built in exactly one place.
 */
export async function buildVerificationFixture(
  options: { now?: Date; policy?: VerificationPolicy } = {},
): Promise<VerificationFixture> {
  const clock = new FakeClock(options.now ?? new Date('2026-01-01T00:00:00.000Z'));
  const users = new InMemoryUserRepository();
  const tokens = new InMemoryVerificationTokenRepository();
  const events = new InMemoryEventPublisher();
  const ids = new UuidIdGenerator();
  const hasher = new ScryptPasswordHasher();
  const passwordPolicy = new DefaultPasswordPolicy();

  const registered = await new RegisterUser({
    users,
    hasher,
    policy: passwordPolicy,
    ids,
    clock,
    events,
  }).execute({ email: 'jane@example.com', password: STRONG_PASSWORD, displayName: 'Jane' });

  if (!registered.ok) {
    throw new Error('fixture invariant broken: user registration failed');
  }
  events.drain();

  return {
    users,
    tokens,
    events,
    secrets: new RandomTokenGenerator(),
    tokenHasher: new HmacTokenHasher(TEST_TOKEN_PEPPER),
    hasher,
    policy: options.policy ?? new DefaultVerificationPolicy(),
    passwordPolicy,
    ids,
    clock,
    userId: registered.value.id,
    email: registered.value.email,
  };
}

export interface OidcFixture {
  users: InMemoryUserRepository;
  devices: InMemoryDeviceRepository;
  oauthRequests: InMemoryOAuthAuthorizationRequestRepository;
  federatedIdentities: InMemoryFederatedIdentityRepository;
  passkeys: InMemoryPasskeyCredentialRepository;
  events: InMemoryEventPublisher;
  secrets: RandomTokenGenerator;
  tokenHasher: HmacTokenHasher;
  exchanger: StubOidcTokenExchanger;
  verifier: StubOidcTokenVerifier;
  oidcPolicy: OidcPolicy;
  ids: UuidIdGenerator;
  clock: FakeClock;
  /** A password-registered account, present only when `withLocalUser` is set. */
  userId: string | null;
  email: string;
}

/**
 * Wire the OIDC use cases against real in-memory adapters plus the provider
 * doubles. By default there is **no** local account, which is the plain
 * federated sign-up path; pass `withLocalUser` to exercise linking against an
 * existing password account.
 */
export async function buildOidcFixture(
  options: {
    now?: Date;
    oidcPolicy?: OidcPolicy;
    withLocalUser?: boolean;
    localEmailVerified?: boolean;
  } = {},
): Promise<OidcFixture> {
  const clock = new FakeClock(options.now ?? new Date('2026-01-01T00:00:00.000Z'));
  const users = new InMemoryUserRepository();
  const events = new InMemoryEventPublisher();
  const ids = new UuidIdGenerator();
  const email = 'jane@example.com';

  let userId: string | null = null;
  if (options.withLocalUser === true) {
    const registered = await new RegisterUser({
      users,
      hasher: new ScryptPasswordHasher(),
      policy: new DefaultPasswordPolicy(),
      ids,
      clock,
      events,
    }).execute({ email, password: STRONG_PASSWORD, displayName: 'Jane' });
    if (!registered.ok) {
      throw new Error('fixture invariant broken: user registration failed');
    }
    userId = registered.value.id;

    if (options.localEmailVerified === true) {
      const user = await users.findById(toUserId(userId));
      user?.verifyEmail(clock.now());
      if (user) {
        await users.save(user);
        user.pullEvents();
      }
    }
    events.drain();
  }

  return {
    users,
    devices: new InMemoryDeviceRepository(),
    oauthRequests: new InMemoryOAuthAuthorizationRequestRepository(),
    federatedIdentities: new InMemoryFederatedIdentityRepository(),
    passkeys: new InMemoryPasskeyCredentialRepository(),
    events,
    secrets: new RandomTokenGenerator(),
    tokenHasher: new HmacTokenHasher(TEST_TOKEN_PEPPER),
    exchanger: new StubOidcTokenExchanger(),
    verifier: new StubOidcTokenVerifier(verifiedIdToken()),
    oidcPolicy: options.oidcPolicy ?? new DefaultOidcPolicy(),
    ids,
    clock,
    userId,
    email,
  };
}
