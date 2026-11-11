import { describe, it, expect, beforeEach } from 'vitest';
import { StartSession } from '../start-session';
import { RefreshSession } from '../refresh-session';
import { buildSessionFixture, type SessionFixture } from '../../__tests__/support';

describe('RefreshSession', () => {
  let fixture: SessionFixture;
  let refreshSession: RefreshSession;
  let refreshToken: string;
  let sessionId: string;

  beforeEach(async () => {
    fixture = await buildSessionFixture();
    const started = await new StartSession(fixture).execute({
      userId: fixture.userId,
    });
    if (!started.ok) {
      throw new Error('fixture invariant broken');
    }
    refreshToken = started.value.refreshToken;
    sessionId = started.value.session.id;
    fixture.events.drain();
    refreshSession = new RefreshSession(fixture);
  });

  it('rotates the token and publishes SessionRefreshed', async () => {
    fixture.clock.advance(60_000);
    const result = await refreshSession.execute({ refreshToken });

    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.value.refreshToken).not.toBe(refreshToken);
      expect(result.value.session.id).toBe(sessionId);
      expect(result.value.session.status).toBe('active');
    }
    expect(fixture.events.published.map((e) => e.type)).toEqual(['identity.session.refreshed']);
  });

  it('supports repeated rotation, each token valid exactly once', async () => {
    fixture.clock.advance(60_000);
    const first = await refreshSession.execute({ refreshToken });
    expect(first.ok).toBe(true);
    if (!first.ok) {
      return;
    }

    fixture.clock.advance(60_000);
    const second = await refreshSession.execute({ refreshToken: first.value.refreshToken });
    expect(second.ok).toBe(true);
    if (second.ok) {
      expect(second.value.refreshToken).not.toBe(first.value.refreshToken);
    }
  });

  it('detects reuse of a rotated token, revokes the family, and persists the revocation', async () => {
    fixture.clock.advance(60_000);
    const rotated = await refreshSession.execute({ refreshToken });
    expect(rotated.ok).toBe(true);
    fixture.events.drain();

    // the attacker replays the stolen, already-rotated token
    const replay = await refreshSession.execute({ refreshToken });

    expect(replay.ok).toBe(false);
    if (!replay.ok) {
      expect(replay.error._tag).toBe('RefreshTokenReusedError');
    }
    expect(fixture.events.published.map((e) => e.type)).toEqual([
      'identity.session.reuse_detected',
      'identity.session.revoked',
    ]);

    // the family is dead: the legitimate holder's newest token no longer works
    if (rotated.ok) {
      const afterBurn = await refreshSession.execute({ refreshToken: rotated.value.refreshToken });
      expect(afterBurn.ok).toBe(false);
      if (!afterBurn.ok) {
        expect(afterBurn.error._tag).toBe('SessionRevokedError');
      }
    }
  });

  it('rejects an unknown token without leaking whether a session exists', async () => {
    const result = await refreshSession.execute({ refreshToken: 'never-issued' });
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.error._tag).toBe('SessionNotFoundError');
    }
    expect(fixture.events.published).toHaveLength(0);
  });

  it('rejects a token past the idle window and revokes with idle_expired', async () => {
    fixture.clock.advance(fixture.policy.idleTtlMs);
    const result = await refreshSession.execute({ refreshToken });

    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.error._tag).toBe('SessionExpiredError');
    }
    const stored = await fixture.sessions.findByTokenHash(fixture.tokenHasher.hash(refreshToken));
    expect(stored?.revocationReason).toBe('idle_expired');
  });

  it('rejects a token past the absolute ceiling even if kept warm', async () => {
    const shortFixture = await buildSessionFixture({
      policy: { idleTtlMs: 60_000, absoluteTtlMs: 90_000 },
    });
    const started = await new StartSession(shortFixture).execute({ userId: shortFixture.userId });
    if (!started.ok) {
      throw new Error('fixture invariant broken');
    }
    const refresher = new RefreshSession(shortFixture);

    shortFixture.clock.advance(50_000);
    const warm = await refresher.execute({ refreshToken: started.value.refreshToken });
    expect(warm.ok).toBe(true);
    if (!warm.ok) {
      return;
    }

    shortFixture.clock.advance(40_000);
    const result = await refresher.execute({ refreshToken: warm.value.refreshToken });

    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.error._tag).toBe('SessionExpiredError');
    }
  });
});
