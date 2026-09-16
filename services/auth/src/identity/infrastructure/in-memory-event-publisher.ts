import type { DomainEvent } from '../../kernel/domain-event';
import type { EventPublisher } from '../domain/ports/event-publisher';

/**
 * In-memory EventPublisher — a real in-process collector used for tests and
 * local development, and the seam the outbox/Kafka adapter (doc 06 §2) replaces
 * later. Retains published events for inspection.
 */
export class InMemoryEventPublisher implements EventPublisher {
  private readonly _published: DomainEvent[] = [];

  publishAll(events: readonly DomainEvent[]): Promise<void> {
    this._published.push(...events);
    return Promise.resolve();
  }

  get published(): readonly DomainEvent[] {
    return this._published;
  }

  drain(): readonly DomainEvent[] {
    const drained = [...this._published];
    this._published.length = 0;
    return drained;
  }
}
