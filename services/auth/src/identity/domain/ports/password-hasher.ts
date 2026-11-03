import type { PasswordHash } from '../value-objects/password-hash';

/**
 * PasswordHasher port — hashes and verifies plaintext passwords. The concrete
 * KDF (scrypt today) is an infrastructure detail behind this interface so it can
 * be tuned or swapped without touching the domain or use cases.
 */
export interface PasswordHasher {
  hash(plaintext: string): Promise<PasswordHash>;
  verify(plaintext: string, hash: PasswordHash): Promise<boolean>;
}
