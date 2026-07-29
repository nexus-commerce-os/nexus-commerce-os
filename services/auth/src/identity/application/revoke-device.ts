import { type Result, ok, err } from '../../kernel/result';
import type { Clock } from '../../kernel/clock';
import { isUserId, toUserId } from '../domain/value-objects/user-id';
import { isDeviceId, toDeviceId } from '../domain/value-objects/device-id';
import type { DeviceRepository } from '../domain/ports/device-repository';
import type { EventPublisher } from '../domain/ports/event-publisher';
import { DeviceRevoked } from '../domain/events/device-revoked';
import { DeviceNotFoundError } from '../domain/errors';

export interface RevokeDeviceCommand {
  userId: string;
  deviceId: string;
}

export type RevokeDeviceError = DeviceNotFoundError;

export interface RevokeDeviceDeps {
  devices: DeviceRepository;
  clock: Clock;
  events: EventPublisher;
}

/**
 * Disown a device — the "this isn't mine any more" action.
 *
 * Ownership is checked here and a foreign device reads as `DeviceNotFoundError`,
 * so the response cannot probe other accounts. Revocation is terminal and
 * idempotent; a second call emits nothing further.
 *
 * Passkeys bound to the device are **not** cascaded here: credential revocation
 * runs through `RevokePasskey` so the last-factor rule always applies. Sessions
 * likewise react to the emitted event at the I-7 wiring, never by a direct call.
 */
export class RevokeDevice {
  constructor(private readonly deps: RevokeDeviceDeps) {}

  async execute(command: RevokeDeviceCommand): Promise<Result<void, RevokeDeviceError>> {
    if (!isUserId(command.userId) || !isDeviceId(command.deviceId)) {
      return err(new DeviceNotFoundError(command.deviceId));
    }

    const device = await this.deps.devices.findById(toDeviceId(command.deviceId));
    if (device === null || device.userId !== toUserId(command.userId)) {
      return err(new DeviceNotFoundError(command.deviceId));
    }
    if (device.isRevoked()) {
      return ok(undefined);
    }

    const now = this.deps.clock.now();
    device.revoke(now);
    await this.deps.devices.save(device);
    await this.deps.events.publishAll([new DeviceRevoked(device.id, device.userId, now)]);

    return ok(undefined);
  }
}
