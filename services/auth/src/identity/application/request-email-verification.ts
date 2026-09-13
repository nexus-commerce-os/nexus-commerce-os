import { type Result, ok, err } from '../../kernel/result';
import { isUserId, toUserId } from '../domain/value-objects/user-id';
import type { UserRepository } from '../domain/ports/user-repository';
import type { EventPublisher } from '../domain/ports/event-publisher';
import { EmailVerificationRequested } from '../domain/events/email-verification-requested';
import {
  UserNotFoundError,
  UserDeactivatedError,
  EmailAlreadyVerifiedError,
} from '../domain/errors';
import {
  issueVerificationToken,
  type IssueVerificationTokenDeps,
} from './issue-verification-token';

export interface RequestEmailVerificationCommand {
  userId: string;
}

export interface RequestEmailVerificationResult {
  /** Raw link secret — hand straight to the mailer; it is never stored or logged. */
  rawToken: string;
  email: string;
  expiresAt: Date;
}

export type RequestEmailVerificationError =
  UserNotFoundError | UserDeactivatedError | EmailAlreadyVerifiedError;

export interface RequestEmailVerificationDeps extends IssueVerificationTokenDeps {
  users: UserRepository;
  events: EventPublisher;
}

/**
 * Mint an email-verification link for a signed-in user.
 *
 * Unlike password reset this is an authenticated action — the caller already
 * knows the account exists — so real errors are safe to return here.
 */
export class RequestEmailVerification {
  constructor(private readonly deps: RequestEmailVerificationDeps) {}

  async execute(
    command: RequestEmailVerificationCommand,
  ): Promise<Result<RequestEmailVerificationResult, RequestEmailVerificationError>> {
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
    if (user.emailVerified) {
      return err(new EmailAlreadyVerifiedError(user.id));
    }

    const issued = await issueVerificationToken(this.deps, user, 'email_verification');
    await this.deps.events.publishAll([
      new EmailVerificationRequested(
        issued.token.id,
        user.id,
        user.email.value,
        issued.token.createdAt,
      ),
    ]);

    return ok({
      rawToken: issued.rawToken,
      email: user.email.value,
      expiresAt: issued.token.expiresAt,
    });
  }
}
