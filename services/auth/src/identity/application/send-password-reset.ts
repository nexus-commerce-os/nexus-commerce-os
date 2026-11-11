import { type Result, ok } from '../../kernel/result';
import type {
  NotificationSender,
  NotificationDeliveryError,
} from '../domain/ports/notification-sender';
import { RequestPasswordReset } from './request-password-reset';

export interface SendPasswordResetCommand {
  email: string;
}

export interface SendPasswordResetDeps {
  requestPasswordReset: RequestPasswordReset;
  notifications: NotificationSender;
  /**
   * Where a failed send is reported. It is deliberately *not* the return value:
   * a mail error can only occur for an address that exists, so returning it
   * would hand an enumerator the exact oracle the null-token result was
   * designed to deny them.
   */
  onDeliveryFailure: (error: NotificationDeliveryError) => void;
}

/**
 * Start a password reset and deliver the link.
 *
 * **Never fails**, and takes constant observable shape. An unknown address
 * mints no token and so sends no mail; a known address sends one; a send that
 * bounces is reported to the operator out-of-band. From outside, all three are
 * indistinguishable — which is the whole point of
 * {@link RequestPasswordReset}'s null-token result, and would be undone if this
 * layer leaked the difference (docs/08 threat X7).
 */
export class SendPasswordReset {
  constructor(private readonly deps: SendPasswordResetDeps) {}

  async execute(command: SendPasswordResetCommand): Promise<Result<void, never>> {
    const issued = await this.deps.requestPasswordReset.execute({ email: command.email });

    // `never` on the error side — but the check keeps the narrowing honest if
    // that signature ever tightens.
    if (!issued.ok) {
      return ok(undefined);
    }

    const { rawToken, expiresAt } = issued.value;
    if (rawToken === null || expiresAt === null) {
      return ok(undefined);
    }

    const delivery = await this.deps.notifications.send({
      kind: 'password_reset',
      to: command.email,
      rawToken,
      expiresAt,
    });
    if (!delivery.ok) {
      this.deps.onDeliveryFailure(delivery.error);
    }

    return ok(undefined);
  }
}
