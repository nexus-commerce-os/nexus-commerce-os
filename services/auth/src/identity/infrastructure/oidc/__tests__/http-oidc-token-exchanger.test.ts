import { describe, it, expect } from 'vitest';
import { HttpOidcTokenExchanger, type HttpPost } from '../http-oidc-token-exchanger';
import type { OidcProviderRegistry } from '../oidc-provider-registry';
import { OidcProvider } from '../../../domain/value-objects/oidc-provider';

const GOOGLE = OidcProvider.fromSlug('google');
const TOKEN_ENDPOINT = 'https://accounts.example-idp.com/token';

const providers: OidcProviderRegistry = {
  google: {
    issuer: 'https://accounts.example-idp.com',
    jwksUri: 'https://accounts.example-idp.com/jwks',
    tokenEndpoint: TOKEN_ENDPOINT,
    clientId: 'nexus-client',
    clientSecret: 'test-only-client-secret',
    allowedAlgorithms: ['RS256'],
  },
};

interface Recorded {
  url: string;
  headers: Record<string, string>;
  body: URLSearchParams;
}

/** A token endpoint stand-in that records what we sent it. */
function endpoint(
  reply: { ok: boolean; status: number; payload: unknown } | { throws: true },
): { post: HttpPost; calls: Recorded[] } {
  const calls: Recorded[] = [];
  const post: HttpPost = (url, init) => {
    calls.push({ url, headers: init.headers, body: new URLSearchParams(init.body) });
    if ('throws' in reply) {
      return Promise.reject(new Error('ECONNREFUSED'));
    }
    return Promise.resolve({
      ok: reply.ok,
      status: reply.status,
      json: () => Promise.resolve(reply.payload),
    });
  };
  return { post, calls };
}

const REQUEST = {
  provider: GOOGLE,
  code: 'auth-code-123',
  codeVerifier: 'pkce-verifier-value',
  redirectUri: 'https://nexus.example/callback',
};

describe('HttpOidcTokenExchanger', () => {
  it('returns the token set on a successful exchange', async () => {
    const { post } = endpoint({
      ok: true,
      status: 200,
      payload: {
        id_token: 'the.id.token',
        access_token: 'the-access-token',
        refresh_token: 'the-refresh-token',
        expires_in: 3600,
      },
    });

    const result = await new HttpOidcTokenExchanger(providers, post).exchange(REQUEST);

    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.value).toEqual({
        idToken: 'the.id.token',
        accessToken: 'the-access-token',
        refreshToken: 'the-refresh-token',
        expiresInSeconds: 3600,
      });
    }
  });

  /** PKCE is the proof this exchange belongs to the client that started it. */
  it('sends the authorization code grant with the PKCE verifier and redirect uri', async () => {
    const { post, calls } = endpoint({ ok: true, status: 200, payload: { id_token: 't' } });

    await new HttpOidcTokenExchanger(providers, post).exchange(REQUEST);

    expect(calls).toHaveLength(1);
    expect(calls[0].url).toBe(TOKEN_ENDPOINT);
    expect(calls[0].body.get('grant_type')).toBe('authorization_code');
    expect(calls[0].body.get('code')).toBe('auth-code-123');
    expect(calls[0].body.get('code_verifier')).toBe('pkce-verifier-value');
    expect(calls[0].body.get('redirect_uri')).toBe('https://nexus.example/callback');
  });

  /** The secret belongs in the auth header, not in a body a provider may log. */
  it('authenticates with client_secret_basic and keeps the secret out of the body', async () => {
    const { post, calls } = endpoint({ ok: true, status: 200, payload: { id_token: 't' } });

    await new HttpOidcTokenExchanger(providers, post).exchange(REQUEST);

    const expected = Buffer.from('nexus-client:test-only-client-secret').toString('base64');
    expect(calls[0].headers['authorization']).toBe(`Basic ${expected}`);
    expect(calls[0].headers['content-type']).toBe('application/x-www-form-urlencoded');
    expect(calls[0].body.get('client_secret')).toBeNull();
    expect(calls[0].body.toString()).not.toContain('test-only-client-secret');
  });

  it('reports the provider’s OAuth error code rather than the bare status', async () => {
    const { post } = endpoint({
      ok: false,
      status: 400,
      payload: { error: 'invalid_grant', error_description: 'code already redeemed' },
    });

    const result = await new HttpOidcTokenExchanger(providers, post).exchange(REQUEST);

    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.error.reason).toBe('invalid_grant');
    }
  });

  it('falls back to the status when the provider sends no error code', async () => {
    const { post } = endpoint({ ok: false, status: 503, payload: {} });
    const result = await new HttpOidcTokenExchanger(providers, post).exchange(REQUEST);
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.error.reason).toBe('http_503');
    }
  });

  /** An OIDC exchange without an identity token is useless — refuse it outright. */
  it('refuses a 200 that carries no id_token', async () => {
    const { post } = endpoint({ ok: true, status: 200, payload: { access_token: 'only-this' } });
    const result = await new HttpOidcTokenExchanger(providers, post).exchange(REQUEST);
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.error.reason).toContain('no id_token');
    }
  });

  it('handles an unreadable body and an unreachable endpoint', async () => {
    const unreadable: HttpPost = () =>
      Promise.resolve({
        ok: true,
        status: 200,
        json: () => Promise.reject(new Error('not json')),
      });
    const broken = await new HttpOidcTokenExchanger(providers, unreadable).exchange(REQUEST);
    expect(broken.ok).toBe(false);
    if (!broken.ok) {
      expect(broken.error.reason).toContain('unreadable');
    }

    const { post } = endpoint({ throws: true });
    const unreachable = await new HttpOidcTokenExchanger(providers, post).exchange(REQUEST);
    expect(unreachable.ok).toBe(false);
    if (!unreachable.ok) {
      expect(unreachable.error.reason).toContain('ECONNREFUSED');
    }
  });

  it('refuses an unknown provider without calling anything', async () => {
    const { post, calls } = endpoint({ ok: true, status: 200, payload: { id_token: 't' } });
    const result = await new HttpOidcTokenExchanger(providers, post).exchange({
      ...REQUEST,
      provider: OidcProvider.fromSlug('nobody'),
    });

    expect(result.ok).toBe(false);
    expect(calls).toHaveLength(0);
  });

  it('omits optional fields the provider did not send', async () => {
    const { post } = endpoint({ ok: true, status: 200, payload: { id_token: 'only-id' } });
    const result = await new HttpOidcTokenExchanger(providers, post).exchange(REQUEST);
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.value).toEqual({ idToken: 'only-id' });
    }
  });
});
