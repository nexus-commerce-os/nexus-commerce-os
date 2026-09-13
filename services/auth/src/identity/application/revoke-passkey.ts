import { type Result, ok, err } from '../../kernel/result';
import type { Clock } from '../../kernel/clock';
import { isUserId, toUserId } from '../domain/value-objects/user-id';
import {
  isPasskeyCredentialId,
  toPasskeyCredentialId,
} from '../domain/value-objects/passkey-credential-id';
import { canRemoveFactor } from '../domain/value-objects/authentication-factor-policy';
import type { UserRepository } from '../domain/ports/user-repository';
import type { PasskeyCredentialRepository } from '../domain/ports/passkey-credential-repository';
import type { FederatedIdentityRepository } from '../domain/ports/federated-identity-repository';
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
  federatedIdentities: FederatedIdentityRepository;
  clock: Clock;
  events: EventPublisher;
}

/**
 * Disown an authenticator.
 *
 * Ownership is checked here and a foreign passkey is reported as
 * `PasskeyNotFoundError`, so the response cannot be used to probe other
 * accounts' credentials. The **last-factor rule** is enforced through
 * `canRemoveFactor`, which counts every remaining factor — password, other
 * passkeys and linked providers. A federated-only account with one passkey and
 * no provider left therefore cannot strip its last way in.
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
    const activeFederatedIdentities = await this.deps.federatedIdentities.countActiveByUser(
      user.id,
    );
    const removable = canRemoveFactor(
      {
        activePasskeys,
        hasPasswordFactor: user.hasPasswordFactor(),
        activeFederatedIdentities,
      },
      'passkey',
    );
    if (!removable) {
      return err(new LastFactorRemovalError(user.id));
    }

    const now = this.deps.clock.now();
    passkey.revoke(now);
    await this.deps.passkeys.save(passkey);
    await this.deps.events.publishAll([new PasskeyRevoked(passkey.id, user.id, now)]);

    return ok(undefined);
  }
}
