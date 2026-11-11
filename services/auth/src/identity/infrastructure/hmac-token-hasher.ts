import { createHmac } from 'node:crypto';
import { TokenHash } from '../domain/value-objects/token-hash';
import type { TokenHasher } from '../domain/ports/token-hasher';

/**
 * TokenHasher backed by **HMAC-SHA256** with a server-held pepper.
 *
 * Preferred over a bare digest for stored token hashes: a database leak alone
 * does not let an attacker verify guesses or precompute a lookup, because the
 * key never lives in the database. (Entropy already makes brute force
 * infeasible; this defends the *offline* attack once storage is breached.)
 *
 * The key is supplied by the composition root from config/KMS (I-7) — never
 * hard-coded, never persisted next to the hashes. Implements the same
 * `TokenHasher` port as {@link Sha256TokenHasher}, so refresh tokens can adopt
 * it by swapping the adapter, with no change to the domain.
 */
export class HmacTokenHasher implements TokenHasher {
  private static readonly MIN_KEY_LENGTH = 32;

  constructor(private readonly key: string) {
    if (key.length < HmacTokenHasher.MIN_KEY_LENGTH) {
      throw new Error(
        `HmacTokenHasher key must be at least ${HmacTokenHasher.MIN_KEY_LENGTH} characters.`,
      );
    }
  }

  hash(rawToken: string): TokenHash {
    return TokenHash.fromHex(createHmac('sha256', this.key).update(rawToken, 'utf8').digest('hex'));
  }
}
