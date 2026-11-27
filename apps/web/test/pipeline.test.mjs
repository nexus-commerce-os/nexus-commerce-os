/*
 * The deploy must not be able to skip the checks that make the artifact safe.
 *
 * WHY THIS FILE EXISTS. `gate-catalog.mjs` was added to the `build` script and
 * the catalog shipped anyway, because `deploy:cf` ran `next build` directly and
 * never called `build`. The same was true, and had always been true, of
 * `verify-headers`, `verify-footer`, `verify-merchants` and `verify-catalog`:
 * the deploy path was the least checked path, and Vercel's preview builds were
 * quietly covering for it until they were switched off.
 *
 * A guard wired into a script the deploy does not call is not a guard. These
 * tests assert the wiring itself, so the next person to "simplify" the deploy
 * command finds out here rather than in production.
 */
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { join } from 'node:path';
import { test } from 'node:test';

const WEB = join(dirname(), '..');
function dirname() {
  return fileURLToPath(new URL('.', import.meta.url));
}
const read = (rel) => readFileSync(join(WEB, rel), 'utf8');
const pkg = JSON.parse(read('package.json'));
const REPO = join(WEB, '..', '..');
const workflow = (name) => readFileSync(join(REPO, '.github', 'workflows', name), 'utf8');

/** Every check that must run before anything is uploaded. */
const MANDATORY = [
  'scripts/gate-catalog.mjs',
  'scripts/verify-headers.mjs',
  'scripts/verify-footer.mjs',
  'scripts/verify-merchants.mjs',
  'scripts/verify-catalog.mjs',
];

test('the build runs every mandatory artifact check, after next build', () => {
  const build = pkg.scripts.build;
  const buildIdx = build.indexOf('next build');
  assert.ok(buildIdx >= 0, '`build` must actually build');

  for (const script of MANDATORY) {
    const at = build.indexOf(script);
    assert.ok(at >= 0, `\`build\` does not run ${script}`);
    assert.ok(
      at > buildIdx,
      `${script} runs before \`next build\` — it inspects out/, so it would check nothing`,
    );
  }
});

test('the deploy runs the build, not a bare next build', () => {
  const deploy = pkg.scripts['deploy:cf'];
  assert.ok(deploy, 'deploy:cf is missing');

  assert.ok(
    /pnpm run build/.test(deploy),
    'deploy:cf must run `pnpm run build`. Calling `next build` directly skips ' +
      MANDATORY.join(', ') +
      ' — which is exactly how the unpublished catalog reached production.',
  );

  // Belt and braces: even if the wording above changes, no check may be absent
  // from the deploy's transitive command.
  const effective = deploy.replace('pnpm run build', pkg.scripts.build);
  for (const script of MANDATORY) {
    assert.ok(effective.includes(script), `the deploy path does not reach ${script}`);
  }
});

test('the deploy enforces the release gate before it builds anything', () => {
  const deploy = pkg.scripts['deploy:cf'];
  assert.match(
    deploy,
    /release-gate\.mjs --enforce/,
    'deploy:cf must run the release gate in enforcing mode',
  );
  assert.ok(
    deploy.indexOf('release-gate.mjs --enforce') < deploy.indexOf('build'),
    'the gate must run before the build, so a blocked release costs nothing',
  );
});

test('a bare wrangler deploy still runs both gates', () => {
  // The [build] command in wrangler.toml is the only thing standing between
  // `npx wrangler deploy` and production. It runs two checks now: the legal
  // release gate, and the provenance gate added after production was deployed
  // from an uncommitted working tree ahead of its own CI run.
  const toml = read('wrangler.toml');
  const command = toml.match(/\[build\][\s\S]*?command\s*=\s*"([^"]+)"/)?.[1];
  assert.ok(command, 'wrangler.toml must keep the [build] hook');
  assert.match(command, /scripts\/release-gate\.mjs/, 'the release gate must still run');
  assert.match(
    command,
    /scripts\/verify-deploy-provenance\.mjs/,
    'the provenance gate must run, or an uncommitted tree can reach production again',
  );
});

test('the deploy script also checks provenance before building', () => {
  // Belt and braces: the [build] hook covers `npx wrangler deploy`, this
  // covers `pnpm run deploy:cf`. Losing either one reopens a path.
  const pkg = JSON.parse(read('package.json'));
  assert.match(pkg.scripts['deploy:cf'], /scripts\/verify-deploy-provenance\.mjs/);
});

test('CI and staging build the site the same way the deploy does', () => {
  // One canonical pipeline: if these drift, something is verified that is not
  // what ships, which is worse than not verifying at all.
  const ci = workflow('ci.yml');
  assert.match(
    ci,
    /pnpm --filter @nexus\/web build/,
    'ci.yml must build the web app with the same command',
  );
  const staging = workflow('staging-verify.yml');
  assert.match(
    staging,
    /pnpm --filter @nexus\/web build/,
    'staging-verify.yml must build the web app with the same command',
  );
});

test('the catalog is withheld unless PUBLISH_CATALOG is explicitly set', () => {
  const gate = read('scripts/gate-catalog.mjs');
  assert.match(
    gate,
    /process\.env\.PUBLISH_CATALOG === '1'/,
    'publishing must require an exact opt-in, not any truthy value',
  );
  assert.ok(
    gate.includes('products.html') && gate.includes('products'),
    'the gate must target the catalog index and its product pages',
  );
});

test('BUT A DEPLOY CANNOT WITHDRAW THE LIVE CATALOGUE BY ACCIDENT', () => {
  /*
   * The two halves of this fit together badly on their own: the build drops
   * the catalogue unless PUBLISH_CATALOG=1, and `deploy:cf` does not set it.
   * So the default path produced an artifact with no /products — while
   * honesttotal.com serves /products with two published records and indexed
   * detail pages. Deleting an indexed page is a decision; it should not be a
   * side effect of an unset variable.
   */
  const gate = read('scripts/verify-deploy-provenance.mjs');
  assert.match(gate, /out\/products\.html/, 'the deploy gate must look for the catalog index');
  assert.match(
    gate,
    /ALLOW_CATALOG_WITHDRAWAL !== '1'/,
    'withdrawing the catalog must require an exact opt-in',
  );
});

test('the manifest covers the Worker bundle, not only the static assets', () => {
  // WHY THIS IS ITS OWN TEST. The first manifest hashed `out/` and nothing
  // else. But a deploy uploads two things: the assets in `out/`, and a Worker
  // bundled from `worker/index.ts` AT DEPLOY TIME — the code that sets every
  // security header, mints the CSP nonce and handles the waitlist. It is not a
  // file on disk until wrangler bundles it, so hashing `out/` reported a
  // confident pass while the most security-sensitive thing that ships was
  // unchecked. Proven by weakening the nonce from 16 bytes to 4 and watching
  // the manifest call it `changed: worker/index.js`.
  const manifest = read('scripts/artifact-manifest.mjs');
  assert.match(
    manifest,
    /hashWorkerBundle/,
    'the manifest must bundle and hash the Worker, or the Worker ships unverified',
  );
  assert.match(
    manifest,
    /files\['worker\/index\.js'\] = await hashWorkerBundle\(\)/,
    'the Worker hash must be part of the hashed set, not merely computed',
  );
  // The bundle must come from wrangler itself. A second bundler would hash
  // something other than what Cloudflare runs.
  assert.match(manifest, /WRANGLER_BIN/, "the bundle must be wrangler's own output");

  // The version guard: a v1 manifest did not cover the Worker, so accepting one
  // would report a pass over an artifact whose Worker was never hashed.
  assert.match(manifest, /recorded\.version !== 2/, 'a pre-Worker manifest must be refused');
});

test('the manifest is not written into the directory that gets published', () => {
  // `out/` is the [assets] directory, so every file in it is uploaded AND
  // SERVED. A manifest left there publishes a complete inventory of the site's
  // files and their hashes at a guessable URL.
  const manifest = read('scripts/artifact-manifest.mjs');
  const path = manifest.match(/const MANIFEST_PATH = join\(([^)]*)\)/)?.[1];
  assert.ok(path, 'the manifest path must be explicit');
  assert.ok(
    !/OUT_DIR/.test(path),
    `the manifest must not live inside out/ — it would be served publicly (got: ${path})`,
  );
});

test('the build records what it produced, and the deploy checks it', () => {
  // Build once, verify, deploy that exact set — the promotion step that was
  // missing. Without the write there is nothing to compare against; without
  // the verify nothing compares it, and the deploy is back to trusting that
  // two builds of one commit produce the same bytes.
  const pkg = JSON.parse(read('package.json'));
  assert.match(
    pkg.scripts.build,
    /artifact-manifest\.mjs write/,
    'the build must record a manifest of what it produced',
  );
  assert.match(
    pkg.scripts['deploy:cf'],
    /artifact-manifest\.mjs verify/,
    'the deploy must verify the artifact it is about to upload',
  );
  // Order matters: verifying before the build would check the previous one.
  const deploy = pkg.scripts['deploy:cf'];
  assert.ok(
    deploy.indexOf('pnpm run build') < deploy.indexOf('artifact-manifest.mjs verify'),
    'the verify must come after the build, or it checks a stale artifact',
  );
});
