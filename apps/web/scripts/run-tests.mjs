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
import { readdirSync } from 'node:fs';
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

console.log(`Running ${files.length} test files.`);
const result = spawnSync(process.execPath, ['--test', ...files], {
  cwd: packageRoot,
  stdio: 'inherit',
});
process.exit(result.status ?? 1);
