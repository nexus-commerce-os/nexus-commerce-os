import { type Result, ok, err } from '../../kernel/result';
import type { Clock } from '../../kernel/clock';
import type { SessionRepository } from '../domain/ports/session-repository';
import type { AccessTokenService } from '../domain/ports/access-token-service';
import { isSessionId, toSessionId } from '../domain/value-objects/session-id';
import { InvalidAccessTokenError } from '../domain/errors';

export interface AuthorizeRequestCommand {
  accessToken: string;
}

/** Who the request is acting as. Nothing more: authorization is a later phase. */
export interface Principal {
  readonly userId: string;
  readonly sessionId: string;
}

export interface AuthorizeRequestDeps {
  accessTokens: AccessTokenService;
  sessions: SessionRepository;
  clock: Clock;
}

/**
 * Resolve an access token into the principal it names.
 *
 * A valid signature is necessary but never sufficient. The token is a derived
 * artefact with a fixed lifetime; the Session aggregate is what actually
 * decides whether that lifetime still means anything. So every request
 * re-reads the session and refuses if it has been revoked or has expired —
 * which is what makes logout, logout-all and reuse-detection take effect
 * immediately rather than whenever the token happens to lapse.
 *
 * Every failure collapses into one error. A forged signature, an unknown
 * session and a revoked session are indistinguishable to the caller: telling
 * them apart would let someone probe which session ids are real.
 */
export class AuthorizeRequest {
  constructor(private readonly deps: AuthorizeRequestDeps) {}

  async execute(
    command: AuthorizeRequestCommand,
  ): Promise<Result<Principal, InvalidAccessTokenError>> {
    const verified = await this.deps.accessTokens.verify(command.accessToken);
    if (!verified.ok) {
      return err(verified.error);
    }
    const claims = verified.value;

    if (!isSessionId(claims.sessionId)) {
      return err(new InvalidAccessTokenError('sid is not a session id'));
    }

    const session = await this.deps.sessions.findById(toSessionId(claims.sessionId));
    if (session === null) {
      return err(new InvalidAccessTokenError('session not found'));
    }
    if (!session.isActive(this.deps.clock.now())) {
      return err(new InvalidAccessTokenError('session is no longer active'));
    }
    // A token minted from one session may not speak for another user.
    if (session.userId !== claims.userId) {
      return err(new InvalidAccessTokenError('token does not match the session owner'));
    }

    return ok({ userId: claims.userId, sessionId: claims.sessionId });
  }
}
