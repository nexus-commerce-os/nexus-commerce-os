#!/usr/bin/env node
/*
 * HonestTotal deployment smoke test.
 *
 *   node smoke-test.mjs https://your-preview.vercel.app
 *   node smoke-test.mjs https://honesttotal.com --live
 *
 * Checks everything that can be checked from outside the box: headers, the
 * legal pages, the brand, the disclosures, robots, and the full sign-up path
 * including the duplicate and honeypot branches.
 *
 * WHAT IT WILL NOT DO. Without --live it refuses any host that is not a
 * *.vercel.app preview, because the sign-up checks POST real addresses at the
 * configured provider and a production run puts test rows in the real list.
 * With --live it uses a single address and tells you to delete it afterwards.
 *
 * It asserts what the site CLAIMS matches what it DOES, so it is also the
 * thing to re-run after any change to the privacy notice or the CSP.
 *
 * Zero dependencies. Exits non-zero if anything fails.
 */
const [, , rawUrl, ...flags] = process.argv;
const LIVE = flags.includes('--live');

if (!rawUrl) {
  console.error('usage: node smoke-test.mjs <base-url> [--live]');
  process.exit(2);
}
const base = rawUrl.replace(/\/+$/, '');
const host = new URL(base).host;

const isLocal = /^(localhost|127\.0\.0\.1|\[::1\])(:\d+)?$/.test(host);

if (!LIVE && !isLocal && !host.endsWith('.vercel.app')) {
  console.error(
    `Refusing to run against ${host}.\n` +
      'The sign-up checks POST real addresses to the configured provider, so by\n' +
      'default this only runs against localhost or a *.vercel.app preview. Pass\n' +
      '--live if you really mean to, and delete the test contact afterwards.',
  );
  process.exit(2);
}

/* A single address per run, so a live run leaves exactly one row to delete. */
const stamp = Date.now();
const TEST_EMAIL = `smoke-${stamp}@example.invalid`;

let pass = 0;
const failures = [];
const ok = (name, cond, detail = '') => {
  if (cond) {
    pass += 1;
    console.log(`  ok    ${name}`);
  } else {
    failures.push(`${name}${detail ? ` — ${detail}` : ''}`);
    console.log(`  FAIL  ${name}${detail ? ` — ${detail}` : ''}`);
  }
};

const get = async (path) => {
  const res = await fetch(base + path, { redirect: 'manual' });
  return { res, body: await res.text().catch(() => '') };
};

const post = async (payload) => {
  const res = await fetch(`${base}/api/waitlist`, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify(payload),
  });
  let json = null;
  try {
    json = await res.json();
  } catch {
    /* non-JSON body is itself a failure, reported by the caller */
  }
  return { status: res.status, json };
};

console.log(`\nHonestTotal smoke test — ${base}${LIVE ? '  (LIVE)' : ''}\n`);

/* ── security headers ──────────────────────────────────────────────────── */
console.log('security headers');
{
  const { res } = await get('/');
  const h = (n) => res.headers.get(n) || '';
  ok('200 on /', res.status === 200, `got ${res.status}`);
  ok('Content-Security-Policy present', h('content-security-policy').length > 0);
  ok("CSP script-src has no 'unsafe-eval'", !h('content-security-policy').includes('unsafe-eval'));
  ok("CSP frame-ancestors 'none'", h('content-security-policy').includes("frame-ancestors 'none'"));
  ok('Strict-Transport-Security present', h('strict-transport-security').includes('max-age='));
  ok('X-Content-Type-Options nosniff', h('x-content-type-options') === 'nosniff');
  ok('X-Frame-Options DENY', h('x-frame-options') === 'DENY');
  ok('Referrer-Policy set', h('referrer-policy').length > 0);
  ok('Permissions-Policy set', h('permissions-policy').length > 0);
  ok('x-powered-by absent', h('x-powered-by') === '', h('x-powered-by'));
}

/* ── the landing page says what it should ──────────────────────────────── */
console.log('\nlanding page');
{
  const { body } = await get('/');
  ok('brand is HonestTotal', body.includes('HonestTotal'));
  ok('old codename is gone', !/(?<![\w/@-])NEXUS(?![\w/-])/.test(body), 'found NEXUS');
  const disclosures = (body.match(/Illustrative example/g) || []).length;
  ok('sample figures carry the disclosure', disclosures >= 2, `found ${disclosures}, want >= 2`);
  ok('no VERIFIED stamp on the sample receipt', !body.includes('VERIFIED ✓'));
  ok('no "Confirmed by the merchant network" claim', !body.includes('Confirmed by the merchant network'));
  ok('consent line present', body.includes('agree we may email you'));
  ok('privacy link present', body.includes('/privacy'));
  ok('terms link present', body.includes('/terms'));
  ok('honeypot field rendered', body.includes('name="company"'));
}

/* ── legal pages, and no placeholders ──────────────────────────────────── */
console.log('\nlegal pages');
for (const path of ['/privacy', '/terms']) {
  const { res, body } = await get(path);
  ok(`${path} returns 200`, res.status === 200, `got ${res.status}`);
  const left = body.match(/\[([A-Z][A-Z /]+[A-Z])\]/g) || [];
  ok(`${path} has no [PLACEHOLDERS]`, left.length === 0, left.join(', '));
}

/* ── robots and the internal gallery ───────────────────────────────────── */
console.log('\nrobots / internal pages');
{
  const { body } = await get('/robots.txt');
  ok('robots.txt disallows /ui', body.includes('/ui'));
  ok('robots.txt disallows /api/', body.includes('/api/'));
  const { res } = await get('/ui');
  ok('/ui is noindex', (res.headers.get('x-robots-tag') || '').includes('noindex'));
}

/* ── the sign-up path ──────────────────────────────────────────────────── */
console.log('\nsign-up');
{
  const bad = await post({ email: 'user@example..com', company: '' });
  ok('malformed address refused with 422', bad.status === 422, `got ${bad.status}`);

  const bot = await post({ email: `bot-${stamp}@example.invalid`, company: 'SPAM INC' });
  ok('honeypot answered 200 (tells a bot nothing)', bot.status === 200, `got ${bot.status}`);

  const first = await post({ email: TEST_EMAIL, company: '' });
  ok('real sign-up returns 200', first.status === 200, `got ${first.status}`);
  ok(
    'real sign-up reports added',
    first.json?.status === 'added',
    `got ${JSON.stringify(first.json)}`,
  );

  const again = await post({ email: TEST_EMAIL, company: '' });
  ok('repeat sign-up returns 200', again.status === 200, `got ${again.status}`);
  ok(
    'repeat sign-up reports duplicate (the 409 path)',
    again.json?.status === 'duplicate',
    `got ${JSON.stringify(again.json)} — if this says "added", the provider is not ` +
      'returning 409 and the duplicate branch is untested',
  );
}

/* ── report ────────────────────────────────────────────────────────────── */
console.log('');
if (failures.length === 0) {
  console.log(`PASS — ${pass} checks\n`);
  console.log('Still to confirm BY HAND, because only the provider can show it:');
  console.log(`  * ${TEST_EMAIL} appears in the Loops contact list`);
  console.log('  * its `source` reads "web" and `createdAt` is populated');
  console.log('  * the 6th POST from one IP inside 10 minutes is refused (firewall rule)');
  if (LIVE) console.log(`\n  Then DELETE ${TEST_EMAIL} from the list.`);
  process.exit(0);
}
console.log(`FAIL — ${failures.length} of ${pass + failures.length} checks failed:\n`);
for (const f of failures) console.log(`  * ${f}`);
process.exit(1);
