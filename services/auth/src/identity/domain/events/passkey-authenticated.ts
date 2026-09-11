import type { DomainEvent } from '../../../kernel/domain-event';

/**
 * Emitted on a successful passkey assertion. `counterSupported` is false when the
 * authenticator keeps no signature counter — clone detection is impossible for
 * that credential, which downstream risk scoring may want to weigh.
 */
export class PasskeyAuthenticated implements DomainEvent {
  readonly type = 'identity.passkey.authenticated';
  constructor(
    public readonly aggregateId: string,
    public readonly userId: string,
    public readonly counterSupported: boolean,
    public readonly occurredAt: Date,
  ) {}
}
