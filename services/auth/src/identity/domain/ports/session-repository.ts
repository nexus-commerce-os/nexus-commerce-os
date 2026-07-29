import type { Session } from '../entities/session';
import type { SessionId } from '../value-objects/session-id';
import type { TokenHash } from '../value-objects/token-hash';
import type { UserId } from '../value-objects/user-id';

/**
 * SessionRepository port — persistence boundary for the Session aggregate.
 *
 * `findByTokenHash` must match **any** generation in the family (active,
 * consumed, or revoked), not just the current one: resolving a stolen,
 * already-rotated token to its family is what makes reuse detection possible.
 */
export interface SessionRepository {
  findById(id: SessionId): Promise<Session | null>;
  findByTokenHash(hash: TokenHash): Promise<Session | null>;
  listByUser(userId: UserId): Promise<Session[]>;
  save(session: Session): Promise<void>;
}
