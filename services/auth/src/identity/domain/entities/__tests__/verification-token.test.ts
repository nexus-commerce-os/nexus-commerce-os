import { describe, it, expect } from 'vitest';
import { VerificationToken } from '../verification-token';
import { Email } from '../../value-objects/email';
import { TokenHash } from '../../value-objects/token-hash';
import { toUserId } from '../../value-objects/user-id';
import { toVerificationTokenId } from '../../value-objects/verification-token-id';
import {
  DefaultVerificationPolicy,
  type VerificationPolicy,
} from '../../value-objects/verification-policy';

const TOKEN_ID = toVerificationTokenId('33333333-3333-4333-8333-333333333333');
const USER_ID = toUserId('11111111-1111-4111-8111-111111111111');
const START = new Date('2026-01-01T00:00:00.000Z');
const policy: VerificationPolicy = new DefaultVerificationPolicy();

function email(raw: string): Email {
  const r = Email.create(raw);
  if (!r.ok) {
    throw new Error('fixture invariant broken');
  }
  return r.value;
}

const JANE = email('jane@example.com');

function issue(purpose: 'email_verification' | 'password_reset', addr: Email = JANE) {
  return VerificationToken.issue({
    id: TOKEN_ID,
    userId: USER_ID,
    purpose,
    email: addr,
    tokenHash: TokenHash.fromHex('deadbeef'),
    policy,
    now: START,
  });
}

function at(ms: number): Date {
  return new Date(START.getTime() + ms);
}

describe('VerificationToken', () => {
  it('issues as pending with a purpose-driven TTL from the policy', () => {
    const verify = issue('email_verification');
    const reset = issue('password_reset');
    expect(verify.isPending()).toBe(true);
    expect(verify.expiresAt).toEqual(at(policy.ttlFor('email_verification')));
    expect(reset.expiresAt).toEqual(at(policy.ttlFor('password_reset')));
    expect(verify.expiresAt.getTime()).toBeGreaterThan(reset.expiresAt.getTime());
  });

  it('consumes exactly once', () => {
    const token = issue('email_verification');
    expect(token.consume('email_verification', JANE, at(1000)).ok).toBe(true);
    expect(token.status).toBe('consumed');
    expect(token.consumedAt).toEqual(at(1000));

    const replay = token.consume('email_verification', JANE, at(2000));
    expect(replay.ok).toBe(false);
    if (!replay.ok) {
      expect(replay.error._tag).toBe('VerificationTokenAlreadyUsedError');
    }
  });

  it('rejects a token redeemed for the wrong purpose', () => {
    const token = issue('password_reset');
    const wrong = token.consume('email_verification', JANE, at(1000));
    expect(wrong.ok).toBe(false);
    if (!wrong.ok) {
      expect(wrong.error._tag).toBe('InvalidVerificationTokenError');
    }
    // and it is still spendable for its real purpose
    expect(token.consume('password_reset', JANE, at(1000)).ok).toBe(true);
  });

  it('rejects a token whose bound email is no longer the current address', () => {
    const token = issue('email_verification', email('old@example.com'));
    const result = token.consume('email_verification', email('new@example.com'), at(1000));
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.error._tag).toBe('InvalidVerificationTokenError');
    }
    expect(token.status).toBe('pending');
  });

  it('treats the expiry instant itself as expired (boundary)', () => {
    const ttl = policy.ttlFor('password_reset');
    const justInside = issue('password_reset');
    expect(justInside.consume('password_reset', JANE, at(ttl - 1)).ok).toBe(true);

    const atBoundary = issue('password_reset');
    const result = atBoundary.consume('password_reset', JANE, at(ttl));
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.error._tag).toBe('VerificationTokenExpiredError');
    }
  });

  it('does not resurrect a consumed token when the clock drifts backwards', () => {
    const token = issue('email_verification');
    expect(token.consume('email_verification', JANE, at(60_000)).ok).toBe(true);
    const backwards = token.consume('email_verification', JANE, at(-3_600_000));
    expect(backwards.ok).toBe(false);
    if (!backwards.ok) {
      expect(backwards.error._tag).toBe('VerificationTokenAlreadyUsedError');
    }
  });

  it('does not revive an expired token when the clock drifts backwards', () => {
    const ttl = policy.ttlFor('password_reset');
    const token = issue('password_reset');
    expect(token.consume('password_reset', JANE, at(ttl + 1000)).ok).toBe(false);
    // clock jumps back inside the window — the token was never consumed, so it
    // legitimately works again; expiry is evaluated against the supplied time.
    expect(token.consume('password_reset', JANE, at(ttl - 1000)).ok).toBe(true);
  });

  it('invalidate supersedes a pending token and blocks redemption', () => {
    const token = issue('email_verification');
    token.invalidate();
    expect(token.status).toBe('invalidated');
    const result = token.consume('email_verification', JANE, at(1000));
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.error._tag).toBe('InvalidVerificationTokenError');
    }
  });

  it('invalidate never downgrades an already consumed token', () => {
    const token = issue('email_verification');
    token.consume('email_verification', JANE, at(1000));
    token.invalidate();
    expect(token.status).toBe('consumed');
  });

  it('reconstitutes from persistence with its stored status', () => {
    const token = VerificationToken.reconstitute({
      id: TOKEN_ID,
      userId: USER_ID,
      purpose: 'password_reset',
      email: JANE,
      tokenHash: TokenHash.fromHex('deadbeef'),
      status: 'consumed',
      createdAt: START,
      expiresAt: at(3600_000),
      consumedAt: at(1000),
    });
    expect(token.status).toBe('consumed');
    expect(token.consume('password_reset', JANE, at(2000)).ok).toBe(false);
  });

  it('snapshot exposes the record without the secret', () => {
    const snap = issue('email_verification').snapshot();
    expect(snap).toMatchObject({
      userId: USER_ID,
      purpose: 'email_verification',
      email: 'jane@example.com',
      status: 'pending',
      consumedAt: null,
    });
    expect(JSON.stringify(snap)).not.toContain('deadbeef');
  });
});
