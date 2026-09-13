import type { Brand } from '../../../kernel/identifier';

/** Opaque, aggregate-scoped identifier for a user (a validated UUID string). */
export type UserId = Brand<string, 'UserId'>;

const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export function isUserId(raw: string): boolean {
  return UUID_PATTERN.test(raw);
}

/**
 * Brand a raw string as a `UserId`. Throws on a malformed value: ids come from
 * the `IdGenerator` port (always valid) or from validated input, so a bad value
 * here is a broken invariant, not an expected domain outcome.
 */
export function toUserId(raw: string): UserId {
  if (!isUserId(raw)) {
    throw new Error(`Invalid UserId: "${raw}"`);
  }
  return raw as UserId;
}
