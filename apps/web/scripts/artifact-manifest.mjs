/**
 * Records exactly what a build produced, and proves a later copy is the same.
 *
 * WHY. Today every environment rebuilds from the same commit with the same
 * command and we call that equivalent. It is equivalent in practice and not
 * in guarantee: nothing proves the bytes CI checked are the bytes that
 * reached production. A dependency that resolves differently, a stale `out/`,
 * a half-finished build, or a hand-edited file between the check and the
 * upload all pass unnoticed, because nothing ever compares the two.
 *
 * This is the missing half of that: `write` records a content hash for every
 * file in the artifact plus one digest over the whole set, and `verify`
 * re-derives it and refuses on any difference, naming the files.
 *
 * WHAT IT DOES AND DOES NOT PROVE. It proves two artifacts are byte-identical
 * and that one has not been altered since it was recorded. It is NOT a
 * signature: it says nothing about who built it, and anyone who can rewrite
 * the artifact can rewrite the manifest beside it. Signing needs a key that
 * lives outside this repository, which is a credential decision; the manifest
 * is the part that can exist today, and it is what makes promotion — build
 * once, verify, deploy that exact set — possible at all.
 *
 *   node scripts/artifact-manifest.mjs write   > writes out/.artifact-manifest.json
 *   node scripts/artifact-manifest.mjs verify  > exits non-zero on any drift
 */

import { createHash } from 'node:crypto';
import { readdir, readFile, writeFile } from 'node:fs/promises';
import { join, posix, relative, sep } from 'node:path';
import { fileURLToPath } from 'node:url';

const OUT_DIR = fileURLToPath(new URL('../out', import.meta.url));
const MANIFEST_NAME = '.artifact-manifest.json';
const MANIFEST_PATH = join(OUT_DIR, MANIFEST_NAME);

const sha256 = (buffer) => createHash('sha256').update(buffer).digest('hex');

async function* walk(dir) {
  for (const entry of await readdir(dir, { withFileTypes: true })) {
    const full = join(dir, entry.name);
    if (entry.isDirectory()) yield* walk(full);
    else yield full;
  }
}

/**
 * Every file in the artifact except the manifest itself, keyed by its path
 * with forward slashes so a manifest written on Windows verifies on Linux.
 */
async function hashArtifact() {
  const files = {};
  for await (const full of walk(OUT_DIR)) {
    const key = relative(OUT_DIR, full).split(sep).join(posix.sep);
    if (key === MANIFEST_NAME) continue;
    files[key] = sha256(await readFile(full));
  }

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
    version: 1,
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
    `artifact-manifest: wrote ${manifest.fileCount} file hashes, digest ${digest.slice(0, 16)}…`,
  );
  process.exit(0);
}

if (command === 'verify') {
  let recorded;
  try {
    recorded = JSON.parse(await readFile(MANIFEST_PATH, 'utf8'));
  } catch {
    console.error(
      `artifact-manifest: no ${MANIFEST_NAME} in out/. Run "write" at build time, ` +
        `or this verify proves nothing and must not be treated as a pass.`,
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
    `artifact-manifest: verified ${recorded.fileCount} files, digest ${digest.slice(0, 16)}… ` +
      `(recorded ${recorded.builtAt}${recorded.commit ? `, commit ${recorded.commit.slice(0, 8)}` : ''})`,
  );
  process.exit(0);
}

console.error('usage: node scripts/artifact-manifest.mjs <write|verify>');
process.exit(2);
