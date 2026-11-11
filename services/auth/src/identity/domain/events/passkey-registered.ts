import type { DomainEvent } from '../../../kernel/domain-event';

/** Emitted when a new authenticator is bound to an account. */
export class PasskeyRegistered implements DomainEvent {
  readonly type = 'identity.passkey.registered';
  constructor(
    public readonly aggregateId: string,
    public readonly userId: string,
    public readonly deviceId: string | null,
    public readonly occurredAt: Date,
  ) {}
}
