import type { VerificationToken } from '../entities/verification-token';
import type { VerificationTokenId } from '../value-objects/verification-token-id';
import type { VerificationPurpose } from '../value-objects/verification-purpose';
import type { TokenHash } from '../value-objects/token-hash';
import type { UserId } from '../value-objects/user-id';

/**
 * VerificationTokenRepository port — persistence boundary for the
 * {@link VerificationToken} aggregate.
 *
 * `findByTokenHash` must match **any** status (pending, consumed, invalidated):
 * resolving an already-redeemed token to its record is what turns a replay into
 * an explicit `VerificationTokenAlreadyUsedError` instead of a silent miss.
 *
 * Implementations MUST make `save` of a consume atomic against concurrent
 * redemption of the same token (Postgres: `UPDATE … WHERE status = 'pending'`).
 */
export interface VerificationTokenRepository {
  findById(id: VerificationTokenId): Promise<VerificationToken | null>;
  findByTokenHash(hash: TokenHash): Promise<VerificationToken | null>;
  /** Every still-pending token for the pair — used to supersede on re-issue. */
  listPending(userId: UserId, purpose: VerificationPurpose): Promise<VerificationToken[]>;
  /**
   * Most recently issued pending token for the pair, or null.
   * Feeds re-send throttling, abuse detection, cleanup and analytics.
   */
  findLatestPending(
    userId: UserId,
    purpose: VerificationPurpose,
  ): Promise<VerificationToken | null>;
  save(token: VerificationToken): Promise<void>;
}
