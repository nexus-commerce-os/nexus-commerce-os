/**
 * Clock port — the domain never calls `new Date()` directly, so time is
 * injectable and tests are deterministic.
 */
export interface Clock {
  now(): Date;
}
