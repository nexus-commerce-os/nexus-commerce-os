import { describe, it, expect, beforeEach } from 'vitest';
import { StartSession } from '../start-session';
import { RefreshSession } from '../refresh-session';
import { RevokeAllUserSessions } from '../revoke-all-user-sessions';
import { toUserId } from '../../domain/value-objects/user-id';
import { buildSessionFixture, type SessionFixture } from '../../__tests__/support';

describe('RevokeAllUserSessions', () => {
  let fixture: SessionFixture;
  let revokeAll: RevokeAllUserSessions;
  let tokens: string[];
  let sessionIds: string[];

  beforeEach(async () => {
    fixture = await buildSessionFixture();
    const startSession = new StartSession(fixture);
    tokens = [];
    sessionIds = [];
    for (const device of ['laptop', 'phone', 'tablet']) {
      const started = await startSession.execute({ userId: fixture.userId, deviceBinding: device });
      if (!started.ok) {
        throw new Error('fixture invariant broken');
      }
      tokens.push(started.value.refreshToken);
      sessionIds.push(started.value.session.id);
    }
    fixture.events.drain();
    revokeAll = new RevokeAllUserSessions(fixture);
  });

  it('revokes every session and reports the count', async () => {
    const result = await revokeAll.execute({ userId: fixture.userId });

    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.value).toBe(3);
    }
    expect(fixture.events.published.map((e) => e.type)).toEqual([
      'identity.session.revoked',
      'identity.session.revoked',
      'identity.session.revoked',
    ]);

    const refresher = new RefreshSession(fixture);
    for (const token of tokens) {
      const refreshed = await refresher.execute({ refreshToken: token });
      expect(refreshed.ok).toBe(false);
    }
  });

  it('keeps the excepted session alive ("sign out everywhere else")', async () => {
    const result = await revokeAll.execute({
      userId: fixture.userId,
      exceptSessionId: sessionIds[0],
    });

    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.value).toBe(2);
    }

    const refresher = new RefreshSession(fixture);
    expect((await refresher.execute({ refreshToken: tokens[0] })).ok).toBe(true);
    expect((await refresher.execute({ refreshToken: tokens[1] })).ok).toBe(false);
  });

  it('records the supplied reason (e.g. password_changed)', async () => {
    await revokeAll.execute({ userId: fixture.userId, reason: 'password_changed' });

    const sessions = await fixture.sessions.listByUser(toUserId(fixture.userId));
    expect(sessions).toHaveLength(3);
    expect(sessions.every((s) => s.revocationReason === 'password_changed')).toBe(true);
  });

  it('skips already-revoked sessions on a second sweep', async () => {
    await revokeAll.execute({ userId: fixture.userId });
    fixture.events.drain();

    const again = await revokeAll.execute({ userId: fixture.userId });

    expect(again.ok).toBe(true);
    if (again.ok) {
      expect(again.value).toBe(0);
    }
    expect(fixture.events.published).toHaveLength(0);
  });

  it('returns zero for a user with no sessions', async () => {
    const other = await buildSessionFixture();
    const result = await new RevokeAllUserSessions(other).execute({ userId: other.userId });
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.value).toBe(0);
    }
  });

  it('rejects a malformed user id', async () => {
    const result = await revokeAll.execute({ userId: 'not-a-uuid' });
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.error._tag).toBe('UserNotFoundError');
    }
  });
});
