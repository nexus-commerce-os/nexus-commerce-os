import type { Brand } from '../../../kernel/identifier';

/** Opaque identifier (a validated UUID string). */
export type OAuthRequestId = Brand<string, 'OAuthRequestId'>;

const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export function isOAuthRequestId(raw: string): boolean {
  return UUID_PATTERN.test(raw);
}

/**
 * Brand a raw string as a `OAuthRequestId`. Throws on a malformed value: ids come from the
 * `IdGenerator` port (always valid), so a bad value here is a broken invariant
 * rather than an expected domain outcome.
 */
export function toOAuthRequestId(raw: string): OAuthRequestId {
  if (!isOAuthRequestId(raw)) {
    throw new Error(`Invalid OAuthRequestId: "${raw}"`);
  }
  return raw as OAuthRequestId;
}
