import { describe, it, expect, beforeAll } from 'vitest';
import {
  SignJWT,
  exportJWK,
  generateKeyPair,
  createLocalJWKSet,
  type JWK,
  type KeyLike,
} from 'jose';
import { JoseOidcTokenVerifier } from '../jose-oidc-token-verifier';
import type { OidcProviderRegistry } from '../oidc-provider-registry';
import { OidcProvider } from '../../../domain/value-objects/oidc-provider';

const GOOGLE = OidcProvider.fromSlug('google');
const ISSUER = 'https://accounts.example-idp.com';
const CLIENT_ID = 'nexus-client';

const providers: OidcProviderRegistry = {
  google: {
    issuer: ISSUER,
    jwksUri: 'https://accounts.example-idp.com/jwks',
    tokenEndpoint: 'https://accounts.example-idp.com/token',
    clientId: CLIENT_ID,
    clientSecret: 'test-only-client-secret',
    allowedAlgorithms: ['RS256'],
  },
};

/**
 * A real signing key and a real JWKS, served locally.
 *
 * Every token below is genuinely signed and genuinely verified — the only thing
 * stubbed is the network hop to fetch the key set, so the cryptography under
 * test is the same code that will run in production.
 */
let signingKey: KeyLike;
let publicJwk: JWK;
let strangerKey: KeyLike;

beforeAll(async () => {
  const pair = await generateKeyPair('RS256', { extractable: true });
  signingKey = pair.privateKey;
  publicJwk = { ...(await exportJWK(pair.publicKey)), alg: 'RS256', kid: 'test-key' };
  const other = await generateKeyPair('RS256', { extractable: true });
  strangerKey = other.privateKey;
});

function verifier(): JoseOidcTokenVerifier {
  const jwks = createLocalJWKSet({ keys: [publicJwk] });
  return new JoseOidcTokenVerifier(providers, () => jwks);
}

async function idToken(
  claims: Record<string, unknown> = {},
  options: { issuer?: string; audience?: string; key?: KeyLike; expired?: boolean } = {},
): Promise<string> {
  const now = Math.floor(Date.now() / 1000);
  return new SignJWT({ ...claims })
    .setProtectedHeader({ alg: 'RS256', kid: 'test-key' })
    .setIssuer(options.issuer ?? ISSUER)
    .setAudience(options.audience ?? CLIENT_ID)
    .setSubject((claims['sub'] as string | undefined) ?? 'provider-subject-0001')
    .setIssuedAt(options.expired === true ? now - 7200 : now)
    .setExpirationTime(options.expired === true ? now - 3600 : now + 3600)
    .sign(options.key ?? signingKey);
}

describe('JoseOidcTokenVerifier', () => {
  it('verifies a genuinely signed token and surfaces its claims', async () => {
    const token = await idToken({
      nonce: 'nonce-abc',
      email: 'jane@example.com',
      email_verified: true,
    });

    const result = await verifier().verifyIdToken({ provider: GOOGLE, idToken: token });

    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.value.subject).toBe('provider-subject-0001');
      expect(result.value.issuer).toBe(ISSUER);
      expect(result.value.audience).toBe(CLIENT_ID);
      expect(result.value.nonce).toBe('nonce-abc');
      expect(result.value.email).toBe('jane@example.com');
      expect(result.value.emailVerified).toBe(true);
    }
  });

  /** An absent claim must never be read as "verified". */
  it('treats a missing or non-true email_verified as unverified', async () => {
    for (const claims of [
      { email: 'jane@example.com' },
      { email: 'jane@example.com', email_verified: 'true' },
      { email: 'jane@example.com', email_verified: false },
    ]) {
      const result = await verifier().verifyIdToken({
        provider: GOOGLE,
        idToken: await idToken(claims),
      });
      expect(result.ok).toBe(true);
      if (result.ok) {
        expect(result.value.emailVerified).toBe(false);
      }
    }
  });

  it('reports a missing nonce as null rather than inventing one', async () => {
    const result = await verifier().verifyIdToken({
      provider: GOOGLE,
      idToken: await idToken(),
    });
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.value.nonce).toBeNull();
    }
  });

  it('rejects a token signed by a key we do not trust', async () => {
    const token = await idToken({}, { key: strangerKey });
    const result = await verifier().verifyIdToken({ provider: GOOGLE, idToken: token });
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.error._tag).toBe('InvalidOidcTokenError');
    }
  });

  it('rejects a token from another issuer', async () => {
    const token = await idToken({}, { issuer: 'https://evil-idp.example' });
    expect((await verifier().verifyIdToken({ provider: GOOGLE, idToken: token })).ok).toBe(false);
  });

  it('rejects a token minted for another audience', async () => {
    const token = await idToken({}, { audience: 'someone-elses-client' });
    expect((await verifier().verifyIdToken({ provider: GOOGLE, idToken: token })).ok).toBe(false);
  });

  it('rejects an expired token', async () => {
    const token = await idToken({}, { expired: true });
    expect((await verifier().verifyIdToken({ provider: GOOGLE, idToken: token })).ok).toBe(false);
  });

  it('rejects an algorithm the provider is not pinned to', async () => {
    const pinnedToEs256: OidcProviderRegistry = {
      google: { ...providers.google, allowedAlgorithms: ['ES256'] },
    };
    const jwks = createLocalJWKSet({ keys: [publicJwk] });
    const strict = new JoseOidcTokenVerifier(pinnedToEs256, () => jwks);

    const result = await strict.verifyIdToken({ provider: GOOGLE, idToken: await idToken() });
    expect(result.ok).toBe(false);
  });

  it('rejects a token with no subject', async () => {
    const now = Math.floor(Date.now() / 1000);
    const token = await new SignJWT({})
      .setProtectedHeader({ alg: 'RS256', kid: 'test-key' })
      .setIssuer(ISSUER)
      .setAudience(CLIENT_ID)
      .setIssuedAt(now)
      .setExpirationTime(now + 3600)
      .sign(signingKey);

    const result = await verifier().verifyIdToken({ provider: GOOGLE, idToken: token });
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.error.reason).toContain('subject');
    }
  });

  it('rejects garbage and an unknown provider without throwing', async () => {
    const unknown = await verifier().verifyIdToken({
      provider: OidcProvider.fromSlug('nobody'),
      idToken: await idToken(),
    });
    expect(unknown.ok).toBe(false);

    for (const bad of ['', 'not-a-jwt', 'a.b.c']) {
      const result = await verifier().verifyIdToken({ provider: GOOGLE, idToken: bad });
      expect(result.ok).toBe(false);
    }
  });

  it('never leaks a stack trace through the failure reason', async () => {
    const result = await verifier().verifyIdToken({ provider: GOOGLE, idToken: 'not-a-jwt' });
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.error.reason).not.toContain('node_modules');
    }
  });

  it('reuses one key set per provider so its cache applies', async () => {
    let resolved = 0;
    const jwks = createLocalJWKSet({ keys: [publicJwk] });
    const counting = new JoseOidcTokenVerifier(providers, () => {
      resolved += 1;
      return jwks;
    });

    await counting.verifyIdToken({ provider: GOOGLE, idToken: await idToken() });
    await counting.verifyIdToken({ provider: GOOGLE, idToken: await idToken() });

    expect(resolved).toBe(1);
  });
});
