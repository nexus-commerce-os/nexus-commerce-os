import { describe, it, expect, beforeEach } from 'vitest';
import { RequestEmailVerification } from '../request-email-verification';
import { VerifyEmail } from '../verify-email';
import { SendEmailVerification } from '../send-email-verification';
import { InMemoryNotificationSender } from '../../infrastructure/notifications/in-memory-notification-sender';
import { buildVerificationFixture, type VerificationFixture } from '../../__tests__/support';

describe('SendEmailVerification', () => {
  let fx: VerificationFixture;
  let notifications: InMemoryNotificationSender;
  let send: SendEmailVerification;

  beforeEach(async () => {
    fx = await buildVerificationFixture();
    notifications = new InMemoryNotificationSender();
    send = new SendEmailVerification({
      requestEmailVerification: new RequestEmailVerification(fx),
      notifications,
    });
  });

  it('delivers one link to the account address and reports the expiry', async () => {
    const result = await send.execute({ userId: fx.userId });

    expect(result.ok).toBe(true);
    expect(notifications.sent).toHaveLength(1);
    const sent = notifications.sent[0]!;
    expect(sent.kind).toBe('email_verification');
    expect(sent.to).toBe(fx.email);
    if (result.ok) {
      expect(result.value.expiresAt).toEqual(sent.expiresAt);
    }
  });

  /** The link that goes out must be the one the repository will accept. */
  it('sends the same secret that was persisted as a hash, and it verifies', async () => {
    await send.execute({ userId: fx.userId });
    const rawToken = notifications.sent[0]!.rawToken;

    const stored = await fx.tokens.findByTokenHash(fx.tokenHasher.hash(rawToken));
    expect(stored).not.toBeNull();

    const verified = await new VerifyEmail(fx).execute({ token: rawToken });
    expect(verified.ok).toBe(true);
  });

  it('publishes the domain event without the secret on it', async () => {
    await send.execute({ userId: fx.userId });
    expect(fx.events.published.map((e) => e.type)).toEqual([
      'identity.email_verification.requested',
    ]);
    expect(JSON.stringify(fx.events.published)).not.toContain(notifications.sent[0]!.rawToken);
  });

  it('sends nothing when the domain refuses the request', async () => {
    const unknown = await send.execute({ userId: 'not-a-user-id' });
    expect(unknown.ok).toBe(false);
    if (!unknown.ok) {
      expect(unknown.error._tag).toBe('UserNotFoundError');
    }
    expect(notifications.sent).toHaveLength(0);
  });

  it('refuses a second request once the address is already verified', async () => {
    await send.execute({ userId: fx.userId });
    const verified = await new VerifyEmail(fx).execute({
      token: notifications.sent[0]!.rawToken,
    });
    expect(verified.ok).toBe(true);

    const again = await send.execute({ userId: fx.userId });
    expect(again.ok).toBe(false);
    if (!again.ok) {
      expect(again.error._tag).toBe('EmailAlreadyVerifiedError');
    }
    expect(notifications.sent).toHaveLength(1);
  });

  /**
   * The crux of "failed delivery must not corrupt domain state": the token was
   * already committed when the send was attempted, so it has to survive the
   * failure and still work — otherwise a flaky mail server would silently
   * consume the user's one link.
   */
  it('surfaces a delivery failure while leaving the issued token valid', async () => {
    notifications.failWith('ECONNREFUSED');

    const result = await send.execute({ userId: fx.userId });
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.error._tag).toBe('NotificationDeliveryError');
    }

    // the token still exists, unconsumed, and the event still fired
    const issued = fx.events.published;
    expect(issued.map((e) => e.type)).toEqual(['identity.email_verification.requested']);

    // and a retry that does deliver produces a working link
    const retryNotifications = new InMemoryNotificationSender();
    const retry = new SendEmailVerification({
      requestEmailVerification: new RequestEmailVerification(fx),
      notifications: retryNotifications,
    });
    expect((await retry.execute({ userId: fx.userId })).ok).toBe(true);
    const verified = await new VerifyEmail(fx).execute({
      token: retryNotifications.sent[0]!.rawToken,
    });
    expect(verified.ok).toBe(true);
  });
});
