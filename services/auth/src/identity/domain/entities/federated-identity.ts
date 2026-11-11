import type { UserId } from '../value-objects/user-id';
import type { FederatedIdentityId } from '../value-objects/federated-identity-id';
import type { OidcProvider } from '../value-objects/oidc-provider';

export interface LinkFederatedIdentityParams {
  id: FederatedIdentityId;
  userId: UserId;
  provider: OidcProvider;
  /** The provider's stable subject claim (`sub`) — never an email. */
  subject: string;
  /** Address the provider asserted at link time, kept for support/audit context. */
  emailAtLink: string | null;
  now: Date;
}

export interface ReconstituteFederatedIdentityParams extends Omit<
  LinkFederatedIdentityParams,
  'now'
> {
  linkedAt: Date;
  lastUsedAt: Date | null;
  revokedAt: Date | null;
}

export interface FederatedIdentitySnapshot {
  readonly id: FederatedIdentityId;
  readonly userId: UserId;
  readonly provider: string;
  readonly subject: string;
  readonly emailAtLink: string | null;
  readonly linkedAt: Date;
  readonly lastUsedAt: Date | null;
  readonly revokedAt: Date | null;
}

/**
 * FederatedIdentity aggregate — the link between a NEXUS account and one
 * provider account (doc 06 §3.1 `USER_IDENTITY`, keyed on `subject`).
 *
 * Identity is keyed on the provider's **`sub`**, never on email: addresses are
 * re-assignable at many providers, so binding on email would let a recycled
 * address inherit an account. `emailAtLink` is context only, never a lookup key.
 */
export class FederatedIdentity {
  private constructor(
    public readonly id: FederatedIdentityId,
    public readonly userId: UserId,
    public readonly provider: OidcProvider,
    public readonly subject: string,
    public readonly emailAtLink: string | null,
    public readonly linkedAt: Date,
    private _lastUsedAt: Date | null,
    private _revokedAt: Date | null,
  ) {}

  static link(params: LinkFederatedIdentityParams): FederatedIdentity {
    if (params.subject.length === 0) {
      throw new Error('FederatedIdentity subject must not be empty.');
    }
    return new FederatedIdentity(
      params.id,
      params.userId,
      params.provider,
      params.subject,
      params.emailAtLink,
      params.now,
      null,
      null,
    );
  }

  /** Rehydrate from persistence (no transition checks). */
  static reconstitute(params: ReconstituteFederatedIdentityParams): FederatedIdentity {
    return new FederatedIdentity(
      params.id,
      params.userId,
      params.provider,
      params.subject,
      params.emailAtLink,
      params.linkedAt,
      params.lastUsedAt,
      params.revokedAt,
    );
  }

  get lastUsedAt(): Date | null {
    return this._lastUsedAt;
  }

  get revokedAt(): Date | null {
    return this._revokedAt;
  }

  isActive(): boolean {
    return this._revokedAt === null;
  }

  /** Record a successful sign-in through this provider. */
  recordUse(now: Date): void {
    if (this.isActive()) {
      this._lastUsedAt = now;
    }
  }

  /** Unlink. Idempotent; keeps the first revocation time. */
  revoke(now: Date): void {
    if (this._revokedAt === null) {
      this._revokedAt = now;
    }
  }

  snapshot(): FederatedIdentitySnapshot {
    return {
      id: this.id,
      userId: this.userId,
      provider: this.provider.value,
      subject: this.subject,
      emailAtLink: this.emailAtLink,
      linkedAt: this.linkedAt,
      lastUsedAt: this._lastUsedAt,
      revokedAt: this._revokedAt,
    };
  }
}
