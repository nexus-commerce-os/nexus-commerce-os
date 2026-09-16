import { type Result, ok, err } from '../../../kernel/result';
import { WeakPasswordError } from '../errors';

/**
 * PasswordPolicy port — the rules a plaintext password must satisfy. Injected so
 * the strength bar can evolve (or be regionally configured) without touching the
 * use cases. Operates on plaintext only, never on a stored hash.
 */
export interface PasswordPolicy {
  validate(plaintext: string): Result<void, WeakPasswordError>;
}

/**
 * Default policy: length 12–1024, with lower, upper, and digit character classes.
 * The 1024 ceiling bounds hashing cost (a DoS guard on the KDF).
 */
export class DefaultPasswordPolicy implements PasswordPolicy {
  private static readonly MIN_LENGTH = 12;
  private static readonly MAX_LENGTH = 1024;

  validate(plaintext: string): Result<void, WeakPasswordError> {
    const reasons: string[] = [];
    if (plaintext.length < DefaultPasswordPolicy.MIN_LENGTH) {
      reasons.push(`must be at least ${DefaultPasswordPolicy.MIN_LENGTH} characters`);
    }
    if (plaintext.length > DefaultPasswordPolicy.MAX_LENGTH) {
      reasons.push(`must be at most ${DefaultPasswordPolicy.MAX_LENGTH} characters`);
    }
    if (!/[a-z]/.test(plaintext)) {
      reasons.push('must contain a lowercase letter');
    }
    if (!/[A-Z]/.test(plaintext)) {
      reasons.push('must contain an uppercase letter');
    }
    if (!/[0-9]/.test(plaintext)) {
      reasons.push('must contain a digit');
    }
    return reasons.length > 0 ? err(new WeakPasswordError(reasons)) : ok(undefined);
  }
}
