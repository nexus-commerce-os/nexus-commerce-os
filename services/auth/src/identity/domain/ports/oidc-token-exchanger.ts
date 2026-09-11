import type { Result } from '../../../kernel/result';
import type { OidcProvider } from '../value-objects/oidc-provider';
import type { OidcTokenExchangeFailedError } from '../errors';

export interface ExchangeAuthorizationCodeRequest {
  provider: OidcProvider;
  code: string;
  /** PKCE verifier proving this exchange belongs to the same client that started it. */
  codeVerifier: string;
  redirectUri: string;
}

/** The raw token set as returned by the provider; only `idToken` is domain-relevant. */
export interface OidcTokenSet {
  readonly idToken: string;
  readonly accessToken?: string;
  readonly refreshToken?: string;
  readonly expiresInSeconds?: number;
}

/**
 * OidcTokenExchanger port — the network boundary to the provider's token
 * endpoint. Implementations own discovery, client authentication and transport;
 * none of that exists in this module. The real adapter arrives in I-7.
 */
export interface OidcTokenExchanger {
  exchange(
    request: ExchangeAuthorizationCodeRequest,
  ): Promise<Result<OidcTokenSet, OidcTokenExchangeFailedError>>;
}
