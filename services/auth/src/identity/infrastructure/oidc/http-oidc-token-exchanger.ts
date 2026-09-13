import { type Result, ok, err } from '../../../kernel/result';
import { OidcTokenExchangeFailedError } from '../../domain/errors';
import type {
  OidcTokenExchanger,
  ExchangeAuthorizationCodeRequest,
  OidcTokenSet,
} from '../../domain/ports/oidc-token-exchanger';
import type { OidcProviderRegistry } from './oidc-provider-registry';

/** The subset of `fetch` this adapter needs; injectable so tests need no network. */
export type HttpPost = (
  url: string,
  init: { method: 'POST'; headers: Record<string, string>; body: string },
) => Promise<{ ok: boolean; status: number; json: () => Promise<unknown> }>;

interface TokenEndpointResponse {
  id_token?: unknown;
  access_token?: unknown;
  refresh_token?: unknown;
  expires_in?: unknown;
  error?: unknown;
  error_description?: unknown;
}

/**
 * The real {@link OidcTokenExchanger} — the deferral from I-5.
 *
 * Redeems an authorization code at the provider's token endpoint. Two details
 * carry the security weight:
 *
 * - the PKCE `code_verifier` goes in the body, which is what proves this
 *   exchange belongs to the client that started the ceremony;
 * - client credentials go in the **Authorization header** (`client_secret_basic`)
 *   rather than the body, so the secret does not end up in a provider's request
 *   log alongside the code.
 *
 * Any non-2xx, malformed, or `id_token`-less response is a failure. An OIDC
 * exchange without an identity token is useless to us, so it is refused rather
 * than half-accepted.
 */
export class HttpOidcTokenExchanger implements OidcTokenExchanger {
  constructor(
    private readonly providers: OidcProviderRegistry,
    private readonly post: HttpPost = globalThis.fetch as unknown as HttpPost,
  ) {}

  async exchange(
    request: ExchangeAuthorizationCodeRequest,
  ): Promise<Result<OidcTokenSet, OidcTokenExchangeFailedError>> {
    const settings = this.providers[request.provider.value];
    if (settings === undefined) {
      return err(new OidcTokenExchangeFailedError('unknown provider'));
    }

    const body = new URLSearchParams({
      grant_type: 'authorization_code',
      code: request.code,
      code_verifier: request.codeVerifier,
      redirect_uri: request.redirectUri,
    }).toString();
    const basic = Buffer.from(`${settings.clientId}:${settings.clientSecret}`).toString('base64');

    let response;
    try {
      response = await this.post(settings.tokenEndpoint, {
        method: 'POST',
        headers: {
          'content-type': 'application/x-www-form-urlencoded',
          accept: 'application/json',
          authorization: `Basic ${basic}`,
        },
        body,
      });
    } catch (error) {
      return err(new OidcTokenExchangeFailedError(describe(error)));
    }

    let payload: TokenEndpointResponse;
    try {
      payload = (await response.json()) as TokenEndpointResponse;
    } catch {
      return err(new OidcTokenExchangeFailedError(`unreadable response (${response.status})`));
    }

    if (!response.ok) {
      // providers report failures as an OAuth error code; prefer it over the status
      const code = typeof payload.error === 'string' ? payload.error : `http_${response.status}`;
      return err(new OidcTokenExchangeFailedError(code));
    }

    const idToken = payload.id_token;
    if (typeof idToken !== 'string' || idToken.length === 0) {
      return err(new OidcTokenExchangeFailedError('response carried no id_token'));
    }

    return ok({
      idToken,
      ...(typeof payload.access_token === 'string' ? { accessToken: payload.access_token } : {}),
      ...(typeof payload.refresh_token === 'string' ? { refreshToken: payload.refresh_token } : {}),
      ...(typeof payload.expires_in === 'number' ? { expiresInSeconds: payload.expires_in } : {}),
    });
  }
}

function describe(error: unknown): string {
  return error instanceof Error ? error.message : 'token endpoint unreachable';
}
