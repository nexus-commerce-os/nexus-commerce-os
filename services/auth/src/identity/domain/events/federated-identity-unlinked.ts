import type { DomainEvent } from '../../../kernel/domain-event';

/** Emitted when a provider account is detached from a NEXUS account. */
export class FederatedIdentityUnlinked implements DomainEvent {
  readonly type = 'identity.federated_identity.unlinked';
  constructor(
    public readonly aggregateId: string,
    public readonly userId: string,
    public readonly provider: string,
    public readonly occurredAt: Date,
  ) {}
}
