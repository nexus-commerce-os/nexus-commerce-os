/*
 * CLOUDFLARE ACCESS TOKEN VERIFICATION.
 *
 * Written from the forgeries. A verifier that accepts a correctly-signed token
 * is not interesting; a verifier that refuses `alg: none`, a token signed with
 * a different key, and — the one most often missed — a perfectly valid token
 * issued for a DIFFERENT application in the same team, is the whole point.
 *
 * Real RSA keys are generated per run with WebCrypto, so these are genuine
 * signatures rather than a stubbed verify.
 */
import assert from 'node:assert/strict';
import { test } from 'node:test';

import {
  AccessKeyStore,
  AccessVerificationError,
  certsUrl,
  expectedIssuer,
  readAccessToken,
  verifyAccessToken,
} from '../dist/index.js';

const TEAM = 'https://honesttotal.cloudflareaccess.com';
const AUD = 'f0e1d2c3b4a5968778695a4b3c2d1e0f00112233445566778899aabbccddeeff';
const NOW = 1_800_000_000;

const b64url = (bytes) =>
  Buffer.from(bytes).toString('base64').replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
const jsonPart = (value) => b64url(Buffer.from(JSON.stringify(value), 'utf8'));

async function makeKeyPair() {
  return crypto.subtle.generateKey(
    {
      name: 'RSASSA-PKCS1-v1_5',
      modulusLength: 2048,
      publicExponent: new Uint8Array([1, 0, 1]),
      hash: 'SHA-256',
    },
    true,
    ['sign', 'verify'],
  );
}

async function jwkOf(publicKey, kid) {
  const jwk = await crypto.subtle.exportKey('jwk', publicKey);
  return { kid, kty: 'RSA', alg: 'RS256', use: 'sig', n: jwk.n, e: jwk.e };
}

async function sign(privateKey, header, payload) {
  const signing = `${jsonPart(header)}.${jsonPart(payload)}`;
  const signature = await crypto.subtle.sign(
    { name: 'RSASSA-PKCS1-v1_5' },
    privateKey,
    new TextEncoder().encode(signing),
  );
  return `${signing}.${b64url(new Uint8Array(signature))}`;
}

const claims = (over = {}) => ({
  iss: TEAM,
  aud: [AUD],
  sub: 'd0e1f2a3-0000-4000-8000-0123456789ab',
  email: 'Owner@Example.Invalid',
  iat: NOW - 60,
  exp: NOW + 3600,
  idp: 'onetimepin',
  ...over,
});

/** A key store fed by a stub fetch, so nothing here reaches the network. */
function storeFor(jwks, { onFetch } = {}) {
  let calls = 0;
  const store = new AccessKeyStore(TEAM, {
    now: () => NOW * 1000,
    fetchImpl: async (url) => {
      calls += 1;
      onFetch?.(url, calls);
      return {
        ok: true,
        status: 200,
        json: async () => ({ keys: typeof jwks === 'function' ? jwks(calls) : jwks }),
      };
    },
  });
  return { store, calls: () => calls };
}

const verify = (token, store, over = {}) =>
  verifyAccessToken(token, {
    config: { teamDomain: TEAM, audience: AUD, ...over },
    keys: store,
    now: () => NOW,
  });

async function rejects(promise, code) {
  await assert.rejects(promise, (error) => {
    assert.ok(
      error instanceof AccessVerificationError,
      `expected AccessVerificationError, got ${error}`,
    );
    assert.equal(error.code, code, `expected ${code}, got ${error.code}: ${error.message}`);
    return true;
  });
}

/* ───────────────────────────── the happy path ───────────────────────────── */

test('a correctly signed token for this application is accepted', async () => {
  const pair = await makeKeyPair();
  const { store } = storeFor([await jwkOf(pair.publicKey, 'k1')]);
  const token = await sign(pair.privateKey, { alg: 'RS256', kid: 'k1', typ: 'JWT' }, claims());

  const identity = await verify(token, store);
  assert.equal(identity.email, 'owner@example.invalid', 'the email is lower-cased');
  assert.equal(identity.subject, 'd0e1f2a3-0000-4000-8000-0123456789ab');
  assert.equal(identity.audience, AUD);
  assert.equal(identity.identityProvider, 'onetimepin');
  assert.equal(identity.commonName, null);
});

test('a service token identifies by common name rather than email', async () => {
  const pair = await makeKeyPair();
  const { store } = storeFor([await jwkOf(pair.publicKey, 'k1')]);
  const token = await sign(
    pair.privateKey,
    { alg: 'RS256', kid: 'k1' },
    claims({ email: undefined, sub: '', common_name: 'ci-deployer' }),
  );
  const identity = await verify(token, store);
  assert.equal(identity.commonName, 'ci-deployer');
  assert.equal(identity.subject, 'service:ci-deployer');
});

/* ──────────────────────────── the forgeries ──────────────────────────── */

test('alg: none is refused BEFORE a key is chosen', async () => {
  const pair = await makeKeyPair();
  const { store } = storeFor([await jwkOf(pair.publicKey, 'k1')]);
  // The classic: strip the signature and declare there is no algorithm.
  const token = `${jsonPart({ alg: 'none', kid: 'k1' })}.${jsonPart(claims())}.`;
  await rejects(verify(token, store), 'unsupported_algorithm');
});

test('a symmetric algorithm is refused, because the "secret" would be public', async () => {
  const pair = await makeKeyPair();
  const { store } = storeFor([await jwkOf(pair.publicKey, 'k1')]);
  // HS256 invites the verifier to HMAC with the RSA public key — a key the
  // attacker can simply read from the certs endpoint.
  const token = `${jsonPart({ alg: 'HS256', kid: 'k1' })}.${jsonPart(claims())}.c2lnbmF0dXJl`;
  await rejects(verify(token, store), 'unsupported_algorithm');
});

test('a token signed with the wrong key is refused', async () => {
  const real = await makeKeyPair();
  const attacker = await makeKeyPair();
  const { store } = storeFor([await jwkOf(real.publicKey, 'k1')]);
  // Same kid, different private key: the signature cannot verify.
  const token = await sign(attacker.privateKey, { alg: 'RS256', kid: 'k1' }, claims());
  await rejects(verify(token, store), 'bad_signature');
});

test('a token naming a key the team does not publish is refused', async () => {
  const pair = await makeKeyPair();
  const { store } = storeFor([await jwkOf(pair.publicKey, 'k1')]);
  const token = await sign(pair.privateKey, { alg: 'RS256', kid: 'attacker-chosen' }, claims());
  await rejects(verify(token, store), 'unknown_key');
});

test('A VALID TOKEN FOR ANOTHER APPLICATION IN THE SAME TEAM IS REFUSED', async () => {
  /*
   * The check that is easiest to omit and most expensive to omit. Every
   * application in a team is signed by the SAME keys, so a token minted for a
   * low-privilege application carries a perfectly good signature here.
   * Skipping aud turns "can open the status page" into "can open the admin
   * console".
   */
  const pair = await makeKeyPair();
  const { store } = storeFor([await jwkOf(pair.publicKey, 'k1')]);
  const token = await sign(
    pair.privateKey,
    { alg: 'RS256', kid: 'k1' },
    claims({ aud: ['a-different-application-aud-tag'] }),
  );
  await rejects(verify(token, store), 'wrong_audience');
});

test('a deployment that declares NO audience refuses everything', async () => {
  // Rather than accepting every application's tokens, which is what an empty
  // audience would otherwise mean.
  const pair = await makeKeyPair();
  const { store } = storeFor([await jwkOf(pair.publicKey, 'k1')]);
  const token = await sign(pair.privateKey, { alg: 'RS256', kid: 'k1' }, claims());
  await rejects(verify(token, store, { audience: '   ' }), 'wrong_audience');
});

test('a token from another team is refused', async () => {
  const pair = await makeKeyPair();
  const { store } = storeFor([await jwkOf(pair.publicKey, 'k1')]);
  const token = await sign(
    pair.privateKey,
    { alg: 'RS256', kid: 'k1' },
    claims({ iss: 'https://someone-else.cloudflareaccess.com' }),
  );
  await rejects(verify(token, store), 'wrong_issuer');
});

test('an expired token is refused, and the tolerance is small', async () => {
  const pair = await makeKeyPair();
  const { store } = storeFor([await jwkOf(pair.publicKey, 'k1')]);

  const justExpired = await sign(
    pair.privateKey,
    { alg: 'RS256', kid: 'k1' },
    claims({ exp: NOW - 10 }),
  );
  const identity = await verify(justExpired, store);
  assert.ok(identity, 'ten seconds inside the clock tolerance is still valid');

  const longExpired = await sign(
    pair.privateKey,
    { alg: 'RS256', kid: 'k1' },
    claims({ exp: NOW - 120 }),
  );
  await rejects(verify(longExpired, store), 'expired');
});

test('a token that is not yet valid is refused', async () => {
  const pair = await makeKeyPair();
  const { store } = storeFor([await jwkOf(pair.publicKey, 'k1')]);
  const token = await sign(
    pair.privateKey,
    { alg: 'RS256', kid: 'k1' },
    claims({ nbf: NOW + 600 }),
  );
  await rejects(verify(token, store), 'not_yet_valid');
});

test('a token identifying nobody is refused', async () => {
  const pair = await makeKeyPair();
  const { store } = storeFor([await jwkOf(pair.publicKey, 'k1')]);
  const token = await sign(
    pair.privateKey,
    { alg: 'RS256', kid: 'k1' },
    claims({ email: undefined, sub: '', common_name: undefined }),
  );
  await rejects(verify(token, store), 'missing_identity');
});

test('a missing or malformed token is refused without touching the key store', async () => {
  const pair = await makeKeyPair();
  const { store, calls } = storeFor([await jwkOf(pair.publicKey, 'k1')]);
  await rejects(verify(null, store), 'missing_token');
  await rejects(verify('   ', store), 'missing_token');
  await rejects(verify('not.a.jwt.at.all', store), 'malformed_token');
  await rejects(verify('onlyonepart', store), 'malformed_token');
  await rejects(verify('!!!.!!!.!!!', store), 'malformed_token');
  assert.equal(calls(), 0, 'a malformed token must not cause an outbound fetch');
});

test('claims are only read AFTER the signature verifies', async () => {
  const real = await makeKeyPair();
  const attacker = await makeKeyPair();
  const { store } = storeFor([await jwkOf(real.publicKey, 'k1')]);
  // Expired AND wrong-issuer AND signed by the wrong key. The signature is
  // what must be reported, because reporting a claim would confirm that a
  // forged token got as far as claim checking.
  const token = await sign(
    attacker.privateKey,
    { alg: 'RS256', kid: 'k1' },
    claims({ exp: NOW - 9999, iss: 'https://evil.invalid' }),
  );
  await rejects(verify(token, store), 'bad_signature');
});

/* ──────────────────────── key rotation and fetching ──────────────────────── */

test('an unknown kid triggers exactly one refetch, which is how rotation works', async () => {
  const oldKey = await makeKeyPair();
  const newKey = await makeKeyPair();
  let calls = 0;
  // An explicit clock. The first version tied `now` to the call count, so it
  // never advanced past minRefetchIntervalMs and the refetch was rate-limited
  // away — the test failed for its own reason rather than the code's.
  let clock = NOW * 1000;
  const store = new AccessKeyStore(TEAM, {
    now: () => clock,
    minRefetchIntervalMs: 60_000,
    fetchImpl: async () => {
      calls += 1;
      return {
        ok: true,
        status: 200,
        json: async () => ({
          keys:
            calls === 1
              ? [await jwkOf(oldKey.publicKey, 'old')]
              : [await jwkOf(newKey.publicKey, 'new')],
        }),
      };
    },
  });

  // Prime the store with the pre-rotation key.
  assert.ok(await store.get('old'), 'the old key is served first');
  assert.equal(calls, 1);

  // Cloudflare rotates. Time passes, then a token arrives signed by the new key.
  clock += 120_000;
  const token = await sign(newKey.privateKey, { alg: 'RS256', kid: 'new' }, claims());
  const identity = await verify(token, store);
  assert.ok(identity, 'the rotated key was picked up without a restart');
  assert.equal(calls, 2, 'one initial fetch, one on the unknown kid');
});

test('a flood of unknown kids does NOT become an outbound request amplifier', async () => {
  const pair = await makeKeyPair();
  let calls = 0;
  const store = new AccessKeyStore(TEAM, {
    // A frozen clock, so the rate limit is the only thing that can stop it.
    now: () => NOW * 1000,
    minRefetchIntervalMs: 60_000,
    fetchImpl: async () => {
      calls += 1;
      return {
        ok: true,
        status: 200,
        json: async () => ({ keys: [await jwkOf(pair.publicKey, 'k1')] }),
      };
    },
  });

  for (let i = 0; i < 25; i += 1) {
    const token = await sign(pair.privateKey, { alg: 'RS256', kid: `forged-${i}` }, claims());
    await rejects(verify(token, store), 'unknown_key');
  }
  assert.equal(calls, 1, 'twenty-five forged kids caused one fetch, not twenty-five');
});

test('a certs endpoint that fails is an error, never an empty allow-list', async () => {
  const store = new AccessKeyStore(TEAM, {
    now: () => NOW * 1000,
    fetchImpl: async () => ({ ok: false, status: 503, json: async () => ({}) }),
  });
  await rejects(verify('a.b.c', store), 'malformed_token');

  const pair = await makeKeyPair();
  const token = await sign(pair.privateKey, { alg: 'RS256', kid: 'k1' }, claims());
  await rejects(verify(token, store), 'keys_unavailable');
});

test('a certs endpoint returning no usable keys is an error', async () => {
  const store = new AccessKeyStore(TEAM, {
    now: () => NOW * 1000,
    fetchImpl: async () => ({
      ok: true,
      status: 200,
      // An EC key is not usable for RS256 and must not be silently accepted.
      json: async () => ({ keys: [{ kid: 'k1', kty: 'EC', crv: 'P-256', x: 'a', y: 'b' }] }),
    }),
  });
  const pair = await makeKeyPair();
  const token = await sign(pair.privateKey, { alg: 'RS256', kid: 'k1' }, claims());
  await rejects(verify(token, store), 'keys_unavailable');
});

test('concurrent first requests make ONE fetch', async () => {
  const pair = await makeKeyPair();
  let calls = 0;
  const store = new AccessKeyStore(TEAM, {
    now: () => NOW * 1000,
    fetchImpl: async () => {
      calls += 1;
      await new Promise((resolve) => setTimeout(resolve, 5));
      return {
        ok: true,
        status: 200,
        json: async () => ({ keys: [await jwkOf(pair.publicKey, 'k1')] }),
      };
    },
  });

  const token = await sign(pair.privateKey, { alg: 'RS256', kid: 'k1' }, claims());
  await Promise.all([verify(token, store), verify(token, store), verify(token, store)]);
  assert.equal(calls, 1, 'coalesced, so a cold start does not stampede the certs endpoint');
});

/* ──────────────────────────── reading the token ──────────────────────────── */

test('the assertion is read from the header, then the cookie', async () => {
  const headers = (map) => ({ headers: { get: (name) => map[name.toLowerCase()] ?? null } });

  assert.equal(
    readAccessToken(headers({ 'cf-access-jwt-assertion': 'from-header' })),
    'from-header',
  );
  assert.equal(
    readAccessToken(headers({ cookie: 'other=1; CF_Authorization=from-cookie; more=2' })),
    'from-cookie',
  );
  assert.equal(
    readAccessToken(
      headers({ 'cf-access-jwt-assertion': 'from-header', cookie: 'CF_Authorization=from-cookie' }),
    ),
    'from-header',
    'the header wins',
  );
  assert.equal(readAccessToken(headers({})), null);
  assert.equal(readAccessToken(headers({ 'cf-access-jwt-assertion': '   ' })), null);
  assert.equal(readAccessToken(headers({ cookie: 'CF_Authorization=' })), null);
  assert.equal(
    readAccessToken(headers({ cookie: 'CF_Authorization=a=b' })),
    'a=b',
    'a value containing = is not truncated',
  );
});

test('a pathological run of slashes does not stall the verifier', () => {
  /*
   * CodeQL flagged the trailing-slash strip as js/polynomial-redos in three
   * places, and was right about the one that matters: payload.iss comes from
   * the token. The signature is checked first, so only Cloudflare can reach
   * it today — a reason to fix it calmly, not a reason to leave a quadratic
   * scan sitting on a trust boundary that could move.
   *
   * 200k slashes: a linear scan is instant, a backtracking one is not.
   */
  const pathological = `https://example.cloudflareaccess.com${'/'.repeat(200_000)}`;
  const started = Date.now();
  assert.equal(expectedIssuer(pathological), 'https://example.cloudflareaccess.com');
  assert.equal(certsUrl(pathological), 'https://example.cloudflareaccess.com/cdn-cgi/access/certs');
  const elapsed = Date.now() - started;
  assert.ok(elapsed < 1000, `took ${elapsed}ms, which is not a linear scan`);
});

test('the certs URL and issuer are derived the same way, with or without a scheme', () => {
  assert.equal(
    certsUrl('example.cloudflareaccess.com'),
    'https://example.cloudflareaccess.com/cdn-cgi/access/certs',
  );
  assert.equal(
    certsUrl('https://example.cloudflareaccess.com/'),
    'https://example.cloudflareaccess.com/cdn-cgi/access/certs',
  );
  assert.equal(
    expectedIssuer('example.cloudflareaccess.com'),
    'https://example.cloudflareaccess.com',
  );
  assert.equal(
    expectedIssuer('https://example.cloudflareaccess.com/'),
    'https://example.cloudflareaccess.com',
  );
});
