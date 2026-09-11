import type { Session } from '../entities/session';
import type { SessionId } from '../value-objects/session-id';
import type { TokenHash } from '../value-objects/token-hash';
import type { UserId } from '../value-objects/user-id';
import type { DeviceId } from '../value-objects/device-id';

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
  /**
   * Active sessions bound to one device. Unbound sessions are never returned, so
   * a device revocation cannot reach a session that was not bound to it.
   */
  listActiveByDevice(deviceId: DeviceId): Promise<Session[]>;
  save(session: Session): Promise<void>;
}
