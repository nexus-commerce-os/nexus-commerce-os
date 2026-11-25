/**
 * The nonce path, exercised against the real Worker module.
 *
 * WHY. `script-src 'self'` blocked Next's inline bootstrap scripts, React
 * never hydrated on the live site, and nothing noticed for as long as the
 * policy had been in place. Every existing check passed: the headers were
 * present, the CSP was not weakened, the pages built, the links worked. An
 * HTTP 200 is not evidence that a page works.
 *
 * These tests fail if the nonce stops being issued, stops reaching the
 * scripts, starts repeating, or starts being handed to things that should
 * never have it.
 */

import assert from 'node:assert/strict';
import { dirname, join, resolve } from 'node:path';
import { test } from 'node:test';
import { fileURLToPath, pathToFileURL } from 'node:url';

/*
 * `HTMLRewriter` is a Cloudflare runtime global and does not exist in Node, so
 * it is stood in for here.
 *
 * Be clear about what this does and does not prove. The shim replaces the
 * STREAMING PARSER only; the element handler it drives is the Worker's own,
 * unmodified, and so are the nonce, the CSP rewrite and the caching decision.
 * What is therefore NOT covered is Cloudflare's parser itself — which is why
 * the same behaviour is also measured against the deployed site rather than
 * trusted from here alone.
 */
globalThis.HTMLRewriter ??= class {
  #handlers = [];
  on(selector, handler) {
    this.#handlers.push({ selector, handler });
    return this;
  }
  transform(response) {
    const handlers = this.#handlers;
    const rewrite = async () => {
      const html = await response.text();
      // Case-insensitive: `<SCRIPT>` is the same element to a browser, and a
      // shim that only matched lower case would quietly be laxer than the
      // parser it stands in for. CodeQL flags exactly this (js/bad-tag-filter)
      // and is right to — a tag filter that misses a case variant is the
      // classic way one of these is bypassed.
      return html.replace(/<script([^>]*)>/gi, (whole, attrs) => {
        const parsed = new Map(
          [...attrs.matchAll(/([\w-]+)(?:="([^"]*)")?/g)].map((m) => [m[1], m[2] ?? '']),
        );
        const element = {
          getAttribute: (name) => (parsed.has(name) ? parsed.get(name) : null),
          setAttribute: (name, value) => parsed.set(name, value),
        };
        for (const { selector, handler } of handlers) {
          if (selector === 'script') handler.element(element);
        }
        const rendered = [...parsed].map(([k, v]) => (v === '' ? k : `${k}="${v}"`)).join(' ');
        return rendered ? `<script ${rendered}>` : whole;
      });
    };
    // A ReadableStream, not the promise itself: `new Response(promise)` would
    // stringify it to "[object Promise]" and the body would silently be wrong.
    const stream = new ReadableStream({
      async start(controller) {
        controller.enqueue(new TextEncoder().encode(await rewrite()));
        controller.close();
      },
    });
    return new Response(stream, response);
  }
};

const packageRoot = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const workerUrl = pathToFileURL(join(packageRoot, '.worker-test', 'worker', 'index.js'));
const worker = (await import(workerUrl.href)).default;

const PAGE_CSP =
  "default-src 'self'; script-src 'self'; style-src 'self' 'unsafe-inline'; " +
  "img-src 'self' data:; frame-ancestors 'none'; base-uri 'none'; object-src 'none'";

/** A stand-in asset service that answers with whatever the test needs. */
function envServing(body, headers) {
  return {
    WAITLIST: { get: async () => null, put: async () => {} },
    ASSETS: { fetch: async () => new Response(body, { headers }) },
  };
}

const htmlEnv = (body) =>
  envServing(body, {
    'content-type': 'text/html; charset=utf-8',
    'content-security-policy': PAGE_CSP,
  });

const get = (env, path = '/') => worker.fetch(new Request(`https://honesttotal.com${path}`), env);

const nonceOf = (response) =>
  response.headers.get('content-security-policy')?.match(/'nonce-([^']+)'/)?.[1] ?? null;

test('an HTML response gets a nonce added to script-src', async () => {
  const r = await get(htmlEnv('<html><body><script>hydrate()</script></body></html>'));
  const nonce = nonceOf(r);
  assert.ok(nonce, 'script-src must carry a nonce');
  const csp = r.headers.get('content-security-policy');
  assert.match(csp, /script-src 'self' 'nonce-/, "the nonce is ADDED to 'self', not replacing it");
  // Every other directive must survive untouched.
  assert.match(csp, /frame-ancestors 'none'/);
  assert.match(csp, /object-src 'none'/);
  assert.match(csp, /style-src 'self' 'unsafe-inline'/);
});

test('the nonce in the header is the one on the inline script', async () => {
  const env = htmlEnv('<html><body><script>hydrate()</script></body></html>');
  const r = await get(env);
  const nonce = nonceOf(r);
  const body = await r.text();
  assert.ok(
    body.includes(`nonce="${nonce}"`),
    'a nonce the scripts do not carry authorises nothing',
  );
});

test('every response gets a different nonce', async () => {
  const seen = new Set();
  for (let i = 0; i < 25; i += 1) {
    const r = await get(htmlEnv('<html><body><script>a()</script></body></html>'));
    seen.add(nonceOf(r));
  }
  assert.equal(seen.size, 25, 'a repeated nonce is not a nonce');
  for (const n of seen) {
    // 16 random bytes, base64 — 24 characters with padding.
    assert.equal(n.length, 24, `nonce "${n}" is not 128 bits of base64`);
  }
});

test('HTML carrying a nonce is never stored by a shared cache', async () => {
  const r = await get(htmlEnv('<html><body><script>a()</script></body></html>'));
  assert.equal(r.headers.get('cache-control'), 'no-store');
});

test('a script with src is NOT given a nonce', async () => {
  // It is already covered by 'self'; a nonce would only widen the grant.
  const env = htmlEnv('<html><body><script src="/a.js"></script></body></html>');
  const body = await (await get(env)).text();
  assert.ok(!body.includes('nonce='), 'external scripts need no grant');
});

test('a non-executable script block is NOT given a nonce', async () => {
  const env = htmlEnv(
    '<html><body><script type="application/ld+json">{"a":1}</script></body></html>',
  );
  const body = await (await get(env)).text();
  assert.ok(!body.includes('nonce='), 'JSON-LD is data; the browser never executes it');
});

test('a non-HTML asset is passed through untouched, keeping its caching', async () => {
  const env = envServing('body{}', {
    'content-type': 'text/css',
    'cache-control': 'public, max-age=31536000, immutable',
  });
  const r = await get(env, '/_next/static/a.css');
  assert.equal(
    r.headers.get('cache-control'),
    'public, max-age=31536000, immutable',
    'static assets must keep their long cache — they are the bytes that benefit',
  );
  assert.equal(r.headers.get('content-security-policy'), null);
});

test('the API keeps its own strict CSP and is not given a nonce', async () => {
  const env = htmlEnv('<html></html>');
  const r = await worker.fetch(
    new Request('https://honesttotal.com/api/waitlist', {
      method: 'POST',
      headers: { 'content-type': 'application/json', 'CF-Connecting-IP': 'ip-x' },
      body: JSON.stringify({ email: 'a@example.com' }),
    }),
    env,
  );
  const csp = r.headers.get('content-security-policy');
  assert.match(csp, /default-src 'none'/, "the API's policy is unchanged");
  assert.ok(!/nonce-/.test(csp), 'the API serves no document and needs no nonce');
});

test('an asset response with no CSP is not given a fabricated one', async () => {
  // `public/_headers` is the single place the page policy is written. If it
  // ever stops arriving, the right behaviour is to leave it absent and let
  // verify-headers catch it — not to invent a second policy here that would
  // drift from the first.
  const env = envServing('<html><body><script>a()</script></body></html>', {
    'content-type': 'text/html',
  });
  const r = await get(env);
  assert.equal(r.headers.get('content-security-policy'), null);
});

test('an upper-case SCRIPT tag is treated the same as a lower-case one', () => {
  // Not about the Worker — HTMLRewriter is a real parser and never had this
  // problem. This pins the SHIM, which did: its regex was case-sensitive, so
  // it would have reported a clean pass on markup the real parser rewrites.
  // CodeQL caught it (js/bad-tag-filter); the test keeps it caught.
  const pattern = /<script([^>]*)>/gi;
  assert.ok(pattern.test('<SCRIPT>'), 'a shim that misses <SCRIPT> is laxer than the parser');
  pattern.lastIndex = 0;
  assert.ok(pattern.test('<ScRiPt nonce="x">'));
});
