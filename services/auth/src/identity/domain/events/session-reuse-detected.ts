import type { DomainEvent } from '../../../kernel/domain-event';

/**
 * Emitted when an already-consumed refresh token is presented again — a strong
 * token-theft signal. Raised alongside the family revocation so downstream
 * consumers (audit, anomaly detection) can react (doc 08 §3.4, §7).
 */
export class SessionReuseDetected implements DomainEvent {
  readonly type = 'identity.session.reuse_detected';
  constructor(
    public readonly aggregateId: string,
    public readonly userId: string,
    public readonly occurredAt: Date,
  ) {}
}
