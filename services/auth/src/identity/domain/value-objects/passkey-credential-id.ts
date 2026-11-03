import type { Brand } from '../../../kernel/identifier';

/** Opaque identifier (a validated UUID string). */
export type PasskeyCredentialId = Brand<string, 'PasskeyCredentialId'>;

const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export function isPasskeyCredentialId(raw: string): boolean {
  return UUID_PATTERN.test(raw);
}

/**
 * Brand a raw string as a `PasskeyCredentialId`. Throws on a malformed value: ids come from the
 * `IdGenerator` port (always valid), so a bad value here is a broken invariant
 * rather than an expected domain outcome.
 */
export function toPasskeyCredentialId(raw: string): PasskeyCredentialId {
  if (!isPasskeyCredentialId(raw)) {
    throw new Error(`Invalid PasskeyCredentialId: "${raw}"`);
  }
  return raw as PasskeyCredentialId;
}
