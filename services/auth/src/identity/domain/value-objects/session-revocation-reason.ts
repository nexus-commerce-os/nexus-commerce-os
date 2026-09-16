/**
 * Why a session was revoked. Kept in its own module so both the aggregate and
 * the revocation event can reference it without a circular import.
 *
 * `reuse_detected` is the security-critical one: a consumed refresh token was
 * presented again, so the whole family is burned (doc 08 §3.4).
 */
export type SessionRevocationReason =
  | 'user_revoked'
  | 'admin_revoked'
  | 'password_changed'
  /** Set only by the DeviceRevoked subscriber, never requested directly. */
  | 'device_revoked'
  | 'reuse_detected'
  | 'idle_expired'
  | 'absolute_expired';
