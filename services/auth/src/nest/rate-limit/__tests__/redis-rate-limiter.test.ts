import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { GenericContainer, type StartedTestContainer } from 'testcontainers';
import Redis from 'ioredis';
import { RedisRateLimiter } from '../redis-rate-limiter';

/**
 * The real adapter against a real Redis.
 *
 * The in-memory double proves the guard's logic; it cannot prove the Lua script,
 * the atomicity of increment-and-expire, or that a TTL is actually set — and a
 * counter that never expires locks a caller out permanently. Those are exactly
 * the failures a double hides, so they need the real thing.
 *
 * Enforced in CI (`NEXUS_REDIS_TESTS=1`), skipped on a workstation without
 * Docker with the reason printed rather than silently passing.
 */
const REDIS_TESTS_ENABLED = process.env['NEXUS_REDIS_TESTS'] === '1';
const CONTAINER_TIMEOUT_MS = 180_000;

const RULE = { limit: 3, windowSeconds: 60 };

describe.skipIf(!REDIS_TESTS_ENABLED)('RedisRateLimiter', () => {
  let container: StartedTestContainer;
  let redis: Redis;
  let limiter: RedisRateLimiter;
  let counter = 0;

  /** A fresh key per test, so one test cannot consume another's quota. */
  const nextKey = (): string => `test-${(counter += 1)}`;

  beforeAll(async () => {
    container = await new GenericContainer('redis:7-alpine').withExposedPorts(6379).start();
    redis = new Redis({ host: container.getHost(), port: container.getMappedPort(6379) });
    limiter = new RedisRateLimiter(redis, 'test-rl');
  }, CONTAINER_TIMEOUT_MS);

  afterAll(async () => {
    redis?.disconnect();
    await container?.stop();
  });

  it('allows up to the limit and rejects beyond it', async () => {
    const key = nextKey();
    for (let i = 0; i < RULE.limit; i += 1) {
      const decision = await limiter.consume(key, RULE);
      expect(decision.allowed, `request ${i + 1} should be allowed`).toBe(true);
      expect(decision.degraded).toBe(false);
    }

    const rejected = await limiter.consume(key, RULE);
    expect(rejected.allowed).toBe(false);
    expect(rejected.degraded).toBe(false);
  });

  /**
   * The failure a two-command INCR-then-EXPIRE would produce: a counter with no
   * TTL never resets, so the caller is locked out forever.
   */
  it('always leaves the counter with an expiry', async () => {
    const key = nextKey();
    await limiter.consume(key, RULE);

    const ttl = await redis.ttl(`test-rl:${key}`);
    expect(ttl).toBeGreaterThan(0);
    expect(ttl).toBeLessThanOrEqual(RULE.windowSeconds);
  });

  it('reports the real remaining time rather than a constant', async () => {
    const key = nextKey();
    for (let i = 0; i <= RULE.limit; i += 1) {
      await limiter.consume(key, RULE);
    }

    const decision = await limiter.consume(key, RULE);
    expect(decision.allowed).toBe(false);
    expect(decision.retryAfterSeconds).toBeGreaterThan(0);
    expect(decision.retryAfterSeconds).toBeLessThanOrEqual(RULE.windowSeconds);
  });

  it('keeps separate keys independent', async () => {
    const exhausted = nextKey();
    for (let i = 0; i <= RULE.limit; i += 1) {
      await limiter.consume(exhausted, RULE);
    }
    expect((await limiter.consume(exhausted, RULE)).allowed).toBe(false);
    expect((await limiter.consume(nextKey(), RULE)).allowed).toBe(true);
  });

  it('lets the caller back in once the window expires', async () => {
    const key = nextKey();
    const oneSecond = { limit: 1, windowSeconds: 1 };

    expect((await limiter.consume(key, oneSecond)).allowed).toBe(true);
    expect((await limiter.consume(key, oneSecond)).allowed).toBe(false);

    await new Promise((resolve) => setTimeout(resolve, 1_200));
    expect((await limiter.consume(key, oneSecond)).allowed).toBe(true);
  });

  /**
   * The counter is shared, which is the entire reason for using Redis: two
   * processes must not each get their own quota.
   */
  it('shares state across connections, as separate pods would', async () => {
    const key = nextKey();
    const other = new Redis({ host: container.getHost(), port: container.getMappedPort(6379) });
    const otherLimiter = new RedisRateLimiter(other, 'test-rl');

    try {
      for (let i = 0; i < RULE.limit; i += 1) {
        await limiter.consume(key, RULE);
      }
      expect((await otherLimiter.consume(key, RULE)).allowed).toBe(false);
    } finally {
      other.disconnect();
    }
  });

  /** Fail open: an unreachable store must not stop people signing in. */
  it('allows the request and reports degradation when Redis is unreachable', async () => {
    const dead = new Redis({
      host: '127.0.0.1',
      port: 1,
      lazyConnect: true,
      retryStrategy: () => null,
    });
    const decision = await new RedisRateLimiter(dead).consume('any', RULE);
    dead.disconnect();

    expect(decision.allowed).toBe(true);
    expect(decision.degraded).toBe(true);
  });
});

/**
 * A skipped suite reports green, so the gate itself has to be asserted — this is
 * the same false-green trap the Postgres suites guard against.
 */
describe('Redis suite gate', () => {
  it('is enabled in CI', () => {
    if (process.env['CI'] === 'true') {
      expect(
        REDIS_TESTS_ENABLED,
        'NEXUS_REDIS_TESTS must be 1 in CI, or the Redis adapter is never exercised',
      ).toBe(true);
    } else {
      expect(true).toBe(true);
    }
  });
});
