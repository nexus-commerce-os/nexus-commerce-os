import { describe, it, expect } from 'vitest';
import { User } from '../user';
import { Profile } from '../profile';
import { PasswordCredential } from '../password-credential';
import { Email } from '../../value-objects/email';
import { PasswordHash } from '../../value-objects/password-hash';
import { toUserId } from '../../value-objects/user-id';

const NOW = new Date('2026-01-01T00:00:00.000Z');
const LATER = new Date('2026-02-01T00:00:00.000Z');

function buildUser(email = 'jane@example.com'): User {
  const emailResult = Email.create(email);
  const profileResult = Profile.create({ displayName: 'Jane', locale: 'en-US' });
  if (!emailResult.ok || !profileResult.ok) {
    throw new Error('fixture invariant broken');
  }
  return User.register({
    id: toUserId('11111111-1111-4111-8111-111111111111'),
    email: emailResult.value,
    credential: PasswordCredential.fromHash(PasswordHash.fromEncoded('scrypt$s$h'), NOW),
    profile: profileResult.value,
    residencyRegion: 'us-east-1',
    now: NOW,
  });
}

function emailOf(raw: string): Email {
  const result = Email.create(raw);
  if (!result.ok) {
    throw new Error('fixture invariant broken');
  }
  return result.value;
}

describe('User aggregate', () => {
  it('registers as active + unverified and records UserRegistered', () => {
    const user = buildUser();
    expect(user.isActive()).toBe(true);
    expect(user.emailVerified).toBe(false);
    const events = user.pullEvents();
    expect(events.map((e) => e.type)).toEqual(['identity.user.registered']);
  });

  it('drains events exactly once', () => {
    const user = buildUser();
    expect(user.pullEvents()).toHaveLength(1);
    expect(user.pullEvents()).toHaveLength(0);
  });

  it('changeEmail resets verification, bumps updatedAt, and records EmailChanged', () => {
    const user = buildUser();
    user.pullEvents();
    user.changeEmail(emailOf('new@example.com'), LATER);
    expect(user.email.value).toBe('new@example.com');
    expect(user.emailVerified).toBe(false);
    expect(user.updatedAt).toEqual(LATER);
    expect(user.pullEvents().map((e) => e.type)).toEqual(['identity.user.email_changed']);
  });

  it('changeEmail is a no-op when the address is unchanged', () => {
    const user = buildUser();
    user.pullEvents();
    user.changeEmail(emailOf('jane@example.com'), LATER);
    expect(user.pullEvents()).toHaveLength(0);
  });

  it('changePassword records PasswordChanged and bumps updatedAt', () => {
    const user = buildUser();
    user.pullEvents();
    user.changePassword(
      PasswordCredential.fromHash(PasswordHash.fromEncoded('scrypt$s2$h2'), LATER),
      LATER,
    );
    expect(user.credential.hash.encoded).toBe('scrypt$s2$h2');
    expect(user.updatedAt).toEqual(LATER);
    expect(user.pullEvents().map((e) => e.type)).toEqual(['identity.user.password_changed']);
  });

  it('deactivate flips status and records UserDeactivated (idempotent)', () => {
    const user = buildUser();
    user.pullEvents();
    user.deactivate(LATER);
    expect(user.isActive()).toBe(false);
    expect(user.pullEvents().map((e) => e.type)).toEqual(['identity.user.deactivated']);
    user.deactivate(LATER);
    expect(user.pullEvents()).toHaveLength(0);
  });

  it('snapshot reflects current state', () => {
    const user = buildUser();
    const snapshot = user.snapshot();
    expect(snapshot).toMatchObject({
      email: 'jane@example.com',
      emailVerified: false,
      status: 'active',
      residencyRegion: 'us-east-1',
      displayName: 'Jane',
      locale: 'en-US',
    });
  });
});
