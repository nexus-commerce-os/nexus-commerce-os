import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { Test } from '@nestjs/testing';
import { APP_GUARD } from '@nestjs/core';
import type { INestApplication } from '@nestjs/common';
import request from 'supertest';
import { AuthController } from '../../auth.controller';
import { ProblemDetailsFilter } from '../../problem-details.filter';
import { SessionAuthGuard } from '../../session-auth.guard';
import { RateLimitGuard, type RateLimitPolicy } from '../rate-limit.guard';
import { InMemoryRateLimiter } from '../in-memory-rate-limiter';
import type { RateLimitEvent } from '../rate-limiter';
import {
  IDENTITY_CONTAINER,
  RATE_LIMITER,
  RATE_LIMIT_OBSERVER,
  RATE_LIMIT_POLICY,
} from '../../tokens';
import type { IdentityContainer } from '../../../composition/identity-container';
import { FakeClock } from '../../../identity/__tests__/fake-clock';

const KEY_SECRET = 'test-only-rate-limit-secret-0000000000';

/** Tight limits so the tests read as intent rather than as loops. */
const POLICY: RateLimitPolicy = {
  enabled: true,
  trustedProxyHops: 1,
  keySecret: KEY_SECRET,
  operations: {
    login: {
      network: { limit: 100, windowSeconds: 60 },
      fingerprint: { limit: 2, windowSeconds: 60 },
    },
    requestPasswordReset: {
      network: { limit: 100, windowSeconds: 60 },
      fingerprint: { limit: 2, windowSeconds: 60 },
      silentDropStatus: 202,
    },
    requestEmailVerification: {
      network: { limit: 100, windowSeconds: 60 },
      fingerprint: { limit: 1, windowSeconds: 60 },
    },
  },
};

let clock: FakeClock;
let limiter: InMemoryRateLimiter;
let events: RateLimitEvent[];
let app: INestApplication;

/** The controller is never reached in these tests; only the guard is. */
const container = {
  useCases: {
    authenticateUser: {
      execute: () => Promise.resolve({ ok: false, error: { _tag: 'InvalidCredentialsError' } }),
    },
    sendPasswordReset: { execute: () => Promise.resolve({ ok: true, value: undefined }) },
  },
} as unknown as IdentityContainer;

beforeEach(async () => {
  clock = new FakeClock(new Date('2026-07-31T00:00:00.000Z'));
  limiter = new InMemoryRateLimiter(clock);
  events = [];

  const moduleRef = await Test.createTestingModule({
    controllers: [AuthController],
    providers: [
      { provide: IDENTITY_CONTAINER, useValue: container },
      { provide: RATE_LIMITER, useValue: limiter },
      { provide: RATE_LIMIT_POLICY, useValue: POLICY },
      {
        provide: RATE_LIMIT_OBSERVER,
        useValue: { onDecision: (e: RateLimitEvent) => events.push(e) },
      },
      { provide: APP_GUARD, useClass: RateLimitGuard },
      SessionAuthGuard,
    ],
  }).compile();
  app = moduleRef.createNestApplication();
  app.useGlobalFilters(new ProblemDetailsFilter());
  await app.init();
});

afterEach(async () => {
  await app.close();
});

function post(path: string, forwardedFor = '203.0.113.7', agent = 'Test/1'): request.Test {
  return request(app.getHttpServer())
    .post(path)
    .set('X-Forwarded-For', forwardedFor)
    .set('User-Agent', agent);
}

const LOGIN = { email: 'jane@example.com', password: 'Correct-Horse-9!' };

describe('RateLimitGuard — thresholds', () => {
  it('allows up to the limit and then answers 429 with Retry-After', async () => {
    for (let i = 0; i < 2; i += 1) {
      const allowed = await post('/auth/login').send(LOGIN);
      expect(allowed.status).not.toBe(429);
    }

    const limited = await post('/auth/login').send(LOGIN);
    expect(limited.status).toBe(429);
    expect(limited.body.code).toBe('RateLimitedError');
    expect(Number(limited.headers['retry-after'])).toBeGreaterThan(0);
    expect(Number(limited.headers['retry-after'])).toBeLessThanOrEqual(60);
  });

  it('lets the caller back in once the window has passed', async () => {
    for (let i = 0; i < 3; i += 1) {
      await post('/auth/login').send(LOGIN);
    }
    expect((await post('/auth/login').send(LOGIN)).status).toBe(429);

    clock.advance(61_000);
    expect((await post('/auth/login').send(LOGIN)).status).not.toBe(429);
  });

  it('gives a different client its own quota', async () => {
    for (let i = 0; i < 3; i += 1) {
      await post('/auth/login').send(LOGIN);
    }
    expect((await post('/auth/login').send(LOGIN)).status).toBe(429);

    // different fingerprint, same network
    expect((await post('/auth/login', '203.0.113.7', 'Other/2').send(LOGIN)).status).not.toBe(429);
  });

  it('leaves unprotected operations alone', async () => {
    for (let i = 0; i < 5; i += 1) {
      const response = await post('/auth/session/refresh').send({ refreshToken: 'x' });
      expect(response.status).not.toBe(429);
    }
  });
});

describe('RateLimitGuard — spoofing', () => {
  /**
   * Only the hop our own proxy wrote is trusted. If a forged chain minted a
   * fresh bucket, the network layer would hand an attacker unlimited quota.
   */
  it('cannot be reset by forging the forwarded chain', async () => {
    for (let i = 0; i < 3; i += 1) {
      await post('/auth/login', '203.0.113.7').send(LOGIN);
    }
    expect((await post('/auth/login', '203.0.113.7').send(LOGIN)).status).toBe(429);

    for (const spoof of ['1.1.1.1', '2.2.2.2', '3.3.3.3']) {
      const response = await post('/auth/login', `${spoof}, 203.0.113.7`).send(LOGIN);
      expect(response.status, `spoofing ${spoof} minted a fresh bucket`).toBe(429);
    }
  });
});

describe('RateLimitGuard — account-enumeration safety', () => {
  /**
   * The test the design was written around. A 429 on password reset would tell
   * a prober which addresses exist: unknown ones could be submitted forever
   * while real ones began to throttle. Throttled must look exactly like
   * accepted — same status, same body, and no `Retry-After`, since the header
   * alone is the tell.
   */
  it('answers a throttled reset request exactly as it answers an accepted one', async () => {
    const responses = [];
    for (let i = 0; i < 4; i += 1) {
      responses.push(
        await post('/auth/password/reset-requests').send({ email: 'jane@example.com' }),
      );
    }

    for (const response of responses) {
      expect(response.status).toBe(202);
      expect(response.body).toEqual({});
      expect(response.headers['retry-after']).toBeUndefined();
    }
  });

  it('produces byte-identical sequences for a known and an unknown address', async () => {
    const sequenceFor = async (email: string, agent: string): Promise<string[]> => {
      const seen: string[] = [];
      for (let i = 0; i < 4; i += 1) {
        const response = await post('/auth/password/reset-requests', '203.0.113.7', agent).send({
          email,
        });
        seen.push(
          `${response.status}|${JSON.stringify(response.body)}|${response.headers['retry-after'] ?? '-'}`,
        );
      }
      return seen;
    };

    expect(await sequenceFor('jane@example.com', 'A/1')).toEqual(
      await sequenceFor('nobody@example.com', 'B/1'),
    );
  });
});

describe('RateLimitGuard — availability', () => {
  /**
   * Fail open. Rejecting every login because a cache is down would make the
   * limiter the most effective denial of service in the system — but it must be
   * visible, so the degradation is reported.
   */
  it('allows the request and reports degradation when the store is unreachable', async () => {
    limiter.failWith();

    for (let i = 0; i < 5; i += 1) {
      expect((await post('/auth/login').send(LOGIN)).status).not.toBe(429);
    }
    expect(events.every((e) => e.degraded)).toBe(true);
    expect(events.length).toBeGreaterThan(0);
  });

  it('reports which layer rejected, for operational visibility', async () => {
    for (let i = 0; i < 4; i += 1) {
      await post('/auth/login').send(LOGIN);
    }
    const rejection = events.find((e) => !e.allowed);
    expect(rejection?.operation).toBe('login');
    expect(rejection?.layer).toBe('fingerprint');
  });
});

describe('RateLimitGuard — ordering', () => {
  /**
   * The limiter is registered globally, so it runs before route guards: an
   * unauthenticated flood is rejected before it can cost a session lookup.
   * Registering it as a second `@UseGuards()` on the method would instead have
   * overwritten the authentication guard.
   */
  it('rate-limits an authenticated route before authenticating it', async () => {
    const first = await post('/auth/email/verification-requests').send({});
    expect(first.status).toBe(401);

    const second = await post('/auth/email/verification-requests').send({});
    expect(second.status).toBe(429);
  });

  it('still authenticates protected routes that are under the limit', async () => {
    const response = await post('/auth/email/verification-requests').send({});
    expect(response.status).toBe(401);
    expect(response.body.code).toBe('InvalidAccessTokenError');
  });
});
