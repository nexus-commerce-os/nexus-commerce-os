import { type Result, ok, err } from '../../kernel/result';
import type { Clock } from '../../kernel/clock';
import type { IdGenerator } from '../../kernel/id-generator';
import { Session, type SessionSnapshot } from '../domain/entities/session';
import { toSessionId } from '../domain/value-objects/session-id';
import { isUserId, toUserId } from '../domain/value-objects/user-id';
import type { SessionPolicy } from '../domain/value-objects/session-policy';
import type { SessionRepository } from '../domain/ports/session-repository';
import type { UserRepository } from '../domain/ports/user-repository';
import type { TokenGenerator } from '../domain/ports/token-generator';
import type { TokenHasher } from '../domain/ports/token-hasher';
import type { EventPublisher } from '../domain/ports/event-publisher';
import { UserNotFoundError, UserDeactivatedError } from '../domain/errors';

export interface StartSessionCommand {
  userId: string;
  /** Opaque device/passkey reference this session is bound to (doc 08 §3.4). */
  deviceBinding?: string;
}

export interface StartSessionResult {
  session: SessionSnapshot;
  /** The raw refresh-token secret — returned **once**; only its hash is stored. */
  refreshToken: string;
}

export type StartSessionError = UserNotFoundError | UserDeactivatedError;

export interface StartSessionDeps {
  sessions: SessionRepository;
  users: UserRepository;
  tokens: TokenGenerator;
  tokenHasher: TokenHasher;
  policy: SessionPolicy;
  ids: IdGenerator;
  clock: Clock;
  events: EventPublisher;
}

/**
 * Open a session for an already-authenticated user (the caller performs
 * authentication; this use case never sees a password). Issues generation 1 of
 * the refresh-token family and publishes `SessionStarted`.
 */
export class StartSession {
  constructor(private readonly deps: StartSessionDeps) {}

  async execute(
    command: StartSessionCommand,
  ): Promise<Result<StartSessionResult, StartSessionError>> {
    if (!isUserId(command.userId)) {
      return err(new UserNotFoundError(command.userId));
    }

    const user = await this.deps.users.findById(toUserId(command.userId));
    if (user === null) {
      return err(new UserNotFoundError(command.userId));
    }
    if (!user.isActive()) {
      return err(new UserDeactivatedError(user.id));
    }

    const now = this.deps.clock.now();
    const rawToken = this.deps.tokens.generate();
    const session = Session.start({
      id: toSessionId(this.deps.ids.generate()),
      userId: user.id,
      deviceBinding: command.deviceBinding ?? null,
      initialTokenHash: this.deps.tokenHasher.hash(rawToken),
      policy: this.deps.policy,
      now,
    });

    await this.deps.sessions.save(session);
    await this.deps.events.publishAll(session.pullEvents());

    return ok({ session: session.snapshot(), refreshToken: rawToken });
  }
}
