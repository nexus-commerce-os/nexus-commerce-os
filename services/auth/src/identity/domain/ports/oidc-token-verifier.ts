import type { Result } from '../../../kernel/result';
import type { OidcProvider } from '../value-objects/oidc-provider';
import type { InvalidOidcTokenError } from '../errors';

export interface VerifyIdTokenRequest {
  provider: OidcProvider;
  idToken: string;
}

/** Claims taken from a *cryptographically verified* identity token. */
export interface VerifiedIdToken {
  readonly issuer: string;
  /** The provider's stable identifier for the end user (`sub`). */
  readonly subject: string;
  readonly audience: string;
  /** Echoed back from the authorization request; the domain compares it. */
  readonly nonce: string | null;
  readonly email: string | null;
  readonly emailVerified: boolean;
}

/**
 * OidcTokenVerifier port — the entire JWT/JWKS boundary.
 *
 * An implementation MUST validate signature, issuer, audience and expiry against
 * the provider's published keys, and MUST fail closed. No implementation ships
 * here by design: the real adapter arrives in I-7, and tests supply explicit
 * doubles rather than a permissive stand-in in `src`.
 *
 * `nonce` is returned rather than checked here — binding it to the pending
 * request is a domain rule, enforced by the use case.
 */
export interface OidcTokenVerifier {
  verifyIdToken(
    request: VerifyIdTokenRequest,
  ): Promise<Result<VerifiedIdToken, InvalidOidcTokenError>>;
}
