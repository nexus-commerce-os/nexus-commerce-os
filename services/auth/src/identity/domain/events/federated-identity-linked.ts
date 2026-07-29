import type { DomainEvent } from '../../../kernel/domain-event';

/** Emitted when a provider account is attached to a NEXUS account. */
export class FederatedIdentityLinked implements DomainEvent {
  readonly type = 'identity.federated_identity.linked';
  constructor(
    public readonly aggregateId: string,
    public readonly userId: string,
    public readonly provider: string,
    public readonly occurredAt: Date,
  ) {}
}
