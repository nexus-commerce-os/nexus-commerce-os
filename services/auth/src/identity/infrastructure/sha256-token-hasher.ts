import { createHash } from 'node:crypto';
import { TokenHash } from '../domain/value-objects/token-hash';
import type { TokenHasher } from '../domain/ports/token-hasher';

/**
 * TokenHasher backed by SHA-256. Correct primitive here because refresh tokens
 * are high-entropy random secrets: there is nothing to brute-force, so the slow
 * KDF used for passwords would only add latency to every refresh.
 */
export class Sha256TokenHasher implements TokenHasher {
  hash(rawToken: string): TokenHash {
    return TokenHash.fromHex(createHash('sha256').update(rawToken, 'utf8').digest('hex'));
  }
}
