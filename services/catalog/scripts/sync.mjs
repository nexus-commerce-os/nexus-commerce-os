#!/usr/bin/env node
/**
 * The command a scheduler runs.
 *
 *   node scripts/sync.mjs --config feeds.json [--force] [--allow-fixtures]
 *                         [--deadline-ms 600000] [--concurrency 2]
 *
 * EXIT CODES ARE THE ALERT. 0 = nothing failed; 1 = at least one source
 * failed; 2 = the configuration is invalid. A scheduler that only looks at
 * "did the process run" learns nothing, so this makes the distinction the
 * thing it can already see.
 *
 * STORAGE. `--dsn` (or HONESTTOTAL_PG_DSN) uses PostgreSQL. Without one this
 * runs against the in-memory store, which is useful for proving the pipeline
 * and USELESS for keeping a catalogue — nothing survives the process. It says
 * so on every run rather than letting a green job imply persistence.
 */

import { readFile } from 'node:fs/promises';
import { dirname, isAbsolute, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const argv = process.argv.slice(2);
const flag = (name) => argv.includes(`--${name}`);
const value = (name, fallback) => {
  const i = argv.indexOf(`--${name}`);
  return i >= 0 && argv[i + 1] ? argv[i + 1] : fallback;
};

const configPath = value('config');
if (!configPath) {
  console.error('usage: node scripts/sync.mjs --config <feeds.json> [--force] [--allow-fixtures]');
  process.exit(2);
}

const {
  InMemoryOfferStore,
  InMemorySourceState,
  PostgresOfferStore,
  CatalogMigrationRunner,
  envCredentialResolver,
  runSync,
} = await import(new URL('../dist/index.js', import.meta.url).href);

const configFile = resolve(process.cwd(), configPath);
const parsed = JSON.parse(await readFile(configFile, 'utf8'));
const sources = (parsed.sources ?? []).map((source) =>
  // A fixture path in config is relative to the CONFIG file, not to whatever
  // directory the scheduler happened to start in.
  source.transport === 'fixture' && !isAbsolute(source.url)
    ? { ...source, url: resolve(dirname(configFile), source.url) }
    : source,
);

const dsn = value('dsn', process.env.HONESTTOTAL_PG_DSN);
let store;
let closeStore = async () => {};

if (dsn) {
  const pg = await import('pg');
  const pool = new pg.default.Pool({ connectionString: dsn, max: 4 });
  // `migrate()`, and the migrations directory is required — the runner does
  // not guess where the SQL lives. The first version of this called a method
  // that does not exist; CI caught it on the first scheduled run, which is
  // exactly what the assertions around the command are for.
  const migrationsDir = fileURLToPath(new URL('../migrations/', import.meta.url));
  const applied = await new CatalogMigrationRunner(pool, migrationsDir).migrate();
  process.stdout.write(`${JSON.stringify({ event: 'sync.migrate', applied })}
`);
  store = new PostgresOfferStore(pool);
  closeStore = () => pool.end();
  process.stdout.write(
    `${JSON.stringify({ event: 'sync.storage', kind: 'postgres', durable: true })}\n`,
  );
} else {
  store = new InMemoryOfferStore();
  process.stdout.write(
    `${JSON.stringify({
      event: 'sync.storage',
      kind: 'in-memory',
      durable: false,
      warning:
        'No DSN given. This run proves the pipeline but PERSISTS NOTHING — the catalogue dies with the process.',
    })}\n`,
  );
}

try {
  const result = await runSync(sources, store, new InMemorySourceState(), {
    force: flag('force'),
    allowFixtures: flag('allow-fixtures'),
    deadlineMs: Number(value('deadline-ms', 600_000)),
    concurrency: Number(value('concurrency', 2)),
    retrieveOptions: { resolveCredential: envCredentialResolver() },
  });

  // GitHub Actions reads these and surfaces them on the run; harmless elsewhere.
  for (const failure of result.health.failing) {
    process.stdout.write(`::error title=Feed sync failed::${failure.sourceId}: ${failure.reason}\n`);
  }
  if (result.deadlineHit) {
    process.stdout.write(
      '::warning title=Sync deadline::the cycle ran out of time; deferred sources are still due and will be picked up next run\n',
    );
  }

  process.exitCode = result.exitCode;
} finally {
  await closeStore();
}
