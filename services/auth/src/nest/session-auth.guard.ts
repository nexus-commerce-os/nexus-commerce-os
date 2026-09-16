import { Injectable, Inject, type CanActivate, type ExecutionContext } from '@nestjs/common';
import type { Request } from 'express';
import { IDENTITY_CONTAINER } from './tokens';
import type { IdentityContainer } from '../composition/identity-container';
import type { Principal } from '../identity/application/authorize-request';
import { InvalidAccessTokenError } from '../identity/domain/errors';
import { DomainFailure } from './problem-details.filter';

/** The authenticated principal, attached once the guard has resolved it. */
export interface AuthenticatedRequest extends Request {
  principal?: Principal;
}

/**
 * Turns a bearer access token into a principal.
 *
 * The guard does no deciding of its own — it delegates to `AuthorizeRequest`,
 * which re-reads the Session aggregate on every call. That is what makes the
 * session, not the token, authoritative: a revoked session stops working
 * immediately rather than when its derived tokens happen to expire.
 *
 * Every rejection is the same 401. A malformed header, a forged signature and a
 * revoked session are indistinguishable, so none of them can be used to probe
 * what exists.
 */
@Injectable()
export class SessionAuthGuard implements CanActivate {
  constructor(@Inject(IDENTITY_CONTAINER) private readonly container: IdentityContainer) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const request = context.switchToHttp().getRequest<AuthenticatedRequest>();
    const token = bearerFrom(request.headers.authorization);
    if (token === null) {
      throw new DomainFailure(new InvalidAccessTokenError('missing bearer token'));
    }

    const authorized = await this.container.useCases.authorizeRequest.execute({
      accessToken: token,
    });
    if (!authorized.ok) {
      throw new DomainFailure(authorized.error);
    }

    request.principal = authorized.value;
    return true;
  }
}

/** RFC 6750 §2.1: exactly one `Bearer <token>`, scheme compared case-insensitively. */
function bearerFrom(header: string | undefined): string | null {
  if (header === undefined) {
    return null;
  }
  const match = /^Bearer (.+)$/i.exec(header.trim());
  const token = match?.[1]?.trim();
  return token === undefined || token.length === 0 ? null : token;
}

/** Reads the principal the guard attached. Never reached unguarded. */
export function principalOf(request: AuthenticatedRequest): Principal {
  if (request.principal === undefined) {
    throw new Error('principalOf called on an unguarded route');
  }
  return request.principal;
}
