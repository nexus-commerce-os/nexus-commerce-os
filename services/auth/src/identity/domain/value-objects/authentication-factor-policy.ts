/**
 * The factors an account can authenticate with. Kept as plain data so the rule
 * below is a pure function of it — independent of how any particular account
 * happens to store its credentials.
 */
export interface AuthenticationFactors {
  /** Non-revoked passkeys currently registered. */
  readonly activePasskeys: number;
  /** Whether a password credential is set. Federated-only accounts report false. */
  readonly hasPasswordFactor: boolean;
  /** Non-revoked federated (OIDC) identities currently linked. */
  readonly activeFederatedIdentities: number;
}

/** Which kind of factor is being removed. */
export type RemovableFactor = 'passkey' | 'federated_identity';

/**
 * Last-factor rule: an account must always retain at least one way to
 * authenticate, so removing a factor is refused when it would be the last one.
 *
 * Written against counts rather than against a `User`, so it covers every mix —
 * password-only, passkey-only, federated-only — with nothing to change as new
 * factor kinds arrive.
 */
export function canRemoveFactor(factors: AuthenticationFactors, kind: RemovableFactor): boolean {
  const passkeys =
    kind === 'passkey' ? Math.max(0, factors.activePasskeys - 1) : factors.activePasskeys;
  const federated =
    kind === 'federated_identity'
      ? Math.max(0, factors.activeFederatedIdentities - 1)
      : factors.activeFederatedIdentities;
  return passkeys + federated + (factors.hasPasswordFactor ? 1 : 0) >= 1;
}
