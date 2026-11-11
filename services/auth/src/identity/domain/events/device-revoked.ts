import type { DomainEvent } from '../../../kernel/domain-event';

/** Emitted when a device is disowned. Terminal for that device. */
export class DeviceRevoked implements DomainEvent {
  readonly type = 'identity.device.revoked';
  constructor(
    public readonly aggregateId: string,
    public readonly userId: string,
    public readonly occurredAt: Date,
  ) {}
}
