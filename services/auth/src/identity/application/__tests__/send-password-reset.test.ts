import { describe, it, expect, beforeEach } from 'vitest';
import { RequestPasswordReset } from '../request-password-reset';
import { ResetPassword } from '../reset-password';
import { SendPasswordReset } from '../send-password-reset';
import { InMemoryNotificationSender } from '../../infrastructure/notifications/in-memory-notification-sender';
import type { NotificationDeliveryError } from '../../domain/ports/notification-sender';
import { buildVerificationFixture, type VerificationFixture } from '../../__tests__/support';

describe('SendPasswordReset', () => {
  let fx: VerificationFixture;
  let notifications: InMemoryNotificationSender;
  let failures: NotificationDeliveryError[];
  let send: SendPasswordReset;

  beforeEach(async () => {
    fx = await buildVerificationFixture();
    notifications = new InMemoryNotificationSender();
    failures = [];
    send = new SendPasswordReset({
      requestPasswordReset: new RequestPasswordReset(fx),
      notifications,
      onDeliveryFailure: (error) => failures.push(error),
    });
  });

  it('delivers a reset link to a known address', async () => {
    const result = await send.execute({ email: fx.email });

    expect(result.ok).toBe(true);
    expect(notifications.sent).toHaveLength(1);
    expect(notifications.sent[0]!.kind).toBe('password_reset');
    expect(notifications.sent[0]!.to).toBe(fx.email);
  });

  it('sends a secret that actually resets the password', async () => {
    await send.execute({ email: fx.email });

    const reset = await new ResetPassword({ ...fx, policy: fx.passwordPolicy }).execute({
      token: notifications.sent[0]!.rawToken,
      newPassword: 'Reset-Passw0rd-One!',
    });
    expect(reset.ok).toBe(true);
  });

  /**
   * Anti-enumeration. An unknown address, a malformed one, and a real one must
   * be indistinguishable to the caller — same `ok`, no error, no timing tell
   * from an extra branch. Only the mailbox differs.
   */
  it.each([
    ['an unknown address', 'nobody@example.com'],
    ['a malformed address', 'not-an-email'],
  ])('returns ok and sends nothing for %s', async (_label, email) => {
    const result = await send.execute({ email });

    expect(result.ok).toBe(true);
    expect(notifications.sent).toHaveLength(0);
    expect(failures).toHaveLength(0);
  });

  it('mints no token at all for an unknown address', async () => {
    await send.execute({ email: 'nobody@example.com' });
    expect(fx.events.published).toHaveLength(0);
  });

  /**
   * A failed send may only be reported out-of-band: returning it would tell a
   * prober that the address exists, which is exactly what the null-token
   * result is designed to hide.
   */
  it('still returns ok when delivery fails, reporting the failure to the operator', async () => {
    notifications.failWith('ECONNREFUSED');

    const result = await send.execute({ email: fx.email });

    expect(result.ok).toBe(true);
    expect(failures).toHaveLength(1);
    expect(failures[0]!._tag).toBe('NotificationDeliveryError');
    expect(failures[0]!.kind).toBe('password_reset');
  });

  it('is observationally identical whether the address exists or not', async () => {
    notifications.failWith('ECONNREFUSED');

    const real = await send.execute({ email: fx.email });
    const fake = await send.execute({ email: 'nobody@example.com' });

    expect(real).toEqual(fake);
  });

  it('leaves the reset token usable after a failed delivery', async () => {
    notifications.failWith('ECONNREFUSED');
    await send.execute({ email: fx.email });
    expect(fx.events.published.map((e) => e.type)).toEqual(['identity.password_reset.requested']);

    const delivering = new InMemoryNotificationSender();
    const retry = new SendPasswordReset({
      requestPasswordReset: new RequestPasswordReset(fx),
      notifications: delivering,
      onDeliveryFailure: (error) => failures.push(error),
    });
    await retry.execute({ email: fx.email });

    const reset = await new ResetPassword({ ...fx, policy: fx.passwordPolicy }).execute({
      token: delivering.sent[0]!.rawToken,
      newPassword: 'Reset-Passw0rd-Two!',
    });
    expect(reset.ok).toBe(true);
  });
});
