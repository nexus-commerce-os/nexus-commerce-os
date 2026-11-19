#!/usr/bin/env node
/*
 * Production release gate — Cloudflare edition.
 *
 * ──── WHY THIS FILE EXISTS ON THIS BRANCH ──────────────────────────────────
 *
 * A gate with the same name already lived on `main`. It did not protect
 * anything, because of a split nobody had noticed:
 *
 *     main / ci-integration-launch   gate present, NO wrangler.toml
 *     release/product-catalog        wrangler.toml + deploy:cf, NO gate
 *
 * The branch that can reach honesttotal.com had no gate, and the branch with
 * the gate could not deploy to Cloudflare at all. So the protection was real
 * on paper and absent in practice: `pnpm deploy:cf` would happily publish
 * legal pages full of `[PLACEHOLDERS]` to the live site.
 *
 * This copy lives on the branch that actually ships, and `deploy:cf` calls it
 * with `--enforce` before anything is built. That is the whole point.
 *
 * ──── HOW IT DECIDES TO BLOCK ──────────────────────────────────────────────
 *
 * A check that fails every build is a check people learn to skip, so it blocks
 * only on a real release:
 *
 *     --enforce            the Cloudflare deploy path (deploy:cf)
 *     RELEASE_GATE=1       manual, for checking locally
 *     VERCEL_ENV=production  if this branch is ever built on Vercel
 *
 * Everything else — ordinary `pnpm build`, CI, a laptop — passes with a notice
 * that lists what is still outstanding. The information is never hidden; only
 * the failure is scoped.
 *
 * The flag is used rather than an env var because `RELEASE_GATE=1 next build`
 * is not valid on Windows `cmd`, which is where this repo is built, and a
 * guard that silently does not run on the maintainer's own machine is worse
 * than no guard at all.
 */
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

const WEB = join(dirname(fileURLToPath(import.meta.url)), '..');

/*
 * Every page that makes a legal or privacy representation. `cookies` and
 * `disclosure` are included because an affiliate disclosure with a blank in it
 * is exactly as misleading as a privacy notice with one.
 */
const FILES = [
  'src/app/privacy/page.tsx',
  'src/app/terms/page.tsx',
  'src/app/cookies/page.tsx',
  'src/app/disclosure/page.tsx',
];

const isRelease =
  process.argv.includes('--enforce') ||
  process.env.RELEASE_GATE === '1' ||
  process.env.VERCEL_ENV === 'production';

/** Bracketed upper-case tokens still awaiting a real value. */
function outstanding() {
  const found = new Set();
  for (const rel of FILES) {
    let source;
    try {
      source = readFileSync(join(WEB, rel), 'utf8');
    } catch {
      // A missing legal page is itself a release blocker.
      found.add(`${rel}: FILE MISSING`);
      continue;
    }
    for (const match of source.matchAll(/\[([A-Z][A-Z /]+[A-Z])\]/g)) {
      found.add(`${rel} → ${match[0]}`);
    }
  }
  return [...found];
}

const missing = outstanding();

if (missing.length === 0) {
  console.log(`release-gate: ${FILES.length} legal pages checked, no placeholders.`);
  process.exit(0);
}

if (!isRelease) {
  console.log(
    `release-gate: ${missing.length} legal placeholder(s) outstanding — not blocking ` +
      `(this is not a release). Run with --enforce to enforce.`,
  );
  for (const item of missing) console.log(`  · ${item}`);
  process.exit(0);
}

console.error('');
console.error('  RELEASE BLOCKED — the legal pages are not finished.');
console.error('');
console.error('  These are facts only the owner has, and the site collects email');
console.error('  addresses, so a page naming no controller cannot go live:');
console.error('');
for (const item of missing) console.error(`    · ${item}`);
console.error('');
console.error('  Fill them in, then deploy again.');
console.error('  To check at any time:  pnpm --filter @nexus/web release-gate');
console.error('');
process.exit(1);
