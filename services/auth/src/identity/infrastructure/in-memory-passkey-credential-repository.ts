import type { PasskeyCredential } from '../domain/entities/passkey-credential';
import type { PasskeyCredentialId } from '../domain/value-objects/passkey-credential-id';
import type { CredentialId } from '../domain/value-objects/credential-id';
import type { DeviceId } from '../domain/value-objects/device-id';
import type { UserId } from '../domain/value-objects/user-id';
import type { PasskeyCredentialRepository } from '../domain/ports/passkey-credential-repository';

/**
 * In-memory PasskeyCredentialRepository — a real implementation for tests and
 * local development; the Postgres adapter (I-6) implements the same port and
 * must back `findByCredentialId` with a unique index.
 */
export class InMemoryPasskeyCredentialRepository implements PasskeyCredentialRepository {
  private readonly byId = new Map<PasskeyCredentialId, PasskeyCredential>();

  findById(id: PasskeyCredentialId): Promise<PasskeyCredential | null> {
    return Promise.resolve(this.byId.get(id) ?? null);
  }

  findByCredentialId(credentialId: CredentialId): Promise<PasskeyCredential | null> {
    for (const credential of this.byId.values()) {
      if (credential.credentialId.equals(credentialId)) {
        return Promise.resolve(credential);
      }
    }
    return Promise.resolve(null);
  }

  listByUser(userId: UserId): Promise<PasskeyCredential[]> {
    return Promise.resolve(this.filter((c) => c.userId === userId));
  }

  listByDevice(deviceId: DeviceId): Promise<PasskeyCredential[]> {
    return Promise.resolve(this.filter((c) => c.deviceId === deviceId));
  }

  countActiveByUser(userId: UserId): Promise<number> {
    return Promise.resolve(this.filter((c) => c.userId === userId && c.isActive()).length);
  }

  save(credential: PasskeyCredential): Promise<void> {
    this.byId.set(credential.id, credential);
    return Promise.resolve();
  }

  /** Test/inspection helper: number of stored credentials. */
  get size(): number {
    return this.byId.size;
  }

  private filter(predicate: (c: PasskeyCredential) => boolean): PasskeyCredential[] {
    const matches: PasskeyCredential[] = [];
    for (const credential of this.byId.values()) {
      if (predicate(credential)) {
        matches.push(credential);
      }
    }
    return matches;
  }
}
