import { describe, it, expect, beforeEach } from 'vitest';
import { RegisterUser, type RegisterUserDeps } from '../register-user';
import { DefaultPasswordPolicy } from '../../domain/value-objects/password-policy';
import { InMemoryUserRepository } from '../../infrastructure/in-memory-user-repository';
import { InMemoryEventPublisher } from '../../infrastructure/in-memory-event-publisher';
import { ScryptPasswordHasher } from '../../infrastructure/scrypt-password-hasher';
import { UuidIdGenerator } from '../../infrastructure/uuid-id-generator';
import { isUserId } from '../../domain/value-objects/user-id';
import { FixedClock, STRONG_PASSWORD } from '../../__tests__/support';

const NOW = new Date('2026-01-01T00:00:00.000Z');

function buildDeps(): RegisterUserDeps & {
  users: InMemoryUserRepository;
  events: InMemoryEventPublisher;
} {
  return {
    users: new InMemoryUserRepository(),
    hasher: new ScryptPasswordHasher(),
    policy: new DefaultPasswordPolicy(),
    ids: new UuidIdGenerator(),
    clock: new FixedClock(NOW),
    events: new InMemoryEventPublisher(),
  };
}

describe('RegisterUser', () => {
  let deps: ReturnType<typeof buildDeps>;
  let register: RegisterUser;

  beforeEach(() => {
    deps = buildDeps();
    register = new RegisterUser(deps);
  });

  it('registers a user, persists it, and publishes UserRegistered', async () => {
    const result = await register.execute({
      email: 'Jane@Example.com',
      password: STRONG_PASSWORD,
      displayName: 'Jane',
    });

    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.value.email).toBe('jane@example.com');
      expect(result.value.status).toBe('active');
      expect(result.value.emailVerified).toBe(false);
      expect(result.value.residencyRegion).toBe('us-east-1');
      expect(isUserId(result.value.id)).toBe(true);
      expect(result.value.createdAt).toEqual(NOW);
    }
    expect(deps.users.size).toBe(1);
    expect(deps.events.published.map((e) => e.type)).toEqual(['identity.user.registered']);
  });

  it('rejects a duplicate email (case-insensitive)', async () => {
    await register.execute({
      email: 'jane@example.com',
      password: STRONG_PASSWORD,
      displayName: 'Jane',
    });
    const result = await register.execute({
      email: 'JANE@example.com',
      password: STRONG_PASSWORD,
      displayName: 'Jane 2',
    });
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.error._tag).toBe('EmailAlreadyInUseError');
    }
    expect(deps.users.size).toBe(1);
  });

  it('rejects an invalid email before touching the repository', async () => {
    const result = await register.execute({
      email: 'nope',
      password: STRONG_PASSWORD,
      displayName: 'Jane',
    });
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.error._tag).toBe('InvalidEmailError');
    }
    expect(deps.users.size).toBe(0);
    expect(deps.events.published).toHaveLength(0);
  });

  it('rejects a weak password', async () => {
    const result = await register.execute({
      email: 'jane@example.com',
      password: 'weak',
      displayName: 'Jane',
    });
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.error._tag).toBe('WeakPasswordError');
    }
    expect(deps.users.size).toBe(0);
  });

  it('rejects an empty display name', async () => {
    const result = await register.execute({
      email: 'jane@example.com',
      password: STRONG_PASSWORD,
      displayName: '   ',
    });
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.error._tag).toBe('InvalidProfileError');
    }
  });
});
