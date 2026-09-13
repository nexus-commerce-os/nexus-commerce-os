import { describe, it, expect, beforeEach } from 'vitest';
import { AuthorizeRequest } from '../authorize-request';
import { StartSession } from '../start-session';
import { RevokeSession } from '../revoke-session';
import { JoseAccessTokenService } from '../../infrastructure/tokens/jose-access-token-service';
import { buildSessionFixture, type SessionFixture } from '../../__tests__/support';

const SETTINGS = {
  secret: 'test-only-access-secret-not-real-00000000',
  issuer: 'https://identity.test',
  audience: 'nexus-api',
  ttlSeconds: 900,
};

const ANOTHER_USER = '99999999-9999-4999-8999-999999999999';

describe('AuthorizeRequest', () => {
  let fx: SessionFixture;
  let accessTokens: JoseAccessTokenService;
  let authorize: AuthorizeRequest;
  let sessionId: string;

  beforeEach(async () => {
    fx = await buildSessionFixture();
    accessTokens = new JoseAccessTokenService(SETTINGS, fx.clock);
    authorize = new AuthorizeRequest({ accessTokens, sessions: fx.sessions, clock: fx.clock });

    const started = await new StartSession(fx).execute({ userId: fx.userId });
    if (!started.ok) {
      throw new Error('fixture invariant broken');
    }
    sessionId = started.value.session.id;
  });

  async function tokenFor(userId: string, sid: string = sessionId): Promise<string> {
    return (await accessTokens.issue({ userId, sessionId: sid })).token;
  }

  it('resolves a valid token against a live session', async () => {
    const result = await authorize.execute({ accessToken: await tokenFor(fx.userId) });
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.value.userId).toBe(fx.userId);
      expect(result.value.sessionId).toBe(sessionId);
    }
  });

  /**
   * Required by the ruling of 2026-07-31. A token can be perfectly signed and
   * unexpired and still be lying about who it speaks for: the signature proves
   * we minted it, not that this subject owns that session. Only the aggregate
   * knows the owner, so the check has to happen against the aggregate.
   */
  it('rejects a validly signed token whose subject does not own the session', async () => {
    const forged = await tokenFor(ANOTHER_USER);

    // the token itself verifies — the rejection is not a crypto failure
    expect((await accessTokens.verify(forged)).ok).toBe(true);

    const result = await authorize.execute({ accessToken: forged });
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.error._tag).toBe('InvalidAccessTokenError');
    }
  });

  /**
   * Every rejection is one externally identical error. If a mismatch, a
   * revocation, an unknown session and a forgery were distinguishable, the
   * differences would be an oracle for probing which sessions and users exist.
   */
  it('is externally indistinguishable across every rejection cause', async () => {
    const revokedSession = await new StartSession(fx).execute({ userId: fx.userId });
    if (!revokedSession.ok) {
      throw new Error('fixture invariant broken');
    }
    await new RevokeSession(fx).execute({
      sessionId: revokedSession.value.session.id,
      userId: fx.userId,
    });

    const rejections = await Promise.all([
      authorize.execute({ accessToken: await tokenFor(ANOTHER_USER) }),
      authorize.execute({
        accessToken: await tokenFor(fx.userId, revokedSession.value.session.id),
      }),
      authorize.execute({
        accessToken: await tokenFor(fx.userId, '33333333-3333-4333-8333-333333333333'),
      }),
      authorize.execute({ accessToken: 'not-a-jwt' }),
    ]);

    for (const rejection of rejections) {
      expect(rejection.ok).toBe(false);
      if (!rejection.ok) {
        expect(rejection.error._tag).toBe('InvalidAccessTokenError');
        // one public message, whatever the internal cause
        expect(rejection.error.message).toBe('The access token is not valid.');
      }
    }
  });

  it('leaks no identifier or stack trace through the failure reason', async () => {
    const result = await authorize.execute({ accessToken: await tokenFor(ANOTHER_USER) });
    expect(result.ok).toBe(false);
    if (!result.ok) {
      const reason = result.error.reason;
      expect(reason).not.toContain(sessionId);
      expect(reason).not.toContain(fx.userId);
      expect(reason).not.toContain(ANOTHER_USER);
      expect(reason).not.toContain('node_modules');
      expect(reason.split('\n')).toHaveLength(1);
    }
  });

  it('rejects a token whose session was revoked, though the token is still valid', async () => {
    const token = await tokenFor(fx.userId);
    await new RevokeSession(fx).execute({ sessionId, userId: fx.userId });

    expect((await accessTokens.verify(token)).ok).toBe(true);
    expect((await authorize.execute({ accessToken: token })).ok).toBe(false);
  });

  it('rejects a sid that is not a session identifier at all', async () => {
    const result = await authorize.execute({
      accessToken: await tokenFor(fx.userId, 'not-a-uuid'),
    });
    expect(result.ok).toBe(false);
  });
});
