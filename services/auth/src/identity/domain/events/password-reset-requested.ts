import type { DomainEvent } from '../../../kernel/domain-event';

/**
 * Emitted when a password-reset link is minted. Carries no token secret.
 *
 * Note this is emitted **only when a token was actually issued** — i.e. only for
 * a real, active account. The use case still answers the caller identically
 * either way, so the anti-enumeration guarantee is not weakened by the event.
 */
export class PasswordResetRequested implements DomainEvent {
  readonly type = 'identity.password_reset.requested';
  constructor(
    public readonly aggregateId: string,
    public readonly userId: string,
    public readonly email: string,
    public readonly occurredAt: Date,
  ) {}
}
