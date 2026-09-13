import { type Result, ok, err } from '../../kernel/result';
import { isUserId, toUserId } from '../domain/value-objects/user-id';
import type { FederatedIdentitySnapshot } from '../domain/entities/federated-identity';
import type { FederatedIdentityRepository } from '../domain/ports/federated-identity-repository';
import { UserNotFoundError } from '../domain/errors';

export interface ListFederatedIdentitiesCommand {
  userId: string;
  /** Include unlinked providers — off by default, on for a security history view. */
  includeRevoked?: boolean;
}

export type ListFederatedIdentitiesError = UserNotFoundError;

export interface ListFederatedIdentitiesDeps {
  federatedIdentities: FederatedIdentityRepository;
}

/**
 * Read model behind "connected accounts": which providers are attached, when
 * they were linked and last used. Snapshots only.
 */
export class ListFederatedIdentities {
  constructor(private readonly deps: ListFederatedIdentitiesDeps) {}

  async execute(
    command: ListFederatedIdentitiesCommand,
  ): Promise<Result<FederatedIdentitySnapshot[], ListFederatedIdentitiesError>> {
    if (!isUserId(command.userId)) {
      return err(new UserNotFoundError(command.userId));
    }
    const all = await this.deps.federatedIdentities.listByUser(toUserId(command.userId));
    const visible = command.includeRevoked === true ? all : all.filter((i) => i.isActive());
    return ok(visible.map((i) => i.snapshot()));
  }
}
