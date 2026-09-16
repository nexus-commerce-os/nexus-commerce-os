import { type Result, ok } from '../../kernel/result';
import { Email } from '../domain/value-objects/email';
import type { UserRepository } from '../domain/ports/user-repository';
import type { EventPublisher } from '../domain/ports/event-publisher';
import { PasswordResetRequested } from '../domain/events/password-reset-requested';
import {
  issueVerificationToken,
  type IssueVerificationTokenDeps,
} from './issue-verification-token';

export interface RequestPasswordResetCommand {
  email: string;
}

/**
 * Deliberately constant-shaped. `rawToken` is present **only** when a link was
 * genuinely minted; the caller (I-7 HTTP layer) returns the same 202 either way,
 * so a probe cannot tell a real account from a fabricated one.
 */
export interface RequestPasswordResetResult {
  rawToken: string | null;
  expiresAt: Date | null;
}

export interface RequestPasswordResetDeps extends IssueVerificationTokenDeps {
  users: UserRepository;
  events: EventPublisher;
}

/**
 * Start a password reset.
 *
 * **Never fails.** A malformed address, an unknown account, and a deactivated
 * account all resolve `ok` with a null token — the anti-enumeration rule, the
 * same posture `AuthenticateUser` takes by collapsing every credential failure
 * into one error (docs/08 threat X7: account recovery is an ATO target).
 */
export class RequestPasswordReset {
  constructor(private readonly deps: RequestPasswordResetDeps) {}

  async execute(
    command: RequestPasswordResetCommand,
  ): Promise<Result<RequestPasswordResetResult, never>> {
    const emailResult = Email.create(command.email);
    if (!emailResult.ok) {
      return ok({ rawToken: null, expiresAt: null });
    }

    const user = await this.deps.users.findByEmail(emailResult.value);
    if (user === null || !user.isActive()) {
      return ok({ rawToken: null, expiresAt: null });
    }

    const issued = await issueVerificationToken(this.deps, user, 'password_reset');
    await this.deps.events.publishAll([
      new PasswordResetRequested(
        issued.token.id,
        user.id,
        user.email.value,
        issued.token.createdAt,
      ),
    ]);

    return ok({ rawToken: issued.rawToken, expiresAt: issued.token.expiresAt });
  }
}
