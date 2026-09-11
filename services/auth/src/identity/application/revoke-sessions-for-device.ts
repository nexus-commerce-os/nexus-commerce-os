import { type Result, ok, err } from '../../kernel/result';
import type { Clock } from '../../kernel/clock';
import type { SessionRepository } from '../domain/ports/session-repository';
import type { EventPublisher } from '../domain/ports/event-publisher';
import { isDeviceId, toDeviceId } from '../domain/value-objects/device-id';
import { DeviceNotFoundError } from '../domain/errors';

export interface RevokeSessionsForDeviceCommand {
  deviceId: string;
}

export interface RevokeSessionsForDeviceResult {
  /** Sessions actually revoked by this call. Zero is a normal outcome. */
  readonly revoked: number;
  /**
   * Sessions that lost a write race and were left alone. Reported rather than
   * retried here: durable retry arrives with the outbox.
   */
  readonly contended: number;
}

export interface RevokeSessionsForDeviceDeps {
  sessions: SessionRepository;
  clock: Clock;
  events: EventPublisher;
}

/**
 * Revoke every active session bound to a device.
 *
 * Reached only through the `DeviceRevoked` subscriber, never called by
 * `RevokeDevice` itself — the device aggregate must not mutate sessions, so the
 * two stay connected by an event rather than by a dependency.
 *
 * Scope is exact: sessions **explicitly bound** to this device. Never every
 * session of the user, never a session bound elsewhere, and never a legacy
 * unbound session — those carry no device reference at all, and inferring one
 * from an old opaque value is precisely what I-7f exists to stop.
 *
 * Each session is revoked independently. One lost write race must not abandon
 * the rest, so contention is counted and reported rather than thrown on the
 * first failure.
 */
export class RevokeSessionsForDevice {
  constructor(private readonly deps: RevokeSessionsForDeviceDeps) {}

  async execute(
    command: RevokeSessionsForDeviceCommand,
  ): Promise<Result<RevokeSessionsForDeviceResult, DeviceNotFoundError>> {
    if (!isDeviceId(command.deviceId)) {
      return err(new DeviceNotFoundError(command.deviceId));
    }

    const sessions = await this.deps.sessions.listActiveByDevice(toDeviceId(command.deviceId));
    const now = this.deps.clock.now();
    let revoked = 0;
    let contended = 0;

    for (const session of sessions) {
      session.revoke('device_revoked', now);
      try {
        await this.deps.sessions.save(session);
      } catch {
        // Someone else wrote first. Their write either revoked it too or
        // rotated a token, and the retry will see a revoked session.
        contended += 1;
        continue;
      }
      await this.deps.events.publishAll(session.pullEvents());
      revoked += 1;
    }

    return ok({ revoked, contended });
  }
}
