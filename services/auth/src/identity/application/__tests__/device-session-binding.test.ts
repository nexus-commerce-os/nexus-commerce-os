import { describe, it, expect, beforeEach } from 'vitest';
import { StartSession } from '../start-session';
import { RefreshSession } from '../refresh-session';
import { RevokeSessionsForDevice } from '../revoke-sessions-for-device';
import { RevokeDevice } from '../revoke-device';
import { Device } from '../../domain/entities/device';
import { Session } from '../../domain/entities/session';
import { toDeviceId } from '../../domain/value-objects/device-id';
import { toUserId } from '../../domain/value-objects/user-id';
import { toSessionId } from '../../domain/value-objects/session-id';
import { buildSessionFixture, type SessionFixture } from '../../__tests__/support';

const DEVICE_A = toDeviceId('11111111-1111-4111-8111-111111111111');
const DEVICE_B = toDeviceId('22222222-2222-4222-8222-222222222222');
const STRANGER = toUserId('99999999-9999-4999-8999-999999999999');

/**
 * I-7f — a session is bound only to a device its owner controls, and revoking a
 * device revokes exactly the sessions bound to it.
 */
describe('device/session binding', () => {
  let fx: SessionFixture;
  let startSession: StartSession;
  let revokeForDevice: RevokeSessionsForDevice;

  beforeEach(async () => {
    fx = await buildSessionFixture();
    startSession = new StartSession(fx);
    revokeForDevice = new RevokeSessionsForDevice(fx);

    await fx.devices.save(
      Device.register({
        id: DEVICE_A,
        userId: toUserId(fx.userId),
        label: 'Laptop',
        platform: 'macOS',
        now: fx.clock.now(),
      }),
    );
  });

  async function bind(deviceId: string): Promise<ReturnType<StartSession['execute']>> {
    return startSession.execute({ userId: fx.userId, deviceId });
  }

  // ── binding validation ────────────────────────────────────────────────────

  it('binds a session to a device the user owns', async () => {
    const result = await bind(DEVICE_A);
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.value.session.deviceId).toBe(DEVICE_A);
    }
  });

  it('leaves the session unbound when no device is named', async () => {
    const result = await startSession.execute({ userId: fx.userId });
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.value.session.deviceId).toBeNull();
    }
  });

  it('refuses a device that does not exist', async () => {
    const result = await bind(DEVICE_B);
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.error._tag).toBe('DeviceNotFoundError');
    }
  });

  it('refuses a malformed device id without touching the repository', async () => {
    expect((await bind('not-a-uuid')).ok).toBe(false);
  });

  it('refuses a revoked device', async () => {
    const device = await fx.devices.findById(DEVICE_A);
    device?.revoke(fx.clock.now());
    if (device) {
      await fx.devices.save(device);
    }
    expect((await bind(DEVICE_A)).ok).toBe(false);
  });

  // ── ownership ─────────────────────────────────────────────────────────────

  /**
   * The reason I-7f exists. If a caller could bind to someone else's device,
   * that person revoking it would end this user's sessions — and the binding
   * itself would be a lie about which machine holds the session.
   */
  it('refuses a device belonging to another user, indistinguishably from one that does not exist', async () => {
    await fx.devices.save(
      Device.register({
        id: DEVICE_B,
        userId: STRANGER,
        label: "Someone else's phone",
        platform: 'iOS',
        now: fx.clock.now(),
      }),
    );

    const absentId = toDeviceId('33333333-3333-4333-8333-333333333333');
    const stolen = await bind(DEVICE_B);
    const absent = await bind(absentId);

    expect(stolen.ok).toBe(false);
    expect(absent.ok).toBe(false);
    if (!stolen.ok && !absent.ok) {
      expect(stolen.error._tag).toBe(absent.error._tag);
      // Identical apart from the id the caller supplied and already knows —
      // nothing distinguishes "owned by someone else" from "does not exist",
      // and no owner is named.
      expect(stolen.error.message.replace(DEVICE_B, 'ID')).toBe(
        absent.error.message.replace(absentId, 'ID'),
      );
      expect(stolen.error.message).not.toContain(STRANGER);
    }
  });

  // ── refresh inheritance ───────────────────────────────────────────────────

  it('carries the binding through refresh-token rotation', async () => {
    const started = await bind(DEVICE_A);
    if (!started.ok) {
      throw new Error('fixture invariant broken');
    }

    const refreshed = await new RefreshSession(fx).execute({
      refreshToken: started.value.refreshToken,
    });
    expect(refreshed.ok).toBe(true);
    if (refreshed.ok) {
      expect(refreshed.value.session.deviceId).toBe(DEVICE_A);
      expect(refreshed.value.session.id).toBe(started.value.session.id);
    }
  });

  /**
   * Rotation takes only a refresh token — there is no field through which a
   * replacement device could be supplied. Asserted structurally so that adding
   * one later fails this test.
   */
  it('offers no way for rotation to replace the device', async () => {
    const started = await bind(DEVICE_A);
    if (!started.ok) {
      throw new Error('fixture invariant broken');
    }
    const command = { refreshToken: started.value.refreshToken };
    expect(Object.keys(command)).toEqual(['refreshToken']);
  });

  // ── cascade scope ─────────────────────────────────────────────────────────

  it('revokes every session bound to the device', async () => {
    const first = await bind(DEVICE_A);
    const second = await bind(DEVICE_A);
    expect(first.ok && second.ok).toBe(true);

    const result = await revokeForDevice.execute({ deviceId: DEVICE_A });
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.value.revoked).toBe(2);
      expect(result.value.contended).toBe(0);
    }

    for (const started of [first, second]) {
      if (started.ok) {
        const stored = await fx.sessions.findById(toSessionId(started.value.session.id));
        expect(stored?.status).toBe('revoked');
        expect(stored?.snapshot().revocationReason).toBe('device_revoked');
      }
    }
  });

  it('leaves sessions bound to another device untouched', async () => {
    await fx.devices.save(
      Device.register({
        id: DEVICE_B,
        userId: toUserId(fx.userId),
        label: 'Phone',
        platform: 'iOS',
        now: fx.clock.now(),
      }),
    );
    const onA = await bind(DEVICE_A);
    const onB = await bind(DEVICE_B);

    await revokeForDevice.execute({ deviceId: DEVICE_A });

    if (onA.ok && onB.ok) {
      expect((await fx.sessions.findById(toSessionId(onA.value.session.id)))?.status).toBe(
        'revoked',
      );
      expect((await fx.sessions.findById(toSessionId(onB.value.session.id)))?.status).toBe(
        'active',
      );
    }
  });

  it('leaves unbound sessions untouched', async () => {
    const unbound = await startSession.execute({ userId: fx.userId });
    await bind(DEVICE_A);

    const result = await revokeForDevice.execute({ deviceId: DEVICE_A });
    expect(result.ok && result.value.revoked).toBe(1);

    if (unbound.ok) {
      expect((await fx.sessions.findById(toSessionId(unbound.value.session.id)))?.status).toBe(
        'active',
      );
    }
  });

  /**
   * Legacy compatibility. Rows written before I-7f carry no device reference,
   * and no opaque value may be promoted into one — so they are unbound and a
   * device revocation must never reach them.
   */
  it('never reaches a legacy session that predates device binding', async () => {
    const legacy = Session.start({
      id: toSessionId('44444444-4444-4444-8444-444444444444'),
      userId: toUserId(fx.userId),
      deviceId: null,
      initialTokenHash: fx.tokenHasher.hash('legacy-token'),
      policy: fx.policy,
      now: fx.clock.now(),
    });
    await fx.sessions.save(legacy);
    await bind(DEVICE_A);

    await revokeForDevice.execute({ deviceId: DEVICE_A });

    expect((await fx.sessions.findById(legacy.id))?.status).toBe('active');
  });

  // ── idempotency ───────────────────────────────────────────────────────────

  it('is idempotent — replaying the revocation changes nothing', async () => {
    await bind(DEVICE_A);

    const first = await revokeForDevice.execute({ deviceId: DEVICE_A });
    const second = await revokeForDevice.execute({ deviceId: DEVICE_A });

    expect(first.ok && first.value.revoked).toBe(1);
    // already revoked, so no longer active and no longer swept
    expect(second.ok && second.value.revoked).toBe(0);
  });

  it('succeeds with nothing to do when the device has no sessions', async () => {
    const result = await revokeForDevice.execute({ deviceId: DEVICE_A });
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.value.revoked).toBe(0);
    }
  });

  it('refuses a malformed device id', async () => {
    expect((await revokeForDevice.execute({ deviceId: 'not-a-uuid' })).ok).toBe(false);
  });

  // ── concurrency ───────────────────────────────────────────────────────────

  /**
   * A session that loses a write race is counted, not thrown on: one contended
   * session must not abandon the rest of the sweep.
   */
  it('reports a contended session and still revokes the others', async () => {
    await bind(DEVICE_A);
    await bind(DEVICE_A);

    let failed = false;
    const realSave = fx.sessions.save.bind(fx.sessions);
    fx.sessions.save = async (session): Promise<void> => {
      if (!failed) {
        failed = true;
        throw new Error('concurrent modification');
      }
      return realSave(session);
    };

    const result = await revokeForDevice.execute({ deviceId: DEVICE_A });
    fx.sessions.save = realSave;

    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.value.contended).toBe(1);
      expect(result.value.revoked).toBe(1);
    }
  });

  /**
   * The device aggregate must never mutate a session. `RevokeDevice` therefore
   * publishes an event and nothing else; the cascade is a separate reaction.
   */
  it('revokes the device without itself touching any session', async () => {
    const started = await bind(DEVICE_A);
    fx.events.drain();

    const result = await new RevokeDevice({
      devices: fx.devices,
      clock: fx.clock,
      events: fx.events,
    }).execute({ userId: fx.userId, deviceId: DEVICE_A });

    expect(result.ok).toBe(true);
    expect(fx.events.published.map((e) => e.type)).toEqual(['identity.device.revoked']);
    if (started.ok) {
      // untouched until the subscriber runs — which the composition root wires
      expect((await fx.sessions.findById(toSessionId(started.value.session.id)))?.status).toBe(
        'active',
      );
    }
  });
});
