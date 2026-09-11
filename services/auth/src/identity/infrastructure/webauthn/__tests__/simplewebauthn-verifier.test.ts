import { describe, it, expect } from 'vitest';
import { createHash, createSign, generateKeyPairSync, type KeyObject } from 'node:crypto';
import { SimpleWebAuthnVerifier } from '../simplewebauthn-verifier';

const RP_ID = 'nexus.example';
const ORIGIN = 'https://nexus.example';
const CHALLENGE = 'Q0hBTExFTkdFLTAwMDAwMDAwMDAwMDAwMDAwMDAw';

const verifier = new SimpleWebAuthnVerifier({ rpId: RP_ID, origin: ORIGIN });

/* ── a real authenticator, in ~40 lines ──────────────────────────────────────
 * Everything below produces a genuinely signed assertion: a P-256 key, its
 * COSE encoding, real authenticator data, and an ECDSA signature over
 * authData || SHA-256(clientDataJSON). That is what makes the positive test
 * meaningful — the library performs actual cryptographic verification, so a
 * pass proves the adapter wired the expectations correctly rather than that a
 * stub said yes.
 */

const b64u = (buf: Buffer): string => buf.toString('base64url');

/** COSE_Key for an EC2 P-256 ES256 public key: {1:2, 3:-7, -1:1, -2:x, -3:y}. */
function coseKey(publicKey: KeyObject): Buffer {
  const jwk = publicKey.export({ format: 'jwk' }) as { x: string; y: string };
  const x = Buffer.from(jwk.x, 'base64url');
  const y = Buffer.from(jwk.y, 'base64url');
  return Buffer.concat([
    Buffer.from([0xa5, 0x01, 0x02, 0x03, 0x26, 0x20, 0x01, 0x21, 0x58, 0x20]),
    x,
    Buffer.from([0x22, 0x58, 0x20]),
    y,
  ]);
}

/** rpIdHash(32) || flags(1) || signCount(4, big-endian). */
function authenticatorData(rpId: string, signCount: number, flags = 0x05): Buffer {
  const counter = Buffer.alloc(4);
  counter.writeUInt32BE(signCount);
  return Buffer.concat([
    createHash('sha256').update(rpId).digest(),
    Buffer.from([flags]),
    counter,
  ]);
}

interface Assertion {
  response: Record<string, unknown>;
  publicKey: string;
}

function signedAssertion(
  options: {
    challenge?: string;
    origin?: string;
    rpId?: string;
    signCount?: number;
    tamperSignature?: boolean;
  } = {},
): Assertion {
  const { privateKey, publicKey } = generateKeyPairSync('ec', { namedCurve: 'P-256' });
  const clientDataJSON = Buffer.from(
    JSON.stringify({
      type: 'webauthn.get',
      challenge: options.challenge ?? CHALLENGE,
      origin: options.origin ?? ORIGIN,
      crossOrigin: false,
    }),
    'utf8',
  );
  const authData = authenticatorData(options.rpId ?? RP_ID, options.signCount ?? 1);
  const signed = Buffer.concat([authData, createHash('sha256').update(clientDataJSON).digest()]);
  const signature = createSign('sha256').update(signed).sign(privateKey);
  if (options.tamperSignature === true) {
    signature[signature.length - 1] ^= 0xff;
  }

  return {
    publicKey: b64u(coseKey(publicKey)),
    response: {
      id: 'cred-AAAA',
      rawId: 'cred-AAAA',
      type: 'public-key',
      clientExtensionResults: {},
      response: {
        clientDataJSON: b64u(clientDataJSON),
        authenticatorData: b64u(authData),
        signature: b64u(signature),
        userHandle: null,
      },
    },
  };
}

describe('SimpleWebAuthnVerifier · authentication', () => {
  it('accepts a genuinely signed assertion and reports the new counter', async () => {
    const { response, publicKey } = signedAssertion({ signCount: 7 });

    const result = await verifier.verifyAuthentication({
      challenge: CHALLENGE,
      response,
      publicKey,
      storedSignCount: 6,
    });

    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.value.credentialId).toBe('cred-AAAA');
      expect(result.value.signCount).toBe(7);
      expect(result.value.userVerified).toBe(true);
    }
  });

  it('rejects a tampered signature', async () => {
    const { response, publicKey } = signedAssertion({ tamperSignature: true });

    const result = await verifier.verifyAuthentication({
      challenge: CHALLENGE,
      response,
      publicKey,
      storedSignCount: 0,
    });

    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.error._tag).toBe('WebAuthnVerificationFailedError');
    }
  });

  /** The phishing guard: a signature made for another site must not verify. */
  it('rejects an assertion signed for a different origin', async () => {
    const { response, publicKey } = signedAssertion({ origin: 'https://evil.example' });

    const result = await verifier.verifyAuthentication({
      challenge: CHALLENGE,
      response,
      publicKey,
      storedSignCount: 0,
    });

    expect(result.ok).toBe(false);
  });

  it('rejects an assertion bound to a different RP id', async () => {
    const { response, publicKey } = signedAssertion({ rpId: 'other.example' });

    const result = await verifier.verifyAuthentication({
      challenge: CHALLENGE,
      response,
      publicKey,
      storedSignCount: 0,
    });

    expect(result.ok).toBe(false);
  });

  it('rejects an assertion answering a different challenge', async () => {
    const { response, publicKey } = signedAssertion({ challenge: 'c29tZS1vdGhlci1jaGFsbGVuZ2U' });

    const result = await verifier.verifyAuthentication({
      challenge: CHALLENGE,
      response,
      publicKey,
      storedSignCount: 0,
    });

    expect(result.ok).toBe(false);
  });

  it('rejects an assertion verified against somebody else’s key', async () => {
    const { response } = signedAssertion();
    const { publicKey: strangersKey } = signedAssertion();

    const result = await verifier.verifyAuthentication({
      challenge: CHALLENGE,
      response,
      publicKey: strangersKey,
      storedSignCount: 0,
    });

    expect(result.ok).toBe(false);
  });

  it('reports a missing credential id rather than throwing', async () => {
    const { publicKey } = signedAssertion();
    const result = await verifier.verifyAuthentication({
      challenge: CHALLENGE,
      response: { type: 'public-key' },
      publicKey,
      storedSignCount: 0,
    });

    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.error.reason).toContain('credential id');
    }
  });

  it('reports an empty stored public key rather than throwing', async () => {
    const { response } = signedAssertion();
    const result = await verifier.verifyAuthentication({
      challenge: CHALLENGE,
      response,
      publicKey: '',
      storedSignCount: 0,
    });

    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.error.reason).toContain('empty');
    }
  });

  it('fails closed on a structurally garbage response', async () => {
    const { publicKey } = signedAssertion();
    const result = await verifier.verifyAuthentication({
      challenge: CHALLENGE,
      response: { id: 'cred-AAAA', response: { clientDataJSON: 'not-valid', signature: '??' } },
      publicKey,
      storedSignCount: 0,
    });

    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.error._tag).toBe('WebAuthnVerificationFailedError');
    }
  });
});

describe('SimpleWebAuthnVerifier · registration', () => {
  /**
   * A *valid* registration needs a CBOR attestation object, which only a real
   * authenticator produces. What matters here is that the adapter never
   * fails open: anything it cannot verify is rejected, with the reason kept for
   * audit and out of the caller's hands. The happy path is covered end-to-end
   * by the browser-driven test at I-7b.
   */
  it('fails closed on responses it cannot verify', async () => {
    for (const response of [
      {},
      { id: 'cred-AAAA' },
      { id: 'cred-AAAA', response: { clientDataJSON: 'nope', attestationObject: 'nope' } },
      { id: 'cred-AAAA', response: { attestationObject: '' } },
    ]) {
      const result = await verifier.verifyRegistration({ challenge: CHALLENGE, response });
      expect(result.ok).toBe(false);
      if (!result.ok) {
        expect(result.error._tag).toBe('WebAuthnVerificationFailedError');
        expect(result.error.reason.length).toBeGreaterThan(0);
      }
    }
  });

  it('never leaks a stack trace through the failure reason', async () => {
    const result = await verifier.verifyRegistration({
      challenge: CHALLENGE,
      response: { id: 'x', response: { attestationObject: 'garbage' } },
    });
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.error.reason).not.toContain('at ');
      expect(result.error.reason).not.toContain('node_modules');
    }
  });
});
