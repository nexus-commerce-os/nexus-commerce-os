import { describe, it, expect, beforeEach } from 'vitest';
import { registerIdentitySubscribers } from '../identity-container';
import { InProcessEventBus } from '../../identity/infrastructure/in-process-event-bus';
import { InMemorySessionRepository } from '../../identity/infrastructure/in-memory-session-repository';
import { InMemoryDeviceRepository } from '../../identity/infrastructure/in-memory-device-repository';
import { RevokeSessionsForDevice } from '../../identity/application/revoke-sessions-for-device';
import { RevokeDevice } from '../../identity/application/revoke-device';
import { Device } from '../../identity/domain/entities/device';
import { toDeviceId } from '../../identity/domain/value-objects/device-id';
import { toSessionId } from '../../identity/domain/value-objects/session-id';
import { InMemoryUserRepository } from '../../identity/infrastructure/in-memory-user-repository';
import { ScryptPasswordHasher } from '../../identity/infrastructure/scrypt-password-hasher';
import { RandomTokenGenerator } from '../../identity/infrastructure/random-token-generator';
import { Sha256TokenHasher } from '../../identity/infrastructure/sha256-token-hasher';
import { UuidIdGenerator } from '../../identity/infrastructure/uuid-id-generator';
import { RevokeAllUserSessions } from '../../identity/application/revoke-all-user-sessions';
import { RegisterUser } from '../../identity/application/register-user';
import { StartSession } from '../../identity/application/start-session';
import { RefreshSession } from '../../identity/application/refresh-session';
import { ChangePassword } from '../../identity/application/change-password';
import { DefaultPasswordPolicy } from '../../identity/domain/value-objects/password-policy';
import { DefaultSessionPolicy } from '../../identity/domain/value-objects/session-policy';
import { PasswordChanged } from '../../identity/domain/events/password-changed';
import { toUserId } from '../../identity/domain/value-objects/user-id';
import {
  FakeClock,
  STRONG_PASSWORD,
  OTHER_STRONG_PASSWORD,
} from '../../identity/__tests__/support';

const NOW = new Date('2026-01-01T00:00:00.000Z');

describe('identity event subscribers', () => {
  let events: InProcessEventBus;
  let users: InMemoryUserRepository;
  let sessions: InMemorySessionRepository;
  let clock: FakeClock;
  let userId: string;
  let refreshTokens: string[];

  beforeEach(async () => {
    clock = new FakeClock(NOW);
    users = new InMemoryUserRepository();
    sessions = new InMemorySessionRepository();
    events = new InProcessEventBus(() => {});
    const ids = new UuidIdGenerator();
    const hasher = new ScryptPasswordHasher();

    registerIdentitySubscribers(
      events,
      new RevokeAllUserSessions({ sessions, clock, events }),
      new RevokeSessionsForDevice({ sessions, clock, events }),
    );

    const registered = await new RegisterUser({
      users,
      hasher,
      policy: new DefaultPasswordPolicy(),
      ids,
      clock,
      events,
    }).execute({ email: 'jane@example.com', password: STRONG_PASSWORD, displayName: 'Jane' });
    if (!registered.ok) {
      throw new Error('fixture invariant broken');
    }
    userId = registered.value.id;

    // two live sessions, as if the user were signed in on two devices
    const startSession = new StartSession({
      sessions,
      users,
      devices: new InMemoryDeviceRepository(),
      tokens: new RandomTokenGenerator(),
      tokenHasher: new Sha256TokenHasher(),
      policy: new DefaultSessionPolicy(),
      ids,
      clock,
      events,
    });
    refreshTokens = [];
    for (let i = 0; i < 2; i += 1) {
      const started = await startSession.execute({ userId });
      if (!started.ok) {
        throw new Error('fixture invariant broken');
      }
      refreshTokens.push(started.value.refreshToken);
    }
  });

  it('wires exactly one handler for PasswordChanged', () => {
    expect(events.handlerCount('identity.user.password_changed')).toBe(1);
  });

  it('revokes every session when PasswordChanged is published', async () => {
    await events.publishAll([new PasswordChanged(userId, clock.now())]);

    const all = await sessions.listByUser(toUserId(userId));
    expect(all).toHaveLength(2);
    expect(all.every((s) => s.status === 'revoked')).toBe(true);
    expect(all.every((s) => s.revocationReason === 'password_changed')).toBe(true);
  });

  /**
   * The behaviour I-3 promised and deferred: changing a password must not leave
   * a stolen session alive (docs/08 threat X7). `ChangePassword` still knows
   * nothing about sessions — the event is what connects them.
   */
  it('a password change kills the refresh tokens issued before it', async () => {
    const refresher = new RefreshSession({
      sessions,
      tokens: new RandomTokenGenerator(),
      tokenHasher: new Sha256TokenHasher(),
      policy: new DefaultSessionPolicy(),
      clock,
      events,
    });

    const changed = await new ChangePassword({
      users,
      hasher: new ScryptPasswordHasher(),
      policy: new DefaultPasswordPolicy(),
      clock,
      events,
    }).execute({
      userId,
      currentPassword: STRONG_PASSWORD,
      newPassword: OTHER_STRONG_PASSWORD,
    });
    expect(changed.ok).toBe(true);

    for (const token of refreshTokens) {
      const refreshed = await refresher.execute({ refreshToken: token });
      expect(refreshed.ok).toBe(false);
      if (!refreshed.ok) {
        expect(refreshed.error._tag).toBe('SessionRevokedError');
      }
    }
  });

  it('leaves other users untouched', async () => {
    const other = toUserId('99999999-9999-4999-8999-999999999999');
    await events.publishAll([new PasswordChanged(other, clock.now())]);

    const mine = await sessions.listByUser(toUserId(userId));
    expect(mine.every((s) => s.status === 'active')).toBe(true);
  });
});

describe('InProcessEventBus', () => {
  it('dispatches to every handler of a type, in registration order', async () => {
    const seen: string[] = [];
    const bus = new InProcessEventBus(() => {});
    bus.subscribe('a.b', async () => {
      seen.push('first');
    });
    bus.subscribe('a.b', async () => {
      seen.push('second');
    });

    await bus.publishAll([{ type: 'a.b', aggregateId: 'x', occurredAt: NOW }]);
    expect(seen).toEqual(['first', 'second']);
  });

  it('ignores an event nobody subscribed to', async () => {
    const bus = new InProcessEventBus(() => {});
    await expect(
      bus.publishAll([{ type: 'nobody.listens', aggregateId: 'x', occurredAt: NOW }]),
    ).resolves.toBeUndefined();
  });

  /**
   * The write that produced the event is already committed, so one failing
   * reaction must not undo it or silence the others — it is reported instead.
   */
  it('reports a throwing handler and still runs the rest', async () => {
    const reported: unknown[] = [];
    const seen: string[] = [];
    const bus = new InProcessEventBus((_event, error) => reported.push(error));
    bus.subscribe('a.b', async () => {
      throw new Error('handler exploded');
    });
    bus.subscribe('a.b', async () => {
      seen.push('still ran');
    });

    await expect(
      bus.publishAll([{ type: 'a.b', aggregateId: 'x', occurredAt: NOW }]),
    ).resolves.toBeUndefined();
    expect(reported).toHaveLength(1);
    expect(seen).toEqual(['still ran']);
  });
});

/**
 * I-7f — `DeviceRevoked` reaches sessions only through the subscriber the
 * composition root wires. `RevokeDevice` never touches a Session aggregate, so
 * this is the test that proves the two are actually connected in production
 * wiring rather than only in principle.
 */
describe('DeviceRevoked → session revocation (I-7f)', () => {
  it('revokes sessions bound to the device and leaves the rest alone', async () => {
    const clock = new FakeClock(new Date('2026-01-01T00:00:00.000Z'));
    const users = new InMemoryUserRepository();
    const sessions = new InMemorySessionRepository();
    const devices = new InMemoryDeviceRepository();
    const bus = new InProcessEventBus((_event, error) => {
      throw error;
    });
    const ids = new UuidIdGenerator();

    registerIdentitySubscribers(
      bus,
      new RevokeAllUserSessions({ sessions, clock, events: bus }),
      new RevokeSessionsForDevice({ sessions, clock, events: bus }),
    );

    const registered = await new RegisterUser({
      users,
      hasher: new ScryptPasswordHasher(),
      policy: new DefaultPasswordPolicy(),
      ids,
      clock,
      events: bus,
    }).execute({ email: 'dev@example.com', password: STRONG_PASSWORD, displayName: 'Dev' });
    if (!registered.ok) {
      throw new Error('fixture invariant broken');
    }

    const deviceId = toDeviceId('55555555-5555-4555-8555-555555555555');
    await devices.save(
      Device.register({
        id: deviceId,
        userId: toUserId(registered.value.id),
        label: 'Laptop',
        platform: 'macOS',
        now: clock.now(),
      }),
    );

    const startSession = new StartSession({
      sessions,
      users,
      devices,
      tokens: new RandomTokenGenerator(),
      tokenHasher: new Sha256TokenHasher(),
      policy: new DefaultSessionPolicy(),
      ids,
      clock,
      events: bus,
    });
    const bound = await startSession.execute({ userId: registered.value.id, deviceId });
    const unbound = await startSession.execute({ userId: registered.value.id });
    if (!bound.ok || !unbound.ok) {
      throw new Error('fixture invariant broken');
    }

    const revoked = await new RevokeDevice({ devices, clock, events: bus }).execute({
      userId: registered.value.id,
      deviceId,
    });
    expect(revoked.ok).toBe(true);

    expect((await sessions.findById(toSessionId(bound.value.session.id)))?.status).toBe('revoked');
    expect((await sessions.findById(toSessionId(unbound.value.session.id)))?.status).toBe('active');
  });
});
