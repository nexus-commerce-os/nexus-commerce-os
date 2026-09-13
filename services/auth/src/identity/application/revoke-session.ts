import { type Result, ok, err } from '../../kernel/result';
import type { Clock } from '../../kernel/clock';
import { isSessionId, toSessionId } from '../domain/value-objects/session-id';
import { isUserId, toUserId } from '../domain/value-objects/user-id';
import type { SessionRepository } from '../domain/ports/session-repository';
import type { EventPublisher } from '../domain/ports/event-publisher';
import { SessionNotFoundError } from '../domain/errors';

export interface RevokeSessionCommand {
  sessionId: string;
  /** Owner of the session; a mismatch is reported as "not found". */
  userId: string;
}

export type RevokeSessionError = SessionNotFoundError;

export interface RevokeSessionDeps {
  sessions: SessionRepository;
  clock: Clock;
  events: EventPublisher;
}

/**
 * Revoke a single session — the "sign out this device" action behind
 * concurrent-session visibility + remote revoke (doc 08 §3.4).
 *
 * Ownership is checked here and a foreign session is reported as
 * `SessionNotFoundError`, so the response cannot be used to probe for the
 * existence of other users' sessions.
 */
export class RevokeSession {
  constructor(private readonly deps: RevokeSessionDeps) {}

  async execute(command: RevokeSessionCommand): Promise<Result<void, RevokeSessionError>> {
    if (!isSessionId(command.sessionId) || !isUserId(command.userId)) {
      return err(new SessionNotFoundError(command.sessionId));
    }

    const session = await this.deps.sessions.findById(toSessionId(command.sessionId));
    if (session === null || session.userId !== toUserId(command.userId)) {
      return err(new SessionNotFoundError(command.sessionId));
    }

    session.revoke('user_revoked', this.deps.clock.now());
    await this.deps.sessions.save(session);
    await this.deps.events.publishAll(session.pullEvents());

    return ok(undefined);
  }
}
