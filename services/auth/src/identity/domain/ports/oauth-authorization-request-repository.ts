import type { OAuthAuthorizationRequest } from '../entities/oauth-authorization-request';
import type { OAuthRequestId } from '../value-objects/oauth-request-id';
import type { OidcProvider } from '../value-objects/oidc-provider';
import type { TokenHash } from '../value-objects/token-hash';
import type { UserId } from '../value-objects/user-id';

/**
 * OAuthAuthorizationRequestRepository port — persistence boundary for in-flight
 * sign-ins.
 *
 * `findByStateHash` must match **any** status so a replayed callback is rejected
 * explicitly rather than silently missing. Implementations MUST make consuming a
 * request atomic against a concurrent callback for the same state
 * (Postgres: `UPDATE … WHERE status = 'pending'`).
 */
export interface OAuthAuthorizationRequestRepository {
  findById(id: OAuthRequestId): Promise<OAuthAuthorizationRequest | null>;
  findByStateHash(hash: TokenHash): Promise<OAuthAuthorizationRequest | null>;
  /** Still-pending requests for the pair — used to supersede on re-start. */
  listPending(userId: UserId, provider: OidcProvider): Promise<OAuthAuthorizationRequest[]>;
  save(request: OAuthAuthorizationRequest): Promise<void>;
}
