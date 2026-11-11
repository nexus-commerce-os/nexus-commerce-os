/**
 * SessionPolicy port — the lifetime bounds a session is created and refreshed
 * against (doc 08 §3.4: "idle + absolute session lifetimes enforced"). Injected
 * so the values can be tuned or regionally configured without touching the
 * aggregate or the use cases.
 */
export interface SessionPolicy {
  /** Sliding window: a session dies this long after its last use. */
  readonly idleTtlMs: number;
  /** Hard ceiling: a session dies this long after it started, however active. */
  readonly absoluteTtlMs: number;
}

const MINUTE = 60 * 1000;
const DAY = 24 * 60 * MINUTE;

/** Default lifetimes: 30-minute idle window inside a 30-day absolute ceiling. */
export class DefaultSessionPolicy implements SessionPolicy {
  readonly idleTtlMs = 30 * MINUTE;
  readonly absoluteTtlMs = 30 * DAY;
}
