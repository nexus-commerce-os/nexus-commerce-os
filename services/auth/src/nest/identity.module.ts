import { Module, type DynamicModule } from '@nestjs/common';
import type { IdentityConfig } from '../config/identity-config';
import { createIdentityContainer, type IdentityContainer } from '../composition/identity-container';
import { APP_FILTER, APP_GUARD } from '@nestjs/core';
import { HealthController } from './health.controller';
import { AuthController } from './auth.controller';
import { ProblemDetailsFilter } from './problem-details.filter';
import { SessionAuthGuard } from './session-auth.guard';
import { RateLimitGuard, type RateLimitPolicy } from './rate-limit/rate-limit.guard';
import { RedisRateLimiter } from './rate-limit/redis-rate-limiter';
import { policyFrom } from './rate-limit/rate-limit-policy';
import { SILENT_OBSERVER, type RateLimiter } from './rate-limit/rate-limiter';
import Redis from 'ioredis';
import {
  IDENTITY_CONFIG,
  IDENTITY_CONTAINER,
  IDENTITY_POOL,
  RATE_LIMITER,
  RATE_LIMIT_OBSERVER,
  RATE_LIMIT_POLICY,
} from './tokens';

/**
 * The NestJS edge of the Identity module.
 *
 * Nest is used only for HTTP plumbing and lifecycle: the object graph is built
 * by the composition root, not by decorators, so the domain and use cases stay
 * framework-free exactly as they were through I-1..I-6. That is what makes the
 * whole module testable without booting a web server.
 *
 * `forRoot` takes an already-validated config; `forContainer` takes a container
 * outright, which is how tests supply fakes without a database.
 */
@Module({})
export class IdentityModule {
  static forRoot(config: IdentityConfig): DynamicModule {
    return IdentityModule.forContainer(createIdentityContainer(config), config);
  }

  static forContainer(container: IdentityContainer, config?: IdentityConfig): DynamicModule {
    return {
      module: IdentityModule,
      controllers: [HealthController, AuthController],
      providers: [
        { provide: APP_FILTER, useClass: ProblemDetailsFilter },
        SessionAuthGuard,
        { provide: APP_GUARD, useClass: RateLimitGuard },
        { provide: RATE_LIMIT_POLICY, useValue: rateLimitPolicy(config) },
        { provide: RATE_LIMITER, useValue: rateLimiter(config) },
        {
          provide: RATE_LIMIT_OBSERVER,
          useValue: config === undefined ? SILENT_OBSERVER : loggingObserver(),
        },
        { provide: IDENTITY_CONTAINER, useValue: container },
        { provide: IDENTITY_POOL, useValue: container.pool },
        ...(config === undefined ? [] : [{ provide: IDENTITY_CONFIG, useValue: config }]),
      ],
      exports: [IDENTITY_CONTAINER, IDENTITY_POOL],
    };
  }
}

/**
 * Version prefix. The contract declares `servers: /v1`; a conformance test
 * asserts this constant and that declaration agree, so they cannot drift.
 */
export const API_PREFIX = 'v1';

/**
 * With no configuration — the shape tests use — the limiter is off and the
 * store is one that refuses to answer. An in-memory counter must never be
 * reachable from here: per-pod state would make the effective limit
 * `N x pods` and reset it on every deploy, which is worse than being honest
 * about having no limiter at all.
 */
function rateLimitPolicy(config?: IdentityConfig): RateLimitPolicy {
  if (config === undefined) {
    return { enabled: false, trustedProxyHops: 0, keySecret: '', operations: {} };
  }
  return policyFrom(config.rateLimit);
}

function rateLimiter(config?: IdentityConfig): RateLimiter {
  if (config === undefined || !config.rateLimit.enabled) {
    return {
      consume: () =>
        Promise.reject(new Error('rate limiting is disabled; no limiter is configured')),
    };
  }
  return new RedisRateLimiter(new Redis(config.rateLimit.redisUrl, { lazyConnect: false }));
}

/**
 * Operational visibility until a metrics stack exists. Only rejections and
 * degradation are reported — logging every allowed request would drown the
 * signal that matters.
 */
function loggingObserver(): { onDecision: (event: RateLimitEventShape) => void } {
  return {
    onDecision: (event): void => {
      if (event.degraded) {
        console.error(
          `[identity] rate-limit store unavailable; failing open for ${event.operation}`,
        );
        return;
      }
      if (!event.allowed) {
        console.warn(`[identity] rate limited ${event.operation} on the ${event.layer} layer`);
      }
    },
  };
}

interface RateLimitEventShape {
  readonly operation: string;
  readonly layer: string;
  readonly allowed: boolean;
  readonly degraded: boolean;
}
