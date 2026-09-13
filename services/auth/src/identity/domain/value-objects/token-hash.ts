/**
 * TokenHash value object — the stored digest of a refresh-token secret. The raw
 * secret is returned to the client exactly once at issue time and is **never**
 * persisted; only this hash is kept, so a leaked store yields no usable token.
 *
 * Comparison is constant-time (no early exit on the first differing character)
 * so matching a presented token against the family leaks no timing signal. The
 * comparison is implemented inline to keep the domain free of any import.
 */
export class TokenHash {
  private constructor(public readonly value: string) {}

  static fromHex(hex: string): TokenHash {
    if (hex.length === 0) {
      throw new Error('TokenHash cannot be empty.');
    }
    return new TokenHash(hex);
  }

  equals(other: TokenHash): boolean {
    const a = this.value;
    const b = other.value;
    if (a.length !== b.length) {
      return false;
    }
    let diff = 0;
    for (let i = 0; i < a.length; i += 1) {
      diff |= a.charCodeAt(i) ^ b.charCodeAt(i);
    }
    return diff === 0;
  }

  toString(): string {
    return this.value;
  }
}
