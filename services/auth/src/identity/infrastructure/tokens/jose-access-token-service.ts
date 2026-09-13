import { SignJWT, jwtVerify, type JWTPayload } from 'jose';
import { randomUUID } from 'node:crypto';
import { type Result, ok, err } from '../../../kernel/result';
import { InvalidAccessTokenError } from '../../domain/errors';
import type {
  AccessTokenClaims,
  AccessTokenService,
  IssuedAccessToken,
} from '../../domain/ports/access-token-service';
import type { Clock } from '../../../kernel/clock';

export interface AccessTokenSettings {
  /** HMAC key. Kept in the secret manager, never beside anything it signs. */
  readonly secret: string;
  readonly issuer: string;
  readonly audience: string;
  readonly ttlSeconds: number;
}

const ALGORITHM = 'HS256';

/**
 * Mints and verifies the short-lived access token.
 *
 * HS256 is deliberate for now: this service is both the only issuer and the
 * only verifier, so a symmetric key is the smaller attack surface — there is no
 * public key to distribute and no key-rotation endpoint to expose. The moment a
 * second service needs to verify a token, that reasoning inverts and this must
 * become asymmetric so the signing key never leaves Identity. That is a change
 * of this file and its configuration only: the port speaks about claims, not
 * algorithms, so nothing above it moves.
 *
 * Claims are exactly sub/sid/jti/iat/exp/iss/aud. No permissions, no roles, no
 * profile — a token that carried business state would let a stale copy of it
 * answer questions only the aggregate is entitled to answer.
 */
export class JoseAccessTokenService implements AccessTokenService {
  private readonly key: Uint8Array;

  constructor(
    private readonly settings: AccessTokenSettings,
    private readonly clock: Clock,
  ) {
    this.key = new TextEncoder().encode(settings.secret);
  }

  async issue(input: { userId: string; sessionId: string }): Promise<IssuedAccessToken> {
    const now = this.clock.now();
    const issuedAtSeconds = Math.floor(now.getTime() / 1000);
    const expiresAtSeconds = issuedAtSeconds + this.settings.ttlSeconds;

    const token = await new SignJWT({ sid: input.sessionId })
      .setProtectedHeader({ alg: ALGORITHM, typ: 'JWT' })
      .setSubject(input.userId)
      .setJti(randomUUID())
      .setIssuedAt(issuedAtSeconds)
      .setExpirationTime(expiresAtSeconds)
      .setIssuer(this.settings.issuer)
      .setAudience(this.settings.audience)
      .sign(this.key);

    return { token, expiresAt: new Date(expiresAtSeconds * 1000) };
  }

  async verify(token: string): Promise<Result<AccessTokenClaims, InvalidAccessTokenError>> {
    let payload: JWTPayload;
    try {
      // The algorithm is pinned: without it a token could name its own, and
      // "alg: none" or a downgrade would verify against nothing.
      ({ payload } = await jwtVerify(token, this.key, {
        algorithms: [ALGORITHM],
        issuer: this.settings.issuer,
        audience: this.settings.audience,
        currentDate: this.clock.now(),
      }));
    } catch (cause) {
      return err(new InvalidAccessTokenError(describe(cause)));
    }

    const sessionId = payload['sid'];
    if (typeof sessionId !== 'string' || sessionId.length === 0) {
      return err(new InvalidAccessTokenError('missing sid claim'));
    }
    if (typeof payload.sub !== 'string' || payload.sub.length === 0) {
      return err(new InvalidAccessTokenError('missing sub claim'));
    }
    if (typeof payload.jti !== 'string' || payload.jti.length === 0) {
      return err(new InvalidAccessTokenError('missing jti claim'));
    }
    if (typeof payload.iat !== 'number' || typeof payload.exp !== 'number') {
      return err(new InvalidAccessTokenError('missing iat or exp claim'));
    }

    return ok({
      userId: payload.sub,
      sessionId,
      tokenId: payload.jti,
      issuedAt: new Date(payload.iat * 1000),
      expiresAt: new Date(payload.exp * 1000),
    });
  }
}

/** One short line, never a stack trace — this reason is logged. */
function describe(cause: unknown): string {
  if (typeof cause === 'object' && cause !== null) {
    const code = (cause as { code?: unknown }).code;
    if (typeof code === 'string' && code.length > 0) {
      return code;
    }
    const message = (cause as { message?: unknown }).message;
    if (typeof message === 'string' && message.length > 0) {
      return message.split('\n')[0].slice(0, 120);
    }
  }
  return 'token could not be verified';
}
