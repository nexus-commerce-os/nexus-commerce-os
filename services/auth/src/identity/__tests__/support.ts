import type { Clock } from '../../kernel/clock';
import { RegisterUser } from '../application/register-user';
import { DefaultPasswordPolicy } from '../domain/value-objects/password-policy';
import { DefaultSessionPolicy, type SessionPolicy } from '../domain/value-objects/session-policy';
import { InMemoryUserRepository } from '../infrastructure/in-memory-user-repository';
import { InMemorySessionRepository } from '../infrastructure/in-memory-session-repository';
import { InMemoryEventPublisher } from '../infrastructure/in-memory-event-publisher';
import { ScryptPasswordHasher } from '../infrastructure/scrypt-password-hasher';
import { Sha256TokenHasher } from '../infrastructure/sha256-token-hasher';
import { RandomTokenGenerator } from '../infrastructure/random-token-generator';
import { UuidIdGenerator } from '../infrastructure/uuid-id-generator';

/** Deterministic clock for tests. */
export class FixedClock implements Clock {
  constructor(private current: Date) {}

  now(): Date {
    return new Date(this.current);
  }

  advance(ms: number): void {
    this.current = new Date(this.current.getTime() + ms);
  }
}

export const STRONG_PASSWORD = 'Sup3rSecret-Pw!';
export const OTHER_STRONG_PASSWORD = 'An0ther-Str0ng-Pw!';

export interface SessionFixture {
  users: InMemoryUserRepository;
  sessions: InMemorySessionRepository;
  events: InMemoryEventPublisher;
  tokens: RandomTokenGenerator;
  tokenHasher: Sha256TokenHasher;
  ids: UuidIdGenerator;
  clock: FixedClock;
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
  const clock = new FixedClock(options.now ?? new Date('2026-01-01T00:00:00.000Z'));
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
