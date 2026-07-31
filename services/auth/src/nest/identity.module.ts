import { Module, type DynamicModule } from '@nestjs/common';
import type { IdentityConfig } from '../config/identity-config';
import { createIdentityContainer, type IdentityContainer } from '../composition/identity-container';
import { APP_FILTER } from '@nestjs/core';
import { HealthController } from './health.controller';
import { AuthController } from './auth.controller';
import { ProblemDetailsFilter } from './problem-details.filter';
import { IDENTITY_CONFIG, IDENTITY_CONTAINER, IDENTITY_POOL } from './tokens';

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
