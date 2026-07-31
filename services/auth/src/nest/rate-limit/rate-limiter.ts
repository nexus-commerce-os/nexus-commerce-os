/**
 * Abuse protection for the Identity HTTP edge.
 *
 * Rate limiting is not an invariant of any aggregate, so it lives here rather
 * than in the domain: no use case knows an IP address exists, and none should.
 * The guard consumes this port, which keeps the storage decision swappable and
 * lets every test run without Redis.
 */
export interface RateLimitDecision {
  readonly allowed: boolean;
  /** Seconds until the window resets. Only meaningful when `allowed` is false. */
  readonly retryAfterSeconds: number;
  /**
   * True when the store could not be reached and the request was allowed
   * through. Fail-open is deliberate — see {@link RateLimiter} — but it must be
   * visible, because a limiter everyone believes is on is worse than one
   * everyone knows is off.
   */
  readonly degraded: boolean;
}

export interface RateLimitRule {
  /** Requests permitted per window. */
  readonly limit: number;
  readonly windowSeconds: number;
}

/**
 * A distributed counter.
 *
 * Implementations **must fail open**: if the backing store is unreachable, the
 * request is allowed and `degraded` is set. Rejecting every login because a
 * cache is down converts a dependency outage into a total authentication
 * outage, which makes the limiter the most effective denial of service in the
 * system. Configuration errors are the opposite case and fail closed at boot.
 */
export interface RateLimiter {
  consume(key: string, rule: RateLimitRule): Promise<RateLimitDecision>;
}

/**
 * Where limiter activity is reported. A callback rather than a metrics client:
 * this service has no metrics stack yet, and inventing one here would be a
 * larger decision than this increment is allowed to make. The composition root
 * supplies the sink, so wiring OTel later changes one line.
 */
export interface RateLimitObserver {
  onDecision(event: RateLimitEvent): void;
}

export interface RateLimitEvent {
  readonly operation: string;
  /** Which layer rejected, or the one consulted last when allowed. */
  readonly layer: string;
  readonly allowed: boolean;
  readonly degraded: boolean;
}

/** Reports nothing. Used where a caller has no interest in the signal. */
export const SILENT_OBSERVER: RateLimitObserver = { onDecision: () => undefined };
