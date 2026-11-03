import { Controller, Get, Inject, ServiceUnavailableException } from '@nestjs/common';
import type { Pool } from 'pg';
import { IDENTITY_POOL } from './tokens';

export type DependencyStatus = 'up' | 'down';

export interface ReadinessBody {
  readonly status: 'ready' | 'not_ready';
  readonly dependencies: Readonly<Record<string, DependencyStatus>>;
}

const READINESS_PROBE_SQL = 'SELECT 1';

/**
 * Liveness, readiness and dependency health — ADR-0010 #5, consumed by
 * Kubernetes and by the gateway's failover (docs/10).
 *
 * The distinction matters operationally: **liveness** says the process is
 * running and must never touch a dependency, or a database blip would get
 * healthy pods killed and turn a partial outage into a total one.
 * **Readiness** does check the database, because a pod that cannot reach it
 * should be taken out of rotation rather than serve errors.
 */
@Controller()
export class HealthController {
  constructor(@Inject(IDENTITY_POOL) private readonly pool: Pool) {}

  @Get('healthz')
  liveness(): { status: 'ok' } {
    return { status: 'ok' };
  }

  @Get('readyz')
  async readiness(): Promise<ReadinessBody> {
    const database = await this.probeDatabase();
    if (database !== 'up') {
      // 503 so the orchestrator pulls this pod out of rotation instead of
      // routing traffic it cannot serve; the body still names the culprit.
      throw new ServiceUnavailableException({
        status: 'not_ready',
        dependencies: { database },
      } satisfies ReadinessBody);
    }
    return { status: 'ready', dependencies: { database } };
  }

  private async probeDatabase(): Promise<DependencyStatus> {
    try {
      await this.pool.query(READINESS_PROBE_SQL);
      return 'up';
    } catch {
      return 'down';
    }
  }
}
