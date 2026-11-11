import type { Brand } from '../../../kernel/identifier';

/** Opaque identifier (a validated UUID string). */
export type DeviceId = Brand<string, 'DeviceId'>;

const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export function isDeviceId(raw: string): boolean {
  return UUID_PATTERN.test(raw);
}

/**
 * Brand a raw string as a `DeviceId`. Throws on a malformed value: ids come from the
 * `IdGenerator` port (always valid), so a bad value here is a broken invariant
 * rather than an expected domain outcome.
 */
export function toDeviceId(raw: string): DeviceId {
  if (!isDeviceId(raw)) {
    throw new Error(`Invalid DeviceId: "${raw}"`);
  }
  return raw as DeviceId;
}
