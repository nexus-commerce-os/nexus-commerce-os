import type { DomainEvent } from '../../../kernel/domain-event';

/** Emitted when a user proves control of their email address. */
export class EmailVerified implements DomainEvent {
  readonly type = 'identity.user.email_verified';
  constructor(
    public readonly aggregateId: string,
    public readonly email: string,
    public readonly occurredAt: Date,
  ) {}
}
