import type { OAuthAuthorizationRequest } from '../domain/entities/oauth-authorization-request';
import type { OAuthRequestId } from '../domain/value-objects/oauth-request-id';
import type { OidcProvider } from '../domain/value-objects/oidc-provider';
import type { TokenHash } from '../domain/value-objects/token-hash';
import type { UserId } from '../domain/value-objects/user-id';
import type { OAuthAuthorizationRequestRepository } from '../domain/ports/oauth-authorization-request-repository';

/**
 * In-memory OAuthAuthorizationRequestRepository — a real implementation for
 * tests and local development; the Postgres adapter (I-6) implements the same
 * port.
 *
 * Single-use safety comes from storing the aggregate by reference, so a second
 * concurrent callback reads the *same* instance and sees it already consumed.
 * The Postgres adapter must reproduce that with a conditional
 * `UPDATE … WHERE status = 'pending'`.
 */
export class InMemoryOAuthAuthorizationRequestRepository
  implements OAuthAuthorizationRequestRepository
{
  private readonly byId = new Map<OAuthRequestId, OAuthAuthorizationRequest>();

  findById(id: OAuthRequestId): Promise<OAuthAuthorizationRequest | null> {
    return Promise.resolve(this.byId.get(id) ?? null);
  }

  findByStateHash(hash: TokenHash): Promise<OAuthAuthorizationRequest | null> {
    for (const request of this.byId.values()) {
      if (request.stateHash.equals(hash)) {
        return Promise.resolve(request);
      }
    }
    return Promise.resolve(null);
  }

  listPending(userId: UserId, provider: OidcProvider): Promise<OAuthAuthorizationRequest[]> {
    const matches: OAuthAuthorizationRequest[] = [];
    for (const request of this.byId.values()) {
      if (
        request.userId === userId &&
        request.provider.equals(provider) &&
        request.isPending()
      ) {
        matches.push(request);
      }
    }
    return Promise.resolve(matches);
  }

  save(request: OAuthAuthorizationRequest): Promise<void> {
    this.byId.set(request.id, request);
    return Promise.resolve();
  }

  /** Test/inspection helper: number of stored requests. */
  get size(): number {
    return this.byId.size;
  }
}
