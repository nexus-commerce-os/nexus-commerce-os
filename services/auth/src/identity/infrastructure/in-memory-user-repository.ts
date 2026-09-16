import type { User } from '../domain/entities/user';
import type { Email } from '../domain/value-objects/email';
import type { UserId } from '../domain/value-objects/user-id';
import type { UserRepository } from '../domain/ports/user-repository';

/**
 * In-memory UserRepository — a real implementation used for tests and local
 * development. Not a placeholder: the Postgres adapter (increment I-6) implements
 * the same port. Email lookups scan the small in-process map, which stays correct
 * across email changes without a separate index to keep in sync.
 */
export class InMemoryUserRepository implements UserRepository {
  private readonly byId = new Map<UserId, User>();

  findById(id: UserId): Promise<User | null> {
    return Promise.resolve(this.byId.get(id) ?? null);
  }

  findByEmail(email: Email): Promise<User | null> {
    for (const user of this.byId.values()) {
      if (user.email.equals(email)) {
        return Promise.resolve(user);
      }
    }
    return Promise.resolve(null);
  }

  existsByEmail(email: Email): Promise<boolean> {
    for (const user of this.byId.values()) {
      if (user.email.equals(email)) {
        return Promise.resolve(true);
      }
    }
    return Promise.resolve(false);
  }

  save(user: User): Promise<void> {
    this.byId.set(user.id, user);
    return Promise.resolve();
  }

  /** Test/inspection helper: number of stored users. */
  get size(): number {
    return this.byId.size;
  }
}
