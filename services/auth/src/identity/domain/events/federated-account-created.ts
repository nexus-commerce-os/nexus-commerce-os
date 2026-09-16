import type { DomainEvent } from '../../../kernel/domain-event';

/**
 * Emitted when a brand-new account is bootstrapped from a provider sign-in.
 *
 * Such an account has **no password factor**. Under docs/08 §3.2 social login
 * must not remain the only factor for money-moving capabilities, so downstream
 * policy is expected to require elevation (passkey/MFA) before enabling them.
 */
export class FederatedAccountCreated implements DomainEvent {
  readonly type = 'identity.user.federated_account_created';
  constructor(
    public readonly aggregateId: string,
    public readonly provider: string,
    public readonly emailVerified: boolean,
    public readonly occurredAt: Date,
  ) {}
}
