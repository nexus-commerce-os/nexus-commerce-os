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
import { cpSync, existsSync, readFileSync, readdirSync, writeFileSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { pathToFileURL } from 'node:url';
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
    // auth.ts is not imported by index.ts yet — the admin surface is tested
    // before it is routed — so it must be named explicitly or it never
    // compiles and its suite silently has nothing to import.
    'worker/auth.ts',
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
/*
 * WHERE tsc ACTUALLY PUT IT.
 *
 * With no `--rootDir`, tsc derives the output root from the common directory
 * of every input — and `worker/catalog.ts` imports the compiled catalogue by
 * relative path, which lives outside this package. That silently moved the
 * emit from `.worker-test/worker/` to `.worker-test/apps/web/worker/`, and
 * the suites then failed with ERR_MODULE_NOT_FOUND against a path that had
 * been correct for every earlier run.
 *
 * `--rootDir .` is not the fix: it makes tsc refuse the outside input
 * entirely. So the layout is DISCOVERED rather than assumed, and the
 * discovered directory is flattened back to `.worker-test/worker` so the
 * test files' imports stay stable.
 */
function locateWorkerEmit(root) {
  const direct = join(root, 'worker', 'index.js');
  if (existsSync(direct)) return join(root, 'worker');

  // Breadth-first, because the nesting depth depends on how far outside the
  // package the furthest input happens to live.
  const queue = [root];
  while (queue.length > 0) {
    const dir = queue.shift();
    let entries;
    try {
      entries = readdirSync(dir, { withFileTypes: true });
    } catch {
      continue;
    }
    for (const entry of entries) {
      if (!entry.isDirectory()) continue;
      const child = join(dir, entry.name);
      if (entry.name === 'worker' && existsSync(join(child, 'index.js'))) return child;
      queue.push(child);
    }
  }
  return null;
}

const emittedWorkerDir = locateWorkerEmit(workerOut);
if (emittedWorkerDir !== null && emittedWorkerDir !== join(workerOut, 'worker')) {
  cpSync(emittedWorkerDir, join(workerOut, 'worker'), { recursive: true });
}

const workerEntry = join(workerOut, 'worker', 'index.js');
const authEntry = join(workerOut, 'worker', 'auth.js');
if (!existsSync(authEntry)) {
  console.error(`Could not compile the Worker auth module for testing:
${compile.stdout}${compile.stderr}`);
  process.exit(1);
}
if (!existsSync(workerEntry)) {
  console.error(`Could not compile the Worker for testing:
${compile.stdout}${compile.stderr}`);
  process.exit(1);
}
/*
 * Mark the output as ESM explicitly.
 *
 * `apps/web/package.json` has no `"type": "module"`, so a `.js` file under it
 * is CommonJS — and the emitted Worker is ESM. Node 22 and newer sniff the
 * syntax and get away with it; Node 20, which CI stage 3 runs, does not, and
 * fails with "Cannot use import statement outside a module". Writing the
 * marker makes the answer the same on every version instead of depending on
 * which Node happens to be installed.
 */
writeFileSync(join(workerOut, 'package.json'), JSON.stringify({ type: 'module' }));

/*
 * The emitted imports are extensionless; Node's ESM loader requires the `.js`.
 *
 * This used to rewrite ONE named import. That held until `worker/index.ts`
 * gained a second relative import — `./catalog` — and the suites failed with
 * ERR_MODULE_NOT_FOUND on a file that had compiled perfectly well. A list of
 * imports to patch is a list that goes stale the next time somebody adds one,
 * so every relative specifier without an extension is rewritten instead.
 */
const addJsExtension = (code) =>
  code.replace(/from '(\.[^']*)'/g, (whole, specifier) =>
    /\.[a-z]+$/i.test(specifier) ? whole : `from '${specifier}.js'`,
  );

/*
 * The catalogue import is made ABSOLUTE.
 *
 * `worker/catalog.ts` reaches the compiled catalogue with
 * `../../../services/catalog/dist/...`, which is correct from
 * `apps/web/worker/`. The emitted copy sits one level deeper, at
 * `apps/web/.worker-test/worker/`, so the same three `..` land in `apps/` and
 * the loader looked for `apps/services/catalog`.
 *
 * Rewriting the depth would be one more thing to get wrong the next time the
 * output layout moves. A file URL to the real directory cannot drift.
 */
// The trailing slash matters and pathToFileURL drops it: without it the
// rewrite produced `distpublic/read.js`.
const catalogDist = `${pathToFileURL(resolve(packageRoot, '../../services/catalog/dist')).href}/`;

for (const file of [workerEntry, authEntry, join(workerOut, 'worker', 'catalog.js')]) {
  if (!existsSync(file)) continue;
  const code = addJsExtension(readFileSync(file, 'utf8')).replace(
    /'(?:\.\.\/)+services\/catalog\/dist\//g,
    `'${catalogDist}`,
  );
  writeFileSync(file, code);
}

console.log(`Running ${files.length} test files.`);
const result = spawnSync(process.execPath, ['--test', ...files], {
  cwd: packageRoot,
  stdio: 'inherit',
});
process.exit(result.status ?? 1);
