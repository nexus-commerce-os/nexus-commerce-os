import { type Result, ok, err } from '../../kernel/result';
import type { Clock } from '../../kernel/clock';
import { isUserId, toUserId } from '../domain/value-objects/user-id';
import {
  isPasskeyCredentialId,
  toPasskeyCredentialId,
} from '../domain/value-objects/passkey-credential-id';
import { canRemovePasskey } from '../domain/value-objects/authentication-factor-policy';
import type { UserRepository } from '../domain/ports/user-repository';
import type { PasskeyCredentialRepository } from '../domain/ports/passkey-credential-repository';
import type { EventPublisher } from '../domain/ports/event-publisher';
import { PasskeyRevoked } from '../domain/events/passkey-revoked';
import { PasskeyNotFoundError, LastFactorRemovalError, UserNotFoundError } from '../domain/errors';

export interface RevokePasskeyCommand {
  userId: string;
  passkeyId: string;
}

export type RevokePasskeyError = UserNotFoundError | PasskeyNotFoundError | LastFactorRemovalError;

export interface RevokePasskeyDeps {
  users: UserRepository;
  passkeys: PasskeyCredentialRepository;
  clock: Clock;
  events: EventPublisher;
}

/**
 * Disown an authenticator.
 *
 * Ownership is checked here and a foreign passkey is reported as
 * `PasskeyNotFoundError`, so the response cannot be used to probe other
 * accounts' credentials. The **last-factor rule** is enforced through
 * `canRemovePasskey`, which counts the account's remaining factors — today every
 * account also has a password, so the guard passes; it becomes load-bearing the
 * moment passwordless accounts exist, with nothing here to change.
 */
export class RevokePasskey {
  constructor(private readonly deps: RevokePasskeyDeps) {}

  async execute(command: RevokePasskeyCommand): Promise<Result<void, RevokePasskeyError>> {
    if (!isUserId(command.userId)) {
      return err(new UserNotFoundError(command.userId));
    }
    if (!isPasskeyCredentialId(command.passkeyId)) {
      return err(new PasskeyNotFoundError(command.passkeyId));
    }

    const user = await this.deps.users.findById(toUserId(command.userId));
    if (user === null) {
      return err(new UserNotFoundError(command.userId));
    }

    const passkey = await this.deps.passkeys.findById(toPasskeyCredentialId(command.passkeyId));
    if (passkey === null || passkey.userId !== user.id || !passkey.isActive()) {
      return err(new PasskeyNotFoundError(command.passkeyId));
    }

    const activePasskeys = await this.deps.passkeys.countActiveByUser(user.id);
    if (!canRemovePasskey({ activePasskeys, hasPasswordFactor: user.hasPasswordFactor() })) {
      return err(new LastFactorRemovalError(user.id));
    }

    const now = this.deps.clock.now();
    passkey.revoke(now);
    await this.deps.passkeys.save(passkey);
    await this.deps.events.publishAll([new PasskeyRevoked(passkey.id, user.id, now)]);

    return ok(undefined);
  }
}
