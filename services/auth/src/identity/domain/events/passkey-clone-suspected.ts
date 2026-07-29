import type { DomainEvent } from '../../../kernel/domain-event';

/**
 * Emitted when a signature counter regresses — the assertion was cryptographically
 * valid yet the counter did not advance, which means two authenticators hold the
 * same credential. A high-severity signal for audit and anomaly detection
 * (docs/08 threat X7).
 */
export class PasskeyCloneSuspected implements DomainEvent {
  readonly type = 'identity.passkey.clone_suspected';
  constructor(
    public readonly aggregateId: string,
    public readonly userId: string,
    public readonly storedSignCount: number,
    public readonly presentedSignCount: number,
    public readonly occurredAt: Date,
  ) {}
}
