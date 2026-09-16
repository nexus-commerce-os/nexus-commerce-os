import { type Result, ok, err } from '../../../kernel/result';
import {
  NotificationDeliveryError,
  type IdentityNotification,
  type NotificationSender,
} from '../../domain/ports/notification-sender';

/**
 * Records what would have been sent, and can be told to fail on demand.
 *
 * Used by tests to assert both halves of the contract — that a link is sent
 * when it should be, and that nothing leaves when it should not — without
 * standing up a mail server. It is never wired into the production container.
 */
export class InMemoryNotificationSender implements NotificationSender {
  private readonly delivered: IdentityNotification[] = [];
  private nextFailure: string | null = null;

  get sent(): readonly IdentityNotification[] {
    return this.delivered;
  }

  /** Make every subsequent send fail, as an unreachable mail server would. */
  failWith(reason: string): void {
    this.nextFailure = reason;
  }

  async send(
    notification: IdentityNotification,
  ): Promise<Result<void, NotificationDeliveryError>> {
    if (this.nextFailure !== null) {
      return err(new NotificationDeliveryError(notification.kind, this.nextFailure));
    }
    this.delivered.push(notification);
    return ok(undefined);
  }
}
