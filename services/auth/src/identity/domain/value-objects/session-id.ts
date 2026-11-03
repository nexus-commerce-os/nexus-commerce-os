import type { Brand } from '../../../kernel/identifier';

/** Opaque, aggregate-scoped identifier for a session (a validated UUID string). */
export type SessionId = Brand<string, 'SessionId'>;

const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export function isSessionId(raw: string): boolean {
  return UUID_PATTERN.test(raw);
}

/**
 * Brand a raw string as a `SessionId`. Throws on a malformed value: ids come from
 * the `IdGenerator` port (always valid), so a bad value here is a broken
 * invariant rather than an expected domain outcome.
 */
export function toSessionId(raw: string): SessionId {
  if (!isSessionId(raw)) {
    throw new Error(`Invalid SessionId: "${raw}"`);
  }
  return raw as SessionId;
}
