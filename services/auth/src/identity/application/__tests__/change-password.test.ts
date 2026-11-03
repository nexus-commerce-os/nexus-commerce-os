import { describe, it, expect, beforeEach } from 'vitest';
import { ChangePassword } from '../change-password';
import { AuthenticateUser } from '../authenticate-user';
import { RegisterUser } from '../register-user';
import { DefaultPasswordPolicy } from '../../domain/value-objects/password-policy';
import { InMemoryUserRepository } from '../../infrastructure/in-memory-user-repository';
import { InMemoryEventPublisher } from '../../infrastructure/in-memory-event-publisher';
import { ScryptPasswordHasher } from '../../infrastructure/scrypt-password-hasher';
import { UuidIdGenerator } from '../../infrastructure/uuid-id-generator';
import { FakeClock, STRONG_PASSWORD, OTHER_STRONG_PASSWORD } from '../../__tests__/support';

const NOW = new Date('2026-01-01T00:00:00.000Z');

describe('ChangePassword', () => {
  let users: InMemoryUserRepository;
  let hasher: ScryptPasswordHasher;
  let events: InMemoryEventPublisher;
  let changePassword: ChangePassword;
  let userId: string;

  beforeEach(async () => {
    users = new InMemoryUserRepository();
    hasher = new ScryptPasswordHasher();
    events = new InMemoryEventPublisher();
    const deps = {
      users,
      hasher,
      policy: new DefaultPasswordPolicy(),
      clock: new FakeClock(NOW),
      events,
    };
    const register = new RegisterUser({ ...deps, ids: new UuidIdGenerator() });
    const created = await register.execute({
      email: 'jane@example.com',
      password: STRONG_PASSWORD,
      displayName: 'Jane',
    });
    if (!created.ok) {
      throw new Error('fixture invariant broken');
    }
    userId = created.value.id;
    events.drain();
    changePassword = new ChangePassword(deps);
  });

  it('changes the password, publishes PasswordChanged, and the new password authenticates', async () => {
    const result = await changePassword.execute({
      userId,
      currentPassword: STRONG_PASSWORD,
      newPassword: OTHER_STRONG_PASSWORD,
    });
    expect(result.ok).toBe(true);
    expect(events.published.map((e) => e.type)).toEqual(['identity.user.password_changed']);

    const authenticate = new AuthenticateUser({ users, hasher });
    const oldLogin = await authenticate.execute({
      email: 'jane@example.com',
      password: STRONG_PASSWORD,
    });
    const newLogin = await authenticate.execute({
      email: 'jane@example.com',
      password: OTHER_STRONG_PASSWORD,
    });
    expect(oldLogin.ok).toBe(false);
    expect(newLogin.ok).toBe(true);
  });

  it('rejects a wrong current password with InvalidCredentials', async () => {
    const result = await changePassword.execute({
      userId,
      currentPassword: 'Wr0ng-Password!!',
      newPassword: OTHER_STRONG_PASSWORD,
    });
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.error._tag).toBe('InvalidCredentialsError');
    }
    expect(events.published).toHaveLength(0);
  });

  it('rejects a weak new password with WeakPassword', async () => {
    const result = await changePassword.execute({
      userId,
      currentPassword: STRONG_PASSWORD,
      newPassword: 'weak',
    });
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.error._tag).toBe('WeakPasswordError');
    }
  });

  it('rejects an unknown user with UserNotFound', async () => {
    const result = await changePassword.execute({
      userId: '99999999-9999-4999-8999-999999999999',
      currentPassword: STRONG_PASSWORD,
      newPassword: OTHER_STRONG_PASSWORD,
    });
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.error._tag).toBe('UserNotFoundError');
    }
  });

  it('rejects a malformed user id with UserNotFound', async () => {
    const result = await changePassword.execute({
      userId: 'not-a-uuid',
      currentPassword: STRONG_PASSWORD,
      newPassword: OTHER_STRONG_PASSWORD,
    });
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.error._tag).toBe('UserNotFoundError');
    }
  });
});
