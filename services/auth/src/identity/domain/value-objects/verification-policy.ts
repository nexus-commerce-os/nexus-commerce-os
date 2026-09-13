import type { VerificationPurpose } from './verification-purpose';

/**
 * VerificationPolicy port — how long a verification token stays valid, resolved
 * **per purpose** rather than hard-coded in the aggregate. Keeping this behind an
 * interface is what lets a per-country, per-tenant, or stricter enterprise
 * policy replace the defaults later without touching the domain or use cases.
 */
export interface VerificationPolicy {
  /** Lifetime in milliseconds for tokens minted for `purpose`. */
  ttlFor(purpose: VerificationPurpose): number;
}

const MINUTE = 60 * 1000;
const HOUR = 60 * MINUTE;

/**
 * Default lifetimes: a password-reset link is short-lived (1 h) because it grants
 * account takeover if intercepted; email verification is low-risk and allows for
 * inbox delays (24 h).
 */
export class DefaultVerificationPolicy implements VerificationPolicy {
  private static readonly TTL: Record<VerificationPurpose, number> = {
    email_verification: 24 * HOUR,
    password_reset: 1 * HOUR,
  };

  ttlFor(purpose: VerificationPurpose): number {
    return DefaultVerificationPolicy.TTL[purpose];
  }
}
