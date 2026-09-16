import { describe, it, expect, beforeEach } from 'vitest';
import { StartPasskeyRegistration } from '../start-passkey-registration';
import { CompletePasskeyRegistration } from '../complete-passkey-registration';
import { StartPasskeyAuthentication } from '../start-passkey-authentication';
import { toUserId } from '../../domain/value-objects/user-id';
import { toDeviceId } from '../../domain/value-objects/device-id';
import { buildPasskeyFixture, type PasskeyFixture } from '../../__tests__/support';
import { verifiedRegistration } from '../../__tests__/webauthn-doubles';

const RESPONSE = { id: 'cred-AAAA', rawId: 'cred-AAAA' } as const;

describe('passkey registration', () => {
  let fx: PasskeyFixture;
  let start: StartPasskeyRegistration;
  let complete: CompletePasskeyRegistration;

  beforeEach(async () => {
    fx = await buildPasskeyFixture();
    start = new StartPasskeyRegistration(fx);
    complete = new CompletePasskeyRegistration(fx);
  });

  async function challenge(): Promise<string> {
    const r = await start.execute({ userId: fx.userId });
    if (!r.ok) {
      throw new Error('fixture invariant broken');
    }
    fx.events.drain();
    return r.value.challenge;
  }

  it('issues a challenge and stores only its hash', async () => {
    const r = await start.execute({ userId: fx.userId });
    expect(r.ok).toBe(true);
    if (!r.ok) {
      return;
    }
    expect(r.value.challenge.length).toBeGreaterThan(20);
    expect(r.value.expiresAt).toEqual(
      new Date(fx.clock.now().getTime() + fx.webauthnPolicy.challengeTtlMs()),
    );
    const stored = await fx.challenges.findByChallengeHash(fx.tokenHasher.hash(r.value.challenge));
    expect(stored).not.toBeNull();
    expect(JSON.stringify(stored?.snapshot())).not.toContain(r.value.challenge);
  });

  it('registers a credential, trusts the device, and publishes both events', async () => {
    const c = await challenge();
    const result = await complete.execute({
      userId: fx.userId,
      challenge: c,
      response: RESPONSE,
      label: 'iPhone',
      deviceLabel: 'Jane iPhone',
      platform: 'iOS',
    });

    expect(result.ok).toBe(true);
    if (!result.ok) {
      return;
    }
    expect(fx.passkeys.size).toBe(1);
    expect(fx.devices.size).toBe(1);
    const device = await fx.devices.findById(toDeviceId(result.value.deviceId));
    expect(device?.trustState).toBe('TRUSTED');
    expect(fx.events.published.map((e) => e.type)).toEqual([
      'identity.device.registered',
      'identity.passkey.registered',
    ]);
  });

  it('rejects a replayed challenge', async () => {
    const c = await challenge();
    await complete.execute({ userId: fx.userId, challenge: c, response: RESPONSE, label: 'A' });

    fx.verifier.setRegistration(verifiedRegistration({ credentialId: 'cred-BBBB' }));
    const replay = await complete.execute({
      userId: fx.userId,
      challenge: c,
      response: RESPONSE,
      label: 'B',
    });
    expect(replay.ok).toBe(false);
    if (!replay.ok) {
      expect(replay.error._tag).toBe('InvalidChallengeError');
    }
  });

  it('rejects an expired challenge at the TTL boundary', async () => {
    const c = await challenge();
    fx.clock.advance(fx.webauthnPolicy.challengeTtlMs());
    const result = await complete.execute({
      userId: fx.userId,
      challenge: c,
      response: RESPONSE,
      label: 'A',
    });
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.error._tag).toBe('ChallengeExpiredError');
    }
  });

  it('rejects an authentication challenge used to complete a registration', async () => {
    const auth = await new StartPasskeyAuthentication(fx).execute({ email: fx.email });
    expect(auth.ok).toBe(true);
    if (!auth.ok) {
      return;
    }
    const result = await complete.execute({
      userId: fx.userId,
      challenge: auth.value.challenge,
      response: RESPONSE,
      label: 'A',
    });
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.error._tag).toBe('InvalidChallengeError');
    }
  });

  it("rejects another user's challenge", async () => {
    const c = await challenge();
    const other = await buildPasskeyFixture();
    const result = await complete.execute({
      userId: other.userId,
      challenge: c,
      response: RESPONSE,
      label: 'A',
    });
    expect(result.ok).toBe(false);
    if (!result.ok) {
      // the other user does not exist in this fixture's user repo
      expect(['UserNotFoundError', 'InvalidChallengeError']).toContain(result.error._tag);
    }
  });

  it('supersedes the previous challenge when a new ceremony starts', async () => {
    const first = await challenge();
    await challenge();
    const result = await complete.execute({
      userId: fx.userId,
      challenge: first,
      response: RESPONSE,
      label: 'A',
    });
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.error._tag).toBe('InvalidChallengeError');
    }
  });

  it('propagates a verifier failure and never stores a credential', async () => {
    const c = await challenge();
    fx.verifier.failRegistration('attestation invalid');
    const result = await complete.execute({
      userId: fx.userId,
      challenge: c,
      response: RESPONSE,
      label: 'A',
    });
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.error._tag).toBe('WebAuthnVerificationFailedError');
    }
    expect(fx.passkeys.size).toBe(0);
  });

  it('burns the challenge even when verification fails', async () => {
    const c = await challenge();
    fx.verifier.failRegistration('bad signature');
    await complete.execute({ userId: fx.userId, challenge: c, response: RESPONSE, label: 'A' });

    fx.verifier.setRegistration(verifiedRegistration());
    const retry = await complete.execute({
      userId: fx.userId,
      challenge: c,
      response: RESPONSE,
      label: 'A',
    });
    expect(retry.ok).toBe(false);
  });

  it('rejects registering the same authenticator twice', async () => {
    await complete.execute({
      userId: fx.userId,
      challenge: await challenge(),
      response: RESPONSE,
      label: 'A',
    });
    const duplicate = await complete.execute({
      userId: fx.userId,
      challenge: await challenge(),
      response: RESPONSE,
      label: 'B',
    });
    expect(duplicate.ok).toBe(false);
    if (!duplicate.ok) {
      expect(duplicate.error._tag).toBe('DuplicateCredentialError');
    }
    expect(fx.passkeys.size).toBe(1);
  });

  it('attaches a second credential to an existing device instead of duplicating it', async () => {
    const first = await complete.execute({
      userId: fx.userId,
      challenge: await challenge(),
      response: RESPONSE,
      label: 'A',
    });
    expect(first.ok).toBe(true);
    if (!first.ok) {
      return;
    }
    fx.verifier.setRegistration(verifiedRegistration({ credentialId: 'cred-BBBB' }));
    fx.events.drain();

    const second = await complete.execute({
      userId: fx.userId,
      challenge: await challenge(),
      response: { id: 'cred-BBBB' },
      label: 'B',
      deviceId: first.value.deviceId,
    });
    expect(second.ok).toBe(true);
    if (second.ok) {
      expect(second.value.deviceId).toBe(first.value.deviceId);
    }
    expect(fx.devices.size).toBe(1);
    expect(fx.events.published.map((e) => e.type)).toEqual(['identity.passkey.registered']);
  });

  it('registers separate devices for separate ceremonies', async () => {
    await complete.execute({
      userId: fx.userId,
      challenge: await challenge(),
      response: RESPONSE,
      label: 'A',
      deviceLabel: 'Phone',
    });
    fx.verifier.setRegistration(verifiedRegistration({ credentialId: 'cred-BBBB' }));
    await complete.execute({
      userId: fx.userId,
      challenge: await challenge(),
      response: { id: 'cred-BBBB' },
      label: 'B',
      deviceLabel: 'Laptop',
    });
    const devices = await fx.devices.listByUser(toUserId(fx.userId));
    expect(devices).toHaveLength(2);
    expect(devices.map((d) => d.label).sort()).toEqual(['Laptop', 'Phone']);
  });

  it('rejects an unknown or deactivated user', async () => {
    const unknown = await start.execute({ userId: '99999999-9999-4999-8999-999999999999' });
    expect(unknown.ok).toBe(false);

    const user = await fx.users.findById(toUserId(fx.userId));
    user?.deactivate(fx.clock.now());
    if (user) {
      await fx.users.save(user);
    }
    const deactivated = await start.execute({ userId: fx.userId });
    expect(deactivated.ok).toBe(false);
    if (!deactivated.ok) {
      expect(deactivated.error._tag).toBe('UserDeactivatedError');
    }
  });

  it('only one of two concurrent completions succeeds', async () => {
    const c = await challenge();
    const [a, b] = await Promise.all([
      complete.execute({ userId: fx.userId, challenge: c, response: RESPONSE, label: 'A' }),
      complete.execute({ userId: fx.userId, challenge: c, response: RESPONSE, label: 'B' }),
    ]);
    expect([a.ok, b.ok].filter(Boolean)).toHaveLength(1);
    expect(fx.passkeys.size).toBe(1);
  });
});
