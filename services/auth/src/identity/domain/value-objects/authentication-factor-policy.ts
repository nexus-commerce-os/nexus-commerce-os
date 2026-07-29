/**
 * The factors an account can authenticate with. Kept as plain data so the rule
 * below is a pure function of it — independent of how any particular account
 * happens to store its credentials today.
 */
export interface AuthenticationFactors {
  /** Non-revoked passkeys currently registered. */
  readonly activePasskeys: number;
  /** Whether a password credential is set. Passwordless accounts report false. */
  readonly hasPasswordFactor: boolean;
}

/**
 * Last-factor rule: an account must always retain at least one way to
 * authenticate. Removing a passkey is refused when it would be the last factor
 * left.
 *
 * Written against the counts rather than against a `User`, so a future
 * passwordless account (`hasPasswordFactor: false`) is covered by exactly this
 * logic with nothing to change.
 */
export function canRemovePasskey(factors: AuthenticationFactors): boolean {
  const remaining = Math.max(0, factors.activePasskeys - 1) + (factors.hasPasswordFactor ? 1 : 0);
  return remaining >= 1;
}
