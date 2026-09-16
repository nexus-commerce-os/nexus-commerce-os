import type { DomainEvent } from '../../../kernel/domain-event';

/** Emitted once when a new user account is created. */
export class UserRegistered implements DomainEvent {
  readonly type = 'identity.user.registered';
  constructor(
    public readonly aggregateId: string,
    public readonly email: string,
    public readonly occurredAt: Date,
  ) {}
}
