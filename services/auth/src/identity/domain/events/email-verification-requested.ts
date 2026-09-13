import type { DomainEvent } from '../../../kernel/domain-event';

/**
 * Emitted when a verification link is minted. The I-7 notification subscriber
 * reacts to this; the event deliberately carries **no token secret** — the raw
 * value is returned once to the caller and never travels through the event bus.
 */
export class EmailVerificationRequested implements DomainEvent {
  readonly type = 'identity.email_verification.requested';
  constructor(
    public readonly aggregateId: string,
    public readonly userId: string,
    public readonly email: string,
    public readonly occurredAt: Date,
  ) {}
}
