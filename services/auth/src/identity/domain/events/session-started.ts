import type { DomainEvent } from '../../../kernel/domain-event';

/** Emitted when a new session (and its refresh-token family) is created. */
export class SessionStarted implements DomainEvent {
  readonly type = 'identity.session.started';
  constructor(
    public readonly aggregateId: string,
    public readonly userId: string,
    public readonly occurredAt: Date,
  ) {}
}
