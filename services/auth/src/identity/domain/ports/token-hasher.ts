import type { TokenHash } from '../value-objects/token-hash';

/**
 * TokenHasher port — digests a refresh-token secret for storage.
 *
 * Distinct from `PasswordHasher` on purpose: refresh tokens are high-entropy
 * random secrets, so a fast cryptographic digest (SHA-256) is the correct
 * primitive. A slow KDF is required only for low-entropy human passwords.
 */
export interface TokenHasher {
  hash(rawToken: string): TokenHash;
}
