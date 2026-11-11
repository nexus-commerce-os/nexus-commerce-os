import { type Result, ok, err } from '../../kernel/result';
import type { Clock } from '../../kernel/clock';
import type { IdGenerator } from '../../kernel/id-generator';
import { isUserId, toUserId } from '../domain/value-objects/user-id';
import { toPasskeyCredentialId } from '../domain/value-objects/passkey-credential-id';
import { toDeviceId } from '../domain/value-objects/device-id';
import { CredentialId } from '../domain/value-objects/credential-id';
import type { ConsumeChallengeError } from '../domain/entities/webauthn-challenge';
import { PasskeyCredential } from '../domain/entities/passkey-credential';
import { Device } from '../domain/entities/device';
import type { UserRepository } from '../domain/ports/user-repository';
import type { WebAuthnChallengeRepository } from '../domain/ports/webauthn-challenge-repository';
import type { PasskeyCredentialRepository } from '../domain/ports/passkey-credential-repository';
import type { DeviceRepository } from '../domain/ports/device-repository';
import type { TokenHasher } from '../domain/ports/token-hasher';
import type { EventPublisher } from '../domain/ports/event-publisher';
import type { WebAuthnVerifier, WebAuthnClientResponse } from '../domain/ports/webauthn-verifier';
import { PasskeyRegistered } from '../domain/events/passkey-registered';
import { DeviceRegistered } from '../domain/events/device-registered';
import {
  InvalidChallengeError,
  DuplicateCredentialError,
  UserNotFoundError,
  UserDeactivatedError,
  type WebAuthnVerificationFailedError,
} from '../domain/errors';

export interface CompletePasskeyRegistrationCommand {
  userId: string;
  /** The raw challenge echoed back by the client. */
  challenge: string;
  response: WebAuthnClientResponse;
  label: string;
  /** Existing device to attach to; omit to register a new one. */
  deviceId?: string;
  deviceLabel?: string;
  platform?: string;
}

export interface CompletePasskeyRegistrationResult {
  passkeyId: string;
  deviceId: string;
}

export type CompletePasskeyRegistrationError =
  | UserNotFoundError
  | UserDeactivatedError
  | InvalidChallengeError
  | ConsumeChallengeError
  | WebAuthnVerificationFailedError
  | DuplicateCredentialError;

export interface CompletePasskeyRegistrationDeps {
  users: UserRepository;
  challenges: WebAuthnChallengeRepository;
  passkeys: PasskeyCredentialRepository;
  devices: DeviceRepository;
  verifier: WebAuthnVerifier;
  tokenHasher: TokenHasher;
  ids: IdGenerator;
  clock: Clock;
  events: EventPublisher;
}

const DEFAULT_DEVICE_LABEL = 'Unnamed device';
const DEFAULT_PLATFORM = 'unknown';

/**
 * Finish registering an authenticator.
 *
 * Order matters: the challenge is consumed and persisted **before** the verifier
 * runs, so a failed or slow verification can never leave a live nonce behind.
 * The cryptography itself is entirely the verifier's (I-7); this use case only
 * enforces the identity rules around it — challenge validity, credential
 * uniqueness, and device attribution.
 */
export class CompletePasskeyRegistration {
  constructor(private readonly deps: CompletePasskeyRegistrationDeps) {}

  async execute(
    command: CompletePasskeyRegistrationCommand,
  ): Promise<Result<CompletePasskeyRegistrationResult, CompletePasskeyRegistrationError>> {
    if (!isUserId(command.userId)) {
      return err(new UserNotFoundError(command.userId));
    }
    const user = await this.deps.users.findById(toUserId(command.userId));
    if (user === null) {
      return err(new UserNotFoundError(command.userId));
    }
    if (!user.isActive()) {
      return err(new UserDeactivatedError(user.id));
    }

    const challenge = await this.deps.challenges.findByChallengeHash(
      this.deps.tokenHasher.hash(command.challenge),
    );
    if (challenge === null) {
      return err(new InvalidChallengeError());
    }

    const now = this.deps.clock.now();
    const consumed = challenge.consume('registration', user.id, now);
    await this.deps.challenges.save(challenge);
    if (!consumed.ok) {
      return consumed;
    }

    const verified = await this.deps.verifier.verifyRegistration({
      challenge: command.challenge,
      response: command.response,
    });
    if (!verified.ok) {
      return verified;
    }

    const credentialId = CredentialId.fromBase64Url(verified.value.credentialId);
    if ((await this.deps.passkeys.findByCredentialId(credentialId)) !== null) {
      return err(new DuplicateCredentialError(credentialId.value));
    }

    const device = await this.resolveDevice(command, user.id, now);
    const passkey = PasskeyCredential.register({
      id: toPasskeyCredentialId(this.deps.ids.generate()),
      userId: user.id,
      credentialId,
      publicKey: verified.value.publicKey,
      signCount: verified.value.signCount,
      transports: verified.value.transports,
      aaguid: verified.value.aaguid,
      backupEligible: verified.value.backupEligible,
      backupState: verified.value.backupState,
      label: command.label,
      deviceId: device.entity.id,
      now,
    });
    await this.deps.passkeys.save(passkey);

    // completing a ceremony on the device proves possession of it
    device.entity.trust(now);
    await this.deps.devices.save(device.entity);

    await this.deps.events.publishAll([
      ...(device.isNew ? [new DeviceRegistered(device.entity.id, user.id, now)] : []),
      new PasskeyRegistered(passkey.id, user.id, device.entity.id, now),
    ]);

    return ok({ passkeyId: passkey.id, deviceId: device.entity.id });
  }

  /** Attach to the named device when it belongs to this user, else register one. */
  private async resolveDevice(
    command: CompletePasskeyRegistrationCommand,
    userId: ReturnType<typeof toUserId>,
    now: Date,
  ): Promise<{ entity: Device; isNew: boolean }> {
    if (command.deviceId !== undefined) {
      const existing = await this.deps.devices.findById(toDeviceId(command.deviceId));
      if (existing !== null && existing.userId === userId && !existing.isRevoked()) {
        existing.touch(now);
        return { entity: existing, isNew: false };
      }
    }
    return {
      entity: Device.register({
        id: toDeviceId(this.deps.ids.generate()),
        userId,
        label: command.deviceLabel ?? DEFAULT_DEVICE_LABEL,
        platform: command.platform ?? DEFAULT_PLATFORM,
        now,
      }),
      isNew: true,
    };
  }
}
