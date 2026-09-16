import { type Result, ok, err } from '../../kernel/result';
import { isUserId, toUserId } from '../domain/value-objects/user-id';
import type { PasskeyCredentialSnapshot } from '../domain/entities/passkey-credential';
import type { PasskeyCredentialRepository } from '../domain/ports/passkey-credential-repository';
import { UserNotFoundError } from '../domain/errors';

export interface ListUserPasskeysCommand {
  userId: string;
  /** Include revoked credentials — off by default, on for a security history view. */
  includeRevoked?: boolean;
}

export type ListUserPasskeysError = UserNotFoundError;

export interface ListUserPasskeysDeps {
  passkeys: PasskeyCredentialRepository;
}

/**
 * Read model behind "your security keys": what is registered, when it was last
 * used, and which device it belongs to. Snapshots only — the public key and the
 * credential's internals never leave as live objects.
 */
export class ListUserPasskeys {
  constructor(private readonly deps: ListUserPasskeysDeps) {}

  async execute(
    command: ListUserPasskeysCommand,
  ): Promise<Result<PasskeyCredentialSnapshot[], ListUserPasskeysError>> {
    if (!isUserId(command.userId)) {
      return err(new UserNotFoundError(command.userId));
    }
    const all = await this.deps.passkeys.listByUser(toUserId(command.userId));
    const visible = command.includeRevoked === true ? all : all.filter((p) => p.isActive());
    return ok(visible.map((p) => p.snapshot()));
  }
}
