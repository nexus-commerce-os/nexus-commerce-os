import type { FederatedIdentity } from '../entities/federated-identity';
import type { FederatedIdentityId } from '../value-objects/federated-identity-id';
import type { OidcProvider } from '../value-objects/oidc-provider';
import type { UserId } from '../value-objects/user-id';

/**
 * FederatedIdentityRepository port — persistence boundary for provider links.
 *
 * `findByProviderSubject` is the identity lookup and MUST be backed by a unique
 * index on `(provider, subject)` (doc 06 §3.1 `subject UK`), so one provider
 * account can never be attached to two NEXUS accounts. `countActiveByUser`
 * backs the last-factor guard and must count only non-revoked links.
 */
export interface FederatedIdentityRepository {
  findById(id: FederatedIdentityId): Promise<FederatedIdentity | null>;
  findByProviderSubject(provider: OidcProvider, subject: string): Promise<FederatedIdentity | null>;
  listByUser(userId: UserId): Promise<FederatedIdentity[]>;
  countActiveByUser(userId: UserId): Promise<number>;
  save(identity: FederatedIdentity): Promise<void>;
}
