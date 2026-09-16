import type { DomainEvent } from '../../kernel/domain-event';
import type { EventPublisher } from '../domain/ports/event-publisher';

export type EventHandler = (event: DomainEvent) => Promise<void>;

/**
 * In-process {@link EventPublisher} that also dispatches.
 *
 * This is the seam that lets one part of Identity react to another without the
 * two depending on each other: `ResetPassword` publishes `PasswordChanged` and
 * knows nothing about sessions, while a subscriber registered here revokes
 * them. The dependency stays one-way, which is exactly why the use cases were
 * written to emit rather than call.
 *
 * A handler that throws must not swallow the others or fail the publisher: the
 * write that produced the event has already been committed, so a reacting
 * side-effect failing is a *reporting* problem, not a reason to undo it.
 * Failures go to `onHandlerError` for the composition root to log or alert on.
 * The durable, at-least-once version of this is the outbox → Kafka adapter
 * (docs/06 §2), which replaces this class without touching a use case.
 */
export class InProcessEventBus implements EventPublisher {
  private readonly handlers = new Map<string, EventHandler[]>();

  constructor(private readonly onHandlerError: (event: DomainEvent, error: unknown) => void) {}

  /** Register a reaction to one event type. Order of registration is preserved. */
  subscribe(eventType: string, handler: EventHandler): void {
    const existing = this.handlers.get(eventType);
    if (existing === undefined) {
      this.handlers.set(eventType, [handler]);
      return;
    }
    existing.push(handler);
  }

  async publishAll(events: readonly DomainEvent[]): Promise<void> {
    for (const event of events) {
      for (const handler of this.handlers.get(event.type) ?? []) {
        try {
          await handler(event);
        } catch (error) {
          this.onHandlerError(event, error);
        }
      }
    }
  }

  /** Number of handlers registered for a type — for wiring assertions. */
  handlerCount(eventType: string): number {
    return this.handlers.get(eventType)?.length ?? 0;
  }
}
