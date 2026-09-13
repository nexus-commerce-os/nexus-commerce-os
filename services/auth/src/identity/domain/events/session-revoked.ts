import type { DomainEvent } from '../../../kernel/domain-event';
import type { SessionRevocationReason } from '../value-objects/session-revocation-reason';

/** Emitted when a session and its whole token family are invalidated. */
export class SessionRevoked implements DomainEvent {
  readonly type = 'identity.session.revoked';
  constructor(
    public readonly aggregateId: string,
    public readonly userId: string,
    public readonly reason: SessionRevocationReason,
    public readonly occurredAt: Date,
  ) {}
}
