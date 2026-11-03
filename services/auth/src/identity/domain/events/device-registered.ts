import type { DomainEvent } from '../../../kernel/domain-event';

/** Emitted the first time a device is bound to an account. */
export class DeviceRegistered implements DomainEvent {
  readonly type = 'identity.device.registered';
  constructor(
    public readonly aggregateId: string,
    public readonly userId: string,
    public readonly occurredAt: Date,
  ) {}
}
