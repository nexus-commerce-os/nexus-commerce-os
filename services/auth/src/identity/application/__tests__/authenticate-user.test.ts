import { describe, it, expect, beforeEach } from 'vitest';
import { AuthenticateUser } from '../authenticate-user';
import { RegisterUser } from '../register-user';
import { DefaultPasswordPolicy } from '../../domain/value-objects/password-policy';
import { InMemoryUserRepository } from '../../infrastructure/in-memory-user-repository';
import { InMemoryEventPublisher } from '../../infrastructure/in-memory-event-publisher';
import { ScryptPasswordHasher } from '../../infrastructure/scrypt-password-hasher';
import { UuidIdGenerator } from '../../infrastructure/uuid-id-generator';
import { toUserId } from '../../domain/value-objects/user-id';
import { FakeClock, STRONG_PASSWORD, OTHER_STRONG_PASSWORD } from '../../__tests__/support';

const NOW = new Date('2026-01-01T00:00:00.000Z');

describe('AuthenticateUser', () => {
  let users: InMemoryUserRepository;
  let authenticate: AuthenticateUser;
  let userId: string;

  beforeEach(async () => {
    users = new InMemoryUserRepository();
    const hasher = new ScryptPasswordHasher();
    const register = new RegisterUser({
      users,
      hasher,
      policy: new DefaultPasswordPolicy(),
      ids: new UuidIdGenerator(),
      clock: new FakeClock(NOW),
      events: new InMemoryEventPublisher(),
    });
    const created = await register.execute({
      email: 'jane@example.com',
      password: STRONG_PASSWORD,
      displayName: 'Jane',
    });
    if (!created.ok) {
      throw new Error('fixture invariant broken');
    }
    userId = created.value.id;
    authenticate = new AuthenticateUser({ users, hasher });
  });

  it('accepts correct credentials (email case-insensitive)', async () => {
    const result = await authenticate.execute({
      email: 'JANE@example.com',
      password: STRONG_PASSWORD,
    });
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.value.email).toBe('jane@example.com');
    }
  });

  it('rejects a wrong password with InvalidCredentials', async () => {
    const result = await authenticate.execute({
      email: 'jane@example.com',
      password: OTHER_STRONG_PASSWORD,
    });
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.error._tag).toBe('InvalidCredentialsError');
    }
  });

  it('rejects an unknown account with InvalidCredentials (no account enumeration)', async () => {
    const result = await authenticate.execute({
      email: 'ghost@example.com',
      password: STRONG_PASSWORD,
    });
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.error._tag).toBe('InvalidCredentialsError');
    }
  });

  it('rejects a malformed email with InvalidCredentials', async () => {
    const result = await authenticate.execute({ email: 'not-an-email', password: STRONG_PASSWORD });
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.error._tag).toBe('InvalidCredentialsError');
    }
  });

  it('rejects a deactivated account (with correct password) as UserDeactivated', async () => {
    const user = await users.findById(toUserId(userId));
    expect(user).not.toBeNull();
    user?.deactivate(NOW);
    if (user) {
      await users.save(user);
    }
    const result = await authenticate.execute({
      email: 'jane@example.com',
      password: STRONG_PASSWORD,
    });
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.error._tag).toBe('UserDeactivatedError');
    }
  });
});
