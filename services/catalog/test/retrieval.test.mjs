/*
 * The retrieval layer: the half the importer never had.
 *
 * The tests that matter most here are the refusals. An importer that works is
 * easy to notice; a fetcher that can be pointed at the cloud metadata service,
 * or that will happily expand a 10MB bomb into 10GB, works perfectly right up
 * until it is used against us.
 */
import assert from 'node:assert/strict';
import { gzipSync } from 'node:zlib';
import { test } from 'node:test';

import {
  assertFetchableUrl,
  backoffMs,
  envCredentialResolver,
  expandIfCompressed,
  gunzipWithLimit,
  isDue,
  isGzip,
  isPublicAddress,
  isZip,
  parseRetryAfter,
  readWithLimit,
  redactUrl,
  retrieveFeed,
  validateFeedSource,
} from '../dist/index.js';

/** A minimal valid source, overridden per test. */
const source = (over = {}) => ({
  id: 'src-1',
  merchantId: 'soundcore',
  transport: 'https',
  url: 'https://feeds.example.com/products.csv',
  format: 'csv',
  schedule: { everyMinutes: 60 },
  credentialRef: null,
  enabled: true,
  ...over,
});

/** A fetch stand-in returning a scripted sequence of responses. */
function scriptedFetch(responses) {
  const calls = [];
  const queue = [...responses];
  const impl = async (url, init) => {
    calls.push({ url: url.toString(), headers: new Headers(init?.headers) });
    const next = queue.shift();
    if (!next) throw new Error('scriptedFetch: ran out of responses');
    if (typeof next === 'function') return next();
    return next;
  };
  impl.calls = calls;
  return impl;
}

const bodyResponse = (text, headers = {}) =>
  new Response(text, { status: 200, headers: { 'content-type': 'text/csv', ...headers } });

/** DNS that always says "public", so transport tests are not DNS tests. */
const publicLookup = async () => [{ address: '93.184.216.34', family: 4 }];
const noSleep = async () => {};

// ---------------------------------------------------------------- URL guard

test('a plain-http feed URL is refused', () => {
  assert.throws(
    () => assertFetchableUrl('http://feeds.example.com/f.csv'),
    /must be https|not allowed/i,
  );
});

test('credentials inside the URL are refused', () => {
  assert.throws(
    () => assertFetchableUrl('https://user:secret@feeds.example.com/f.csv'),
    /credential reference/i,
  );
});

test('the cloud metadata address is refused', () => {
  // The single most valuable refusal in this file.
  assert.throws(
    () => assertFetchableUrl('https://169.254.169.254/latest/meta-data/'),
    /not a public/i,
  );
});

test('loopback, private and link-local addresses are all refused', () => {
  for (const host of ['127.0.0.1', '10.0.0.5', '192.168.1.1', '172.16.0.1', '0.0.0.0']) {
    assert.throws(() => assertFetchableUrl(`https://${host}/f.csv`), /not a public/i, host);
  }
  assert.throws(() => assertFetchableUrl('https://localhost/f.csv'), /not a public host/i);
});

test('an IPv4-mapped IPv6 private address is refused, not waved through', () => {
  // The spelling that gets missed: ::ffff:127.0.0.1 is loopback written in v6.
  assert.equal(isPublicAddress({ family: 6, address: '::ffff:127.0.0.1' }), false);
  assert.equal(isPublicAddress({ family: 6, address: '::ffff:10.0.0.1' }), false);
  assert.equal(isPublicAddress({ family: 6, address: '2606:2800:220:1:248:1893:25c8:1946' }), true);
});

test('a public https URL is allowed', () => {
  const url = assertFetchableUrl('https://feeds.example.com/products.csv?key=abc');
  assert.equal(url.hostname, 'feeds.example.com');
});

test('redaction keeps parameter names and drops their values', () => {
  const out = redactUrl('https://u:p@feeds.example.com/f.csv?key=supersecret&id=7');
  assert.ok(!out.includes('supersecret'), 'the secret survived redaction');
  assert.ok(!out.includes('u:p'), 'credentials survived redaction');
  assert.ok(out.includes('key='), 'the parameter name should survive, for debugging');
});

// ------------------------------------------------------------------- limits

test('gzip and zip are detected by magic bytes, not by file extension', () => {
  assert.equal(isGzip(gzipSync(Buffer.from('hello'))), true);
  assert.equal(isGzip(Buffer.from('hello')), false);
  assert.equal(isZip(Buffer.from([0x50, 0x4b, 0x03, 0x04, 0x00])), true);
});

test('a gzipped feed is expanded', async () => {
  const out = await expandIfCompressed(gzipSync(Buffer.from('a,b\n1,2\n')));
  assert.equal(out.toString(), 'a,b\n1,2\n');
});

test('an uncompressed feed passes through untouched', async () => {
  const raw = Buffer.from('a,b\n1,2\n');
  assert.equal((await expandIfCompressed(raw)).toString(), raw.toString());
});

test('a decompression bomb is refused by RATIO, before the absolute cap', async () => {
  // 8MB of zeroes compresses to a few KB: ratio in the thousands.
  const bomb = gzipSync(Buffer.alloc(8 * 1024 * 1024, 0));
  await assert.rejects(
    () => gunzipWithLimit(bomb, { maxExpandedBytes: 1024 * 1024 * 1024, maxExpansionRatio: 200 }),
    /expansion ratio|decompression bomb/i,
  );
});

test('a normal feed is well inside the ratio limit', async () => {
  // Real CSV rows, not zeroes: this must NOT trip the bomb detector.
  const rows = Array.from({ length: 5000 }, (_, i) => `SKU${i},Product ${i},19.99,USD,in stock`);
  const csv = Buffer.from(`sku,title,price,currency,availability\n${rows.join('\n')}\n`);
  const out = await gunzipWithLimit(gzipSync(csv));
  assert.equal(out.length, csv.length);
});

test('a download is cut off the moment it exceeds its budget', async () => {
  const stream = new ReadableStream({
    start(controller) {
      // Would stream forever if nothing stopped it.
      for (let i = 0; i < 100; i += 1) controller.enqueue(new Uint8Array(1024));
      controller.close();
    },
  });
  await assert.rejects(() => readWithLimit(stream, 8 * 1024), /exceeded 8192 bytes/);
});

// ------------------------------------------------------------- feed sources

test('a credentialRef must be a NAME, not a pasted secret', () => {
  const problems = validateFeedSource(
    source({ credentialRef: 'sk_live_abc!@#$%^', auth: { kind: 'bearer' } }),
  );
  assert.ok(
    problems.some((p) => /NAME of a secret/i.test(p)),
    problems.join('; '),
  );
});

test('auth without a credentialRef is a configuration error', () => {
  const problems = validateFeedSource(source({ auth: { kind: 'bearer' }, credentialRef: null }));
  assert.ok(
    problems.some((p) => /needs a credentialRef/i.test(p)),
    problems.join('; '),
  );
});

test('a valid source has no problems', () => {
  assert.deepEqual(validateFeedSource(source()), []);
});

test('due-ness is measured from the last SUCCESS, so a failing source keeps retrying', () => {
  const now = new Date('2026-11-26T12:00:00Z');
  const src = source({ schedule: { everyMinutes: 60 } });
  assert.equal(isDue(src, null, now), true, 'never run: due');
  assert.equal(isDue(src, new Date('2026-11-26T11:59:00Z'), now), false, 'ran a minute ago');
  assert.equal(isDue(src, new Date('2026-11-26T10:59:00Z'), now), true, 'ran over an hour ago');
  assert.equal(isDue(source({ enabled: false }), null, now), false, 'disabled is never due');
});

test('the environment resolver returns the secret for a reference, and nothing else', async () => {
  const resolve = envCredentialResolver({ FEED_KEY: 's3cret' });
  assert.equal(await resolve('FEED_KEY'), 's3cret');
  assert.equal(await resolve('MISSING'), undefined);
});

// ------------------------------------------------------------------ backoff

test('backoff grows exponentially and is capped', () => {
  const max = (n) => backoffMs(n, () => 1);
  assert.equal(max(1), 1000);
  assert.equal(max(2), 2000);
  assert.equal(max(3), 4000);
  assert.equal(max(10), 30_000, 'capped at 30s');
});

test('backoff is jittered, so failures do not synchronise into a stampede', () => {
  assert.equal(
    backoffMs(5, () => 0),
    0,
  );
  assert.ok(backoffMs(5, () => 0.5) < backoffMs(5, () => 1));
});

test('Retry-After is honoured in both seconds and HTTP-date form', () => {
  const now = new Date('2026-11-26T12:00:00Z');
  assert.equal(parseRetryAfter('30', now), 30_000);
  assert.equal(parseRetryAfter('Thu, 26 Nov 2026 12:00:30 GMT', now), 30_000);
  assert.equal(parseRetryAfter(null, now), null);
  assert.equal(parseRetryAfter('not-a-date', now), null);
  assert.equal(parseRetryAfter('999999', now), 3600_000, 'clamped');
});

// --------------------------------------------------------------- retrieval

test('a successful fetch returns the body and records validators', async () => {
  const fetchImpl = scriptedFetch([
    bodyResponse('sku,title\n1,A\n', {
      etag: '"v1"',
      'last-modified': 'Wed, 25 Nov 2026 10:00:00 GMT',
    }),
  ]);
  const out = await retrieveFeed(source(), {
    fetchImpl,
    lookupImpl: publicLookup,
    sleepImpl: noSleep,
  });
  assert.equal(out.status, 'fetched');
  assert.equal(out.body.toString(), 'sku,title\n1,A\n');
  assert.equal(out.validators.etag, '"v1"');
  assert.ok(out.validators.sha256, 'the payload hash must be recorded');
});

test('a conditional request is sent when validators are known', async () => {
  const fetchImpl = scriptedFetch([new Response(null, { status: 304 })]);
  const out = await retrieveFeed(source(), {
    fetchImpl,
    lookupImpl: publicLookup,
    sleepImpl: noSleep,
    previous: { etag: '"v1"', lastModified: 'Wed, 25 Nov 2026 10:00:00 GMT' },
  });
  assert.equal(out.status, 'unchanged');
  assert.equal(fetchImpl.calls[0].headers.get('if-none-match'), '"v1"');
  assert.equal(
    fetchImpl.calls[0].headers.get('if-modified-since'),
    'Wed, 25 Nov 2026 10:00:00 GMT',
  );
});

test('identical bytes with no ETag are still recognised as unchanged', async () => {
  // Providers that send no validators are common; re-importing an identical
  // feed is work the importer would refuse anyway.
  const first = await retrieveFeed(source(), {
    fetchImpl: scriptedFetch([bodyResponse('sku,title\n1,A\n')]),
    lookupImpl: publicLookup,
    sleepImpl: noSleep,
  });
  const second = await retrieveFeed(source(), {
    fetchImpl: scriptedFetch([bodyResponse('sku,title\n1,A\n')]),
    lookupImpl: publicLookup,
    sleepImpl: noSleep,
    previous: first.validators,
  });
  assert.equal(second.status, 'unchanged');
});

test('a gzipped response is expanded transparently', async () => {
  const gz = gzipSync(Buffer.from('sku,title\n1,A\n'));
  const fetchImpl = scriptedFetch([
    new Response(gz, { status: 200, headers: { 'content-type': 'application/gzip' } }),
  ]);
  const out = await retrieveFeed(source(), {
    fetchImpl,
    lookupImpl: publicLookup,
    sleepImpl: noSleep,
  });
  assert.equal(out.status, 'fetched');
  assert.equal(out.body.toString(), 'sku,title\n1,A\n');
});

test('a 500 is retried with backoff, then succeeds', async () => {
  const slept = [];
  const fetchImpl = scriptedFetch([
    new Response('nope', { status: 500 }),
    new Response('nope', { status: 503 }),
    bodyResponse('sku,title\n1,A\n'),
  ]);
  const out = await retrieveFeed(source(), {
    fetchImpl,
    lookupImpl: publicLookup,
    sleepImpl: async (ms) => void slept.push(ms),
  });
  assert.equal(out.status, 'fetched');
  assert.equal(out.attempts, 3);
  assert.equal(slept.length, 2, 'it waited between attempts');
});

test('a 429 waits for exactly as long as Retry-After says', async () => {
  const slept = [];
  const fetchImpl = scriptedFetch([
    new Response('slow down', { status: 429, headers: { 'retry-after': '7' } }),
    bodyResponse('sku,title\n1,A\n'),
  ]);
  const out = await retrieveFeed(source(), {
    fetchImpl,
    lookupImpl: publicLookup,
    sleepImpl: async (ms) => void slept.push(ms),
  });
  assert.equal(out.status, 'fetched');
  assert.deepEqual(slept, [7000], 'the provider said 7 seconds');
});

test('a 404 is NOT retried — it is a configuration fault, not a bad minute', async () => {
  const fetchImpl = scriptedFetch([new Response('gone', { status: 404 })]);
  const out = await retrieveFeed(source(), {
    fetchImpl,
    lookupImpl: publicLookup,
    sleepImpl: noSleep,
  });
  assert.equal(out.status, 'failed');
  assert.equal(out.retryable, false);
  assert.equal(out.attempts, 1);
});

test('a failed retrieval is reported as FAILED, never as an empty feed', async () => {
  // A network error IS retryable, so the fetcher will try the full budget.
  // Queue a refusal for every attempt rather than letting the harness run dry.
  const fetchImpl = scriptedFetch(
    Array.from({ length: 4 }, () => () => Promise.reject(new Error('socket hang up'))),
  );
  const out = await retrieveFeed(source(), {
    fetchImpl,
    lookupImpl: publicLookup,
    sleepImpl: noSleep,
  });
  assert.equal(out.attempts, 4, 'a transient error must exhaust the retry budget');
  assert.equal(out.status, 'failed');
  // The distinction the whole pipeline depends on: nothing downstream may read
  // this as "the merchant now sells nothing" and retire a catalogue.
  assert.ok(!('body' in out), 'a failure must carry no body at all');
  assert.match(out.reason, /socket hang up/);
});

test('304 is treated as "not modified", never as a redirect', () => {
  // REGRESSION. 304 sits inside the 300-399 block, so a naive `status >= 300
  // && status < 400` treated every conditional request as a redirect and
  // failed it with "redirect with no location" — breaking the entire point of
  // sending If-None-Match. Only 301/302/303/307/308 mean "look elsewhere".
  for (const status of [301, 302, 303, 307, 308]) {
    assert.ok(status >= 300 && status < 400, `${status} is a redirect`);
  }
  assert.ok(304 >= 300 && 304 < 400, '304 is in the 3xx range, which is the trap');
});

test('a redirect to a private address is refused at the hop, not followed', async () => {
  const fetchImpl = scriptedFetch([
    new Response(null, { status: 302, headers: { location: 'https://169.254.169.254/latest/' } }),
  ]);
  const out = await retrieveFeed(source(), {
    fetchImpl,
    lookupImpl: publicLookup,
    sleepImpl: noSleep,
  });
  assert.equal(out.status, 'failed');
  assert.equal(out.retryable, false, 'an SSRF attempt is not a transient error');
  assert.match(out.reason, /not a public/i);
});

test('a host that RESOLVES to a private address is refused', async () => {
  // DNS rebinding: the name is fine, the address is not.
  const rebinding = async () => [{ address: '127.0.0.1', family: 4 }];
  const out = await retrieveFeed(source(), {
    fetchImpl: scriptedFetch([bodyResponse('x')]),
    lookupImpl: rebinding,
    sleepImpl: noSleep,
  });
  assert.equal(out.status, 'failed');
  assert.equal(out.retryable, false);
  assert.match(out.reason, /not a public address/i);
});

test('an oversized download is refused and not retried', async () => {
  const huge = new ReadableStream({
    start(controller) {
      for (let i = 0; i < 64; i += 1) controller.enqueue(new Uint8Array(1024));
      controller.close();
    },
  });
  const fetchImpl = scriptedFetch([new Response(huge, { status: 200 })]);
  const out = await retrieveFeed(source(), {
    fetchImpl,
    lookupImpl: publicLookup,
    sleepImpl: noSleep,
    limits: { maxDownloadBytes: 4096, maxExpandedBytes: 4096, maxExpansionRatio: 200 },
  });
  assert.equal(out.status, 'failed');
  assert.equal(out.retryable, false, 'retrying an oversized feed just costs it again');
});

test('an unimplemented transport is refused loudly, not skipped silently', async () => {
  const out = await retrieveFeed(source({ transport: 'sftp' }), {
    fetchImpl: scriptedFetch([]),
    lookupImpl: publicLookup,
  });
  assert.equal(out.status, 'failed');
  assert.equal(out.retryable, false);
  assert.match(out.reason, /not implemented/i);
});

test('a bearer credential is resolved from its reference and sent', async () => {
  const fetchImpl = scriptedFetch([bodyResponse('sku\n1\n')]);
  await retrieveFeed(source({ credentialRef: 'FEED_KEY', auth: { kind: 'bearer' } }), {
    fetchImpl,
    lookupImpl: publicLookup,
    sleepImpl: noSleep,
    resolveCredential: envCredentialResolver({ FEED_KEY: 's3cret' }),
  });
  assert.equal(fetchImpl.calls[0].headers.get('authorization'), 'Bearer s3cret');
});

test('a missing credential fails with the reference name and never the value', async () => {
  const out = await retrieveFeed(source({ credentialRef: 'FEED_KEY', auth: { kind: 'bearer' } }), {
    fetchImpl: scriptedFetch([bodyResponse('x')]),
    lookupImpl: publicLookup,
    sleepImpl: noSleep,
    resolveCredential: envCredentialResolver({}),
  });
  assert.equal(out.status, 'failed');
  assert.match(out.reason, /FEED_KEY/);
});

test('a query credential goes in the URL at fetch time, not in the stored config', async () => {
  const fetchImpl = scriptedFetch([bodyResponse('sku\n1\n')]);
  const src = source({ credentialRef: 'FEED_KEY', auth: { kind: 'query', parameter: 'apikey' } });
  await retrieveFeed(src, {
    fetchImpl,
    lookupImpl: publicLookup,
    sleepImpl: noSleep,
    resolveCredential: envCredentialResolver({ FEED_KEY: 's3cret' }),
  });
  assert.match(fetchImpl.calls[0].url, /apikey=s3cret/);
  assert.ok(!src.url.includes('s3cret'), 'the configured source must stay free of the secret');
});
