import { describe, it, expect, beforeEach } from 'vitest';
import { StartSession } from '../start-session';
import { isSessionId } from '../../domain/value-objects/session-id';
import { toUserId } from '../../domain/value-objects/user-id';
import { buildSessionFixture, type SessionFixture } from '../../__tests__/support';

describe('StartSession', () => {
  let fixture: SessionFixture;
  let startSession: StartSession;

  beforeEach(async () => {
    fixture = await buildSessionFixture();
    startSession = new StartSession(fixture);
  });

  it('opens a session, returns the raw refresh token once, and publishes SessionStarted', async () => {
    const result = await startSession.execute({
      userId: fixture.userId,
      deviceBinding: 'device-1',
    });

    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(isSessionId(result.value.session.id)).toBe(true);
      expect(result.value.session.status).toBe('active');
      expect(result.value.session.deviceBinding).toBe('device-1');
      expect(result.value.refreshToken.length).toBeGreaterThan(20);
    }
    expect(fixture.sessions.size).toBe(1);
    expect(fixture.events.published.map((e) => e.type)).toEqual(['identity.session.started']);
  });

  it('stores only the hash of the refresh token, never the secret', async () => {
    const result = await startSession.execute({ userId: fixture.userId });
    expect(result.ok).toBe(true);
    if (!result.ok) {
      return;
    }
    const stored = await fixture.sessions.findByTokenHash(
      fixture.tokenHasher.hash(result.value.refreshToken),
    );
    expect(stored).not.toBeNull();
    expect(stored?.tokens[0].hash.value).not.toBe(result.value.refreshToken);
  });

  it('defaults deviceBinding to null when not supplied', async () => {
    const result = await startSession.execute({ userId: fixture.userId });
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.value.session.deviceBinding).toBeNull();
    }
  });

  it('issues independent sessions per device', async () => {
    const first = await startSession.execute({ userId: fixture.userId, deviceBinding: 'a' });
    const second = await startSession.execute({ userId: fixture.userId, deviceBinding: 'b' });
    expect(first.ok && second.ok).toBe(true);
    if (first.ok && second.ok) {
      expect(first.value.session.id).not.toBe(second.value.session.id);
      expect(first.value.refreshToken).not.toBe(second.value.refreshToken);
    }
    expect(fixture.sessions.size).toBe(2);
  });

  it('rejects an unknown user', async () => {
    const result = await startSession.execute({ userId: '99999999-9999-4999-8999-999999999999' });
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.error._tag).toBe('UserNotFoundError');
    }
    expect(fixture.sessions.size).toBe(0);
  });

  it('rejects a malformed user id', async () => {
    const result = await startSession.execute({ userId: 'not-a-uuid' });
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.error._tag).toBe('UserNotFoundError');
    }
  });

  it('rejects a deactivated user', async () => {
    const user = await fixture.users.findById(toUserId(fixture.userId));
    user?.deactivate(fixture.clock.now());
    if (user) {
      await fixture.users.save(user);
    }

    const result = await startSession.execute({ userId: fixture.userId });

    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.error._tag).toBe('UserDeactivatedError');
    }
    expect(fixture.sessions.size).toBe(0);
  });
});
