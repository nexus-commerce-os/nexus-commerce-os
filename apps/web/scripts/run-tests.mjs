/**
 * Runs this package's test files, explicitly.
 *
 * `node --test test/*.test.mjs` works only because CI's shell expands the
 * glob; on Windows it reaches Node literally and matches nothing, and
 * `node --test test` reports a single phantom passing test without running a
 * suite. Both failure modes are silent, so the list is built here and an empty
 * one is an error. Mirrors `packages/shared/scripts/run-tests.mjs`.
 */

import { spawnSync } from 'node:child_process';
import { existsSync, readFileSync, readdirSync, writeFileSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const packageRoot = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const files = readdirSync(join(packageRoot, 'test'))
  .filter((name) => name.endsWith('.test.mjs'))
  .sort()
  .map((name) => join('test', name));

if (files.length === 0) {
  console.error('No test files found in test/. Refusing to report success on an empty suite.');
  process.exit(1);
}

/*
 * The Worker is TypeScript and the test runner is plain Node, so compile it
 * first into a scratch directory the tests import from.
 *
 * This exists because the Worker was the one piece of this app with no test
 * at all, and it is the piece that decides whether a signup is kept or thrown
 * away. `wrangler dev` would be the fuller check, but it needs a running
 * runtime and a port; this needs neither and runs in CI unchanged.
 */
const workerOut = join(packageRoot, '.worker-test');
const tsc = join(packageRoot, 'node_modules', 'typescript', 'bin', 'tsc');
const compile = spawnSync(
  process.execPath,
  [
    tsc,
    'worker/index.ts',
    '--outDir',
    '.worker-test',
    '--target',
    'es2022',
    '--module',
    'es2022',
    '--moduleResolution',
    'bundler',
    '--skipLibCheck',
  ],
  { cwd: packageRoot, encoding: 'utf8' },
);
// tsc emits despite the Cloudflare-global type errors it reports here (those
// globals exist at runtime, just not in this stripped-down invocation), so the
// emitted file is what decides success, not the exit code.
const workerEntry = join(workerOut, 'worker', 'index.js');
if (!existsSync(workerEntry)) {
  console.error(`Could not compile the Worker for testing:
${compile.stdout}${compile.stderr}`);
  process.exit(1);
}
// The emitted import is extensionless; Node's ESM loader requires the .js.
const emitted = readFileSync(workerEntry, 'utf8');
writeFileSync(
  workerEntry,
  emitted.replace("from '../src/lib/waitlist-contract'", "from '../src/lib/waitlist-contract.js'"),
);

console.log(`Running ${files.length} test files.`);
const result = spawnSync(process.execPath, ['--test', ...files], {
  cwd: packageRoot,
  stdio: 'inherit',
});
process.exit(result.status ?? 1);
