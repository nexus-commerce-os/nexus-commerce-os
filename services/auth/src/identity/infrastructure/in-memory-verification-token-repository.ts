import type { VerificationToken } from '../domain/entities/verification-token';
import type { VerificationTokenId } from '../domain/value-objects/verification-token-id';
import type { VerificationPurpose } from '../domain/value-objects/verification-purpose';
import type { TokenHash } from '../domain/value-objects/token-hash';
import type { UserId } from '../domain/value-objects/user-id';
import type { VerificationTokenRepository } from '../domain/ports/verification-token-repository';

/**
 * In-memory VerificationTokenRepository — a real implementation for tests and
 * local development; the Postgres adapter (I-6) implements the same port.
 *
 * Single-use safety here comes from storing the aggregate by reference: a second
 * concurrent redemption reads the *same* instance and therefore sees it already
 * consumed. The Postgres adapter must reproduce that guarantee with a
 * conditional `UPDATE … WHERE status = 'pending'`.
 */
export class InMemoryVerificationTokenRepository implements VerificationTokenRepository {
  private readonly byId = new Map<VerificationTokenId, VerificationToken>();

  findById(id: VerificationTokenId): Promise<VerificationToken | null> {
    return Promise.resolve(this.byId.get(id) ?? null);
  }

  findByTokenHash(hash: TokenHash): Promise<VerificationToken | null> {
    for (const token of this.byId.values()) {
      if (token.tokenHash.equals(hash)) {
        return Promise.resolve(token);
      }
    }
    return Promise.resolve(null);
  }

  listPending(userId: UserId, purpose: VerificationPurpose): Promise<VerificationToken[]> {
    const matches: VerificationToken[] = [];
    for (const token of this.byId.values()) {
      if (token.userId === userId && token.purpose === purpose && token.isPending()) {
        matches.push(token);
      }
    }
    return Promise.resolve(matches);
  }

  async findLatestPending(
    userId: UserId,
    purpose: VerificationPurpose,
  ): Promise<VerificationToken | null> {
    const pending = await this.listPending(userId, purpose);
    if (pending.length === 0) {
      return null;
    }
    return pending.reduce((newest, candidate) =>
      candidate.createdAt.getTime() >= newest.createdAt.getTime() ? candidate : newest,
    );
  }

  save(token: VerificationToken): Promise<void> {
    this.byId.set(token.id, token);
    return Promise.resolve();
  }

  /** Test/inspection helper: number of stored tokens. */
  get size(): number {
    return this.byId.size;
  }
}
