import type { User } from '../entities/user';
import type { Email } from '../value-objects/email';
import type { UserId } from '../value-objects/user-id';

/**
 * UserRepository port — persistence boundary for the User aggregate. The domain
 * depends on this interface; concrete adapters (in-memory now, Postgres in I-6)
 * live in `infrastructure/` (dependency inversion, ADR-0020 boundary).
 */
export interface UserRepository {
  findById(id: UserId): Promise<User | null>;
  findByEmail(email: Email): Promise<User | null>;
  existsByEmail(email: Email): Promise<boolean>;
  save(user: User): Promise<void>;
}
