import { type Result, ok, err } from '../../kernel/result';
import { OidcTokenExchangeFailedError, InvalidOidcTokenError } from '../domain/errors';
import type {
  OidcTokenExchanger,
  ExchangeAuthorizationCodeRequest,
  OidcTokenSet,
} from '../domain/ports/oidc-token-exchanger';
import type {
  OidcTokenVerifier,
  VerifyIdTokenRequest,
  VerifiedIdToken,
} from '../domain/ports/oidc-token-verifier';

/**
 * Test doubles for the OIDC ports.
 *
 * They live in the test tree on purpose: no permissive stand-in ships in `src`.
 * The real adapters — discovery, token exchange, JWKS and JWT verification —
 * arrive in I-7. These doubles let the *identity* rules around the ceremony
 * (state single-use, nonce binding, subject uniqueness, auto-link policy,
 * last-factor guard) be tested without pretending to do cryptography.
 */
export class StubOidcTokenExchanger implements OidcTokenExchanger {
  private result: Result<OidcTokenSet, OidcTokenExchangeFailedError> = ok({
    idToken: 'stub-id-token',
  });

  /** Record of the last exchange, so tests can assert PKCE was passed through. */
  lastRequest: ExchangeAuthorizationCodeRequest | null = null;

  succeedWith(tokens: OidcTokenSet): void {
    this.result = ok(tokens);
  }

  fail(reason: string): void {
    this.result = err(new OidcTokenExchangeFailedError(reason));
  }

  exchange(
    request: ExchangeAuthorizationCodeRequest,
  ): Promise<Result<OidcTokenSet, OidcTokenExchangeFailedError>> {
    this.lastRequest = request;
    return Promise.resolve(this.result);
  }
}

export class StubOidcTokenVerifier implements OidcTokenVerifier {
  private result: Result<VerifiedIdToken, InvalidOidcTokenError>;

  constructor(claims: VerifiedIdToken) {
    this.result = ok(claims);
  }

  setClaims(claims: VerifiedIdToken): void {
    this.result = ok(claims);
  }

  fail(reason: string): void {
    this.result = err(new InvalidOidcTokenError(reason));
  }

  verifyIdToken(
    _request: VerifyIdTokenRequest,
  ): Promise<Result<VerifiedIdToken, InvalidOidcTokenError>> {
    return Promise.resolve(this.result);
  }
}

export function verifiedIdToken(overrides: Partial<VerifiedIdToken> = {}): VerifiedIdToken {
  return {
    issuer: 'https://accounts.example-idp.com',
    subject: 'provider-subject-0001',
    audience: 'nexus-client',
    nonce: null,
    email: 'jane@example.com',
    emailVerified: true,
    ...overrides,
  };
}
