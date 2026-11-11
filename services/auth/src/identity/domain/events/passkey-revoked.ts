import type { DomainEvent } from '../../../kernel/domain-event';

/** Emitted when a user disowns an authenticator. */
export class PasskeyRevoked implements DomainEvent {
  readonly type = 'identity.passkey.revoked';
  constructor(
    public readonly aggregateId: string,
    public readonly userId: string,
    public readonly occurredAt: Date,
  ) {}
}
