import type { DomainEvent } from '../../../kernel/domain-event';

/** Emitted when a refresh token is rotated and the idle window slides forward. */
export class SessionRefreshed implements DomainEvent {
  readonly type = 'identity.session.refreshed';
  constructor(
    public readonly aggregateId: string,
    public readonly userId: string,
    public readonly occurredAt: Date,
  ) {}
}
