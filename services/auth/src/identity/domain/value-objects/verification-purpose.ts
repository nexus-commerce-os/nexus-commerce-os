/**
 * What a {@link VerificationToken} authorises. The two flows share one aggregate
 * because their lifecycle is identical (issue → single-use consume → expire →
 * supersede); only the TTL and the effect of consuming differ.
 *
 * The purpose is bound into the token and re-checked on consume, so a token
 * minted for one flow can never be redeemed in the other.
 */
export type VerificationPurpose = 'email_verification' | 'password_reset';

const ALL: readonly VerificationPurpose[] = ['email_verification', 'password_reset'];

export function isVerificationPurpose(raw: string): raw is VerificationPurpose {
  return (ALL as readonly string[]).includes(raw);
}
