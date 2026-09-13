import { type Result, ok, err } from '../../kernel/result';
import type { Clock } from '../../kernel/clock';
import type { SessionSnapshot, RotateSessionError } from '../domain/entities/session';
import type { SessionPolicy } from '../domain/value-objects/session-policy';
import type { SessionRepository } from '../domain/ports/session-repository';
import type { TokenGenerator } from '../domain/ports/token-generator';
import type { TokenHasher } from '../domain/ports/token-hasher';
import type { EventPublisher } from '../domain/ports/event-publisher';
import { SessionNotFoundError } from '../domain/errors';

export interface RefreshSessionCommand {
  refreshToken: string;
}

export interface RefreshSessionResult {
  session: SessionSnapshot;
  /** The next raw refresh-token secret — the presented one is now dead. */
  refreshToken: string;
}

export type RefreshSessionError = SessionNotFoundError | RotateSessionError;

export interface RefreshSessionDeps {
  sessions: SessionRepository;
  tokens: TokenGenerator;
  tokenHasher: TokenHasher;
  policy: SessionPolicy;
  clock: Clock;
  events: EventPublisher;
}

/**
 * Rotate a refresh token (doc 08 §3.4).
 *
 * The presented secret is hashed and resolved against the **whole** family, so a
 * stolen token that was already rotated still finds its session — and trips
 * reuse detection. Because a rejected rotation may itself mutate state (the
 * family is revoked on reuse or expiry), the session is persisted and its events
 * published on the failure path too, not only on success.
 */
export class RefreshSession {
  constructor(private readonly deps: RefreshSessionDeps) {}

  async execute(
    command: RefreshSessionCommand,
  ): Promise<Result<RefreshSessionResult, RefreshSessionError>> {
    const presented = this.deps.tokenHasher.hash(command.refreshToken);
    const session = await this.deps.sessions.findByTokenHash(presented);
    if (session === null) {
      return err(new SessionNotFoundError('unknown'));
    }

    const now = this.deps.clock.now();
    const rawToken = this.deps.tokens.generate();
    const rotation = session.rotate(
      presented,
      this.deps.tokenHasher.hash(rawToken),
      this.deps.policy,
      now,
    );

    await this.deps.sessions.save(session);
    await this.deps.events.publishAll(session.pullEvents());

    if (!rotation.ok) {
      return rotation;
    }
    return ok({ session: session.snapshot(), refreshToken: rawToken });
  }
}
