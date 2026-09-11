import { type Result, ok, err } from '../../kernel/result';
import type { Clock } from '../../kernel/clock';
import { isUserId, toUserId } from '../domain/value-objects/user-id';
import {
  isFederatedIdentityId,
  toFederatedIdentityId,
} from '../domain/value-objects/federated-identity-id';
import { canRemoveFactor } from '../domain/value-objects/authentication-factor-policy';
import type { UserRepository } from '../domain/ports/user-repository';
import type { FederatedIdentityRepository } from '../domain/ports/federated-identity-repository';
import type { PasskeyCredentialRepository } from '../domain/ports/passkey-credential-repository';
import type { EventPublisher } from '../domain/ports/event-publisher';
import { FederatedIdentityUnlinked } from '../domain/events/federated-identity-unlinked';
import {
  UserNotFoundError,
  FederatedIdentityNotFoundError,
  LastFactorRemovalError,
} from '../domain/errors';

export interface UnlinkFederatedIdentityCommand {
  userId: string;
  federatedIdentityId: string;
}

export type UnlinkFederatedIdentityError =
  UserNotFoundError | FederatedIdentityNotFoundError | LastFactorRemovalError;

export interface UnlinkFederatedIdentityDeps {
  users: UserRepository;
  federatedIdentities: FederatedIdentityRepository;
  passkeys: PasskeyCredentialRepository;
  clock: Clock;
  events: EventPublisher;
}

/**
 * Detach a provider from an account.
 *
 * Ownership is checked here and a foreign link reads as
 * `FederatedIdentityNotFoundError`, so the response cannot probe other accounts.
 *
 * The **last-factor rule** genuinely bites here: an account bootstrapped from a
 * provider has no password, so unlinking its only provider — with no passkey
 * registered — would lock the user out permanently. That is refused.
 */
export class UnlinkFederatedIdentity {
  constructor(private readonly deps: UnlinkFederatedIdentityDeps) {}

  async execute(
    command: UnlinkFederatedIdentityCommand,
  ): Promise<Result<void, UnlinkFederatedIdentityError>> {
    if (!isUserId(command.userId)) {
      return err(new UserNotFoundError(command.userId));
    }
    if (!isFederatedIdentityId(command.federatedIdentityId)) {
      return err(new FederatedIdentityNotFoundError(command.federatedIdentityId));
    }

    const user = await this.deps.users.findById(toUserId(command.userId));
    if (user === null) {
      return err(new UserNotFoundError(command.userId));
    }

    const identity = await this.deps.federatedIdentities.findById(
      toFederatedIdentityId(command.federatedIdentityId),
    );
    if (identity === null || identity.userId !== user.id || !identity.isActive()) {
      return err(new FederatedIdentityNotFoundError(command.federatedIdentityId));
    }

    const [activePasskeys, activeFederatedIdentities] = await Promise.all([
      this.deps.passkeys.countActiveByUser(user.id),
      this.deps.federatedIdentities.countActiveByUser(user.id),
    ]);
    const removable = canRemoveFactor(
      { activePasskeys, hasPasswordFactor: user.hasPasswordFactor(), activeFederatedIdentities },
      'federated_identity',
    );
    if (!removable) {
      return err(new LastFactorRemovalError(user.id));
    }

    const now = this.deps.clock.now();
    identity.revoke(now);
    await this.deps.federatedIdentities.save(identity);
    await this.deps.events.publishAll([
      new FederatedIdentityUnlinked(identity.id, user.id, identity.provider.value, now),
    ]);

    return ok(undefined);
  }
}
