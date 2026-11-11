import { describe, it, expect, beforeEach } from 'vitest';
import { StartSession } from '../start-session';
import { RefreshSession } from '../refresh-session';
import { RevokeSession } from '../revoke-session';
import { buildSessionFixture, type SessionFixture } from '../../__tests__/support';

describe('RevokeSession', () => {
  let fixture: SessionFixture;
  let revokeSession: RevokeSession;
  let sessionId: string;
  let refreshToken: string;

  beforeEach(async () => {
    fixture = await buildSessionFixture();
    const started = await new StartSession(fixture).execute({ userId: fixture.userId });
    if (!started.ok) {
      throw new Error('fixture invariant broken');
    }
    sessionId = started.value.session.id;
    refreshToken = started.value.refreshToken;
    fixture.events.drain();
    revokeSession = new RevokeSession(fixture);
  });

  it('revokes the session and publishes SessionRevoked', async () => {
    const result = await revokeSession.execute({ sessionId, userId: fixture.userId });

    expect(result.ok).toBe(true);
    expect(fixture.events.published.map((e) => e.type)).toEqual(['identity.session.revoked']);
  });

  it('kills the refresh token so the session cannot be resumed', async () => {
    await revokeSession.execute({ sessionId, userId: fixture.userId });

    const refreshed = await new RefreshSession(fixture).execute({ refreshToken });

    expect(refreshed.ok).toBe(false);
    if (!refreshed.ok) {
      expect(refreshed.error._tag).toBe('SessionRevokedError');
    }
  });

  it('is idempotent — a second revoke emits no further event', async () => {
    await revokeSession.execute({ sessionId, userId: fixture.userId });
    fixture.events.drain();

    const again = await revokeSession.execute({ sessionId, userId: fixture.userId });

    expect(again.ok).toBe(true);
    expect(fixture.events.published).toHaveLength(0);
  });

  it("reports another user's session as not found (no cross-user probing)", async () => {
    const result = await revokeSession.execute({
      sessionId,
      userId: '99999999-9999-4999-8999-999999999999',
    });

    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.error._tag).toBe('SessionNotFoundError');
    }
    // and the session is untouched
    const refreshed = await new RefreshSession(fixture).execute({ refreshToken });
    expect(refreshed.ok).toBe(true);
  });

  it('rejects an unknown session id', async () => {
    const result = await revokeSession.execute({
      sessionId: '33333333-3333-4333-8333-333333333333',
      userId: fixture.userId,
    });
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.error._tag).toBe('SessionNotFoundError');
    }
  });

  it('rejects malformed ids', async () => {
    const badSession = await revokeSession.execute({
      sessionId: 'nope',
      userId: fixture.userId,
    });
    const badUser = await revokeSession.execute({ sessionId, userId: 'nope' });

    expect(badSession.ok).toBe(false);
    expect(badUser.ok).toBe(false);
  });
});
