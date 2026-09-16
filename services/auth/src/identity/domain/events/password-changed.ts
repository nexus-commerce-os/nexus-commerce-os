import type { DomainEvent } from '../../../kernel/domain-event';

/** Emitted when a user's password credential is replaced. */
export class PasswordChanged implements DomainEvent {
  readonly type = 'identity.user.password_changed';
  constructor(
    public readonly aggregateId: string,
    public readonly occurredAt: Date,
  ) {}
}
