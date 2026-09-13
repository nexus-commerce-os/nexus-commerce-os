import type { DomainEvent } from '../../../kernel/domain-event';

/** Emitted when a user account is deactivated. */
export class UserDeactivated implements DomainEvent {
  readonly type = 'identity.user.deactivated';
  constructor(
    public readonly aggregateId: string,
    public readonly occurredAt: Date,
  ) {}
}
