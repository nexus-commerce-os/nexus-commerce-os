import type { PasskeyCredential } from '../entities/passkey-credential';
import type { PasskeyCredentialId } from '../value-objects/passkey-credential-id';
import type { CredentialId } from '../value-objects/credential-id';
import type { DeviceId } from '../value-objects/device-id';
import type { UserId } from '../value-objects/user-id';

/**
 * PasskeyCredentialRepository port — persistence boundary for registered
 * authenticators.
 *
 * `findByCredentialId` resolves the authenticator-chosen id presented in an
 * assertion. `countActiveByUser` backs the last-factor guard, so it must count
 * only non-revoked credentials.
 */
export interface PasskeyCredentialRepository {
  findById(id: PasskeyCredentialId): Promise<PasskeyCredential | null>;
  findByCredentialId(credentialId: CredentialId): Promise<PasskeyCredential | null>;
  listByUser(userId: UserId): Promise<PasskeyCredential[]>;
  listByDevice(deviceId: DeviceId): Promise<PasskeyCredential[]>;
  countActiveByUser(userId: UserId): Promise<number>;
  save(credential: PasskeyCredential): Promise<void>;
}
