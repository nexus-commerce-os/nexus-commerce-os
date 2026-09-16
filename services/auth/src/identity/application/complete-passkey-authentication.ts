import { type Result, ok, err } from '../../kernel/result';
import type { Clock } from '../../kernel/clock';
import { CredentialId } from '../domain/value-objects/credential-id';
import type { DeviceId } from '../domain/value-objects/device-id';
import type { ConsumeChallengeError } from '../domain/entities/webauthn-challenge';
import type { UserRepository } from '../domain/ports/user-repository';
import type { WebAuthnChallengeRepository } from '../domain/ports/webauthn-challenge-repository';
import type { PasskeyCredentialRepository } from '../domain/ports/passkey-credential-repository';
import type { DeviceRepository } from '../domain/ports/device-repository';
import type { TokenHasher } from '../domain/ports/token-hasher';
import type { EventPublisher } from '../domain/ports/event-publisher';
import type { WebAuthnVerifier, WebAuthnClientResponse } from '../domain/ports/webauthn-verifier';
import { PasskeyAuthenticated } from '../domain/events/passkey-authenticated';
import { PasskeyCloneSuspected } from '../domain/events/passkey-clone-suspected';
import {
  InvalidChallengeError,
  PasskeyNotFoundError,
  UserDeactivatedError,
  type PasskeyCloneDetectedError,
  type WebAuthnVerificationFailedError,
} from '../domain/errors';

export interface CompletePasskeyAuthenticationCommand {
  challenge: string;
  response: WebAuthnClientResponse;
}

export interface CompletePasskeyAuthenticationResult {
  userId: string;
  passkeyId: string;
  deviceId: string | null;
  /** False when the authenticator keeps no signature counter (clone detection unavailable). */
  counterSupported: boolean;
  userVerified: boolean;
}

export type CompletePasskeyAuthenticationError =
  | InvalidChallengeError
  | ConsumeChallengeError
  | PasskeyNotFoundError
  | UserDeactivatedError
  | WebAuthnVerificationFailedError
  | PasskeyCloneDetectedError;

export interface CompletePasskeyAuthenticationDeps {
  users: UserRepository;
  challenges: WebAuthnChallengeRepository;
  passkeys: PasskeyCredentialRepository;
  devices: DeviceRepository;
  verifier: WebAuthnVerifier;
  tokenHasher: TokenHasher;
  clock: Clock;
  events: EventPublisher;
}

/**
 * Finish a passkey sign-in.
 *
 * The credential is located from the verified assertion, which is what makes
 * discoverable ("usernameless") sign-in work: the challenge need not name a
 * user, but if it does, the credential must belong to that same user.
 *
 * A revoked or unknown credential both answer `PasskeyNotFoundError` so the
 * response cannot distinguish them. A counter regression is rejected **and**
 * announced via `PasskeyCloneSuspected` for audit and anomaly detection.
 */
export class CompletePasskeyAuthentication {
  constructor(private readonly deps: CompletePasskeyAuthenticationDeps) {}

  async execute(
    command: CompletePasskeyAuthenticationCommand,
  ): Promise<Result<CompletePasskeyAuthenticationResult, CompletePasskeyAuthenticationError>> {
    const challenge = await this.deps.challenges.findByChallengeHash(
      this.deps.tokenHasher.hash(command.challenge),
    );
    if (challenge === null) {
      return err(new InvalidChallengeError());
    }
    if (challenge.ceremony !== 'authentication') {
      return err(new InvalidChallengeError());
    }

    const now = this.deps.clock.now();
    // consume against the challenge's own binding; a user mismatch is caught
    // below, once the credential tells us which account actually answered.
    const consumed = challenge.consume('authentication', challenge.userId, now);
    await this.deps.challenges.save(challenge);
    if (!consumed.ok) {
      return consumed;
    }

    const claimed = this.readClaimedCredentialId(command.response);
    if (claimed === null) {
      return err(new PasskeyNotFoundError('unknown'));
    }
    const passkey = await this.deps.passkeys.findByCredentialId(claimed);
    if (passkey === null || !passkey.isActive()) {
      return err(new PasskeyNotFoundError(claimed.value));
    }
    if (challenge.userId !== null && challenge.userId !== passkey.userId) {
      return err(new InvalidChallengeError());
    }

    const user = await this.deps.users.findById(passkey.userId);
    if (user === null) {
      return err(new PasskeyNotFoundError(claimed.value));
    }
    if (!user.isActive()) {
      return err(new UserDeactivatedError(user.id));
    }

    const verified = await this.deps.verifier.verifyAuthentication({
      challenge: command.challenge,
      response: command.response,
      publicKey: passkey.publicKey,
      storedSignCount: passkey.signCount,
    });
    if (!verified.ok) {
      return verified;
    }

    const recorded = passkey.recordAuthentication(
      verified.value.signCount,
      now,
      verified.value.backupState,
    );
    if (!recorded.ok) {
      if (recorded.error._tag === 'PasskeyCloneDetectedError') {
        await this.deps.events.publishAll([
          new PasskeyCloneSuspected(
            passkey.id,
            passkey.userId,
            recorded.error.storedSignCount,
            recorded.error.presentedSignCount,
            now,
          ),
        ]);
      }
      return err(recorded.error);
    }
    await this.deps.passkeys.save(passkey);

    const deviceId = await this.touchDevice(passkey.deviceId, now);

    await this.deps.events.publishAll([
      new PasskeyAuthenticated(passkey.id, passkey.userId, recorded.value.counterSupported, now),
    ]);

    return ok({
      userId: passkey.userId,
      passkeyId: passkey.id,
      deviceId,
      counterSupported: recorded.value.counterSupported,
      userVerified: verified.value.userVerified,
    });
  }

  /**
   * The credential id the client says answered. It is only a *claim* here —
   * the verifier proves the signature, and the stored public key is what makes
   * the claim binding.
   */
  private readClaimedCredentialId(response: WebAuthnClientResponse): CredentialId | null {
    const raw = response['id'];
    if (typeof raw !== 'string' || raw.length === 0) {
      return null;
    }
    try {
      return CredentialId.fromBase64Url(raw);
    } catch {
      return null;
    }
  }

  /** Record activity on the bound device, if it still exists and is not revoked. */
  private async touchDevice(deviceId: DeviceId | null, now: Date): Promise<string | null> {
    if (deviceId === null) {
      return null;
    }
    const device = await this.deps.devices.findById(deviceId);
    if (device === null || device.isRevoked()) {
      return null;
    }
    device.touch(now);
    await this.deps.devices.save(device);
    return device.id;
  }
}
