import { describe, it, expect } from 'vitest';
import { SignJWT, decodeJwt, decodeProtectedHeader } from 'jose';
import { JoseAccessTokenService, type AccessTokenSettings } from '../jose-access-token-service';
import type { Clock } from '../../../../kernel/clock';

const SETTINGS: AccessTokenSettings = {
  secret: 'test-only-access-secret-not-real-00000000',
  issuer: 'https://identity.test',
  audience: 'nexus-api',
  ttlSeconds: 900,
};

const NOW = new Date('2026-07-31T12:00:00.000Z');

function clockAt(instant: Date): Clock {
  return { now: () => instant };
}

function service(
  overrides: Partial<AccessTokenSettings> = {},
  now: Date = NOW,
): JoseAccessTokenService {
  return new JoseAccessTokenService({ ...SETTINGS, ...overrides }, clockAt(now));
}

const PRINCIPAL = {
  userId: '11111111-1111-4111-8111-111111111111',
  sessionId: '22222222-2222-4222-8222-222222222222',
};

describe('JoseAccessTokenService — issuance', () => {
  it('mints a token carrying exactly sub, sid, jti, iat, exp, iss and aud', async () => {
    const { token } = await service().issue(PRINCIPAL);
    const claims = decodeJwt(token);

    expect(claims.sub).toBe(PRINCIPAL.userId);
    expect(claims['sid']).toBe(PRINCIPAL.sessionId);
    expect(typeof claims.jti).toBe('string');
    expect(claims.iss).toBe(SETTINGS.issuer);
    expect(claims.aud).toBe(SETTINGS.audience);
    expect(claims.iat).toBe(Math.floor(NOW.getTime() / 1000));
    expect(claims.exp).toBe(Math.floor(NOW.getTime() / 1000) + SETTINGS.ttlSeconds);

    // No business state: a token that carried roles or profile could answer
    // questions only the aggregate is entitled to answer.
    expect(Object.keys(claims).sort()).toEqual(
      ['aud', 'exp', 'iat', 'iss', 'jti', 'sid', 'sub'].sort(),
    );
  });

  it('pins the algorithm in the header', async () => {
    const { token } = await service().issue(PRINCIPAL);
    expect(decodeProtectedHeader(token).alg).toBe('HS256');
  });

  it('gives every token a distinct jti', async () => {
    const svc = service();
    const [a, b] = await Promise.all([svc.issue(PRINCIPAL), svc.issue(PRINCIPAL)]);
    expect(decodeJwt(a.token).jti).not.toBe(decodeJwt(b.token).jti);
  });

  it('reports the expiry it actually encoded', async () => {
    const issued = await service().issue(PRINCIPAL);
    expect(issued.expiresAt.getTime()).toBe(NOW.getTime() + SETTINGS.ttlSeconds * 1000);
  });
});

describe('JoseAccessTokenService — verification', () => {
  it('accepts a token it issued and returns its claims', async () => {
    const svc = service();
    const { token } = await svc.issue(PRINCIPAL);
    const result = await svc.verify(token);

    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.value.userId).toBe(PRINCIPAL.userId);
      expect(result.value.sessionId).toBe(PRINCIPAL.sessionId);
      expect(result.value.tokenId).toHaveLength(36);
      expect(result.value.expiresAt.getTime()).toBe(NOW.getTime() + 900_000);
    }
  });

  it('rejects a token signed with another key', async () => {
    const { token } = await service({ secret: 'a-different-secret-of-sufficient-length!!' }).issue(
      PRINCIPAL,
    );
    const result = await service().verify(token);
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.error._tag).toBe('InvalidAccessTokenError');
    }
  });

  it('rejects a token from another issuer', async () => {
    const { token } = await service({ issuer: 'https://evil.test' }).issue(PRINCIPAL);
    expect((await service().verify(token)).ok).toBe(false);
  });

  it('rejects a token minted for another audience', async () => {
    const { token } = await service({ audience: 'someone-else' }).issue(PRINCIPAL);
    expect((await service().verify(token)).ok).toBe(false);
  });

  it('rejects a token once it has expired', async () => {
    const { token } = await service().issue(PRINCIPAL);
    const later = new Date(NOW.getTime() + (SETTINGS.ttlSeconds + 60) * 1000);
    expect((await service({}, later).verify(token)).ok).toBe(false);

    // still good one second before it lapses
    const before = new Date(NOW.getTime() + (SETTINGS.ttlSeconds - 1) * 1000);
    expect((await service({}, before).verify(token)).ok).toBe(true);
  });

  /**
   * Algorithm confusion. Without pinning, a token naming `none` — or any other
   * algorithm — would be verified on the attacker's terms rather than ours.
   */
  it('rejects an unsigned token claiming alg none', async () => {
    const unsigned = `${base64url({ alg: 'none', typ: 'JWT' })}.${base64url({
      sub: PRINCIPAL.userId,
      sid: PRINCIPAL.sessionId,
      iss: SETTINGS.issuer,
      aud: SETTINGS.audience,
      exp: Math.floor(NOW.getTime() / 1000) + 900,
    })}.`;
    expect((await service().verify(unsigned)).ok).toBe(false);
  });

  it('rejects a correctly-keyed token that uses a different algorithm', async () => {
    const token = await new SignJWT({ sid: PRINCIPAL.sessionId })
      .setProtectedHeader({ alg: 'HS512' })
      .setSubject(PRINCIPAL.userId)
      .setJti('a-jti')
      .setIssuedAt(Math.floor(NOW.getTime() / 1000))
      .setExpirationTime(Math.floor(NOW.getTime() / 1000) + 900)
      .setIssuer(SETTINGS.issuer)
      .setAudience(SETTINGS.audience)
      .sign(new TextEncoder().encode(SETTINGS.secret));

    expect((await service().verify(token)).ok).toBe(false);
  });

  it('rejects a valid signature that is missing the claims we depend on', async () => {
    const key = new TextEncoder().encode(SETTINGS.secret);
    const seconds = Math.floor(NOW.getTime() / 1000);

    const withoutSid = await new SignJWT({})
      .setProtectedHeader({ alg: 'HS256' })
      .setSubject(PRINCIPAL.userId)
      .setJti('a-jti')
      .setIssuedAt(seconds)
      .setExpirationTime(seconds + 900)
      .setIssuer(SETTINGS.issuer)
      .setAudience(SETTINGS.audience)
      .sign(key);

    const result = await service().verify(withoutSid);
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.error.reason).toContain('sid');
    }
  });

  it('rejects garbage without throwing', async () => {
    for (const bad of ['', 'not-a-jwt', 'a.b.c']) {
      expect((await service().verify(bad)).ok).toBe(false);
    }
  });

  it('never leaks a stack trace through the failure reason', async () => {
    const result = await service().verify('not-a-jwt');
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.error.reason).not.toContain('node_modules');
      expect(result.error.reason.split('\n')).toHaveLength(1);
    }
  });
});

function base64url(value: unknown): string {
  return Buffer.from(JSON.stringify(value)).toString('base64url');
}
