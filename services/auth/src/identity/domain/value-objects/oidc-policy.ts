/**
 * OidcPolicy port — how long an in-flight authorization request stays valid, and
 * whether an identity may be auto-linked to an existing local account.
 *
 * Behind an interface so both can be tightened per tenant or per provider
 * without touching the aggregate or the use cases; neither is hard-coded in
 * business logic.
 */
export interface OidcPolicy {
  /** Lifetime in milliseconds of a pending authorization request (state/nonce/PKCE). */
  authorizationRequestTtlMs(): number;

  /**
   * Whether a provider identity may attach itself to an existing account found
   * by email, without the user first proving they hold that account.
   *
   * Auto-linking is an account-takeover vector: an IdP that does not verify
   * addresses could assert someone else's email and inherit their account. The
   * default therefore demands proof from **both** sides — the provider says the
   * address is verified, and we have verified it locally too.
   */
  allowsAutoLink(providerEmailVerified: boolean, localEmailVerified: boolean): boolean;
}

const MINUTE = 60 * 1000;

/** Default: 10-minute authorization window; auto-link only when both sides verified. */
export class DefaultOidcPolicy implements OidcPolicy {
  private static readonly REQUEST_TTL_MS = 10 * MINUTE;

  authorizationRequestTtlMs(): number {
    return DefaultOidcPolicy.REQUEST_TTL_MS;
  }

  allowsAutoLink(providerEmailVerified: boolean, localEmailVerified: boolean): boolean {
    return providerEmailVerified && localEmailVerified;
  }
}
