import { describe, it, expect, afterEach } from 'vitest';
import { Test } from '@nestjs/testing';
import type { INestApplication } from '@nestjs/common';
import request from 'supertest';
import type { Pool } from 'pg';
import { HealthController } from '../health.controller';
import { IDENTITY_POOL } from '../tokens';

/**
 * A pool stand-in for the readiness probe. Only `query` is exercised, so the
 * cast is confined to this one line rather than spreading through the test.
 */
function poolThat(behaviour: 'answers' | 'fails'): Pool {
  return {
    query: (): Promise<{ rows: unknown[] }> =>
      behaviour === 'answers'
        ? Promise.resolve({ rows: [{ '?column?': 1 }] })
        : Promise.reject(new Error('connection refused')),
  } as unknown as Pool;
}

async function appWith(pool: Pool): Promise<INestApplication> {
  const moduleRef = await Test.createTestingModule({
    controllers: [HealthController],
    providers: [{ provide: IDENTITY_POOL, useValue: pool }],
  }).compile();
  const app = moduleRef.createNestApplication();
  await app.init();
  return app;
}

describe('health endpoints (ADR-0010 #5)', () => {
  let app: INestApplication | undefined;

  afterEach(async () => {
    await app?.close();
    app = undefined;
  });

  /**
   * Liveness must never consult a dependency: if it did, a database blip would
   * get healthy pods restarted and turn a partial outage into a total one.
   */
  it('reports live without touching the database', async () => {
    let queried = false;
    const spy = {
      query: (): Promise<{ rows: unknown[] }> => {
        queried = true;
        return Promise.resolve({ rows: [] });
      },
    } as unknown as Pool;
    app = await appWith(spy);

    const response = await request(app.getHttpServer()).get('/healthz');

    expect(response.status).toBe(200);
    expect(response.body).toEqual({ status: 'ok' });
    expect(queried).toBe(false);
  });

  it('reports ready with dependency health when the database answers', async () => {
    app = await appWith(poolThat('answers'));

    const response = await request(app.getHttpServer()).get('/readyz');

    expect(response.status).toBe(200);
    expect(response.body).toEqual({ status: 'ready', dependencies: { database: 'up' } });
  });

  /** A pod that cannot reach its database should leave rotation, not serve errors. */
  it('reports 503 and names the failing dependency when the database is down', async () => {
    app = await appWith(poolThat('fails'));

    const response = await request(app.getHttpServer()).get('/readyz');

    expect(response.status).toBe(503);
    expect(response.body).toMatchObject({
      status: 'not_ready',
      dependencies: { database: 'down' },
    });
  });

  it('stays live even while readiness is failing', async () => {
    app = await appWith(poolThat('fails'));

    expect((await request(app.getHttpServer()).get('/healthz')).status).toBe(200);
    expect((await request(app.getHttpServer()).get('/readyz')).status).toBe(503);
  });
});
