import { type Result, ok, err } from '../../kernel/result';
import { Email } from '../domain/value-objects/email';
import type { UserSnapshot } from '../domain/entities/user';
import type { UserRepository } from '../domain/ports/user-repository';
import type { PasswordHasher } from '../domain/ports/password-hasher';
import { InvalidCredentialsError, UserDeactivatedError } from '../domain/errors';

export interface AuthenticateUserCommand {
  email: string;
  password: string;
}

export type AuthenticateUserError = InvalidCredentialsError | UserDeactivatedError;

export interface AuthenticateUserDeps {
  users: UserRepository;
  hasher: PasswordHasher;
}

/**
 * Verify an email + password pair. A malformed email, unknown account, or wrong
 * password all collapse to `InvalidCredentialsError` so the response never
 * reveals which accounts exist. A correct password on a deactivated account
 * yields `UserDeactivatedError`.
 */
export class AuthenticateUser {
  constructor(private readonly deps: AuthenticateUserDeps) {}

  async execute(
    command: AuthenticateUserCommand,
  ): Promise<Result<UserSnapshot, AuthenticateUserError>> {
    const emailResult = Email.create(command.email);
    if (!emailResult.ok) {
      return err(new InvalidCredentialsError());
    }

    const user = await this.deps.users.findByEmail(emailResult.value);
    if (user === null) {
      return err(new InvalidCredentialsError());
    }

    const credential = user.credential;
    if (credential === null) {
      // federated-only account: there is no password to check, and saying so
      // would reveal how the account signs in
      return err(new InvalidCredentialsError());
    }

    const passwordValid = await this.deps.hasher.verify(command.password, credential.hash);
    if (!passwordValid) {
      return err(new InvalidCredentialsError());
    }

    if (!user.isActive()) {
      return err(new UserDeactivatedError(user.id));
    }

    return ok(user.snapshot());
  }
}
