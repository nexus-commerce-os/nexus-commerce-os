import type { WebAuthnChallenge } from '../domain/entities/webauthn-challenge';
import type { WebAuthnChallengeId } from '../domain/value-objects/webauthn-challenge-id';
import type { WebAuthnCeremony } from '../domain/value-objects/webauthn-ceremony';
import type { TokenHash } from '../domain/value-objects/token-hash';
import type { UserId } from '../domain/value-objects/user-id';
import type { WebAuthnChallengeRepository } from '../domain/ports/webauthn-challenge-repository';

/**
 * In-memory WebAuthnChallengeRepository — a real implementation for tests and
 * local development; the Postgres adapter (I-6) implements the same port.
 *
 * Single-use safety comes from storing the aggregate by reference, so a second
 * concurrent redemption reads the *same* instance and sees it already consumed.
 * The Postgres adapter must reproduce that with a conditional
 * `UPDATE … WHERE status = 'pending'`.
 */
export class InMemoryWebAuthnChallengeRepository implements WebAuthnChallengeRepository {
  private readonly byId = new Map<WebAuthnChallengeId, WebAuthnChallenge>();

  findById(id: WebAuthnChallengeId): Promise<WebAuthnChallenge | null> {
    return Promise.resolve(this.byId.get(id) ?? null);
  }

  findByChallengeHash(hash: TokenHash): Promise<WebAuthnChallenge | null> {
    for (const challenge of this.byId.values()) {
      if (challenge.challengeHash.equals(hash)) {
        return Promise.resolve(challenge);
      }
    }
    return Promise.resolve(null);
  }

  listPending(userId: UserId, ceremony: WebAuthnCeremony): Promise<WebAuthnChallenge[]> {
    const matches: WebAuthnChallenge[] = [];
    for (const challenge of this.byId.values()) {
      if (challenge.userId === userId && challenge.ceremony === ceremony && challenge.isPending()) {
        matches.push(challenge);
      }
    }
    return Promise.resolve(matches);
  }

  save(challenge: WebAuthnChallenge): Promise<void> {
    this.byId.set(challenge.id, challenge);
    return Promise.resolve();
  }

  /** Test/inspection helper: number of stored challenges. */
  get size(): number {
    return this.byId.size;
  }
}
