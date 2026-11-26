/*
 * Compiles services/catalog before the Worker bundles it.
 *
 * WHY THIS IS A DEPLOY STEP AND NOT A CONVENTION. `worker/catalog.ts` imports
 * `services/catalog/dist/worker.js` by relative path, and `dist/` is
 * gitignored. Without this, a clean checkout deploys a Worker whose catalogue
 * import resolves to whatever happened to be on that machine — or to nothing.
 *
 * WHY A RELATIVE IMPORT RATHER THAN A WORKSPACE DEPENDENCY. Adding
 * `@nexus/catalog` to apps/web would change pnpm-lock.yaml, and this
 * repository's install refuses to proceed without a TTY when the lockfile
 * moves. A deploy path that depends on a lockfile edit landing cleanly is a
 * deploy path that breaks at the worst moment. The relative import costs
 * nothing and this script makes it reproducible.
 */
import { spawnSync } from 'node:child_process';
import { existsSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const here = dirname(fileURLToPath(import.meta.url));
const catalog = resolve(here, '../../../services/catalog');

if (!existsSync(join(catalog, 'tsconfig.json'))) {
  console.error(`build-catalog: ${catalog} has no tsconfig.json; refusing to guess.`);
  process.exit(1);
}

/*
 * `process.execPath` with tsc's own entry, NOT `npx tsc`.
 *
 * Node refuses to spawn a `.cmd` without a shell on Windows, which is how an
 * earlier version of this pattern failed with EINVAL. Resolving the JS entry
 * and running it with the current Node binary avoids the shell entirely.
 */
const tsc = join(catalog, 'node_modules', 'typescript', 'lib', 'tsc.js');
if (!existsSync(tsc)) {
  console.error('build-catalog: typescript is not installed in services/catalog.');
  process.exit(1);
}

const result = spawnSync(process.execPath, [tsc, '-p', join(catalog, 'tsconfig.json')], {
  stdio: 'inherit',
});

if (result.status !== 0) {
  console.error('build-catalog: the catalogue did not compile; refusing to deploy.');
  process.exit(result.status ?? 1);
}

if (!existsSync(join(catalog, 'dist', 'worker.js'))) {
  // A zero exit with no output would mean the Worker bundles nothing.
  console.error('build-catalog: tsc succeeded but dist/worker.js is absent.');
  process.exit(1);
}

console.log('build-catalog: services/catalog compiled.');
