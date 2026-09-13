/**
 * PasswordHash value object — wraps the opaque encoded hash string produced by
 * a `PasswordHasher`. The domain never inspects its contents; it only stores and
 * hands it back to the hasher for verification.
 */
export class PasswordHash {
  private constructor(public readonly encoded: string) {}

  static fromEncoded(encoded: string): PasswordHash {
    if (encoded.length === 0) {
      throw new Error('PasswordHash cannot be empty.');
    }
    return new PasswordHash(encoded);
  }

  toString(): string {
    return this.encoded;
  }
}
