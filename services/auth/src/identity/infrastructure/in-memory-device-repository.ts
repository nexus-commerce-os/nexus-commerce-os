import type { Device } from '../domain/entities/device';
import type { DeviceId } from '../domain/value-objects/device-id';
import type { UserId } from '../domain/value-objects/user-id';
import type { DeviceRepository } from '../domain/ports/device-repository';

/**
 * In-memory DeviceRepository — a real implementation for tests and local
 * development; the Postgres adapter (I-6) implements the same port.
 */
export class InMemoryDeviceRepository implements DeviceRepository {
  private readonly byId = new Map<DeviceId, Device>();

  findById(id: DeviceId): Promise<Device | null> {
    return Promise.resolve(this.byId.get(id) ?? null);
  }

  listByUser(userId: UserId): Promise<Device[]> {
    const matches: Device[] = [];
    for (const device of this.byId.values()) {
      if (device.userId === userId) {
        matches.push(device);
      }
    }
    return Promise.resolve(matches);
  }

  save(device: Device): Promise<void> {
    this.byId.set(device.id, device);
    return Promise.resolve();
  }

  /** Test/inspection helper: number of stored devices. */
  get size(): number {
    return this.byId.size;
  }
}
