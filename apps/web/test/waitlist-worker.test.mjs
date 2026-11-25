/**
 * The Worker's signup path, both ways in.
 *
 * WHY THIS FILE EXISTS. The live site's CSP blocked Next's inline bootstrap
 * scripts, so React never hydrated — and the waitlist form carried no
 * `action`, no `method` and no field `name`, because React's submit handler
 * was the only path there was. Every address anyone typed went nowhere, in
 * silence. Nothing noticed, because nothing tested the Worker at all: it was
 * the one piece of this app with no test, and the piece that decides whether
 * a signup is kept or thrown away.
 *
 * So these assert the thing that actually matters — an address reaches
 * storage by BOTH routes, and the no-JavaScript route tells the visitor what
 * happened.
 */

import assert from 'node:assert/strict';
import { dirname, join, resolve } from 'node:path';
import { test } from 'node:test';
import { fileURLToPath, pathToFileURL } from 'node:url';

const packageRoot = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const workerUrl = pathToFileURL(join(packageRoot, '.worker-test', 'worker', 'index.js'));
const worker = (await import(workerUrl.href)).default;

const URLENC = 'application/x-www-form-urlencoded';
const form = (email) => new URLSearchParams({ email }).toString();

/** A fresh in-memory stand-in for KV, so no test can see another's writes. */
function freshEnv() {
  const kv = new Map();
  return {
    kv,
    env: {
      WAITLIST: {
        get: async (k) => (kv.has(k) ? kv.get(k) : null),
        put: async (k, v) => void kv.set(k, v),
      },
    },
  };
}

const post = (env, body, type, ip, extraHeaders = {}) =>
  worker.fetch(
    new Request('https://honesttotal.com/api/waitlist', {
      method: 'POST',
      headers: { 'content-type': type, 'CF-Connecting-IP': ip, ...extraHeaders },
      body,
    }),
    env,
  );

test('a no-JavaScript form post stores the address and says so', async () => {
  const { kv, env } = freshEnv();
  const r = await post(env, form('nojs@example.com'), URLENC, 'ip-a');
  assert.equal(r.status, 303, '303 forces a GET, so a refresh cannot resubmit the address');
  assert.match(r.headers.get('location'), /\?joined=ok#cta$/);
  assert.equal(kv.size, 1, 'the address actually reached storage');
});

test('a repeat address is reported as already on the list', async () => {
  const { env } = freshEnv();
  await post(env, form('dup@example.com'), URLENC, 'ip-a');
  const r = await post(env, form('dup@example.com'), URLENC, 'ip-b');
  assert.match(r.headers.get('location'), /joined=already/);
});

test('an invalid address is refused and nothing is stored', async () => {
  const { kv, env } = freshEnv();
  const r = await post(env, form('not-an-email'), URLENC, 'ip-a');
  assert.match(r.headers.get('location'), /joined=invalid/);
  assert.equal(kv.size, 0);
});

test('the hydrated JSON contract is unchanged', async () => {
  const { env } = freshEnv();
  const ok = await post(env, JSON.stringify({ email: 'js@example.com' }), 'application/json', 'a');
  assert.equal(ok.status, 200);
  assert.equal((await ok.json()).status, 'added');

  const bad = await post(env, JSON.stringify({ email: 'bad' }), 'application/json', 'b');
  assert.equal(bad.status, 422, 'JSON callers still get JSON, not a redirect');
});

test('the redirect target is our own origin, never the Referer', async () => {
  // Building a redirect from a request header is how a signup form quietly
  // becomes an open redirect.
  const { env } = freshEnv();
  const r = await post(env, form('ref@example.com'), URLENC, 'ip-a', {
    referer: 'https://evil.example/',
  });
  assert.ok(r.headers.get('location').startsWith('https://honesttotal.com/'));
});

test('the rate limit still applies to form posts, and is explained', async () => {
  const { env } = freshEnv();
  let last;
  for (let i = 0; i < 8; i += 1) {
    last = await post(env, form(`x${i}@example.com`), URLENC, 'ip-flood');
  }
  assert.match(last.headers.get('location'), /joined=slow-down/);
});

test('the page markup carries what a no-JS submit needs', async () => {
  // The Worker accepting form posts is only half of it: without these three
  // attributes the browser posts nothing, which is exactly what went wrong.
  const { readFile } = await import('node:fs/promises');
  const page = await readFile(join(packageRoot, 'src', 'app', 'page.tsx'), 'utf8');
  assert.match(page, /action="\/api\/waitlist"/);
  assert.match(page, /method="post"/);
  assert.match(page, /name="email"/);
});
