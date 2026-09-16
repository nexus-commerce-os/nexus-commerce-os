import type { Clock } from '../../kernel/clock';
import type { RateLimitDecision, RateLimitRule, RateLimiter } from './rate-limiter';

/**
 * A limiter for tests, never for production.
 *
 * Per-process state means the effective limit would be `N × pods` and would
 * reset on every deploy, so this is deliberately not wired into the container —
 * the ruling forbids an in-memory production limiter, and the composition root
 * has no path to reach this class.
 */
export class InMemoryRateLimiter implements RateLimiter {
  private readonly windows = new Map<string, { count: number; resetAt: number }>();
  private failing = false;

  constructor(private readonly clock: Clock) {}

  /** Simulate an unreachable store, to exercise the fail-open path. */
  failWith(): void {
    this.failing = true;
  }

  consume(key: string, rule: RateLimitRule): Promise<RateLimitDecision> {
    if (this.failing) {
      return Promise.resolve({ allowed: true, retryAfterSeconds: 0, degraded: true });
    }

    const now = this.clock.now().getTime();
    const existing = this.windows.get(key);
    const window =
      existing === undefined || existing.resetAt <= now
        ? { count: 0, resetAt: now + rule.windowSeconds * 1000 }
        : existing;

    window.count += 1;
    this.windows.set(key, window);

    return Promise.resolve({
      allowed: window.count <= rule.limit,
      retryAfterSeconds: Math.max(1, Math.ceil((window.resetAt - now) / 1000)),
      degraded: false,
    });
  }
}
