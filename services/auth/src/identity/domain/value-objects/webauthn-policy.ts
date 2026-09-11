/**
 * WebAuthnPolicy port — how long a ceremony challenge stays valid. Behind an
 * interface so a stricter (or per-tenant) window can replace the default without
 * touching the aggregate or the use cases; the TTL is never hard-coded in
 * business logic.
 */
export interface WebAuthnPolicy {
  /** Lifetime in milliseconds of a freshly minted ceremony challenge. */
  challengeTtlMs(): number;
}

const MINUTE = 60 * 1000;

/**
 * Default: 5 minutes — long enough for a user to reach for a security key or
 * approve a platform prompt, short enough that an intercepted challenge is
 * worthless almost immediately.
 */
export class DefaultWebAuthnPolicy implements WebAuthnPolicy {
  private static readonly CHALLENGE_TTL_MS = 5 * MINUTE;

  challengeTtlMs(): number {
    return DefaultWebAuthnPolicy.CHALLENGE_TTL_MS;
  }
}
