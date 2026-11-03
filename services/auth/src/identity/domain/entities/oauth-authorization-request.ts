import { type Result, ok, err } from '../../../kernel/result';
import type { UserId } from '../value-objects/user-id';
import type { OAuthRequestId } from '../value-objects/oauth-request-id';
import type { OidcProvider } from '../value-objects/oidc-provider';
import type { OidcPolicy } from '../value-objects/oidc-policy';
import type { TokenHash } from '../value-objects/token-hash';
import { InvalidOidcStateError, OidcStateExpiredError } from '../errors';

/**
 * `pending`     — redeemable exactly once.
 * `consumed`    — the callback already came back; presenting it again is a replay.
 * `invalidated` — superseded because a newer sign-in was started.
 */
export type OAuthRequestStatus = 'pending' | 'consumed' | 'invalidated';

export type ConsumeOAuthRequestError = InvalidOidcStateError | OidcStateExpiredError;

export interface StartOAuthRequestParams {
  id: OAuthRequestId;
  provider: OidcProvider;
  /** Hash of the CSRF `state`; the raw value goes to the provider, not to storage. */
  stateHash: TokenHash;
  /** Replay guard echoed back inside the `id_token`; must be compared verbatim. */
  nonce: string;
  /** PKCE verifier; sent to the token endpoint on callback, so it is kept as-is. */
  codeVerifier: string;
  redirectUri: string;
  /** Set for a *link* flow — an already-signed-in user attaching a provider. */
  userId: UserId | null;
  policy: OidcPolicy;
  now: Date;
}

export interface ReconstituteOAuthRequestParams {
  id: OAuthRequestId;
  provider: OidcProvider;
  stateHash: TokenHash;
  nonce: string;
  codeVerifier: string;
  redirectUri: string;
  userId: UserId | null;
  status: OAuthRequestStatus;
  createdAt: Date;
  expiresAt: Date;
  consumedAt: Date | null;
}

/**
 * Safe projection of an in-flight request. Deliberately omits `nonce` and
 * `codeVerifier`: both are live secrets for the duration of the ceremony and
 * must never reach a log, an event or an API response.
 */
export interface OAuthRequestSnapshot {
  readonly id: OAuthRequestId;
  readonly provider: string;
  readonly redirectUri: string;
  readonly userId: UserId | null;
  readonly status: OAuthRequestStatus;
  readonly createdAt: Date;
  readonly expiresAt: Date;
  readonly consumedAt: Date | null;
}

/**
 * OAuthAuthorizationRequest aggregate — one in-flight OIDC sign-in.
 *
 * Carries the three anti-forgery values of the ceremony: `state` (CSRF, stored
 * only as a hash), `nonce` (binds the returned `id_token` to *this* request) and
 * the PKCE `codeVerifier` (binds the code exchange to this client). All time
 * arrives as a parameter, so the aggregate stays pure and deterministic.
 */
export class OAuthAuthorizationRequest {
  private constructor(
    public readonly id: OAuthRequestId,
    public readonly provider: OidcProvider,
    public readonly stateHash: TokenHash,
    public readonly nonce: string,
    public readonly codeVerifier: string,
    public readonly redirectUri: string,
    public readonly userId: UserId | null,
    private _status: OAuthRequestStatus,
    public readonly createdAt: Date,
    public readonly expiresAt: Date,
    private _consumedAt: Date | null,
  ) {}

  static start(params: StartOAuthRequestParams): OAuthAuthorizationRequest {
    return new OAuthAuthorizationRequest(
      params.id,
      params.provider,
      params.stateHash,
      params.nonce,
      params.codeVerifier,
      params.redirectUri,
      params.userId,
      'pending',
      params.now,
      new Date(params.now.getTime() + params.policy.authorizationRequestTtlMs()),
      null,
    );
  }

  /** Rehydrate from persistence (no transition checks). */
  static reconstitute(params: ReconstituteOAuthRequestParams): OAuthAuthorizationRequest {
    return new OAuthAuthorizationRequest(
      params.id,
      params.provider,
      params.stateHash,
      params.nonce,
      params.codeVerifier,
      params.redirectUri,
      params.userId,
      params.status,
      params.createdAt,
      params.expiresAt,
      params.consumedAt,
    );
  }

  get status(): OAuthRequestStatus {
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

  /** Whether this ceremony is attaching a provider to an already-known account. */
  isLinkFlow(): boolean {
    return this.userId !== null;
  }

  /**
   * Redeem the request exactly once.
   *
   * Rejects a **provider** mismatch (a callback from one provider can never
   * finish another's ceremony), a **replay** of a consumed or superseded
   * request, and **expiry** at the boundary (`now >= expiresAt`).
   */
  consume(provider: OidcProvider, now: Date): Result<void, ConsumeOAuthRequestError> {
    if (!this.provider.equals(provider)) {
      return err(new InvalidOidcStateError());
    }
    if (this._status !== 'pending') {
      return err(new InvalidOidcStateError());
    }
    if (this.isExpiredAt(now)) {
      return err(new OidcStateExpiredError(this.id));
    }
    this._status = 'consumed';
    this._consumedAt = now;
    return ok(undefined);
  }

  /** Verify the `nonce` returned inside the provider's identity token. */
  matchesNonce(candidate: string): boolean {
    if (candidate.length !== this.nonce.length) {
      return false;
    }
    let diff = 0;
    for (let i = 0; i < candidate.length; i += 1) {
      diff |= candidate.charCodeAt(i) ^ this.nonce.charCodeAt(i);
    }
    return diff === 0;
  }

  /** Supersede because a newer sign-in was started. Idempotent. */
  invalidate(): void {
    if (this._status === 'pending') {
      this._status = 'invalidated';
    }
  }

  snapshot(): OAuthRequestSnapshot {
    return {
      id: this.id,
      provider: this.provider.value,
      redirectUri: this.redirectUri,
      userId: this.userId,
      status: this._status,
      createdAt: this.createdAt,
      expiresAt: this.expiresAt,
      consumedAt: this._consumedAt,
    };
  }
}
