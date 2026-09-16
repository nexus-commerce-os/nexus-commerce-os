import type { Session } from '../domain/entities/session';
import type { SessionId } from '../domain/value-objects/session-id';
import type { TokenHash } from '../domain/value-objects/token-hash';
import type { UserId } from '../domain/value-objects/user-id';
import type { DeviceId } from '../domain/value-objects/device-id';
import type { SessionRepository } from '../domain/ports/session-repository';

/**
 * In-memory SessionRepository — a real implementation used for tests and local
 * development; the Postgres adapter (I-6) implements the same port.
 *
 * `findByTokenHash` scans the family of each session, matching **any**
 * generation (active, consumed, or revoked) so a rotated-but-stolen token still
 * resolves to its session and trips reuse detection.
 */
export class InMemorySessionRepository implements SessionRepository {
  private readonly byId = new Map<SessionId, Session>();

  findById(id: SessionId): Promise<Session | null> {
    return Promise.resolve(this.byId.get(id) ?? null);
  }

  findByTokenHash(hash: TokenHash): Promise<Session | null> {
    for (const session of this.byId.values()) {
      if (session.tokens.some((token) => token.hash.equals(hash))) {
        return Promise.resolve(session);
      }
    }
    return Promise.resolve(null);
  }

  listByUser(userId: UserId): Promise<Session[]> {
    const matches: Session[] = [];
    for (const session of this.byId.values()) {
      if (session.userId === userId) {
        matches.push(session);
      }
    }
    return Promise.resolve(matches);
  }

  listActiveByDevice(deviceId: DeviceId): Promise<Session[]> {
    const matches: Session[] = [];
    for (const session of this.byId.values()) {
      if (session.deviceId === deviceId && session.status === 'active') {
        matches.push(session);
      }
    }
    return Promise.resolve(matches);
  }

  save(session: Session): Promise<void> {
    this.byId.set(session.id, session);
    return Promise.resolve();
  }

  /** Test/inspection helper: number of stored sessions. */
  get size(): number {
    return this.byId.size;
  }
}
