/**
 * CredentialId — the **authenticator's** credential identifier (base64url), as
 * opposed to our own `PasskeyCredentialId` primary key. It is chosen by the
 * authenticator, globally unique, and is what an authentication response
 * presents, so it carries a uniqueness invariant of its own.
 *
 * Treated as an opaque token: the domain compares it, never parses it.
 */
export class CredentialId {
  private static readonly MAX_LENGTH = 1023;
  private static readonly BASE64URL = /^[A-Za-z0-9_-]+$/;

  private constructor(public readonly value: string) {}

  static fromBase64Url(raw: string): CredentialId {
    if (raw.length === 0 || raw.length > CredentialId.MAX_LENGTH) {
      throw new Error('CredentialId must be a non-empty base64url string.');
    }
    if (!CredentialId.BASE64URL.test(raw)) {
      throw new Error('CredentialId must be base64url encoded.');
    }
    return new CredentialId(raw);
  }

  equals(other: CredentialId): boolean {
    return this.value === other.value;
  }

  toString(): string {
    return this.value;
  }
}
