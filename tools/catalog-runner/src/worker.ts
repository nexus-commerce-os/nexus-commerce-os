/*
 * THE PRODUCTION CATALOGUE CYCLE, ON A SCHEDULE AND NOTHING ELSE.
 *
 * One handler. No `fetch`, deliberately: a Worker with no fetch handler has
 * no HTTP surface, so there is no administrative endpoint here to leave
 * unauthenticated and no fixture endpoint to serve synthetic data from a
 * production-named Worker. Everything a human needs to see about these runs
 * is already in `catalog_sync_cycle` and in the dashboard that reads it.
 *
 * WHAT IT RUNS. `runSyncCycle` — the same function the staging Worker has run
 * twice a day since 26-Nov, which retrieves every due source, imports,
 * classifies, matches and (when `auto_publish` is set) publishes a new
 * generation. Not a production-specific copy of it: a second implementation
 * of the eligibility rules is exactly how an unapproved merchant reaches the
 * public.
 */
import type { D1Like } from '../../../services/catalog/dist/worker.js';
import { runSyncCycle } from '../../../services/catalog/dist/worker.js';

interface Env {
  readonly CATALOG: D1Database;
}

/** What the bound database must say about itself before anything runs. */
const REQUIRED_ENVIRONMENT = 'production';

/*
 * THE BINDING IS CHECKED, NOT ASSUMED.
 *
 * This Worker's name says production and its cron writes to whatever database
 * is bound to CATALOG. A copy-pasted database id in wrangler.toml would
 * therefore run the production schedule against staging — or, far worse, let
 * a Worker that believes it is staging import fixture merchants into
 * production. `catalog_automation_config.environment` is the row the
 * scheduler already uses to refuse fixture sources, so it is the right thing
 * to agree with, and disagreeing with it is a refusal rather than a warning.
 */
async function boundEnvironment(db: D1Like): Promise<string | null> {
  const row = await db
    .prepare('SELECT environment FROM catalog_automation_config WHERE id = 1')
    .first<{ environment: string | null }>();
  return row?.environment ?? null;
}

/** One structured line per cycle: what happened, never what was in the feed. */
function log(line: Record<string, unknown>): void {
  console.log(JSON.stringify(line));
}

export default {
  async scheduled(event: ScheduledController, env: Env): Promise<void> {
    const at = new Date(event.scheduledTime).toISOString();
    const db = env.CATALOG as unknown as D1Like;

    let environment: string | null;
    try {
      environment = await boundEnvironment(db);
    } catch (error) {
      // A database that cannot answer this is a database no cycle should run
      // against, and the console line is the only record available.
      log({
        at,
        cron: event.cron,
        outcome: 'refused',
        detail: `cannot read the environment: ${(error as Error).message}`,
      });
      return;
    }

    if (environment !== REQUIRED_ENVIRONMENT) {
      log({
        at,
        cron: event.cron,
        outcome: 'refused',
        detail: `the bound database says environment="${environment ?? 'unset'}", not "${REQUIRED_ENVIRONMENT}"`,
      });
      return;
    }

    /*
     * THE HANDLER RECORDS ITS OWN FAILURE.
     *
     * `runSyncCycle` writes a row for every outcome it reaches, refusals
     * included — but it cannot write one for a throw before it starts. That
     * failure is INVISIBLE: the cycle log stays empty, which reads exactly
     * like a cron that never fired. The same lesson the staging Worker
     * learned by watching an empty log for five minutes.
     */
    let result;
    try {
      result = await runSyncCycle(db, { now: new Date(event.scheduledTime), trigger: 'scheduled' });
    } catch (error) {
      const detail = error instanceof Error ? `${error.name}: ${error.message}` : String(error);
      log({ at, cron: event.cron, outcome: 'failed', detail });
      try {
        await db
          .prepare(
            `INSERT INTO catalog_sync_cycle
               (id, started_at, finished_at, trigger, outcome, detail)
             VALUES (?,?,?,'scheduled','failed',?)
             ON CONFLICT (id) DO UPDATE SET detail = excluded.detail`,
          )
          .bind(`cycle-${at}-scheduled`, at, new Date().toISOString(), detail.slice(0, 500))
          .run();
      } catch {
        // If the database is the broken thing, this fails too, and the line
        // above is the record. Throwing from a cron handler buys nothing.
      }
      return;
    }

    /*
     * The figures a human would ask for, and no feed content. `considered` is
     * how many sources were due, not how many exist — with none configured it
     * is 0, which is the line that proves the schedule fired and found
     * nothing to do rather than failing to fire at all.
     */
    log({
      at,
      cron: event.cron,
      outcome: result.outcome,
      detail: result.detail,
      sourcesConsidered: result.retrieval?.considered ?? 0,
      publicationRan: result.publication?.ran ?? false,
      publicationSkipped: result.publication?.skipped ?? null,
      generation: result.publication?.generation ?? null,
      productsPublished: result.publication?.counts.products ?? null,
      rowsWritten: result.cost.rowsWritten,
    });
  },
};
