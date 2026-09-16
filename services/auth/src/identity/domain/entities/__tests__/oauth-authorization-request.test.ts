import { describe, it, expect } from 'vitest';
import { OAuthAuthorizationRequest } from '../oauth-authorization-request';
import { TokenHash } from '../../value-objects/token-hash';
import { OidcProvider } from '../../value-objects/oidc-provider';
import { toUserId } from '../../value-objects/user-id';
import { toOAuthRequestId } from '../../value-objects/oauth-request-id';
import { DefaultOidcPolicy, type OidcPolicy } from '../../value-objects/oidc-policy';

const ID = toOAuthRequestId('99999999-9999-4999-8999-999999999999');
const USER = toUserId('11111111-1111-4111-8111-111111111111');
const GOOGLE = OidcProvider.fromSlug('google');
const APPLE = OidcProvider.fromSlug('apple');
const START = new Date('2026-01-01T00:00:00.000Z');
const policy: OidcPolicy = new DefaultOidcPolicy();
const at = (ms: number) => new Date(START.getTime() + ms);

function start(userId: ReturnType<typeof toUserId> | null = null, p: OidcPolicy = policy) {
  return OAuthAuthorizationRequest.start({
    id: ID,
    provider: GOOGLE,
    stateHash: TokenHash.fromHex('5747e'),
    nonce: 'nonce-abc',
    codeVerifier: 'verifier-xyz',
    redirectUri: 'https://nexus.example/callback',
    userId,
    policy: p,
    now: START,
  });
}

describe('OAuthAuthorizationRequest', () => {
  it('starts pending with a policy-driven TTL (default 10 minutes)', () => {
    const r = start();
    expect(r.isPending()).toBe(true);
    expect(policy.authorizationRequestTtlMs()).toBe(10 * 60 * 1000);
    expect(r.expiresAt).toEqual(at(policy.authorizationRequestTtlMs()));
  });

  it('honours a custom policy TTL instead of any hard-coded value', () => {
    const strict: OidcPolicy = {
      authorizationRequestTtlMs: () => 45_000,
      allowsAutoLink: () => false,
    };
    expect(start(null, strict).expiresAt).toEqual(at(45_000));
  });

  it('distinguishes a link flow from a plain login', () => {
    expect(start().isLinkFlow()).toBe(false);
    expect(start(USER).isLinkFlow()).toBe(true);
  });

  it('consumes exactly once and rejects the replay', () => {
    const r = start();
    expect(r.consume(GOOGLE, at(1000)).ok).toBe(true);
    expect(r.status).toBe('consumed');
    expect(r.consumedAt).toEqual(at(1000));

    const replay = r.consume(GOOGLE, at(2000));
    expect(replay.ok).toBe(false);
    if (!replay.ok) {
      expect(replay.error._tag).toBe('InvalidOidcStateError');
    }
  });

  it('rejects a callback from a different provider', () => {
    const r = start();
    const wrong = r.consume(APPLE, at(1000));
    expect(wrong.ok).toBe(false);
    if (!wrong.ok) {
      expect(wrong.error._tag).toBe('InvalidOidcStateError');
    }
    expect(r.isPending()).toBe(true);
  });

  it('treats the expiry instant itself as expired (clock boundary)', () => {
    const ttl = policy.authorizationRequestTtlMs();
    expect(start().consume(GOOGLE, at(ttl - 1)).ok).toBe(true);

    const boundary = start();
    const result = boundary.consume(GOOGLE, at(ttl));
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.error._tag).toBe('OidcStateExpiredError');
    }
  });

  it('does not resurrect a consumed request when the clock drifts backwards', () => {
    const r = start();
    expect(r.consume(GOOGLE, at(60_000)).ok).toBe(true);
    expect(r.consume(GOOGLE, at(-60_000)).ok).toBe(false);
  });

  it('matches its nonce exactly and rejects near-misses', () => {
    const r = start();
    expect(r.matchesNonce('nonce-abc')).toBe(true);
    expect(r.matchesNonce('nonce-abd')).toBe(false);
    expect(r.matchesNonce('nonce-ab')).toBe(false);
    expect(r.matchesNonce('')).toBe(false);
  });

  it('invalidate supersedes a pending request and blocks redemption', () => {
    const r = start();
    r.invalidate();
    expect(r.status).toBe('invalidated');
    expect(r.consume(GOOGLE, at(1000)).ok).toBe(false);
  });

  it('invalidate never downgrades a consumed request', () => {
    const r = start();
    r.consume(GOOGLE, at(1000));
    r.invalidate();
    expect(r.status).toBe('consumed');
  });

  it('keeps nonce and codeVerifier out of the snapshot', () => {
    const snap = start(USER).snapshot();
    const keys = Object.keys(snap);
    expect(keys).not.toContain('nonce');
    expect(keys).not.toContain('codeVerifier');
    expect(keys).not.toContain('stateHash');
    expect(JSON.stringify(snap)).not.toContain('verifier-xyz');
    expect(JSON.stringify(snap)).not.toContain('nonce-abc');
  });

  it('reconstitutes from persistence with its stored status', () => {
    const r = OAuthAuthorizationRequest.reconstitute({
      id: ID,
      provider: GOOGLE,
      stateHash: TokenHash.fromHex('5747e'),
      nonce: 'nonce-abc',
      codeVerifier: 'verifier-xyz',
      redirectUri: 'https://nexus.example/callback',
      userId: null,
      status: 'consumed',
      createdAt: START,
      expiresAt: at(600_000),
      consumedAt: at(1000),
    });
    expect(r.consume(GOOGLE, at(2000)).ok).toBe(false);
  });
});

describe('OidcProvider', () => {
  it('normalises case so one provider stays one provider', () => {
    expect(OidcProvider.fromSlug('Google').equals(GOOGLE)).toBe(true);
    expect(OidcProvider.fromSlug('  GOOGLE  ').value).toBe('google');
  });

  it('rejects malformed slugs', () => {
    expect(() => OidcProvider.fromSlug('')).toThrow();
    expect(() => OidcProvider.fromSlug('has space')).toThrow();
    expect(() => OidcProvider.fromSlug('-leading')).toThrow();
  });
});
