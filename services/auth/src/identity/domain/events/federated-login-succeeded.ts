import type { DomainEvent } from '../../../kernel/domain-event';

/** Emitted on a successful sign-in through a linked provider. */
export class FederatedLoginSucceeded implements DomainEvent {
  readonly type = 'identity.federated_identity.login_succeeded';
  constructor(
    public readonly aggregateId: string,
    public readonly userId: string,
    public readonly provider: string,
    public readonly occurredAt: Date,
  ) {}
}
