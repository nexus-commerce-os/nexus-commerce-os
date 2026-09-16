import { type Result, ok, err } from '../../kernel/result';
import { isUserId, toUserId } from '../domain/value-objects/user-id';
import type { UserRepository } from '../domain/ports/user-repository';
import { UserNotFoundError, UserDeactivatedError } from '../domain/errors';
import { issueWebAuthnChallenge, type IssueChallengeDeps } from './issue-webauthn-challenge';

export interface StartPasskeyRegistrationCommand {
  userId: string;
}

export interface StartPasskeyRegistrationResult {
  /** Raw nonce for the client's `navigator.credentials.create()` call. */
  challenge: string;
  expiresAt: Date;
}

export type StartPasskeyRegistrationError = UserNotFoundError | UserDeactivatedError;

export interface StartPasskeyRegistrationDeps extends IssueChallengeDeps {
  users: UserRepository;
}

/**
 * Begin registering an authenticator for a signed-in user.
 *
 * Authenticated action — the caller already knows the account exists, so real
 * errors are safe here (unlike the authentication ceremony, which must stay
 * constant-shaped).
 */
export class StartPasskeyRegistration {
  constructor(private readonly deps: StartPasskeyRegistrationDeps) {}

  async execute(
    command: StartPasskeyRegistrationCommand,
  ): Promise<Result<StartPasskeyRegistrationResult, StartPasskeyRegistrationError>> {
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

    const issued = await issueWebAuthnChallenge(this.deps, user.id, 'registration');
    return ok({ challenge: issued.rawChallenge, expiresAt: issued.challenge.expiresAt });
  }
}
