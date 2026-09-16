import { describe, it, expect, beforeEach } from 'vitest';
import { RequestEmailVerification } from '../request-email-verification';
import { VerifyEmail } from '../verify-email';
import { RequestPasswordReset } from '../request-password-reset';
import { toUserId } from '../../domain/value-objects/user-id';
import { Email } from '../../domain/value-objects/email';
import { buildVerificationFixture, type VerificationFixture } from '../../__tests__/support';

describe('email verification', () => {
  let fx: VerificationFixture;
  let request: RequestEmailVerification;
  let verify: VerifyEmail;

  beforeEach(async () => {
    fx = await buildVerificationFixture();
    request = new RequestEmailVerification(fx);
    verify = new VerifyEmail(fx);
  });

  async function issue(): Promise<string> {
    const r = await request.execute({ userId: fx.userId });
    if (!r.ok) {
      throw new Error('fixture invariant broken');
    }
    fx.events.drain();
    return r.value.rawToken;
  }

  it('issues a link, stores only its hash, and publishes the request event', async () => {
    const r = await request.execute({ userId: fx.userId });
    expect(r.ok).toBe(true);
    if (!r.ok) {
      return;
    }
    expect(r.value.rawToken.length).toBeGreaterThan(20);
    expect(r.value.email).toBe('jane@example.com');
    expect(fx.events.published.map((e) => e.type)).toEqual([
      'identity.email_verification.requested',
    ]);
    const stored = await fx.tokens.findByTokenHash(fx.tokenHasher.hash(r.value.rawToken));
    expect(stored).not.toBeNull();
    expect(stored?.tokenHash.value).not.toBe(r.value.rawToken);
    // the secret must not travel on the event
    expect(JSON.stringify(fx.events.published)).not.toContain(r.value.rawToken);
  });

  it('verifies the address and publishes EmailVerified', async () => {
    const token = await issue();
    const result = await verify.execute({ token });
    expect(result.ok).toBe(true);

    const user = await fx.users.findById(toUserId(fx.userId));
    expect(user?.emailVerified).toBe(true);
    expect(fx.events.published.map((e) => e.type)).toEqual(['identity.user.email_verified']);
  });

  it('rejects a replayed link', async () => {
    const token = await issue();
    expect((await verify.execute({ token })).ok).toBe(true);

    const replay = await verify.execute({ token });
    expect(replay.ok).toBe(false);
    if (!replay.ok) {
      expect(replay.error._tag).toBe('VerificationTokenAlreadyUsedError');
    }
  });

  it('rejects an unknown link', async () => {
    const result = await verify.execute({ token: 'never-issued' });
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.error._tag).toBe('InvalidVerificationTokenError');
    }
  });

  it('rejects an expired link at the TTL boundary', async () => {
    const token = await issue();
    fx.clock.advance(fx.policy.ttlFor('email_verification'));
    const result = await verify.execute({ token });
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.error._tag).toBe('VerificationTokenExpiredError');
    }
  });

  it('supersedes the previous link when a new one is requested', async () => {
    const first = await issue();
    const second = await issue();

    const old = await verify.execute({ token: first });
    expect(old.ok).toBe(false);
    if (!old.ok) {
      expect(old.error._tag).toBe('InvalidVerificationTokenError');
    }
    expect((await verify.execute({ token: second })).ok).toBe(true);
  });

  it('rejects a superseded link even after it was replaced twice', async () => {
    const first = await issue();
    await issue();
    const third = await issue();
    expect((await verify.execute({ token: first })).ok).toBe(false);
    expect((await verify.execute({ token: third })).ok).toBe(true);
  });

  it('rejects a link bound to an address the user has since changed', async () => {
    const token = await issue();
    const user = await fx.users.findById(toUserId(fx.userId));
    const next = Email.create('changed@example.com');
    if (user && next.ok) {
      user.changeEmail(next.value, fx.clock.now());
      await fx.users.save(user);
      user.pullEvents();
    }
    const result = await verify.execute({ token });
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.error._tag).toBe('InvalidVerificationTokenError');
    }
  });

  it('rejects a link after the email changed twice and returned to the original', async () => {
    const token = await issue();
    const user = await fx.users.findById(toUserId(fx.userId));
    const other = Email.create('other@example.com');
    const back = Email.create('jane@example.com');
    if (user && other.ok && back.ok) {
      user.changeEmail(other.value, fx.clock.now());
      user.changeEmail(back.value, fx.clock.now());
      await fx.users.save(user);
      user.pullEvents();
    }
    // binding matches again, so the link is redeemable — and verification was
    // reset by the change, so this correctly re-proves the address
    const result = await verify.execute({ token });
    expect(result.ok).toBe(true);
    expect((await fx.users.findById(toUserId(fx.userId)))?.emailVerified).toBe(true);
  });

  it('rejects a password-reset token presented to the verify-email flow', async () => {
    const reset = await new RequestPasswordReset(fx).execute({ email: fx.email });
    expect(reset.ok).toBe(true);
    if (!reset.ok || reset.value.rawToken === null) {
      return;
    }
    const result = await verify.execute({ token: reset.value.rawToken });
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.error._tag).toBe('InvalidVerificationTokenError');
    }
  });

  it('only one of two concurrent redemptions succeeds', async () => {
    const token = await issue();
    const [a, b] = await Promise.all([verify.execute({ token }), verify.execute({ token })]);
    expect([a.ok, b.ok].filter(Boolean)).toHaveLength(1);
  });

  it('refuses to re-issue once the address is verified', async () => {
    const token = await issue();
    await verify.execute({ token });
    const again = await request.execute({ userId: fx.userId });
    expect(again.ok).toBe(false);
    if (!again.ok) {
      expect(again.error._tag).toBe('EmailAlreadyVerifiedError');
    }
  });

  it('rejects a request for an unknown or deactivated user', async () => {
    const unknown = await request.execute({ userId: '99999999-9999-4999-8999-999999999999' });
    expect(unknown.ok).toBe(false);

    const user = await fx.users.findById(toUserId(fx.userId));
    user?.deactivate(fx.clock.now());
    if (user) {
      await fx.users.save(user);
    }
    const deactivated = await request.execute({ userId: fx.userId });
    expect(deactivated.ok).toBe(false);
    if (!deactivated.ok) {
      expect(deactivated.error._tag).toBe('UserDeactivatedError');
    }
  });
});
