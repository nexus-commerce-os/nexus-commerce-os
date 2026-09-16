import type { FederatedIdentity } from '../domain/entities/federated-identity';
import type { FederatedIdentityId } from '../domain/value-objects/federated-identity-id';
import type { OidcProvider } from '../domain/value-objects/oidc-provider';
import type { UserId } from '../domain/value-objects/user-id';
import type { FederatedIdentityRepository } from '../domain/ports/federated-identity-repository';

/**
 * In-memory FederatedIdentityRepository — a real implementation for tests and
 * local development; the Postgres adapter (I-6) implements the same port and
 * must back `findByProviderSubject` with a unique index on (provider, subject).
 */
export class InMemoryFederatedIdentityRepository implements FederatedIdentityRepository {
  private readonly byId = new Map<FederatedIdentityId, FederatedIdentity>();

  findById(id: FederatedIdentityId): Promise<FederatedIdentity | null> {
    return Promise.resolve(this.byId.get(id) ?? null);
  }

  findByProviderSubject(
    provider: OidcProvider,
    subject: string,
  ): Promise<FederatedIdentity | null> {
    for (const identity of this.byId.values()) {
      if (identity.provider.equals(provider) && identity.subject === subject) {
        return Promise.resolve(identity);
      }
    }
    return Promise.resolve(null);
  }

  listByUser(userId: UserId): Promise<FederatedIdentity[]> {
    return Promise.resolve(this.filter((i) => i.userId === userId));
  }

  countActiveByUser(userId: UserId): Promise<number> {
    return Promise.resolve(this.filter((i) => i.userId === userId && i.isActive()).length);
  }

  save(identity: FederatedIdentity): Promise<void> {
    this.byId.set(identity.id, identity);
    return Promise.resolve();
  }

  /** Test/inspection helper: number of stored identities. */
  get size(): number {
    return this.byId.size;
  }

  private filter(predicate: (i: FederatedIdentity) => boolean): FederatedIdentity[] {
    const matches: FederatedIdentity[] = [];
    for (const identity of this.byId.values()) {
      if (predicate(identity)) {
        matches.push(identity);
      }
    }
    return matches;
  }
}
