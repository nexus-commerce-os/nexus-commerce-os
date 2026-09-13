/**
 * Everything needed to talk to one identity provider. Supplied by the
 * composition root from configuration — never discovered at request time, so a
 * compromised or unreachable discovery document cannot silently repoint us at
 * another issuer.
 */
export interface OidcProviderSettings {
  /** Exact `iss` the identity token must carry. */
  readonly issuer: string;
  /** Where to fetch the provider's signing keys. */
  readonly jwksUri: string;
  readonly tokenEndpoint: string;
  readonly clientId: string;
  readonly clientSecret: string;
  /**
   * Signature algorithms we will accept. Pinned per provider so a token signed
   * with an unexpected — or absent — algorithm is refused rather than trusted.
   */
  readonly allowedAlgorithms: readonly string[];
}

/** Slug → settings. Lookup is exact; unknown providers are simply not usable. */
export type OidcProviderRegistry = Readonly<Record<string, OidcProviderSettings>>;

export const DEFAULT_ALLOWED_ALGORITHMS: readonly string[] = ['RS256', 'ES256'];
