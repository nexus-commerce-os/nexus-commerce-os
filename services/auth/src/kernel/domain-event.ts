/**
 * Base shape for a domain event.
 *
 * Identity is a bounded context in a modular monolith: it communicates state
 * changes to other modules only through typed events (never shared DB access,
 * per ADR-0020). Every concrete event carries a stable `type`, the aggregate it
 * concerns, and when it occurred.
 */
export interface DomainEvent {
  /** Stable, namespaced event name, e.g. `identity.user.registered`. */
  readonly type: string;
  /** Id of the aggregate that emitted the event. */
  readonly aggregateId: string;
  /** Domain time at which the event occurred (supplied by the Clock port). */
  readonly occurredAt: Date;
}
