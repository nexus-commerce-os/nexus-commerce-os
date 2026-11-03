// Guardrails for the non-public /preview/soundcore route.
//
// WHY THIS EXISTS. The preview renders real merchant records. Three properties
// keep that safe — it is not indexed, it is not in the sitemap, and the feed
// behind it never enters the repository — and all three are the kind of thing
// that survives for exactly as long as somebody remembers them. Here they fail
// the build instead.
//
// WHAT IT CAN AND CANNOT CHECK. The feed loader is exercised for real: Node 24
// strips TypeScript natively, so this imports the module and calls it. The page
// itself resolves `@/` aliases that plain Node does not understand, so it is
// checked by reading its source. That split is stated rather than hidden —
// a text scan is weaker evidence than a behavioural test and should be labelled
// as such.
//
// The same reasoning, and the same no-new-dependency choice, as
// scripts/verify-merchants.mjs.

import assert from 'node:assert/strict';
import { readdir, readFile, stat } from 'node:fs/promises';
import { join, relative, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

import { FEED_ENV_VAR, loadSoundcoreFeed } from '../src/lib/soundcore-preview-feed.ts';

const here = fileURLToPath(new URL('.', import.meta.url));
const webRoot = resolve(here, '..');
const repoRoot = resolve(webRoot, '..', '..');

const results = [];
const failures = [];

function check(name, fn) {
  return Promise.resolve()
    .then(fn)
    .then(() => results.push(`  ok   ${name}`))
    .catch((err) => failures.push(`  FAIL ${name}\n       ${String(err.message).split('\n')[0]}`));
}

const PREVIEW_PAGE = join(webRoot, 'src/app/preview/soundcore/page.tsx');

await check('the preview page is noindex, nofollow', async () => {
  const src = await readFile(PREVIEW_PAGE, 'utf8');
  assert.match(src, /robots:\s*\{[^}]*index:\s*false/s, 'robots.index must be false');
  assert.match(src, /robots:\s*\{[^}]*follow:\s*false/s, 'robots.follow must be false');
});

await check('the preview route is absent from the sitemap', async () => {
  const src = await readFile(join(webRoot, 'src/app/sitemap.ts'), 'utf8');
  assert.equal(/\/preview/.test(src), false, 'sitemap.ts must not list a preview route');
});

await check('the preview page renders no outbound merchant link', async () => {
  const src = await readFile(PREVIEW_PAGE, 'utf8');
  // The card has no href prop at all, so a link could only appear as raw markup.
  assert.equal(/<a[\s>]/.test(src), false, 'no anchor may be rendered on the preview page');
  assert.equal(
    /anrdoezrs|dpbolvw|jdoqocy|kqzyfj|tkqlhce|soundcore\.com|anker\.com/i.test(src),
    false,
    'no merchant or affiliate host may be referenced',
  );
});

await check('the feed loader refuses a path inside the repository', () => {
  const previous = process.env[FEED_ENV_VAR];
  // A real file inside the tree: if the guard were missing this would load.
  process.env[FEED_ENV_VAR] = join(webRoot, 'package.json');
  try {
    const load = loadSoundcoreFeed();
    assert.equal(load.ok, false, 'an in-repo path must be refused');
    assert.match(load.reason, /inside the repository/i);
  } finally {
    if (previous === undefined) delete process.env[FEED_ENV_VAR];
    else process.env[FEED_ENV_VAR] = previous;
  }
});

await check('the feed loader fails safely when nothing is configured', () => {
  const previous = process.env[FEED_ENV_VAR];
  delete process.env[FEED_ENV_VAR];
  try {
    const load = loadSoundcoreFeed();
    assert.equal(load.ok, false);
    assert.match(load.reason, new RegExp(FEED_ENV_VAR));
  } finally {
    if (previous !== undefined) process.env[FEED_ENV_VAR] = previous;
  }
});

await check('no merchant feed is committed anywhere in the repository', async () => {
  const suspicious = /\.(zip|tsv)$|shopping.*\.txt$|product[-_]?feed/i;
  const skip = new Set(['node_modules', '.git', '.next', 'out', 'dist', '.turbo', 'coverage']);
  const found = [];

  async function walk(dir) {
    for (const entry of await readdir(dir, { withFileTypes: true })) {
      if (skip.has(entry.name)) continue;
      const full = join(dir, entry.name);
      if (entry.isDirectory()) {
        await walk(full);
      } else if (suspicious.test(entry.name)) {
        found.push(relative(repoRoot, full));
      }
    }
  }
  await walk(repoRoot);
  assert.deepEqual(found, [], `feed-shaped files in the tree: ${found.join(', ')}`);
});

await check('the exported preview, if present, holds no affiliate link', async () => {
  const exported = join(webRoot, 'out/preview/soundcore.html');
  try {
    await stat(exported);
  } catch {
    // Not built in this run; nothing to assert.
    return;
  }
  const html = await readFile(exported, 'utf8');
  assert.equal(
    /href="https?:\/\/[^"]*(anrdoezrs|dpbolvw|jdoqocy|kqzyfj|tkqlhce|soundcore\.com|anker\.com)/i.test(
      html,
    ),
    false,
    'the exported preview links to a merchant or affiliate host',
  );
  assert.match(html, /<meta name="robots" content="[^"]*noindex/);
});

console.log('verify-preview:');
for (const line of [...results, ...failures]) console.log(line);

if (failures.length > 0) {
  console.error(`\nverify-preview: FAILED — ${failures.length} of ${results.length + failures.length} checks`);
  process.exit(1);
}
console.log(`verify-preview: OK — ${results.length} checks passed, preview stays non-public`);
