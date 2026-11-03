import type { DomainEvent } from '../../../kernel/domain-event';

/** Emitted when a user's email address changes (re-verification is required). */
export class EmailChanged implements DomainEvent {
  readonly type = 'identity.user.email_changed';
  constructor(
    public readonly aggregateId: string,
    public readonly newEmail: string,
    public readonly occurredAt: Date,
  ) {}
}
