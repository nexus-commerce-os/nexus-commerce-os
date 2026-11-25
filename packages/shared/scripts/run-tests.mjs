/**
 * Runs the compiled test suites, explicitly.
 *
 * WHY THIS EXISTS, rather than `node --test "dist/*.test.js"`:
 *
 *   - Glob expansion inside `node --test` only arrived in Node 22. On Node 20,
 *     which is what CI stage 3 runs, the quoted pattern is passed through
 *     literally and the runner exits 1 with "Could not find dist/*.test.js".
 *   - Unquoting it instead makes the shell expand it, which works in bash and
 *     silently does not on Windows.
 *   - Passing the directory (`node --test dist`) is worse than either: Node 24
 *     accepts it and reports ONE passing test named "dist" without running a
 *     single real suite. A green run that tested nothing is the most expensive
 *     kind of false negative, and it is invisible unless somebody reads the
 *     count.
 *
 * So the file list is built here, from the filesystem, and the run FAILS if the
 * list is empty or shrinks below what the sources imply. A test runner that
 * can quietly run zero tests is not a test runner.
 */

import { spawnSync } from 'node:child_process';
import { readdirSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const packageRoot = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const distDir = join(packageRoot, 'dist');
const srcDir = join(packageRoot, 'src');

const suffix = '.test.js';
const compiled = readdirSync(distDir)
  .filter((name) => name.endsWith(suffix))
  .sort()
  .map((name) => join('dist', name));

// Every `*.test.ts` source must have produced a compiled suite. This catches a
// test file that was added but not built, and a build that half-succeeded —
// both of which otherwise look like a smaller, still-green run.
const expected = readdirSync(srcDir)
  .filter((name) => name.endsWith('.test.ts'))
  .map((name) => name.replace(/\.ts$/, '.js'))
  .sort();

if (expected.length === 0) {
  console.error('No *.test.ts sources found. Refusing to report success on an empty suite.');
  process.exit(1);
}

const missing = expected.filter((name) => !compiled.includes(join('dist', name)));
if (missing.length > 0) {
  console.error(
    `These test sources did not produce a compiled suite: ${missing.join(', ')}.\n` +
      'Run the build and try again; a partial suite must not pass.',
  );
  process.exit(1);
}

console.log(`Running ${compiled.length} compiled test suites.`);
const result = spawnSync(process.execPath, ['--test', ...compiled], {
  cwd: packageRoot,
  stdio: 'inherit',
});

process.exit(result.status ?? 1);
