import type { WebAuthnChallenge } from '../entities/webauthn-challenge';
import type { WebAuthnChallengeId } from '../value-objects/webauthn-challenge-id';
import type { WebAuthnCeremony } from '../value-objects/webauthn-ceremony';
import type { TokenHash } from '../value-objects/token-hash';
import type { UserId } from '../value-objects/user-id';

/**
 * WebAuthnChallengeRepository port — persistence boundary for the challenge
 * aggregate.
 *
 * `findByChallengeHash` must match **any** status so a replayed challenge is
 * rejected explicitly rather than silently missing. Implementations MUST make
 * consuming a challenge atomic against a concurrent redemption of the same one
 * (Postgres: `UPDATE … WHERE status = 'pending'`).
 */
export interface WebAuthnChallengeRepository {
  findById(id: WebAuthnChallengeId): Promise<WebAuthnChallenge | null>;
  findByChallengeHash(hash: TokenHash): Promise<WebAuthnChallenge | null>;
  /** Still-pending challenges for the pair — used to supersede on re-issue. */
  listPending(userId: UserId, ceremony: WebAuthnCeremony): Promise<WebAuthnChallenge[]>;
  save(challenge: WebAuthnChallenge): Promise<void>;
}
