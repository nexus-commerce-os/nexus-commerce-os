import { type Result, ok, err } from '../../../kernel/result';
import type { UserId } from '../value-objects/user-id';
import type { WebAuthnChallengeId } from '../value-objects/webauthn-challenge-id';
import type { WebAuthnCeremony } from '../value-objects/webauthn-ceremony';
import type { WebAuthnPolicy } from '../value-objects/webauthn-policy';
import type { TokenHash } from '../value-objects/token-hash';
import { InvalidChallengeError, ChallengeExpiredError } from '../errors';

/**
 * `pending`     — redeemable exactly once.
 * `consumed`    — already redeemed; presenting it again is a replay.
 * `invalidated` — superseded because a newer ceremony was started.
 */
export type WebAuthnChallengeStatus = 'pending' | 'consumed' | 'invalidated';

export type ConsumeChallengeError = InvalidChallengeError | ChallengeExpiredError;

export interface IssueChallengeParams {
  id: WebAuthnChallengeId;
  /** `null` for a discoverable-credential ceremony, where the user is unknown until the response arrives. */
  userId: UserId | null;
  ceremony: WebAuthnCeremony;
  challengeHash: TokenHash;
  policy: WebAuthnPolicy;
  now: Date;
}

export interface ReconstituteChallengeParams {
  id: WebAuthnChallengeId;
  userId: UserId | null;
  ceremony: WebAuthnCeremony;
  challengeHash: TokenHash;
  status: WebAuthnChallengeStatus;
  createdAt: Date;
  expiresAt: Date;
  consumedAt: Date | null;
}

export interface WebAuthnChallengeSnapshot {
  readonly id: WebAuthnChallengeId;
  readonly userId: UserId | null;
  readonly ceremony: WebAuthnCeremony;
  readonly status: WebAuthnChallengeStatus;
  readonly createdAt: Date;
  readonly expiresAt: Date;
  readonly consumedAt: Date | null;
}

/**
 * WebAuthnChallenge aggregate — the single-use nonce that binds one ceremony.
 *
 * Only the **hash** of the challenge is stored: the raw value is handed to the
 * client once and comes back inside the signed client data, so the record never
 * has to hold it. All time arrives as a parameter (the use case reads the
 * `Clock` port), keeping the aggregate pure and deterministic.
 */
export class WebAuthnChallenge {
  private constructor(
    public readonly id: WebAuthnChallengeId,
    public readonly userId: UserId | null,
    public readonly ceremony: WebAuthnCeremony,
    public readonly challengeHash: TokenHash,
    private _status: WebAuthnChallengeStatus,
    public readonly createdAt: Date,
    public readonly expiresAt: Date,
    private _consumedAt: Date | null,
  ) {}

  static issue(params: IssueChallengeParams): WebAuthnChallenge {
    return new WebAuthnChallenge(
      params.id,
      params.userId,
      params.ceremony,
      params.challengeHash,
      'pending',
      params.now,
      new Date(params.now.getTime() + params.policy.challengeTtlMs()),
      null,
    );
  }

  /** Rehydrate from persistence (no transition checks). */
  static reconstitute(params: ReconstituteChallengeParams): WebAuthnChallenge {
    return new WebAuthnChallenge(
      params.id,
      params.userId,
      params.ceremony,
      params.challengeHash,
      params.status,
      params.createdAt,
      params.expiresAt,
      params.consumedAt,
    );
  }

  get status(): WebAuthnChallengeStatus {
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
   * Redeem the challenge exactly once.
   *
   * Rejects, in order: a **ceremony** mismatch (a registration challenge can
   * never complete an authentication), a **user** mismatch (a challenge bound to
   * one account cannot be finished by another), a **replay** of a consumed or
   * superseded challenge, and **expiry** at the boundary (`now >= expiresAt`).
   *
   * A `null`-bound challenge accepts any user: that is the discoverable
   * credential case, where the account is only learned from the response.
   */
  consume(
    ceremony: WebAuthnCeremony,
    userId: UserId | null,
    now: Date,
  ): Result<void, ConsumeChallengeError> {
    if (this.ceremony !== ceremony) {
      return err(new InvalidChallengeError());
    }
    if (this.userId !== null && this.userId !== userId) {
      return err(new InvalidChallengeError());
    }
    if (this._status !== 'pending') {
      return err(new InvalidChallengeError());
    }
    if (this.isExpiredAt(now)) {
      return err(new ChallengeExpiredError(this.id));
    }
    this._status = 'consumed';
    this._consumedAt = now;
    return ok(undefined);
  }

  /** Supersede because a newer ceremony was started. Idempotent; never revives a consumed challenge. */
  invalidate(): void {
    if (this._status === 'pending') {
      this._status = 'invalidated';
    }
  }

  snapshot(): WebAuthnChallengeSnapshot {
    return {
      id: this.id,
      userId: this.userId,
      ceremony: this.ceremony,
      status: this._status,
      createdAt: this.createdAt,
      expiresAt: this.expiresAt,
      consumedAt: this._consumedAt,
    };
  }
}
