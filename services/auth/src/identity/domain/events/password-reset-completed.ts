import type { DomainEvent } from '../../../kernel/domain-event';

/**
 * Emitted when a reset link is successfully redeemed. Published alongside
 * `PasswordChanged`, which is what the I-7 subscriber turns into
 * session revocation — this event exists for audit/notification ("your password
 * was reset"), not for control flow.
 */
export class PasswordResetCompleted implements DomainEvent {
  readonly type = 'identity.password_reset.completed';
  constructor(
    public readonly aggregateId: string,
    public readonly occurredAt: Date,
  ) {}
}
