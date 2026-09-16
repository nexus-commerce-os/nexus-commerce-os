import { describe, it, expect } from 'vitest';
import { WebAuthnChallenge } from '../webauthn-challenge';
import { TokenHash } from '../../value-objects/token-hash';
import { toUserId } from '../../value-objects/user-id';
import { toWebAuthnChallengeId } from '../../value-objects/webauthn-challenge-id';
import { DefaultWebAuthnPolicy, type WebAuthnPolicy } from '../../value-objects/webauthn-policy';

const ID = toWebAuthnChallengeId('44444444-4444-4444-8444-444444444444');
const USER = toUserId('11111111-1111-4111-8111-111111111111');
const OTHER_USER = toUserId('22222222-2222-4222-8222-222222222222');
const START = new Date('2026-01-01T00:00:00.000Z');
const policy: WebAuthnPolicy = new DefaultWebAuthnPolicy();

function issue(
  ceremony: 'registration' | 'authentication' = 'registration',
  userId = USER as ReturnType<typeof toUserId> | null,
  p: WebAuthnPolicy = policy,
) {
  return WebAuthnChallenge.issue({
    id: ID,
    userId,
    ceremony,
    challengeHash: TokenHash.fromHex('c0ffee'),
    policy: p,
    now: START,
  });
}

const at = (ms: number) => new Date(START.getTime() + ms);

describe('WebAuthnChallenge', () => {
  it('issues pending with a policy-driven TTL (default 5 minutes)', () => {
    const c = issue();
    expect(c.isPending()).toBe(true);
    expect(policy.challengeTtlMs()).toBe(5 * 60 * 1000);
    expect(c.expiresAt).toEqual(at(policy.challengeTtlMs()));
  });

  it('honours a custom policy TTL instead of any hard-coded value', () => {
    const strict: WebAuthnPolicy = { challengeTtlMs: () => 30_000 };
    expect(issue('registration', USER, strict).expiresAt).toEqual(at(30_000));
  });

  it('consumes exactly once and rejects the replay', () => {
    const c = issue();
    expect(c.consume('registration', USER, at(1000)).ok).toBe(true);
    expect(c.status).toBe('consumed');
    expect(c.consumedAt).toEqual(at(1000));

    const replay = c.consume('registration', USER, at(2000));
    expect(replay.ok).toBe(false);
    if (!replay.ok) {
      expect(replay.error._tag).toBe('InvalidChallengeError');
    }
  });

  it('rejects a ceremony mismatch', () => {
    const c = issue('registration');
    const wrong = c.consume('authentication', USER, at(1000));
    expect(wrong.ok).toBe(false);
    if (!wrong.ok) {
      expect(wrong.error._tag).toBe('InvalidChallengeError');
    }
    expect(c.isPending()).toBe(true);
  });

  it('rejects a user mismatch', () => {
    const c = issue('authentication', USER);
    const wrong = c.consume('authentication', OTHER_USER, at(1000));
    expect(wrong.ok).toBe(false);
    if (!wrong.ok) {
      expect(wrong.error._tag).toBe('InvalidChallengeError');
    }
  });

  it('accepts any user when unbound (discoverable-credential flow)', () => {
    const c = issue('authentication', null);
    expect(c.consume('authentication', OTHER_USER, at(1000)).ok).toBe(true);
  });

  it('treats the expiry instant itself as expired (clock boundary)', () => {
    const ttl = policy.challengeTtlMs();
    expect(issue().consume('registration', USER, at(ttl - 1)).ok).toBe(true);

    const boundary = issue();
    const result = boundary.consume('registration', USER, at(ttl));
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.error._tag).toBe('ChallengeExpiredError');
    }
  });

  it('does not resurrect a consumed challenge when the clock drifts backwards', () => {
    const c = issue();
    expect(c.consume('registration', USER, at(60_000)).ok).toBe(true);
    const back = c.consume('registration', USER, at(-60_000));
    expect(back.ok).toBe(false);
    if (!back.ok) {
      expect(back.error._tag).toBe('InvalidChallengeError');
    }
  });

  it('invalidate supersedes a pending challenge and blocks redemption', () => {
    const c = issue();
    c.invalidate();
    expect(c.status).toBe('invalidated');
    expect(c.consume('registration', USER, at(1000)).ok).toBe(false);
  });

  it('invalidate never downgrades a consumed challenge', () => {
    const c = issue();
    c.consume('registration', USER, at(1000));
    c.invalidate();
    expect(c.status).toBe('consumed');
  });

  it('reconstitutes with its stored status and exposes no raw challenge', () => {
    const c = WebAuthnChallenge.reconstitute({
      id: ID,
      userId: USER,
      ceremony: 'authentication',
      challengeHash: TokenHash.fromHex('c0ffee'),
      status: 'consumed',
      createdAt: START,
      expiresAt: at(300_000),
      consumedAt: at(1000),
    });
    expect(c.status).toBe('consumed');
    expect(Object.keys(c.snapshot())).not.toContain('challengeHash');
  });
});
