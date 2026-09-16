/**
 * Which WebAuthn ceremony a challenge was minted for. A challenge issued for one
 * ceremony can never be redeemed in the other — checked on consume.
 */
export type WebAuthnCeremony = 'registration' | 'authentication';

const ALL: readonly WebAuthnCeremony[] = ['registration', 'authentication'];

export function isWebAuthnCeremony(raw: string): raw is WebAuthnCeremony {
  return (ALL as readonly string[]).includes(raw);
}
