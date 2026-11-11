import type { Brand } from '../../../kernel/identifier';

/** Opaque identifier (a validated UUID string). */
export type FederatedIdentityId = Brand<string, 'FederatedIdentityId'>;

const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export function isFederatedIdentityId(raw: string): boolean {
  return UUID_PATTERN.test(raw);
}

/**
 * Brand a raw string as a `FederatedIdentityId`. Throws on a malformed value: ids come from the
 * `IdGenerator` port (always valid), so a bad value here is a broken invariant
 * rather than an expected domain outcome.
 */
export function toFederatedIdentityId(raw: string): FederatedIdentityId {
  if (!isFederatedIdentityId(raw)) {
    throw new Error(`Invalid FederatedIdentityId: "${raw}"`);
  }
  return raw as FederatedIdentityId;
}
