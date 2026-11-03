import type Redis from 'ioredis';
import type { RateLimitDecision, RateLimitRule, RateLimiter } from './rate-limiter';

/**
 * Fixed-window counter in Redis.
 *
 * The increment and the expiry must be one atomic step. Doing `INCR` then
 * `EXPIRE` as two commands leaves a window where a crash between them creates a
 * key with no TTL — a counter that never resets, which locks a caller out
 * permanently. The script also returns the live TTL, so `Retry-After` is the
 * real remaining time rather than a guess.
 *
 * A fixed window is deliberate over a sliding log: it costs one round trip and
 * O(1) memory per key, and its worst case — up to 2×limit across a window
 * boundary — is acceptable for abuse protection, where the goal is to stop
 * automation rather than to meter precisely.
 */
const CONSUME = `
  local count = redis.call('INCR', KEYS[1])
  if count == 1 then
    redis.call('EXPIRE', KEYS[1], ARGV[1])
  end
  local ttl = redis.call('TTL', KEYS[1])
  return { count, ttl }
`;

export class RedisRateLimiter implements RateLimiter {
  constructor(
    private readonly redis: Redis,
    private readonly keyPrefix = 'rl',
  ) {}

  async consume(key: string, rule: RateLimitRule): Promise<RateLimitDecision> {
    try {
      const raw = (await this.redis.eval(
        CONSUME,
        1,
        `${this.keyPrefix}:${key}`,
        String(rule.windowSeconds),
      )) as [number, number];

      const count = Number(raw[0]);
      // -1 means no expiry was observed; fall back to the full window rather
      // than reporting a nonsensical Retry-After.
      const ttl = Number(raw[1]);
      const retryAfterSeconds = ttl > 0 ? ttl : rule.windowSeconds;

      return { allowed: count <= rule.limit, retryAfterSeconds, degraded: false };
    } catch {
      // Fail open. The store being unreachable must not stop people signing in.
      return { allowed: true, retryAfterSeconds: 0, degraded: true };
    }
  }
}
