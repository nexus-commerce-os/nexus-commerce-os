import { type Result, ok, err } from '../../kernel/result';
import type {
  NotificationSender,
  NotificationDeliveryError,
} from '../domain/ports/notification-sender';
import {
  RequestEmailVerification,
  type RequestEmailVerificationError,
} from './request-email-verification';

export interface SendEmailVerificationCommand {
  userId: string;
}

export interface SendEmailVerificationResult {
  readonly expiresAt: Date;
}

export type SendEmailVerificationError = RequestEmailVerificationError | NotificationDeliveryError;

export interface SendEmailVerificationDeps {
  requestEmailVerification: RequestEmailVerification;
  notifications: NotificationSender;
}

/**
 * Mint a verification link and deliver it.
 *
 * The two halves stay separate on purpose: {@link RequestEmailVerification}
 * owns the domain rules and knows nothing about mail, this owns the hand-off
 * and knows nothing about tokens. It is also the only place the raw secret is
 * held — it goes straight from the use-case result into the port and is never
 * returned to the caller.
 *
 * A delivery failure is reported honestly here. This is an authenticated
 * action, so the caller already knows the account exists and there is nothing
 * to conceal — unlike {@link ./send-password-reset SendPasswordReset}. The
 * token remains committed and valid either way, so retrying is a resend rather
 * than a repair.
 */
export class SendEmailVerification {
  constructor(private readonly deps: SendEmailVerificationDeps) {}

  async execute(
    command: SendEmailVerificationCommand,
  ): Promise<Result<SendEmailVerificationResult, SendEmailVerificationError>> {
    const issued = await this.deps.requestEmailVerification.execute({ userId: command.userId });
    if (!issued.ok) {
      return err(issued.error);
    }

    const delivery = await this.deps.notifications.send({
      kind: 'email_verification',
      to: issued.value.email,
      rawToken: issued.value.rawToken,
      expiresAt: issued.value.expiresAt,
    });
    if (!delivery.ok) {
      return err(delivery.error);
    }

    return ok({ expiresAt: issued.value.expiresAt });
  }
}
