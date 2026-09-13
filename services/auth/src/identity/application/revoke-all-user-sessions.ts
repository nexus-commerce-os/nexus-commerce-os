import { type Result, ok, err } from '../../kernel/result';
import type { Clock } from '../../kernel/clock';
import { isUserId, toUserId } from '../domain/value-objects/user-id';
import type { SessionRevocationReason } from '../domain/value-objects/session-revocation-reason';
import type { SessionRepository } from '../domain/ports/session-repository';
import type { EventPublisher } from '../domain/ports/event-publisher';
import { UserNotFoundError } from '../domain/errors';

/** Reasons a caller may sweep every session; expiry reasons are aggregate-internal. */
export type BulkRevocationReason = Extract<
  SessionRevocationReason,
  'user_revoked' | 'admin_revoked' | 'password_changed'
>;

export interface RevokeAllUserSessionsCommand {
  userId: string;
  reason?: BulkRevocationReason;
  /** Optionally keep one session alive — "sign out everywhere else". */
  exceptSessionId?: string;
}

export type RevokeAllUserSessionsError = UserNotFoundError;

export interface RevokeAllUserSessionsDeps {
  sessions: SessionRepository;
  clock: Clock;
  events: EventPublisher;
}

/**
 * Revoke every session of a user (global sign-out, admin action, or the
 * `PasswordChanged` reaction wired at composition time — I-7).
 *
 * Resolves to the number of sessions actually revoked; already-revoked sessions
 * are skipped rather than re-emitting events.
 */
export class RevokeAllUserSessions {
  constructor(private readonly deps: RevokeAllUserSessionsDeps) {}

  async execute(
    command: RevokeAllUserSessionsCommand,
  ): Promise<Result<number, RevokeAllUserSessionsError>> {
    if (!isUserId(command.userId)) {
      return err(new UserNotFoundError(command.userId));
    }

    const reason: BulkRevocationReason = command.reason ?? 'user_revoked';
    const now = this.deps.clock.now();
    const sessions = await this.deps.sessions.listByUser(toUserId(command.userId));

    let revoked = 0;
    for (const session of sessions) {
      if (session.status === 'revoked' || session.id === command.exceptSessionId) {
        continue;
      }
      session.revoke(reason, now);
      await this.deps.sessions.save(session);
      await this.deps.events.publishAll(session.pullEvents());
      revoked += 1;
    }

    return ok(revoked);
  }
}
