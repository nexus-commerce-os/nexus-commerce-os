import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { Test } from '@nestjs/testing';
import type { INestApplication } from '@nestjs/common';
import request from 'supertest';
import { AuthController } from '../auth.controller';
import { ProblemDetailsFilter } from '../problem-details.filter';
import { HealthController } from '../health.controller';
import { Contract } from '../openapi/contract';
import { API_PREFIX } from '../identity.module';
import { IDENTITY_CONTAINER, IDENTITY_POOL } from '../tokens';
import type { IdentityContainer } from '../../composition/identity-container';

/**
 * Contract-first governance (ADR-0020 ruling, 2026-07-31).
 *
 * These are the tests that make "the specification is the source of truth" an
 * enforced property rather than a stated intention. They fail the build when
 * the document and the running application disagree in either direction — a
 * declared operation that is not routed, or a route nobody published.
 */
const contract = Contract.load();

/** Never called: these tests only probe routing and validation, never a use case. */
const unusedContainer = {
  useCases: new Proxy(
    {},
    {
      get(): never {
        throw new Error('a conformance test reached a use case');
      },
    },
  ),
} as unknown as IdentityContainer;

let app: INestApplication;

beforeAll(async () => {
  const moduleRef = await Test.createTestingModule({
    controllers: [AuthController, HealthController],
    providers: [
      { provide: IDENTITY_CONTAINER, useValue: unusedContainer },
      { provide: IDENTITY_POOL, useValue: { query: () => Promise.resolve({ rows: [] }) } },
    ],
  }).compile();
  app = moduleRef.createNestApplication();
  app.useGlobalFilters(new ProblemDetailsFilter());
  await app.init();
});

afterAll(async () => {
  await app.close();
});

describe('OpenAPI contract', () => {
  it('is a 3.1 document and every $ref resolves', () => {
    expect(contract.document.openapi).toMatch(/^3\.1/);
    for (const [operationId] of contract.operations()) {
      // compiling the request schema forces every $ref on that path to resolve
      expect(() => contract.validateRequest(operationId, {})).toThrow();
    }
  });

  it('declares the version prefix the application actually mounts', () => {
    const servers = (contract.document as unknown as { servers: { url: string }[] }).servers;
    expect(servers[0]?.url).toBe(`/${API_PREFIX}`);
  });

  it('gives every operation a unique operationId', () => {
    const declared = [...contract.operations().keys()];
    expect(new Set(declared).size).toBe(declared.length);
    expect(declared.length).toBeGreaterThan(0);
  });

  /**
   * Every published operation must be reachable. An unrouted one answers 404;
   * a routed one rejects the empty body as a contract violation, because every
   * operation here requires a body.
   */
  it('routes every operation the document declares', async () => {
    for (const [operationId, { method, path }] of contract.operations()) {
      expect(method).toBe('post');
      const response = await request(app.getHttpServer()).post(path).send({});
      expect(
        response.status,
        `${operationId} (${method.toUpperCase()} ${path}) is declared but not routed`,
      ).not.toBe(404);
      expect(response.status).toBe(400);
      expect(response.body.code).toBe('ContractViolation');
    }
  });

  /**
   * The other direction: nothing may be served that was never published. An
   * undocumented endpoint is how a contract quietly stops being the truth.
   */
  it('serves no route the document does not declare', () => {
    const declared = new Set([...contract.operations().values()].map((o) => o.path));
    // Probes are infrastructure, not public API: they are consumed by
    // Kubernetes against a fixed ADR-0010 contract, never by an API client.
    const exempt = new Set(['/healthz', '/readyz']);

    for (const route of routesOf(app)) {
      if (exempt.has(route)) {
        continue;
      }
      expect(declared.has(route), `${route} is served but absent from the contract`).toBe(true);
    }
  });

  it('refuses an operationId it does not know, rather than passing the body through', () => {
    expect(() => contract.validateRequest('noSuchOperation', {})).toThrow(/not declared/);
  });
});

interface ExpressLayer {
  route?: { path: string };
}

/** Express 4 router introspection — the routes the app genuinely serves. */
function routesOf(application: INestApplication): readonly string[] {
  const instance = application.getHttpAdapter().getInstance() as {
    _router?: { stack: ExpressLayer[] };
    router?: { stack: ExpressLayer[] };
  };
  const stack = instance._router?.stack ?? instance.router?.stack;
  if (stack === undefined) {
    throw new Error('could not introspect the router; this test must not silently pass');
  }
  return stack.flatMap((layer) => (layer.route === undefined ? [] : [layer.route.path]));
}
