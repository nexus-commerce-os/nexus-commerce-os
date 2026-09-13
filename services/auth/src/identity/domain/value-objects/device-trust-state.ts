/**
 * How much the platform trusts a device.
 *
 * `UNKNOWN` — seen, but nothing has vouched for it.
 * `TRUSTED` — a passkey was successfully registered on it, which is a strong
 *             possession signal (the user completed a ceremony on that device).
 * `REVOKED` — the user or an operator disowned it; terminal.
 */
export type DeviceTrustState = 'UNKNOWN' | 'TRUSTED' | 'REVOKED';
