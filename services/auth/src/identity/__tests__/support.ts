import { RegisterUser } from '../application/register-user';
import { DefaultPasswordPolicy } from '../domain/value-objects/password-policy';
import { DefaultSessionPolicy, type SessionPolicy } from '../domain/value-objects/session-policy';
import {
  DefaultVerificationPolicy,
  type VerificationPolicy,
} from '../domain/value-objects/verification-policy';
import { InMemoryUserRepository } from '../infrastructure/in-memory-user-repository';
import { InMemorySessionRepository } from '../infrastructure/in-memory-session-repository';
import { InMemoryVerificationTokenRepository } from '../infrastructure/in-memory-verification-token-repository';
import { InMemoryEventPublisher } from '../infrastructure/in-memory-event-publisher';
import { ScryptPasswordHasher } from '../infrastructure/scrypt-password-hasher';
import { Sha256TokenHasher } from '../infrastructure/sha256-token-hasher';
import { HmacTokenHasher } from '../infrastructure/hmac-token-hasher';
import { RandomTokenGenerator } from '../infrastructure/random-token-generator';
import { UuidIdGenerator } from '../infrastructure/uuid-id-generator';
import { FakeClock } from './fake-clock';

export { FakeClock } from './fake-clock';

export const STRONG_PASSWORD = 'Sup3rSecret-Pw!';
export const OTHER_STRONG_PASSWORD = 'An0ther-Str0ng-Pw!';

export interface SessionFixture {
  users: InMemoryUserRepository;
  sessions: InMemorySessionRepository;
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
    events,
    tokens: new RandomTokenGenerator(),
    tokenHasher: new Sha256TokenHasher(),
    ids,
    clock,
    policy: options.policy ?? new DefaultSessionPolicy(),
    userId: registered.value.id,
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
