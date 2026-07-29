import { type Result, ok, err } from '../../kernel/result';
import type { Clock } from '../../kernel/clock';
import { isUserId, toUserId } from '../domain/value-objects/user-id';
import { PasswordCredential } from '../domain/entities/password-credential';
import type { UserRepository } from '../domain/ports/user-repository';
import type { PasswordHasher } from '../domain/ports/password-hasher';
import type { PasswordPolicy } from '../domain/value-objects/password-policy';
import type { EventPublisher } from '../domain/ports/event-publisher';
import {
  type WeakPasswordError,
  UserNotFoundError,
  InvalidCredentialsError,
} from '../domain/errors';

export interface ChangePasswordCommand {
  userId: string;
  currentPassword: string;
  newPassword: string;
}

export type ChangePasswordError = UserNotFoundError | InvalidCredentialsError | WeakPasswordError;

export interface ChangePasswordDeps {
  users: UserRepository;
  hasher: PasswordHasher;
  policy: PasswordPolicy;
  clock: Clock;
  events: EventPublisher;
}

/**
 * Change a user's password after verifying the current one and the new one
 * against policy. Records `PasswordChanged`.
 */
export class ChangePassword {
  constructor(private readonly deps: ChangePasswordDeps) {}

  async execute(command: ChangePasswordCommand): Promise<Result<void, ChangePasswordError>> {
    if (!isUserId(command.userId)) {
      return err(new UserNotFoundError(command.userId));
    }

    const user = await this.deps.users.findById(toUserId(command.userId));
    if (user === null) {
      return err(new UserNotFoundError(command.userId));
    }

    const currentValid = await this.deps.hasher.verify(
      command.currentPassword,
      user.credential.hash,
    );
    if (!currentValid) {
      return err(new InvalidCredentialsError());
    }

    const policyResult = this.deps.policy.validate(command.newPassword);
    if (!policyResult.ok) {
      return policyResult;
    }

    const now = this.deps.clock.now();
    const hash = await this.deps.hasher.hash(command.newPassword);
    user.changePassword(PasswordCredential.fromHash(hash, now), now);

    await this.deps.users.save(user);
    await this.deps.events.publishAll(user.pullEvents());

    return ok(undefined);
  }
}
