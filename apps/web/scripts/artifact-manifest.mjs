/**
 * Records exactly what a deploy would upload, and proves a later copy is the same.
 *
 * WHY. Every environment rebuilds from the same commit with the same command and
 * we call that equivalent. It is equivalent in practice and not in guarantee:
 * nothing proves the bytes CI checked are the bytes that reached production. A
 * dependency that resolves differently, a stale `out/`, a half-finished build,
 * or a hand-edited file between the check and the upload all pass unnoticed,
 * because nothing ever compares the two.
 *
 * WHAT A DEPLOY ACTUALLY UPLOADS. Two things, and the first version of this
 * script only covered one of them:
 *
 *   1. the static assets in `out/`          — [assets] directory in wrangler.toml
 *   2. the Worker bundle built from         — main = "worker/index.ts"
 *      TypeScript source AT DEPLOY TIME
 *
 * (2) is the code that sets every security header, mints the CSP nonce and
 * handles the waitlist. It is the most security-sensitive thing that ships, it
 * is not a file on disk until wrangler bundles it, and a manifest covering only
 * `out/` would have reported a confident pass while the entire Worker changed
 * underneath it. So the bundle is produced here, with wrangler's own bundler,
 * and hashed alongside the assets.
 *
 * WHY A SEPARATE CONFIG FOR THE BUNDLE. `wrangler deploy --dry-run` uploads
 * nothing, but the `[build]` hook cannot tell a dry run from a real deploy —
 * wrangler sets WRANGLER_COMMAND to "deploy" with no flags (measured). Rather
 * than add an environment variable that switches a security gate off, this
 * writes a copy of wrangler.toml with the `[build]` block removed and bundles
 * against that. Nothing that affects the bundle — `main`, compatibility flags,
 * rules — is altered, and the gate keeps exactly one meaning.
 *
 * WHAT THIS PROVES, AND WHAT IT DOES NOT. It proves two artifacts are
 * byte-identical and that one has not been altered since it was recorded. That
 * is CHECKSUM VERIFICATION, and it is strictly weaker than immutable artifact
 * promotion, which this is not:
 *
 *   · it is NOT a signature — it says nothing about WHO built it, and anyone who
 *     can rewrite the artifact can rewrite the manifest beside it;
 *   · the artifact is still REBUILT at each stage rather than built once and
 *     carried forward, so this detects divergence, it does not prevent it;
 *   · nothing stores the artifact outside the working tree, so there is no
 *     immutable copy to promote and no way to redeploy a past one byte-for-byte.
 *
 * True promotion needs a signing key and an artifact store, both of which live
 * outside this repository. The manifest is the part that can exist today, and it
 * is what makes the rest possible later.
 *
 *   node scripts/artifact-manifest.mjs write   > writes .artifact-manifest.json
 *   node scripts/artifact-manifest.mjs verify  > exits non-zero on any drift
 */

import { execFileSync } from 'node:child_process';
import { createHash } from 'node:crypto';
import { createRequire } from 'node:module';
import { readdir, readFile, rm, writeFile } from 'node:fs/promises';
import { dirname, join, posix, relative, sep } from 'node:path';
import { fileURLToPath } from 'node:url';

const WEB = fileURLToPath(new URL('..', import.meta.url));
const OUT_DIR = join(WEB, 'out');

/*
 * Deliberately NOT inside `out/`. `out/` is the [assets] directory, so every
 * file in it is uploaded and served: a manifest left there would publish a
 * complete inventory of the site's files and their hashes at a guessable URL.
 * Keeping it one level up also removes the need to exclude it from its own
 * hashing.
 */
const MANIFEST_PATH = join(WEB, '.artifact-manifest.json');

/** Where the Worker bundle is emitted, and the stripped config used to get it. */
const BUNDLE_DIR = join(WEB, '.worker-bundle');
const BUNDLE_CONFIG = join(WEB, '.wrangler-bundle.toml');

const sha256 = (buffer) => createHash('sha256').update(buffer).digest('hex');

/** Resolved from this package, so it is the wrangler the deploy would use. */
const require_ = createRequire(import.meta.url);
const WRANGLER_BIN = join(
  dirname(require_.resolve('wrangler/package.json')),
  require_('wrangler/package.json').bin.wrangler,
);

async function* walk(dir) {
  for (const entry of await readdir(dir, { withFileTypes: true })) {
    const full = join(dir, entry.name);
    if (entry.isDirectory()) yield* walk(full);
    else yield full;
  }
}

/**
 * Bundles the Worker exactly as a deploy would, and returns the bytes.
 *
 * The emitted `index.js` is what Cloudflare runs. `index.js.map` is not hashed
 * because `upload_source_maps` is unset, so it is never uploaded — hashing it
 * would make the manifest fail on a change that does not ship.
 */
async function hashWorkerBundle() {
  const toml = await readFile(join(WEB, 'wrangler.toml'), 'utf8');

  // Remove the `[build]` section only: from its header to the next section
  // header at the start of a line, or end of file.
  const stripped = toml.replace(/^\[build\][\s\S]*?(?=^\[|\Z)/m, '');
  if (stripped === toml) {
    throw new Error(
      'wrangler.toml has no [build] section. If the deploy gates moved, this ' +
        'script must be updated rather than silently bundling with them in place.',
    );
  }
  await writeFile(BUNDLE_CONFIG, stripped);

  try {
    await rm(BUNDLE_DIR, { recursive: true, force: true });
    /*
     * Wrangler's own JS entry point, run with this Node, rather than `npx`.
     * `npx` on Windows is `npx.cmd`, and Node refuses to spawn a .cmd without
     * a shell (the CVE-2024-27980 fix) — and reaching for `shell: true` to get
     * around that would put these paths through a command interpreter for no
     * reason. This spawns no shell at all, so the paths cannot be reinterpreted.
     */
    execFileSync(
      process.execPath,
      [WRANGLER_BIN, 'deploy', '--dry-run', '--outdir', BUNDLE_DIR, '-c', BUNDLE_CONFIG],
      { cwd: WEB, stdio: ['ignore', 'ignore', 'pipe'], encoding: 'utf8' },
    );
    return sha256(await readFile(join(BUNDLE_DIR, 'index.js')));
  } finally {
    await rm(BUNDLE_CONFIG, { force: true });
  }
}

/**
 * Everything a deploy uploads, keyed by path with forward slashes so a manifest
 * written on Windows verifies on Linux. Asset keys are prefixed `assets/` and
 * the Worker `worker/index.js`, so the two can never be confused for each other.
 */
async function hashArtifact() {
  const files = {};
  for await (const full of walk(OUT_DIR)) {
    const key = relative(OUT_DIR, full).split(sep).join(posix.sep);
    files[`assets/${key}`] = sha256(await readFile(full));
  }
  files['worker/index.js'] = await hashWorkerBundle();

  // One digest over "path:hash" lines, sorted, so the whole artifact has a
  // single comparable identity and file ORDER cannot change it.
  const digest = sha256(
    Object.keys(files)
      .sort()
      .map((k) => `${k}:${files[k]}`)
      .join('\n'),
  );
  return { files, digest };
}

const command = process.argv[2];

if (command === 'write') {
  const { files, digest } = await hashArtifact();
  const manifest = {
    version: 2,
    digest,
    fileCount: Object.keys(files).length,
    // The commit is recorded for traceability only. It is NOT what identifies
    // the artifact — two builds of one commit can differ, which is the entire
    // reason this file exists.
    commit: process.env.GITHUB_SHA ?? null,
    builtAt: new Date().toISOString(),
    files,
  };
  await writeFile(MANIFEST_PATH, `${JSON.stringify(manifest, null, 2)}\n`);
  console.log(
    `artifact-manifest: wrote ${manifest.fileCount} hashes ` +
      `(${Object.keys(files).length - 1} assets + the Worker bundle), ` +
      `digest ${digest.slice(0, 16)}…`,
  );
  process.exit(0);
}

if (command === 'verify') {
  let recorded;
  try {
    recorded = JSON.parse(await readFile(MANIFEST_PATH, 'utf8'));
  } catch {
    console.error(
      `artifact-manifest: no .artifact-manifest.json beside wrangler.toml. Run "write" ` +
        `at build time, or this verify proves nothing and must not be treated as a pass.`,
    );
    process.exit(1);
  }

  if (recorded.version !== 2) {
    // A v1 manifest covered `out/` only. Accepting one here would report a pass
    // over an artifact whose Worker was never hashed.
    console.error(
      `artifact-manifest: manifest is version ${recorded.version}, which did not cover the ` +
        `Worker bundle. Rebuild so the Worker is recorded too — refusing.`,
    );
    process.exit(1);
  }

  const { files, digest } = await hashArtifact();
  const problems = [];

  for (const [path, hash] of Object.entries(recorded.files)) {
    if (!(path in files)) problems.push(`missing: ${path}`);
    else if (files[path] !== hash) problems.push(`changed: ${path}`);
  }
  for (const path of Object.keys(files)) {
    if (!(path in recorded.files)) problems.push(`added: ${path}`);
  }

  if (problems.length > 0) {
    const shown = problems.slice(0, 10);
    console.error(
      `artifact-manifest: this is NOT the artifact that was recorded ` +
        `(${problems.length} difference(s)):\n  · ${shown.join('\n  · ')}` +
        (problems.length > shown.length ? `\n  · …and ${problems.length - shown.length} more` : ''),
    );
    process.exit(1);
  }

  if (digest !== recorded.digest) {
    // Belt and braces: per-file comparison agreed, so disagreement here would
    // mean the digest and the file list were produced differently.
    console.error(
      `artifact-manifest: every file matches but the digest does not ` +
        `(${digest.slice(0, 16)}… vs ${recorded.digest.slice(0, 16)}…) — refusing.`,
    );
    process.exit(1);
  }

  console.log(
    `artifact-manifest: verified ${recorded.fileCount} hashes including the Worker bundle, ` +
      `digest ${digest.slice(0, 16)}… ` +
      `(recorded ${recorded.builtAt}${recorded.commit ? `, commit ${recorded.commit.slice(0, 8)}` : ''})`,
  );
  process.exit(0);
}

console.error('usage: node scripts/artifact-manifest.mjs <write|verify>');
process.exit(2);
