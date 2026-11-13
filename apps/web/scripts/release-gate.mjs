#!/usr/bin/env node
/*
 * Production release gate.
 *
 * Runs as `prebuild`, so it runs on EVERY `next build` — including the one
 * Vercel runs — and blocks only the builds that would actually go live.
 *
 * ──── WHY IT IS SCOPED RATHER THAN ALWAYS-ON ───────────────────────────────
 *
 * The legal pages ship with `[PLACEHOLDERS]` for the six facts only the owner
 * has. Those must never reach the public site. But a check that fails every
 * build would also fail ordinary PR CI and the local `pnpm build`, and a gate
 * that is always red is a gate everyone learns to click past — which is the
 * failure mode this is supposed to prevent.
 *
 * So it blocks when, and only when, the build is a production release:
 *
 *     VERCEL_ENV=production     Vercel sets this for production deployments
 *                               only; preview deployments get "preview"
 *     RELEASE_GATE=1            manual override, for running the gate locally
 *
 * Everything else — PR CI, preview deploys, `pnpm build` on a laptop — passes
 * with a one-line notice listing what is still outstanding. The information is
 * never hidden; only the failure is scoped.
 *
 * Exit 1 fails `prebuild`, which fails `next build`, which fails the Vercel
 * deployment before anything is served.
 */
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

const WEB = join(dirname(fileURLToPath(import.meta.url)), '..');
const FILES = ['src/app/legal/legal.tsx', 'src/app/privacy/page.tsx', 'src/app/terms/page.tsx'];

const isProductionRelease =
  process.env.VERCEL_ENV === 'production' || process.env.RELEASE_GATE === '1';

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
  console.log('release-gate: legal pages are complete.');
  process.exit(0);
}

if (!isProductionRelease) {
  console.log(
    `release-gate: ${missing.length} legal placeholder(s) outstanding — not blocking ` +
      `(this is not a production release). Run with RELEASE_GATE=1 to enforce.`,
  );
  for (const item of missing) console.log(`  · ${item}`);
  process.exit(0);
}

console.error('');
console.error('  RELEASE BLOCKED — the legal pages are not finished.');
console.error('');
console.error('  These are facts only the owner has, and the site collects email');
console.error('  addresses, so a privacy notice naming no controller cannot go live:');
console.error('');
for (const item of missing) console.error(`    · ${item}`);
console.error('');
console.error('  Fill them in at apps/web/src/app/legal/legal.tsx, then re-deploy.');
console.error('  To check before deploying:  RELEASE_GATE=1 pnpm --filter @nexus/web build');
console.error('');
process.exit(1);
