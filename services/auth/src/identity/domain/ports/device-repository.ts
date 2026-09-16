import type { Device } from '../entities/device';
import type { DeviceId } from '../value-objects/device-id';
import type { UserId } from '../value-objects/user-id';

/** DeviceRepository port — persistence boundary for the Device aggregate. */
export interface DeviceRepository {
  findById(id: DeviceId): Promise<Device | null>;
  listByUser(userId: UserId): Promise<Device[]>;
  save(device: Device): Promise<void>;
}
