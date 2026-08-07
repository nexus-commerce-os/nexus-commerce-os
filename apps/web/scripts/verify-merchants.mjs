// Guardrails for the merchant/affiliate-link layer.
//
// WHY node:assert AND NOT VITEST. apps/web has no test runner, and adding one
// solely for this module would be a new dependency for a six-assertion check.
// Node 24 strips TypeScript types natively, so this file imports the real
// module and exercises the real function — these are behavioural tests, not a
// text scan of the source. The pattern matches scripts/verify-footer.mjs, which
// already guards the footer the same way.
//
// WHAT THIS PROTECTS. The rule that a pending relationship can never produce an
// affiliate link is worth exactly as much as the thing that enforces it. Left to
// code review, "just ship the link, approval is coming" is a one-line change
// nobody would flag. Here it fails the build.

import assert from 'node:assert/strict';
import { readdir, readFile } from 'node:fs/promises';
import { join, relative } from 'node:path';
import { fileURLToPath } from 'node:url';

import {
  MERCHANTS,
  getMerchant,
  mayClaimAffiliateRelationship,
  resolveOutboundLink,
} from '../src/lib/merchants.ts';

const results = [];
const fail = [];

function check(name, fn) {
  try {
    fn();
    results.push(`  ok   ${name}`);
  } catch (err) {
    fail.push(`  FAIL ${name}\n       ${err.message.split('\n')[0]}`);
  }
}

// 1 — a pending relationship can never yield an affiliate URL.
check('pending merchant cannot return an affiliate URL', () => {
  const link = resolveOutboundLink({
    id: 't',
    name: 'T',
    network: 'cj',
    relationship: 'pending',
    destinationUrl: 'https://example.com/',
    // even if a URL were present, pending must ignore it
    affiliateUrl: 'https://www.dpbolvw.net/click-000-000',
  });
  assert.equal(link.href, 'https://example.com/');
  assert.equal(link.isAffiliate, false);
  assert.equal(link.rel, undefined);
});

// 2 — approved but with no issued URL still falls back.
check('approved merchant without affiliateUrl cannot return an affiliate URL', () => {
  const link = resolveOutboundLink({
    id: 't',
    name: 'T',
    network: 'cj',
    relationship: 'approved',
    destinationUrl: 'https://example.com/',
    affiliateUrl: null,
  });
  assert.equal(link.href, 'https://example.com/');
  assert.equal(link.isAffiliate, false);
});

// 3 — the only combination that may use an affiliate URL.
check('approved merchant with affiliateUrl may return the affiliate URL', () => {
  const link = resolveOutboundLink({
    id: 't',
    name: 'T',
    network: 'cj',
    relationship: 'approved',
    destinationUrl: 'https://example.com/',
    affiliateUrl: 'https://network.example/track/abc',
  });
  assert.equal(link.href, 'https://network.example/track/abc');
  assert.equal(link.isAffiliate, true);
});

// 4 — sponsored metadata only ever accompanies a live affiliate link.
check('rel="sponsored" appears only on active affiliate links', () => {
  const statuses = ['none', 'pending', 'declined', 'expired'];
  for (const relationship of statuses) {
    const link = resolveOutboundLink({
      id: 't',
      name: 'T',
      network: 'cj',
      relationship,
      destinationUrl: 'https://example.com/',
      affiliateUrl: 'https://network.example/track/abc',
    });
    assert.equal(link.rel, undefined, `${relationship} must not carry rel`);
  }
  const live = resolveOutboundLink({
    id: 't',
    name: 'T',
    network: 'cj',
    relationship: 'approved',
    destinationUrl: 'https://example.com/',
    affiliateUrl: 'https://network.example/track/abc',
  });
  assert.match(live.rel ?? '', /\bsponsored\b/);
});

// 5 — the real Soundcore entry, as configured today.
check('Soundcore resolves to its public destination, not a CJ URL', () => {
  const soundcore = getMerchant('soundcore');
  assert.ok(soundcore, 'soundcore entry missing');
  assert.equal(soundcore.relationship, 'pending');
  assert.equal(soundcore.affiliateUrl, null);
  assert.equal(soundcore.advertiserId, '7382109');
  assert.equal(mayClaimAffiliateRelationship(soundcore), false);

  const link = resolveOutboundLink(soundcore);
  assert.equal(link.href, 'https://www.soundcore.com/');
  assert.equal(link.isAffiliate, false);
  assert.equal(link.rel, undefined);
});

// 6 — no CJ tracking domain anywhere in shipped source.
const CJ_TRACKING_HOSTS = [
  'dpbolvw.net',
  'anrdoezrs.net',
  'tkqlhce.com',
  'jdoqocy.com',
  'kqzyfj.com',
  'emjcd.com',
  'ftjcfx.com',
  'awltovhc.com',
  'lduhtrp.net',
  'tqlkg.com',
  'yceml.net',
];

const ROOT = fileURLToPath(new URL('../', import.meta.url));
const SKIP_DIRS = new Set(['node_modules', '.next', 'out', '.turbo']);
// This file necessarily contains the host list it searches for.
const SELF = fileURLToPath(import.meta.url);

async function sourceFiles(dir) {
  const found = [];
  for (const entry of await readdir(dir, { withFileTypes: true })) {
    if (SKIP_DIRS.has(entry.name)) continue;
    const full = join(dir, entry.name);
    if (entry.isDirectory()) found.push(...(await sourceFiles(full)));
    else if (/\.(ts|tsx|js|mjs|json)$/.test(entry.name) && full !== SELF) found.push(full);
  }
  return found;
}

const files = await sourceFiles(ROOT);
const hits = [];
for (const file of files) {
  const text = await readFile(file, 'utf8');
  for (const host of CJ_TRACKING_HOSTS) {
    if (text.includes(host)) hits.push(`${relative(ROOT, file)} -> ${host}`);
  }
}
check(`no fabricated CJ tracking URL in source (${files.length} files scanned)`, () => {
  assert.deepEqual(hits, []);
});

// Registry-wide invariant: nothing is approved, so nothing may link.
check('no merchant in the registry is currently approved', () => {
  const approved = MERCHANTS.filter((m) => m.relationship === 'approved');
  assert.deepEqual(
    approved.map((m) => m.id),
    [],
  );
});

console.log('verify-merchants:');
for (const line of results) console.log(line);
if (fail.length > 0) {
  for (const line of fail) console.error(line);
  console.error(`\nverify-merchants: ${fail.length} check(s) failed`);
  process.exit(1);
}
console.log(`verify-merchants: OK — ${results.length} checks passed, affiliate links DISABLED`);
