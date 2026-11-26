/*
 * Authentication and authorisation for the administration surface.
 *
 * NOTHING IS ROUTED YET. These tests exist before any URL does, because an
 * admin endpoint that ships before its authorisation is verified is worse than
 * no dashboard at all.
 *
 * The tests that matter most here are the refusals and the one about the
 * iteration count — which is a real production outage this project has already
 * seen once, on a different site, from the obvious "security improvement".
 */
import assert from 'node:assert/strict';
import { dirname, join, resolve } from 'node:path';
import { test } from 'node:test';
import { fileURLToPath, pathToFileURL } from 'node:url';

const packageRoot = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const auth = await import(
  pathToFileURL(join(packageRoot, '.worker-test', 'worker', 'auth.js')).href
);

const {
  MAX_PBKDF2_ITERATIONS,
  PBKDF2_ITERATIONS,
  SESSION_COOKIE,
  authorise,
  can,
  clearedCookie,
  createSession,
  destroySession,
  hashPassword,
  permissionsFor,
  readCookie,
  readSession,
  sessionCookie,
  sha256Hex,
  timingSafeEqual,
  verifyPassword,
} = auth;

/** A session store that records what it was given, so storage can be inspected. */
function memoryStore() {
  const rows = new Map();
  return {
    rows,
    async get(hash) {
      return rows.get(hash) ?? null;
    },
    async put(hash, session) {
      rows.set(hash, session);
    },
    async delete(hash) {
      rows.delete(hash);
    },
  };
}

function auditLog() {
  const entries = [];
  return {
    entries,
    async record(entry) {
      entries.push(entry);
    },
  };
}

const user = (over = {}) => ({
  id: 'u-1',
  email: 'owner@example.com',
  role: 'owner',
  passwordHash: 'unused',
  ...over,
});

/* ------------------------------------------------------------------ hashing */

test('PBKDF2 iterations stay at or below the Workers limit', () => {
  /*
   * THIS IS NOT A STYLE RULE. Cloudflare Workers cap PBKDF2 at 100,000
   * iterations; asking for more does not produce a slower hash, it throws
   * inside deriveBits — at sign-in, in production, for every user at once.
   * That exact change (210,000 iterations) took a different production login
   * down. Raising this number is an outage, not a hardening.
   */
  assert.equal(MAX_PBKDF2_ITERATIONS, 100_000);
  assert.ok(
    PBKDF2_ITERATIONS <= MAX_PBKDF2_ITERATIONS,
    `${PBKDF2_ITERATIONS} iterations will throw in a Worker`,
  );
});

test('a password hash is self-describing and carries a unique salt', async () => {
  const a = await hashPassword('correct horse battery');
  const b = await hashPassword('correct horse battery');
  assert.notEqual(a, b, 'the same password must not produce the same hash');

  const [scheme, digest, iterations, salt, hash] = a.split('$');
  assert.equal(scheme, 'pbkdf2');
  assert.equal(digest, 'sha256');
  assert.equal(Number(iterations), PBKDF2_ITERATIONS);
  assert.ok(salt.length > 0 && hash.length > 0);
  // The stored form must never contain the password itself.
  assert.ok(!a.includes('correct horse battery'));
});

test('the right password verifies and the wrong one does not', async () => {
  const stored = await hashPassword('correct horse battery');
  assert.equal(await verifyPassword('correct horse battery', stored), true);
  assert.equal(await verifyPassword('correct horse batterz', stored), false);
  assert.equal(await verifyPassword('', stored), false);
});

test('a short administrative password is refused at the hashing boundary', async () => {
  // Enforced here rather than in a form, because the form is not the control:
  // anything can call this.
  await assert.rejects(() => hashPassword('short'), /at least 12 characters/);
});

test('a malformed stored hash is refused rather than throwing', async () => {
  for (const bad of [
    '',
    'nonsense',
    'pbkdf2$sha256$100000$onlyfour',
    'md5$x$1$a$b',
    'pbkdf2$sha1$1$a$b',
  ]) {
    assert.equal(await verifyPassword('whatever', bad), false, `accepted ${bad}`);
  }
});

test('a stored hash claiming more than the limit is refused, not attempted', async () => {
  // Otherwise a crafted row turns a sign-in into a thrown exception.
  const stored = `pbkdf2$sha256$999999$${btoa('salt')}$${btoa('hash')}`;
  assert.equal(await verifyPassword('whatever', stored), false);
});

test('the comparison does not leak length through an early return', () => {
  assert.equal(timingSafeEqual(new Uint8Array([1, 2, 3]), new Uint8Array([1, 2, 3])), true);
  assert.equal(timingSafeEqual(new Uint8Array([1, 2, 3]), new Uint8Array([1, 2, 4])), false);
  assert.equal(timingSafeEqual(new Uint8Array([1, 2]), new Uint8Array([1, 2, 3])), false);
  assert.equal(timingSafeEqual(new Uint8Array([]), new Uint8Array([])), true);
});

/* ---------------------------------------------------------------------- RBAC */

test('a viewer can read but cannot run a feed', () => {
  // The whole reason roles exist. A dashboard where every reader can trigger
  // an import against a live provider has authentication and no authorisation.
  assert.equal(can('viewer', 'catalog:read'), true);
  assert.equal(can('viewer', 'feeds:read'), true);
  assert.equal(can('viewer', 'feeds:run'), false);
  assert.equal(can('viewer', 'catalog:write'), false);
  assert.equal(can('viewer', 'users:manage'), false);
  assert.equal(can('viewer', 'publication:control'), false);
});

test('an operator can run feeds but cannot manage users or publication', () => {
  assert.equal(can('operator', 'feeds:run'), true);
  assert.equal(can('operator', 'catalog:write'), true);
  assert.equal(can('operator', 'users:manage'), false);
  assert.equal(can('operator', 'publication:control'), false);
  assert.equal(can('operator', 'feeds:write'), false);
});

test('only the owner may manage users and control publication', () => {
  assert.equal(can('owner', 'users:manage'), true);
  assert.equal(can('owner', 'publication:control'), true);
});

test('an unknown role is granted nothing', () => {
  // Fail closed: a role that is not in the table is not a role.
  assert.deepEqual(permissionsFor('superuser'), []);
  assert.equal(can('superuser', 'catalog:read'), false);
  assert.equal(can(undefined, 'catalog:read'), false);
});

/* ------------------------------------------------------------------ sessions */

test('a session token is never stored, only its hash', async () => {
  const store = memoryStore();
  const { token } = await createSession(store, user());

  const stored = JSON.stringify([...store.rows.entries()]);
  assert.ok(!stored.includes(token), 'the raw session token reached the store');
  assert.ok(store.rows.has(await sha256Hex(token)), 'the hash should be the key');
});

test('two sessions never collide', async () => {
  const store = memoryStore();
  const seen = new Set();
  for (let i = 0; i < 50; i += 1) {
    const { token } = await createSession(store, user());
    seen.add(token);
  }
  assert.equal(seen.size, 50);
});

test('a valid token resolves to its session; a wrong one resolves to nothing', async () => {
  const store = memoryStore();
  const { token } = await createSession(store, user({ role: 'operator' }));

  const session = await readSession(store, token);
  assert.equal(session.userId, 'u-1');
  assert.equal(session.role, 'operator');

  assert.equal(await readSession(store, 'not-a-real-token'), null);
  assert.equal(await readSession(store, null), null);
  assert.equal(await readSession(store, ''), null);
});

test('an expired session is refused even if the store still has it', async () => {
  // KV expiry is best-effort, so the timestamp is the control, not the TTL.
  const store = memoryStore();
  const issued = new Date('2026-11-26T00:00:00Z');
  const { token } = await createSession(store, user(), issued);

  const later = new Date(issued.getTime() + 9 * 60 * 60 * 1000);
  assert.equal(await readSession(store, token, later), null, 'an expired session must not resolve');
  assert.ok(store.rows.size > 0, 'this test is only meaningful while the row still exists');
});

test('signing out revokes the session immediately', async () => {
  const store = memoryStore();
  const { token } = await createSession(store, user());
  assert.ok(await readSession(store, token));
  await destroySession(store, token);
  assert.equal(await readSession(store, token), null);
});

test('the cookie is __Host-, Secure, HttpOnly and SameSite=Strict', async () => {
  const cookie = sessionCookie('tok');
  assert.match(cookie, /^__Host-admin_session=tok;/);
  assert.match(cookie, /Secure/);
  assert.match(cookie, /HttpOnly/);
  // Strict, not Lax: no cross-site navigation should arrive already signed in.
  assert.match(cookie, /SameSite=Strict/);
  assert.match(cookie, /Path=\//);
  // __Host- forbids Domain, which is what stops a subdomain setting a cookie
  // this Worker would then trust.
  assert.ok(!/Domain=/i.test(cookie), 'a __Host- cookie must not set Domain');

  assert.match(clearedCookie(), /Max-Age=0/);
});

test('cookie parsing picks the right value and tolerates noise', () => {
  assert.equal(readCookie(`a=1; ${SESSION_COOKIE}=tok; b=2`, SESSION_COOKIE), 'tok');
  assert.equal(readCookie('a=1; b=2', SESSION_COOKIE), null);
  assert.equal(readCookie(null, SESSION_COOKIE), null);
  // A value containing '=' must survive intact.
  assert.equal(readCookie(`${SESSION_COOKIE}=a=b=c`, SESSION_COOKIE), 'a=b=c');
});

/* --------------------------------------------------------------- authorise */

test('no session is denied, and the denial is recorded', async () => {
  const audit = auditLog();
  const decision = await authorise(null, 'feeds:run', audit, { action: 'feeds.run' });
  assert.equal(decision.allowed, false);
  assert.equal(audit.entries.length, 1);
  assert.equal(audit.entries[0].outcome, 'denied');
  assert.equal(audit.entries[0].actorId, null);
});

test('a role without the permission is denied, and the denial names the reason', async () => {
  const audit = auditLog();
  const session = { userId: 'u-9', role: 'viewer', createdAt: '', expiresAt: '' };
  const decision = await authorise(session, 'feeds:run', audit, {
    action: 'feeds.run',
    target: 'soundcore',
  });

  assert.equal(decision.allowed, false);
  assert.match(decision.reason, /viewer/);
  // Denials are the interesting half of an audit log: an authorisation check
  // whose refusals are invisible cannot be reviewed.
  assert.equal(audit.entries[0].outcome, 'denied');
  assert.equal(audit.entries[0].target, 'soundcore');
  assert.match(audit.entries[0].detail, /lacks feeds:run/);
});

test('an allowed action is recorded too', async () => {
  const audit = auditLog();
  const session = { userId: 'u-1', role: 'owner', createdAt: '', expiresAt: '' };
  const decision = await authorise(session, 'feeds:run', audit, { action: 'feeds.run' });
  assert.equal(decision.allowed, true);
  assert.equal(audit.entries[0].outcome, 'allowed');
  assert.equal(audit.entries[0].actorId, 'u-1');
});

test('every audit entry carries a timestamp and an action', async () => {
  const audit = auditLog();
  const session = { userId: 'u-1', role: 'owner', createdAt: '', expiresAt: '' };
  await authorise(session, 'catalog:read', audit, { action: 'catalog.list' });
  await authorise(null, 'catalog:read', audit, { action: 'catalog.list' });

  for (const entry of audit.entries) {
    assert.ok(!Number.isNaN(Date.parse(entry.at)), 'an audit entry needs a real timestamp');
    assert.ok(entry.action.length > 0);
    assert.ok(['allowed', 'denied', 'failed'].includes(entry.outcome));
  }
});

test('no administrative route is exposed yet', async () => {
  // The guard on this whole milestone. The module exists and is tested; the
  // Worker must not be routing any of it until that wiring is reviewed on its
  // own. If this starts failing, the wiring landed without its own tests.
  const { readFileSync } = await import('node:fs');
  const worker = readFileSync(join(packageRoot, 'worker', 'index.ts'), 'utf8');
  assert.ok(
    !/['"`]\/admin/.test(worker),
    'worker/index.ts references an /admin path — admin routes must not ship before their wiring is verified',
  );
});
