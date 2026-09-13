import type { TokenHash } from '../value-objects/token-hash';

/**
 * `active`   — the one token that may currently be presented for rotation.
 * `consumed` — already rotated; presenting it again is a reuse attack.
 * `revoked`  — invalidated with its family (reuse detected, expiry, logout).
 */
export type RefreshTokenStatus = 'active' | 'consumed' | 'revoked';

/**
 * RefreshToken — a child entity of the {@link Session} aggregate. One row per
 * generation of the token family; holds only the hash of the secret.
 */
export class RefreshToken {
  private constructor(
    public readonly hash: TokenHash,
    private _status: RefreshTokenStatus,
    public readonly issuedAt: Date,
  ) {}

  static issue(hash: TokenHash, issuedAt: Date): RefreshToken {
    return new RefreshToken(hash, 'active', issuedAt);
  }

  /** Rehydrate from persistence without transition checks. */
  static reconstitute(hash: TokenHash, status: RefreshTokenStatus, issuedAt: Date): RefreshToken {
    return new RefreshToken(hash, status, issuedAt);
  }

  get status(): RefreshTokenStatus {
    return this._status;
  }

  isActive(): boolean {
    return this._status === 'active';
  }

  consume(): void {
    this._status = 'consumed';
  }

  revoke(): void {
    this._status = 'revoked';
  }
}
