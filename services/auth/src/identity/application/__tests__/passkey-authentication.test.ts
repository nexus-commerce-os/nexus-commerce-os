import { describe, it, expect, beforeEach } from 'vitest';
import { StartPasskeyRegistration } from '../start-passkey-registration';
import { CompletePasskeyRegistration } from '../complete-passkey-registration';
import { StartPasskeyAuthentication } from '../start-passkey-authentication';
import { CompletePasskeyAuthentication } from '../complete-passkey-authentication';
import { RevokePasskey } from '../revoke-passkey';
import { toUserId } from '../../domain/value-objects/user-id';
import { toPasskeyCredentialId } from '../../domain/value-objects/passkey-credential-id';
import { CredentialId } from '../../domain/value-objects/credential-id';
import { PasskeyCredential } from '../../domain/entities/passkey-credential';
import { buildPasskeyFixture, type PasskeyFixture } from '../../__tests__/support';
import { verifiedAuthentication } from '../../__tests__/webauthn-doubles';

const RESPONSE = { id: 'cred-AAAA' } as const;

describe('passkey authentication', () => {
  let fx: PasskeyFixture;
  let startAuth: StartPasskeyAuthentication;
  let completeAuth: CompletePasskeyAuthentication;
  let passkeyId: string;

  beforeEach(async () => {
    fx = await buildPasskeyFixture();
    const reg = await new StartPasskeyRegistration(fx).execute({ userId: fx.userId });
    if (!reg.ok) {
      throw new Error('fixture invariant broken');
    }
    const done = await new CompletePasskeyRegistration(fx).execute({
      userId: fx.userId,
      challenge: reg.value.challenge,
      response: RESPONSE,
      label: 'iPhone',
    });
    if (!done.ok) {
      throw new Error('fixture invariant broken');
    }
    passkeyId = done.value.passkeyId;
    fx.events.drain();
    startAuth = new StartPasskeyAuthentication(fx);
    completeAuth = new CompletePasskeyAuthentication(fx);
  });

  async function challenge(email?: string): Promise<string> {
    const r = await startAuth.execute(email === undefined ? {} : { email });
    if (!r.ok) {
      throw new Error('fixture invariant broken');
    }
    fx.events.drain();
    return r.value.challenge;
  }

  // ── anti-enumeration ──────────────────────────────────────────────────────
  it('returns the same shape for a known account, an unknown one, and a bad address', async () => {
    const known = await startAuth.execute({ email: fx.email });
    const unknown = await startAuth.execute({ email: 'ghost@example.com' });
    const malformed = await startAuth.execute({ email: 'not-an-email' });
    const usernameless = await startAuth.execute({});

    for (const r of [known, unknown, malformed, usernameless]) {
      expect(r.ok).toBe(true);
      if (r.ok) {
        expect(Object.keys(r.value).sort()).toEqual(['challenge', 'expiresAt']);
        expect(r.value.challenge.length).toBeGreaterThan(20);
      }
    }
  });

  it('mints a real stored challenge even for an unknown account', async () => {
    const r = await startAuth.execute({ email: 'ghost@example.com' });
    expect(r.ok).toBe(true);
    if (!r.ok) {
      return;
    }
    const stored = await fx.challenges.findByChallengeHash(fx.tokenHasher.hash(r.value.challenge));
    expect(stored).not.toBeNull();
    expect(stored?.userId).toBeNull();
  });

  it('gives a deactivated account an unbound challenge that cannot complete', async () => {
    const user = await fx.users.findById(toUserId(fx.userId));
    user?.deactivate(fx.clock.now());
    if (user) {
      await fx.users.save(user);
    }
    const c = await challenge(fx.email);
    const result = await completeAuth.execute({ challenge: c, response: RESPONSE });
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.error._tag).toBe('UserDeactivatedError');
    }
  });

  // ── happy path ────────────────────────────────────────────────────────────
  it('authenticates, advances the counter, and publishes the event', async () => {
    const c = await challenge(fx.email);
    const result = await completeAuth.execute({ challenge: c, response: RESPONSE });

    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.value.userId).toBe(fx.userId);
      expect(result.value.counterSupported).toBe(true);
      expect(result.value.deviceId).not.toBeNull();
    }
    const passkey = await fx.passkeys.findById(toPasskeyCredentialId(passkeyId));
    expect(passkey?.signCount).toBe(1);
    expect(fx.events.published.map((e) => e.type)).toEqual(['identity.passkey.authenticated']);
  });

  it('supports a usernameless challenge (discoverable credential)', async () => {
    const c = await challenge();
    const result = await completeAuth.execute({ challenge: c, response: RESPONSE });
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.value.userId).toBe(fx.userId);
    }
  });

  // ── clone detection ───────────────────────────────────────────────────────
  it('rejects a regressed counter and announces PasskeyCloneSuspected', async () => {
    await completeAuth.execute({ challenge: await challenge(fx.email), response: RESPONSE });
    fx.events.drain();

    fx.verifier.setAuthentication(verifiedAuthentication({ signCount: 1 }));
    const result = await completeAuth.execute({
      challenge: await challenge(fx.email),
      response: RESPONSE,
    });

    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.error._tag).toBe('PasskeyCloneDetectedError');
    }
    expect(fx.events.published.map((e) => e.type)).toEqual(['identity.passkey.clone_suspected']);
  });

  it('accepts a counter-less authenticator repeatedly and flags it as unsupported', async () => {
    fx.verifier.setAuthentication(verifiedAuthentication({ signCount: 0 }));
    const first = await completeAuth.execute({
      challenge: await challenge(fx.email),
      response: RESPONSE,
    });
    const second = await completeAuth.execute({
      challenge: await challenge(fx.email),
      response: RESPONSE,
    });
    expect(first.ok && second.ok).toBe(true);
    if (first.ok) {
      expect(first.value.counterSupported).toBe(false);
    }
  });

  // ── rejection paths ───────────────────────────────────────────────────────
  it('rejects an unknown challenge', async () => {
    const result = await completeAuth.execute({ challenge: 'never-issued', response: RESPONSE });
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.error._tag).toBe('InvalidChallengeError');
    }
  });

  it('rejects a replayed challenge', async () => {
    const c = await challenge(fx.email);
    expect((await completeAuth.execute({ challenge: c, response: RESPONSE })).ok).toBe(true);
    fx.verifier.setAuthentication(verifiedAuthentication({ signCount: 2 }));
    const replay = await completeAuth.execute({ challenge: c, response: RESPONSE });
    expect(replay.ok).toBe(false);
    if (!replay.ok) {
      expect(replay.error._tag).toBe('InvalidChallengeError');
    }
  });

  it('rejects an expired challenge at the TTL boundary', async () => {
    const c = await challenge(fx.email);
    fx.clock.advance(fx.webauthnPolicy.challengeTtlMs());
    const result = await completeAuth.execute({ challenge: c, response: RESPONSE });
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.error._tag).toBe('ChallengeExpiredError');
    }
  });

  it('rejects a registration challenge used to authenticate', async () => {
    const reg = await new StartPasskeyRegistration(fx).execute({ userId: fx.userId });
    expect(reg.ok).toBe(true);
    if (!reg.ok) {
      return;
    }
    const result = await completeAuth.execute({
      challenge: reg.value.challenge,
      response: RESPONSE,
    });
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.error._tag).toBe('InvalidChallengeError');
    }
  });

  it('rejects a credential that belongs to a different user than the challenge', async () => {
    // a credential owned by somebody else, stored alongside ours
    const foreignUser = toUserId('12121212-1212-4212-8212-121212121212');
    await fx.passkeys.save(
      PasskeyCredential.register({
        id: toPasskeyCredentialId('13131313-1313-4313-8313-131313131313'),
        userId: foreignUser,
        credentialId: CredentialId.fromBase64Url('cred-ZZZZ'),
        publicKey: 'cose-key-z',
        signCount: 0,
        transports: ['usb'],
        aaguid: '00000000-0000-0000-0000-000000000000',
        backupEligible: false,
        backupState: false,
        label: 'Someone else key',
        deviceId: null,
        now: fx.clock.now(),
      }),
    );

    const c = await challenge(fx.email); // challenge is bound to OUR user
    fx.verifier.setAuthentication(verifiedAuthentication({ credentialId: 'cred-ZZZZ' }));
    const result = await completeAuth.execute({ challenge: c, response: { id: 'cred-ZZZZ' } });

    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.error._tag).toBe('InvalidChallengeError');
    }
  });

  it('rejects a credential nobody has registered', async () => {
    const c = await challenge(fx.email);
    fx.verifier.setAuthentication(verifiedAuthentication({ credentialId: 'cred-NOPE' }));
    const result = await completeAuth.execute({ challenge: c, response: { id: 'cred-NOPE' } });
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.error._tag).toBe('PasskeyNotFoundError');
    }
  });

  it('rejects a revoked credential as not found', async () => {
    const revoke = new RevokePasskey(fx);
    expect((await revoke.execute({ userId: fx.userId, passkeyId })).ok).toBe(true);

    const result = await completeAuth.execute({
      challenge: await challenge(fx.email),
      response: RESPONSE,
    });
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.error._tag).toBe('PasskeyNotFoundError');
    }
  });

  it('propagates a verifier failure without touching the counter', async () => {
    fx.verifier.failAuthentication('signature mismatch');
    const result = await completeAuth.execute({
      challenge: await challenge(fx.email),
      response: RESPONSE,
    });
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.error._tag).toBe('WebAuthnVerificationFailedError');
    }
    const passkey = await fx.passkeys.findById(toPasskeyCredentialId(passkeyId));
    expect(passkey?.signCount).toBe(0);
  });

  it('rejects a malformed credential id in the response', async () => {
    const result = await completeAuth.execute({
      challenge: await challenge(fx.email),
      response: { id: 'not base64url!' },
    });
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.error._tag).toBe('PasskeyNotFoundError');
    }
  });

  it('only one of two concurrent completions succeeds', async () => {
    const c = await challenge(fx.email);
    const [a, b] = await Promise.all([
      completeAuth.execute({ challenge: c, response: RESPONSE }),
      completeAuth.execute({ challenge: c, response: RESPONSE }),
    ]);
    expect([a.ok, b.ok].filter(Boolean)).toHaveLength(1);
  });
});
