import type { Brand } from '../../../kernel/identifier';

/** Opaque identifier for a verification token record (a validated UUID string). */
export type VerificationTokenId = Brand<string, 'VerificationTokenId'>;

const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export function isVerificationTokenId(raw: string): boolean {
  return UUID_PATTERN.test(raw);
}

/**
 * Brand a raw string as a `VerificationTokenId`. Throws on a malformed value:
 * ids come from the `IdGenerator` port (always valid), so a bad value here is a
 * broken invariant rather than an expected domain outcome.
 */
export function toVerificationTokenId(raw: string): VerificationTokenId {
  if (!isVerificationTokenId(raw)) {
    throw new Error(`Invalid VerificationTokenId: "${raw}"`);
  }
  return raw as VerificationTokenId;
}
