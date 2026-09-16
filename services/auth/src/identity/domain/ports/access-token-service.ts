import type { Result } from '../../../kernel/result';
import type { InvalidAccessTokenError } from '../errors';

/**
 * The short-lived credential presented on every authenticated request.
 *
 * It is *derived from* the Session aggregate, never a substitute for it: the
 * session stays the source of truth, and a token only asserts which session it
 * was minted from. Nothing about business state travels in it — no permissions,
 * no roles, no profile — so a token cannot go stale against anything except the
 * session it names, which the caller re-checks on every request.
 *
 * The rotating refresh token is never presented as a request credential; it
 * buys new access tokens and nothing else.
 */
export interface AccessTokenClaims {
  /** `sub` — the authenticated user. */
  readonly userId: string;
  /** `sid` — the session this token was derived from. */
  readonly sessionId: string;
  /** `jti` — unique per token, so an individual credential can be identified. */
  readonly tokenId: string;
  readonly issuedAt: Date;
  readonly expiresAt: Date;
}

export interface IssuedAccessToken {
  readonly token: string;
  readonly expiresAt: Date;
}

export interface AccessTokenService {
  issue(input: { userId: string; sessionId: string }): Promise<IssuedAccessToken>;
  /**
   * Verifies signature, issuer, audience and expiry. Says nothing about whether
   * the session still exists — that check is the caller's, against the
   * aggregate, because only the aggregate knows about revocation.
   */
  verify(token: string): Promise<Result<AccessTokenClaims, InvalidAccessTokenError>>;
}
