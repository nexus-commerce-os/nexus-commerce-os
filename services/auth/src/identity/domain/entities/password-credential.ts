import { PasswordHash } from '../value-objects/password-hash';

/**
 * PasswordCredential — the stored password factor for a user. Holds only the
 * opaque {@link PasswordHash} (never plaintext) plus when it was last set.
 */
export class PasswordCredential {
  private constructor(
    private readonly _hash: PasswordHash,
    private readonly _updatedAt: Date,
  ) {}

  static fromHash(hash: PasswordHash, updatedAt: Date): PasswordCredential {
    return new PasswordCredential(hash, updatedAt);
  }

  get hash(): PasswordHash {
    return this._hash;
  }

  get updatedAt(): Date {
    return this._updatedAt;
  }
}
