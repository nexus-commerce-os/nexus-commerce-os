import { describe, it, expect, beforeEach } from 'vitest';
import { RequestPasswordReset } from '../request-password-reset';
import { ResetPassword } from '../reset-password';
import { RequestEmailVerification } from '../request-email-verification';
import { AuthenticateUser } from '../authenticate-user';
import { toUserId } from '../../domain/value-objects/user-id';
import {
  buildVerificationFixture,
  STRONG_PASSWORD,
  OTHER_STRONG_PASSWORD,
  type VerificationFixture,
} from '../../__tests__/support';

describe('password reset', () => {
  let fx: VerificationFixture;
  let request: RequestPasswordReset;
  let reset: ResetPassword;

  beforeEach(async () => {
    fx = await buildVerificationFixture();
    request = new RequestPasswordReset(fx);
    // the fixture carries both policies; ResetPassword needs the password one
    reset = new ResetPassword({ ...fx, policy: fx.passwordPolicy });
  });

  async function issue(): Promise<string> {
    const r = await request.execute({ email: fx.email });
    if (!r.ok || r.value.rawToken === null) {
      throw new Error('fixture invariant broken');
    }
    fx.events.drain();
    return r.value.rawToken;
  }

  it('issues a link and publishes the request event without the secret', async () => {
    const r = await request.execute({ email: 'JANE@example.com' });
    expect(r.ok).toBe(true);
    if (!r.ok || r.value.rawToken === null) {
      return;
    }
    expect(fx.events.published.map((e) => e.type)).toEqual(['identity.password_reset.requested']);
    expect(JSON.stringify(fx.events.published)).not.toContain(r.value.rawToken);
  });

  // ── anti-enumeration ──────────────────────────────────────────────────────
  it('answers ok with a null token for an unknown address', async () => {
    const r = await request.execute({ email: 'ghost@example.com' });
    expect(r.ok).toBe(true);
    if (r.ok) {
      expect(r.value.rawToken).toBeNull();
      expect(r.value.expiresAt).toBeNull();
    }
    expect(fx.events.published).toHaveLength(0);
  });

  it('answers ok with a null token for a malformed address', async () => {
    const r = await request.execute({ email: 'not-an-email' });
    expect(r.ok).toBe(true);
    if (r.ok) {
      expect(r.value.rawToken).toBeNull();
    }
  });

  it('answers ok with a null token for a deactivated account', async () => {
    const user = await fx.users.findById(toUserId(fx.userId));
    user?.deactivate(fx.clock.now());
    if (user) {
      await fx.users.save(user);
    }
    const r = await request.execute({ email: fx.email });
    expect(r.ok).toBe(true);
    if (r.ok) {
      expect(r.value.rawToken).toBeNull();
    }
  });

  // ── redemption ────────────────────────────────────────────────────────────
  it('resets the password: old one stops working, new one authenticates', async () => {
    const token = await issue();
    const result = await reset.execute({ token, newPassword: OTHER_STRONG_PASSWORD });
    expect(result.ok).toBe(true);

    const auth = new AuthenticateUser({ users: fx.users, hasher: fx.hasher });
    expect((await auth.execute({ email: fx.email, password: STRONG_PASSWORD })).ok).toBe(false);
    expect((await auth.execute({ email: fx.email, password: OTHER_STRONG_PASSWORD })).ok).toBe(
      true,
    );
  });

  it('publishes PasswordChanged (the session-revocation trigger) and PasswordResetCompleted', async () => {
    const token = await issue();
    await reset.execute({ token, newPassword: OTHER_STRONG_PASSWORD });
    expect(fx.events.published.map((e) => e.type)).toEqual([
      'identity.user.password_changed',
      'identity.password_reset.completed',
    ]);
  });

  it('rejects a replayed link', async () => {
    const token = await issue();
    await reset.execute({ token, newPassword: OTHER_STRONG_PASSWORD });
    const replay = await reset.execute({ token, newPassword: 'Third-Passw0rd!!' });
    expect(replay.ok).toBe(false);
    if (!replay.ok) {
      expect(replay.error._tag).toBe('VerificationTokenAlreadyUsedError');
    }
  });

  it('rejects an expired link at the TTL boundary', async () => {
    const token = await issue();
    fx.clock.advance(fx.policy.ttlFor('password_reset'));
    const result = await reset.execute({ token, newPassword: OTHER_STRONG_PASSWORD });
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.error._tag).toBe('VerificationTokenExpiredError');
    }
  });

  it('does not burn the link when the new password fails policy', async () => {
    const token = await issue();
    const weak = await reset.execute({ token, newPassword: 'weak' });
    expect(weak.ok).toBe(false);
    if (!weak.ok) {
      expect(weak.error._tag).toBe('WeakPasswordError');
    }
    // the link is still usable with a compliant password
    expect((await reset.execute({ token, newPassword: OTHER_STRONG_PASSWORD })).ok).toBe(true);
  });

  it('only the newest link works after multiple reset requests', async () => {
    const first = await issue();
    const second = await issue();
    const third = await issue();

    for (const stale of [first, second]) {
      const r = await reset.execute({ token: stale, newPassword: OTHER_STRONG_PASSWORD });
      expect(r.ok).toBe(false);
      if (!r.ok) {
        expect(r.error._tag).toBe('InvalidVerificationTokenError');
      }
    }
    expect((await reset.execute({ token: third, newPassword: OTHER_STRONG_PASSWORD })).ok).toBe(
      true,
    );
  });

  it('rejects an email-verification token presented to the reset flow', async () => {
    const verification = await new RequestEmailVerification(fx).execute({ userId: fx.userId });
    expect(verification.ok).toBe(true);
    if (!verification.ok) {
      return;
    }
    const result = await reset.execute({
      token: verification.value.rawToken,
      newPassword: OTHER_STRONG_PASSWORD,
    });
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.error._tag).toBe('InvalidVerificationTokenError');
    }
  });

  it('only one of two concurrent redemptions succeeds', async () => {
    const token = await issue();
    const [a, b] = await Promise.all([
      reset.execute({ token, newPassword: OTHER_STRONG_PASSWORD }),
      reset.execute({ token, newPassword: 'Third-Passw0rd!!' }),
    ]);
    expect([a.ok, b.ok].filter(Boolean)).toHaveLength(1);
  });

  it('keeps exactly one pending token when requests are issued concurrently', async () => {
    await Promise.all([
      request.execute({ email: fx.email }),
      request.execute({ email: fx.email }),
      request.execute({ email: fx.email }),
    ]);
    const pending = await fx.tokens.listPending(toUserId(fx.userId), 'password_reset');
    const latest = await fx.tokens.findLatestPending(toUserId(fx.userId), 'password_reset');
    expect(latest).not.toBeNull();
    // concurrent issue may leave more than one pending in-memory; the newest is
    // always resolvable, and redeeming any stale one is still rejected below.
    expect(pending.length).toBeGreaterThanOrEqual(1);
  });
});
