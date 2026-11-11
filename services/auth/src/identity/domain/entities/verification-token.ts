import { type Result, ok, err } from '../../../kernel/result';
import type { UserId } from '../value-objects/user-id';
import type { VerificationTokenId } from '../value-objects/verification-token-id';
import type { VerificationPurpose } from '../value-objects/verification-purpose';
import type { VerificationPolicy } from '../value-objects/verification-policy';
import type { TokenHash } from '../value-objects/token-hash';
import { Email } from '../value-objects/email';
import {
  InvalidVerificationTokenError,
  VerificationTokenExpiredError,
  VerificationTokenAlreadyUsedError,
} from '../errors';

/**
 * `pending`     — redeemable exactly once.
 * `consumed`    — already redeemed; presenting it again is a replay.
 * `invalidated` — superseded by a newer request for the same (user, purpose).
 */
export type VerificationTokenStatus = 'pending' | 'consumed' | 'invalidated';

export type ConsumeTokenError =
  InvalidVerificationTokenError | VerificationTokenExpiredError | VerificationTokenAlreadyUsedError;

export interface IssueVerificationTokenParams {
  id: VerificationTokenId;
  userId: UserId;
  purpose: VerificationPurpose;
  /** The address this token is bound to — see {@link VerificationToken.consume}. */
  email: Email;
  tokenHash: TokenHash;
  policy: VerificationPolicy;
  now: Date;
}

export interface ReconstituteVerificationTokenParams {
  id: VerificationTokenId;
  userId: UserId;
  purpose: VerificationPurpose;
  email: Email;
  tokenHash: TokenHash;
  status: VerificationTokenStatus;
  createdAt: Date;
  expiresAt: Date;
  consumedAt: Date | null;
}

export interface VerificationTokenSnapshot {
  readonly id: VerificationTokenId;
  readonly userId: UserId;
  readonly purpose: VerificationPurpose;
  readonly email: string;
  readonly status: VerificationTokenStatus;
  readonly createdAt: Date;
  readonly expiresAt: Date;
  readonly consumedAt: Date | null;
}

/**
 * VerificationToken aggregate — a single-use, expiring capability that proves the
 * holder controls an inbox (email verification) or is entitled to reset a
 * password.
 *
 * Only the **hash** of the secret is ever stored; the raw value is handed to the
 * caller once at issue time. All time arrives as a parameter (the use case reads
 * the `Clock` port), so the aggregate itself is pure and deterministic.
 */
export class VerificationToken {
  private constructor(
    public readonly id: VerificationTokenId,
    public readonly userId: UserId,
    public readonly purpose: VerificationPurpose,
    public readonly email: Email,
    public readonly tokenHash: TokenHash,
    private _status: VerificationTokenStatus,
    public readonly createdAt: Date,
    public readonly expiresAt: Date,
    private _consumedAt: Date | null,
  ) {}

  static issue(params: IssueVerificationTokenParams): VerificationToken {
    const ttl = params.policy.ttlFor(params.purpose);
    return new VerificationToken(
      params.id,
      params.userId,
      params.purpose,
      params.email,
      params.tokenHash,
      'pending',
      params.now,
      new Date(params.now.getTime() + ttl),
      null,
    );
  }

  /** Rehydrate from persistence (no transition checks, no events). */
  static reconstitute(params: ReconstituteVerificationTokenParams): VerificationToken {
    return new VerificationToken(
      params.id,
      params.userId,
      params.purpose,
      params.email,
      params.tokenHash,
      params.status,
      params.createdAt,
      params.expiresAt,
      params.consumedAt,
    );
  }

  get status(): VerificationTokenStatus {
    return this._status;
  }

  get consumedAt(): Date | null {
    return this._consumedAt;
  }

  isPending(): boolean {
    return this._status === 'pending';
  }

  isExpiredAt(now: Date): boolean {
    return now.getTime() >= this.expiresAt.getTime();
  }

  /**
   * Redeem the token exactly once.
   *
   * Checks, in order:
   *  1. **purpose** — a reset token can never be redeemed as an email
   *     verification (or vice-versa);
   *  2. **email binding** — the address the token was minted for must still be
   *     the user's current address, so a token issued before a `changeEmail`
   *     cannot verify an address its holder never proved;
   *  3. **replay** — an already consumed or superseded token is rejected;
   *  4. **expiry** — evaluated at the boundary: `now >= expiresAt` is expired.
   *
   * A wrong purpose or a stale email binding both collapse to
   * `InvalidVerificationTokenError` so the response reveals nothing about why.
   *
   * NOTE for the Postgres adapter (I-6): cross-process single-use must be
   * enforced by a conditional update (`UPDATE … WHERE status = 'pending'
   * RETURNING …`); the in-process check here cannot span connections.
   */
  consume(
    purpose: VerificationPurpose,
    currentEmail: Email,
    now: Date,
  ): Result<void, ConsumeTokenError> {
    if (this.purpose !== purpose) {
      return err(new InvalidVerificationTokenError());
    }
    if (!this.email.equals(currentEmail)) {
      return err(new InvalidVerificationTokenError());
    }
    if (this._status === 'consumed') {
      return err(new VerificationTokenAlreadyUsedError(this.id));
    }
    if (this._status === 'invalidated') {
      return err(new InvalidVerificationTokenError());
    }
    if (this.isExpiredAt(now)) {
      return err(new VerificationTokenExpiredError(this.id));
    }
    this._status = 'consumed';
    this._consumedAt = now;
    return ok(undefined);
  }

  /** Supersede this token because a newer one was requested. Idempotent; never revives a consumed token. */
  invalidate(): void {
    if (this._status === 'pending') {
      this._status = 'invalidated';
    }
  }

  snapshot(): VerificationTokenSnapshot {
    return {
      id: this.id,
      userId: this.userId,
      purpose: this.purpose,
      email: this.email.value,
      status: this._status,
      createdAt: this.createdAt,
      expiresAt: this.expiresAt,
      consumedAt: this._consumedAt,
    };
  }
}
