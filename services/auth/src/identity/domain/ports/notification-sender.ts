import type { Result } from '../../../kernel/result';

/**
 * An outbound message the Identity context needs delivered to a human.
 *
 * These describe *what happened*, never how it travels: there is no subject
 * line, no HTML, no link and no provider vocabulary here. Rendering and
 * transport belong to the adapter, so swapping SMTP for a vendor API changes
 * nothing above this line.
 *
 * `rawToken` is the one-time link secret. It exists only in memory on the path
 * between the use case that minted it and the adapter that sends it — the
 * repository stores a hash, and the corresponding domain event deliberately
 * omits it so the secret never reaches the event log.
 */
export type IdentityNotification = EmailVerificationNotification | PasswordResetNotification;

export interface EmailVerificationNotification {
  readonly kind: 'email_verification';
  readonly to: string;
  readonly rawToken: string;
  readonly expiresAt: Date;
}

export interface PasswordResetNotification {
  readonly kind: 'password_reset';
  readonly to: string;
  readonly rawToken: string;
  readonly expiresAt: Date;
}

/**
 * Delivery failed. Returned, never thrown: a mail server being down is an
 * expected operational outcome, and the token it would have carried is already
 * committed and still valid, so the caller reports the failure without
 * unwinding anything.
 */
export class NotificationDeliveryError {
  readonly _tag = 'NotificationDeliveryError';
  constructor(
    public readonly kind: IdentityNotification['kind'],
    public readonly reason: string,
  ) {}
  get message(): string {
    return `Could not deliver the ${this.kind} notification: ${this.reason}.`;
  }
}

/** Outbound delivery. The only port through which Identity reaches a user. */
export interface NotificationSender {
  send(notification: IdentityNotification): Promise<Result<void, NotificationDeliveryError>>;
}
