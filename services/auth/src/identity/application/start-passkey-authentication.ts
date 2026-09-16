import { type Result, ok } from '../../kernel/result';
import { Email } from '../domain/value-objects/email';
import type { UserId } from '../domain/value-objects/user-id';
import type { UserRepository } from '../domain/ports/user-repository';
import { issueWebAuthnChallenge, type IssueChallengeDeps } from './issue-webauthn-challenge';

export interface StartPasskeyAuthenticationCommand {
  /** Optional: omit entirely for a discoverable-credential ("usernameless") sign-in. */
  email?: string;
}

export interface StartPasskeyAuthenticationResult {
  challenge: string;
  expiresAt: Date;
}

export interface StartPasskeyAuthenticationDeps extends IssueChallengeDeps {
  users: UserRepository;
}

/**
 * Begin a passkey sign-in.
 *
 * **Never fails, and the response is always the same shape.** A malformed
 * address, an unknown account, a deactivated account and an account with no
 * passkeys all receive a genuine, live challenge — it simply is not bound to a
 * user, so nothing can complete it. That keeps "does this address have a
 * passkey?" unanswerable from the outside (docs/08 threat X7), matching the
 * posture `RequestPasswordReset` takes.
 *
 * The work performed is deliberately identical on both paths: a challenge is
 * always minted and stored, so response timing does not leak the answer either.
 */
export class StartPasskeyAuthentication {
  constructor(private readonly deps: StartPasskeyAuthenticationDeps) {}

  async execute(
    command: StartPasskeyAuthenticationCommand,
  ): Promise<Result<StartPasskeyAuthenticationResult, never>> {
    const boundUser = await this.resolveBinding(command.email);
    const issued = await issueWebAuthnChallenge(this.deps, boundUser, 'authentication');
    return ok({ challenge: issued.rawChallenge, expiresAt: issued.challenge.expiresAt });
  }

  /** The user to bind to, or null when we must not reveal that there is one. */
  private async resolveBinding(email?: string): Promise<UserId | null> {
    if (email === undefined) {
      return null;
    }
    const parsed = Email.create(email);
    if (!parsed.ok) {
      return null;
    }
    const user = await this.deps.users.findByEmail(parsed.value);
    if (user === null || !user.isActive()) {
      return null;
    }
    return user.id;
  }
}
