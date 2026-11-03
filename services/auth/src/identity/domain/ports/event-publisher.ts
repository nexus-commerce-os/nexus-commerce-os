import type { DomainEvent } from '../../../kernel/domain-event';

/**
 * EventPublisher port — the outbound channel for domain events. Use cases pull
 * events from the aggregate after a successful save and publish them here; the
 * concrete transport (in-process collector now, Kafka/outbox later — doc 06 §2)
 * is an infrastructure detail.
 */
export interface EventPublisher {
  publishAll(events: readonly DomainEvent[]): Promise<void>;
}
