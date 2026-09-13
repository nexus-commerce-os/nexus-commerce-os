import { jwtVerify, createRemoteJWKSet, type JWTPayload, type JWTVerifyGetKey } from 'jose';
import { type Result, ok, err } from '../../../kernel/result';
import { InvalidOidcTokenError } from '../../domain/errors';
import type {
  OidcTokenVerifier,
  VerifyIdTokenRequest,
  VerifiedIdToken,
} from '../../domain/ports/oidc-token-verifier';
import type { OidcProviderRegistry } from './oidc-provider-registry';

/**
 * Resolves the signing keys for a provider. Injectable so tests can supply a
 * local key set instead of reaching the network — the verification logic under
 * test is identical either way.
 */
export type JwksResolver = (jwksUri: string) => JWTVerifyGetKey;

const remoteJwks: JwksResolver = (jwksUri) => createRemoteJWKSet(new URL(jwksUri));

/**
 * The real {@link OidcTokenVerifier} — the deferral from I-5.
 *
 * Verifies the signature against the provider's published keys and pins
 * `issuer`, `audience` and the accepted algorithms, so a token that is
 * perfectly well-formed but issued by someone else, for someone else, or signed
 * with an algorithm we never agreed to is rejected.
 *
 * It deliberately does **not** check `nonce`. Only the pending authorization
 * request knows which nonce was issued, so that binding is a domain rule and
 * lives in `CompleteOidcLogin`; this adapter just surfaces the claim.
 */
export class JoseOidcTokenVerifier implements OidcTokenVerifier {
  private readonly keyCache = new Map<string, JWTVerifyGetKey>();

  constructor(
    private readonly providers: OidcProviderRegistry,
    private readonly resolveJwks: JwksResolver = remoteJwks,
  ) {}

  async verifyIdToken(
    request: VerifyIdTokenRequest,
  ): Promise<Result<VerifiedIdToken, InvalidOidcTokenError>> {
    const settings = this.providers[request.provider.value];
    if (settings === undefined) {
      return err(new InvalidOidcTokenError('unknown provider'));
    }
    if (request.idToken.length === 0) {
      return err(new InvalidOidcTokenError('missing identity token'));
    }

    let payload: JWTPayload;
    try {
      const verified = await jwtVerify(request.idToken, this.keysFor(settings.jwksUri), {
        issuer: settings.issuer,
        audience: settings.clientId,
        algorithms: [...settings.allowedAlgorithms],
      });
      payload = verified.payload;
    } catch (error) {
      // signature, issuer, audience, algorithm and expiry failures all land
      // here, and all mean the same thing: do not trust this token
      return err(new InvalidOidcTokenError(describe(error)));
    }

    const subject = typeof payload.sub === 'string' ? payload.sub : '';
    if (subject.length === 0) {
      return err(new InvalidOidcTokenError('token carries no subject'));
    }

    return ok({
      issuer: settings.issuer,
      subject,
      audience: settings.clientId,
      nonce: typeof payload['nonce'] === 'string' ? payload['nonce'] : null,
      email: typeof payload['email'] === 'string' ? payload['email'] : null,
      // absent means unverified: an address is only trusted when the provider
      // explicitly says it verified it
      emailVerified: payload['email_verified'] === true,
    });
  }

  /** One key set per provider, reused so its cache and rate limiting apply. */
  private keysFor(jwksUri: string): JWTVerifyGetKey {
    const cached = this.keyCache.get(jwksUri);
    if (cached !== undefined) {
      return cached;
    }
    const created = this.resolveJwks(jwksUri);
    this.keyCache.set(jwksUri, created);
    return created;
  }
}

/** Never surface a stack; the reason is for logs and audit. */
function describe(error: unknown): string {
  return error instanceof Error ? error.message : 'identity token could not be verified';
}
