/*
 * The waitlist store: fail-closed in production, and bounded when the provider
 * misbehaves.
 *
 * NOTHING HERE TOUCHES A NETWORK. Every test injects a `fetch` double, and the
 * only URL used is under `.invalid`, which RFC 2606 reserves so it can never
 * resolve.
 *
 * The test that matters most is the first one. A production default of
 * in-memory storage is the worst failure this site can have: every sign-up
 * returns 200, the visitor is thanked, and the address is gone at the next cold
 * start — with nothing logged and no dashboard turning red. So the assertion is
 * not "it warns"; it is that production REFUSES TO SERVE without a durable
 * destination.
 */
import assert from 'node:assert/strict';
import { afterEach, test } from 'node:test';

const MOD = '../dist/lib/waitlist.js';

/** Fresh module state + a clean environment for every case. */
async function load(env = {}) {
  const mod = await import(MOD);
  mod.resetWaitlistStoreForTests();
  delete process.env.WAITLIST_ESP_URL;
  delete process.env.WAITLIST_ESP_TOKEN;
  delete process.env.NODE_ENV;
  for (const [k, v] of Object.entries(env)) process.env[k] = v;
  return mod;
}

afterEach(async () => {
  const mod = await import(MOD);
  mod.resetWaitlistStoreForTests();
  delete process.env.WAITLIST_ESP_URL;
  delete process.env.WAITLIST_ESP_TOKEN;
  delete process.env.NODE_ENV;
});

const ENTRY = {
  email: 'someone@example.invalid',
  source: 'web',
  createdAt: '2026-11-13T00:00:00.000Z',
};

/* ─── fail closed ───────────────────────────────────────────────────────── */

test('production with no ESP configured REFUSES to build a store', async () => {
  const mod = await load({ NODE_ENV: 'production' });
  assert.throws(
    () => mod.getWaitlistStore(),
    (error) => {
      assert.equal(error.name, 'WaitlistNotConfiguredError');
      assert.equal(error._tag, 'WaitlistNotConfiguredError');
      // The message must tell an operator exactly what to set.
      assert.match(error.message, /WAITLIST_ESP_URL/);
      assert.match(error.message, /development only/);
      return true;
    },
  );
});

test('the refusal is not cached, so supplying the variable fixes the next boot', async () => {
  const mod = await load({ NODE_ENV: 'production' });
  assert.throws(() => mod.getWaitlistStore());

  // Same process, variable now present: must succeed without a restart.
  process.env.WAITLIST_ESP_URL = 'https://esp.example.invalid/hook';
  const store = mod.getWaitlistStore();
  assert.equal(typeof store.add, 'function');
});

test('development without an ESP still gets the memory store', async () => {
  // Otherwise `pnpm dev` would refuse to run, which is not the point.
  const mod = await load({ NODE_ENV: 'development' });
  const store = mod.getWaitlistStore();
  assert.equal((await store.add(ENTRY)).status, 'added');
  assert.equal((await store.add(ENTRY)).status, 'duplicate', 'memory store dedups');
});

test('an unset NODE_ENV is treated as non-production', async () => {
  const mod = await load();
  assert.doesNotThrow(() => mod.getWaitlistStore());
});

test('production WITH an ESP configured builds the durable store', async () => {
  const mod = await load({
    NODE_ENV: 'production',
    WAITLIST_ESP_URL: 'https://esp.example.invalid/hook',
  });
  assert.doesNotThrow(() => mod.getWaitlistStore());
});

/* ─── the ESP driver: request shape ─────────────────────────────────────── */

test('the entry is posted as JSON, with the token as a Bearer header', async () => {
  const mod = await load({
    NODE_ENV: 'production',
    WAITLIST_ESP_URL: 'https://esp.example.invalid/hook',
    WAITLIST_ESP_TOKEN: 's3cret-token',
  });
  let seenUrl = null;
  let seenInit = null;
  const original = globalThis.fetch;
  globalThis.fetch = async (url, init) => {
    seenUrl = url;
    seenInit = init;
    return new Response('{}', { status: 200 });
  };
  try {
    assert.equal((await mod.getWaitlistStore().add(ENTRY)).status, 'added');
  } finally {
    globalThis.fetch = original;
  }

  assert.equal(seenUrl, 'https://esp.example.invalid/hook');
  assert.equal(seenInit.method, 'POST');
  assert.equal(seenInit.headers['content-type'], 'application/json');
  assert.equal(seenInit.headers.authorization, 'Bearer s3cret-token');
  assert.deepEqual(JSON.parse(seenInit.body), ENTRY);
  // The deadline must actually be wired up.
  assert.ok(seenInit.signal, 'a timeout signal must be passed');
  assert.equal(typeof seenInit.signal.aborted, 'boolean');
});

test('no authorization header is invented when no token is configured', async () => {
  const mod = await load({
    NODE_ENV: 'production',
    WAITLIST_ESP_URL: 'https://esp.example.invalid/hook',
  });
  let seenInit = null;
  const original = globalThis.fetch;
  globalThis.fetch = async (_url, init) => {
    seenInit = init;
    return new Response('{}', { status: 200 });
  };
  try {
    await mod.getWaitlistStore().add(ENTRY);
  } finally {
    globalThis.fetch = original;
  }
  assert.equal('authorization' in seenInit.headers, false);
});

/* ─── the ESP driver: failure handling ──────────────────────────────────── */

test('a non-2xx response is an error carrying the status and nothing else', async () => {
  const mod = await load({
    NODE_ENV: 'production',
    WAITLIST_ESP_URL: 'https://esp.example.invalid/hook?key=webhook-secret',
  });
  const original = globalThis.fetch;
  globalThis.fetch = async () => new Response('nope', { status: 503 });
  try {
    await assert.rejects(mod.getWaitlistStore().add(ENTRY), (error) => {
      assert.match(error.message, /503/);
      // An ESP webhook URL is often itself the secret: it must not leak.
      assert.equal(
        /webhook-secret|esp\.example\.invalid/.test(error.message),
        false,
        error.message,
      );
      assert.equal(error.cause, undefined);
      return true;
    });
  } finally {
    globalThis.fetch = original;
  }
});

test('a timeout is reported as a timeout, with the deadline named', async () => {
  const mod = await load({
    NODE_ENV: 'production',
    WAITLIST_ESP_URL: 'https://esp.example.invalid/hook',
  });
  const original = globalThis.fetch;
  globalThis.fetch = async () => {
    const error = new Error('The operation was aborted due to timeout');
    error.name = 'TimeoutError';
    throw error;
  };
  try {
    await assert.rejects(mod.getWaitlistStore().add(ENTRY), (error) => {
      assert.match(error.message, /did not respond within \d+ms/);
      return true;
    });
  } finally {
    globalThis.fetch = original;
  }
});

test('a network failure does not leak the URL from the underlying error', async () => {
  const mod = await load({
    NODE_ENV: 'production',
    WAITLIST_ESP_URL: 'https://esp.example.invalid/hook?key=webhook-secret',
  });
  const original = globalThis.fetch;
  globalThis.fetch = async () => {
    // This is the shape Node really throws: the URL is in the message.
    throw new TypeError('fetch failed for https://esp.example.invalid/hook?key=webhook-secret');
  };
  try {
    await assert.rejects(mod.getWaitlistStore().add(ENTRY), (error) => {
      assert.equal(error.message, 'Waitlist ESP request failed');
      const surface = `${error.message} ${error.stack ?? ''}`;
      for (const secret of ['webhook-secret', 'esp.example.invalid']) {
        assert.equal(surface.includes(secret), false, `leaked ${secret}`);
      }
      assert.equal(error.cause, undefined, 'cause would carry the URL');
      return true;
    });
  } finally {
    globalThis.fetch = original;
  }
});

test('the timeout is a real deadline, not just a passed-through option', async () => {
  const mod = await load({
    NODE_ENV: 'production',
    WAITLIST_ESP_URL: 'https://esp.example.invalid/hook',
  });
  assert.ok(
    mod.ESP_TIMEOUT_MS > 0 && mod.ESP_TIMEOUT_MS <= 15_000,
    `ESP_TIMEOUT_MS=${mod.ESP_TIMEOUT_MS}`,
  );

  const original = globalThis.fetch;
  /*
   * Honour the signal the way undici does: reject when it aborts.
   *
   * The `keepAlive` timer is load-bearing, and its absence made this test fail
   * on CI while passing locally. `AbortSignal.timeout` uses an UNREF'd timer, so
   * it does not by itself keep the event loop alive. With a mock that creates no
   * timer of its own, the loop can drain before the deadline fires and Node
   * reports `Promise resolution is still pending but the event loop has already
   * resolved` -- the test neither passes nor fails, it is cancelled. A real
   * `fetch` always has a socket holding the loop open; the mock has to stand in
   * for that.
   */
  globalThis.fetch = (_url, init) =>
    new Promise((_resolve, reject) => {
      const keepAlive = setTimeout(() => {
        reject(new Error('the abort never fired — the deadline is not wired up'));
      }, 30_000);
      init.signal.addEventListener('abort', () => {
        clearTimeout(keepAlive);
        const error = new Error('aborted');
        error.name = 'TimeoutError';
        reject(error);
      });
    });
  try {
    await assert.rejects(mod.getWaitlistStore().add(ENTRY), /did not respond within/);
  } finally {
    globalThis.fetch = original;
  }
});

/* ─── the shared validator, from the same compiled output ───────────────── */

test('the email validator is the single shared one, cap first', async () => {
  const { isValidEmail, MAX_EMAIL_LENGTH, EMAIL_PATTERN } = await import('../dist/lib/email.js');
  assert.equal(MAX_EMAIL_LENGTH, 254);

  for (const ok of ['a@b.co', "o'brien@example.invalid", 'x+tag@mail.example.invalid']) {
    assert.equal(isValidEmail(ok), true, ok);
  }
  for (const bad of ['a@b', 'user@example..com', 'user@.example.com', '', 'a b@c.co']) {
    assert.equal(isValidEmail(bad), false, bad);
  }

  // Over the cap, but structurally valid: the CAP must be what refuses it.
  const overCap = `${'a'.repeat(MAX_EMAIL_LENGTH)}@b.co`;
  assert.equal(EMAIL_PATTERN.test(overCap), true, 'fixture should be structurally valid');
  assert.equal(isValidEmail(overCap), false, 'the cap must refuse it');

  // And the pattern itself stays linear on the old attack shape.
  const hostile = `a@${'.'.repeat(200_000)}@`;
  const started = process.hrtime.bigint();
  assert.equal(EMAIL_PATTERN.test(hostile), false);
  const ms = Number(process.hrtime.bigint() - started) / 1e6;
  assert.ok(ms < 500, `200k hostile input took ${ms.toFixed(1)}ms`);
});
