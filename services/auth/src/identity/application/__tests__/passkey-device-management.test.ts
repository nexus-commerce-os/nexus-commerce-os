import { describe, it, expect, beforeEach } from 'vitest';
import { StartPasskeyRegistration } from '../start-passkey-registration';
import { CompletePasskeyRegistration } from '../complete-passkey-registration';
import { RevokePasskey } from '../revoke-passkey';
import { ListUserPasskeys } from '../list-user-passkeys';
import { RevokeDevice } from '../revoke-device';
import { toDeviceId } from '../../domain/value-objects/device-id';
import { toUserId } from '../../domain/value-objects/user-id';
import { buildPasskeyFixture, type PasskeyFixture } from '../../__tests__/support';
import { verifiedRegistration } from '../../__tests__/webauthn-doubles';

describe('passkey & device management', () => {
  let fx: PasskeyFixture;
  let revokePasskey: RevokePasskey;
  let listPasskeys: ListUserPasskeys;
  let revokeDevice: RevokeDevice;

  beforeEach(async () => {
    fx = await buildPasskeyFixture();
    revokePasskey = new RevokePasskey(fx);
    listPasskeys = new ListUserPasskeys(fx);
    revokeDevice = new RevokeDevice(fx);
  });

  async function register(
    credentialId: string,
    label: string,
    deviceLabel?: string,
  ): Promise<{ passkeyId: string; deviceId: string }> {
    const start = await new StartPasskeyRegistration(fx).execute({ userId: fx.userId });
    if (!start.ok) {
      throw new Error('fixture invariant broken');
    }
    fx.verifier.setRegistration(verifiedRegistration({ credentialId }));
    const done = await new CompletePasskeyRegistration(fx).execute({
      userId: fx.userId,
      challenge: start.value.challenge,
      response: { id: credentialId },
      label,
      deviceLabel,
    });
    if (!done.ok) {
      throw new Error('fixture invariant broken');
    }
    fx.events.drain();
    return done.value;
  }

  // ── listing ───────────────────────────────────────────────────────────────
  it('lists active credentials and hides revoked ones by default', async () => {
    const first = await register('cred-AAAA', 'Phone');
    await register('cred-BBBB', 'Laptop');

    expect(
      (await revokePasskey.execute({ userId: fx.userId, passkeyId: first.passkeyId })).ok,
    ).toBe(true);

    const active = await listPasskeys.execute({ userId: fx.userId });
    expect(active.ok).toBe(true);
    if (active.ok) {
      expect(active.value.map((p) => p.label)).toEqual(['Laptop']);
    }

    const all = await listPasskeys.execute({ userId: fx.userId, includeRevoked: true });
    expect(all.ok).toBe(true);
    if (all.ok) {
      expect(all.value).toHaveLength(2);
    }
  });

  it('rejects a malformed user id when listing', async () => {
    const result = await listPasskeys.execute({ userId: 'not-a-uuid' });
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.error._tag).toBe('UserNotFoundError');
    }
  });

  // ── revoking credentials ──────────────────────────────────────────────────
  it('revokes a credential and publishes the event', async () => {
    const { passkeyId } = await register('cred-AAAA', 'Phone');
    const result = await revokePasskey.execute({ userId: fx.userId, passkeyId });
    expect(result.ok).toBe(true);
    expect(fx.events.published.map((e) => e.type)).toEqual(['identity.passkey.revoked']);
  });

  it('allows removing the only passkey while a password remains (last-factor rule)', async () => {
    const { passkeyId } = await register('cred-AAAA', 'Phone');
    expect(await fx.passkeys.countActiveByUser(toUserId(fx.userId))).toBe(1);
    const result = await revokePasskey.execute({ userId: fx.userId, passkeyId });
    expect(result.ok).toBe(true);
  });

  it('rejects revoking twice — the credential is no longer active', async () => {
    const { passkeyId } = await register('cred-AAAA', 'Phone');
    await revokePasskey.execute({ userId: fx.userId, passkeyId });
    const again = await revokePasskey.execute({ userId: fx.userId, passkeyId });
    expect(again.ok).toBe(false);
    if (!again.ok) {
      expect(again.error._tag).toBe('PasskeyNotFoundError');
    }
  });

  it("reports another user's credential as not found (no cross-account probing)", async () => {
    const { passkeyId } = await register('cred-AAAA', 'Phone');
    const other = await buildPasskeyFixture();
    const result = await revokePasskey.execute({ userId: other.userId, passkeyId });
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(['PasskeyNotFoundError', 'UserNotFoundError']).toContain(result.error._tag);
    }
  });

  it('rejects malformed ids', async () => {
    expect((await revokePasskey.execute({ userId: 'nope', passkeyId: 'nope' })).ok).toBe(false);
    expect((await revokePasskey.execute({ userId: fx.userId, passkeyId: 'not-a-uuid' })).ok).toBe(
      false,
    );
  });

  // ── revoking devices ──────────────────────────────────────────────────────
  it('revokes a device, publishes the event, and is idempotent', async () => {
    const { deviceId } = await register('cred-AAAA', 'Phone', 'Jane iPhone');

    const first = await revokeDevice.execute({ userId: fx.userId, deviceId });
    expect(first.ok).toBe(true);
    expect(fx.events.published.map((e) => e.type)).toEqual(['identity.device.revoked']);
    fx.events.drain();

    const second = await revokeDevice.execute({ userId: fx.userId, deviceId });
    expect(second.ok).toBe(true);
    expect(fx.events.published).toHaveLength(0);

    const device = await fx.devices.findById(toDeviceId(deviceId));
    expect(device?.trustState).toBe('REVOKED');
  });

  it('leaves the credential itself intact so the last-factor rule still applies', async () => {
    const { passkeyId, deviceId } = await register('cred-AAAA', 'Phone');
    await revokeDevice.execute({ userId: fx.userId, deviceId });

    const list = await listPasskeys.execute({ userId: fx.userId });
    expect(list.ok).toBe(true);
    if (list.ok) {
      expect(list.value.map((p) => p.id)).toContain(passkeyId);
    }
  });

  it("reports another user's device as not found", async () => {
    const { deviceId } = await register('cred-AAAA', 'Phone');
    const other = await buildPasskeyFixture();
    const result = await revokeDevice.execute({ userId: other.userId, deviceId });
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.error._tag).toBe('DeviceNotFoundError');
    }
  });

  it('rejects an unknown or malformed device id', async () => {
    const unknown = await revokeDevice.execute({
      userId: fx.userId,
      deviceId: '88888888-8888-4888-8888-888888888888',
    });
    expect(unknown.ok).toBe(false);
    const malformed = await revokeDevice.execute({ userId: fx.userId, deviceId: 'nope' });
    expect(malformed.ok).toBe(false);
    if (!malformed.ok) {
      expect(malformed.error._tag).toBe('DeviceNotFoundError');
    }
  });

  it('tracks multiple devices independently', async () => {
    const phone = await register('cred-AAAA', 'Phone key', 'Phone');
    const laptop = await register('cred-BBBB', 'Laptop key', 'Laptop');
    expect(phone.deviceId).not.toBe(laptop.deviceId);

    await revokeDevice.execute({ userId: fx.userId, deviceId: phone.deviceId });

    expect((await fx.devices.findById(toDeviceId(phone.deviceId)))?.trustState).toBe('REVOKED');
    expect((await fx.devices.findById(toDeviceId(laptop.deviceId)))?.trustState).toBe('TRUSTED');
  });
});
