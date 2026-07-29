import { type Result, ok, err } from '../../../kernel/result';
import type { UserId } from '../value-objects/user-id';
import type { PasskeyCredentialId } from '../value-objects/passkey-credential-id';
import type { DeviceId } from '../value-objects/device-id';
import type { CredentialId } from '../value-objects/credential-id';
import { PasskeyCloneDetectedError, PasskeyNotFoundError } from '../errors';

export type RecordAuthenticationError = PasskeyCloneDetectedError | PasskeyNotFoundError;

/**
 * Outcome of a successful authentication, so the caller knows whether the
 * authenticator reports a usable signature counter. A `0` counter means the
 * authenticator does not implement one (permitted by the spec) — accepted, but
 * worth recording because clone detection is unavailable for that credential.
 */
export interface AuthenticationRecorded {
  readonly counterSupported: boolean;
}

export interface RegisterPasskeyParams {
  id: PasskeyCredentialId;
  userId: UserId;
  credentialId: CredentialId;
  /** Opaque COSE public key as returned by the verifier; the domain never parses it. */
  publicKey: string;
  signCount: number;
  transports: readonly string[];
  aaguid: string;
  backupEligible: boolean;
  backupState: boolean;
  label: string;
  deviceId: DeviceId | null;
  now: Date;
}

export interface ReconstitutePasskeyParams extends Omit<RegisterPasskeyParams, 'now'> {
  createdAt: Date;
  lastUsedAt: Date | null;
  revokedAt: Date | null;
}

export interface PasskeyCredentialSnapshot {
  readonly id: PasskeyCredentialId;
  readonly userId: UserId;
  readonly credentialId: string;
  readonly signCount: number;
  readonly transports: readonly string[];
  readonly aaguid: string;
  readonly backupEligible: boolean;
  readonly backupState: boolean;
  readonly label: string;
  readonly deviceId: DeviceId | null;
  readonly createdAt: Date;
  readonly lastUsedAt: Date | null;
  readonly revokedAt: Date | null;
}

/**
 * PasskeyCredential aggregate — one registered authenticator.
 *
 * Holds only what the verifier hands back; the WebAuthn protocol itself lives
 * entirely behind the `WebAuthnVerifier` port. The security rule that *is*
 * domain logic lives here: **signature-counter regression**.
 */
export class PasskeyCredential {
  private constructor(
    public readonly id: PasskeyCredentialId,
    public readonly userId: UserId,
    public readonly credentialId: CredentialId,
    public readonly publicKey: string,
    private _signCount: number,
    public readonly transports: readonly string[],
    public readonly aaguid: string,
    public readonly backupEligible: boolean,
    private _backupState: boolean,
    private _label: string,
    private _deviceId: DeviceId | null,
    public readonly createdAt: Date,
    private _lastUsedAt: Date | null,
    private _revokedAt: Date | null,
  ) {}

  static register(params: RegisterPasskeyParams): PasskeyCredential {
    return new PasskeyCredential(
      params.id,
      params.userId,
      params.credentialId,
      params.publicKey,
      params.signCount,
      [...params.transports],
      params.aaguid,
      params.backupEligible,
      params.backupState,
      params.label,
      params.deviceId,
      params.now,
      null,
      null,
    );
  }

  /** Rehydrate from persistence (no transition checks). */
  static reconstitute(params: ReconstitutePasskeyParams): PasskeyCredential {
    return new PasskeyCredential(
      params.id,
      params.userId,
      params.credentialId,
      params.publicKey,
      params.signCount,
      [...params.transports],
      params.aaguid,
      params.backupEligible,
      params.backupState,
      params.label,
      params.deviceId,
      params.createdAt,
      params.lastUsedAt,
      params.revokedAt,
    );
  }

  get signCount(): number {
    return this._signCount;
  }

  get backupState(): boolean {
    return this._backupState;
  }

  get label(): string {
    return this._label;
  }

  get deviceId(): DeviceId | null {
    return this._deviceId;
  }

  get lastUsedAt(): Date | null {
    return this._lastUsedAt;
  }

  get revokedAt(): Date | null {
    return this._revokedAt;
  }

  isActive(): boolean {
    return this._revokedAt === null;
  }

  /**
   * Record a verified authentication.
   *
   * **Clone detection.** An authenticator's signature counter must strictly
   * increase. If the stored counter is above zero and the presented one does not
   * exceed it, two authenticators are answering for one credential — the
   * signature is cryptographically valid but the credential has been copied, so
   * the attempt is rejected.
   *
   * A stored counter of `0` means the authenticator does not maintain one
   * (allowed by the spec, common for platform passkeys); the attempt is accepted
   * and reported with `counterSupported: false` so the caller can log it.
   */
  recordAuthentication(
    presentedSignCount: number,
    now: Date,
    backupState?: boolean,
  ): Result<AuthenticationRecorded, RecordAuthenticationError> {
    if (!this.isActive()) {
      return err(new PasskeyNotFoundError(this.credentialId.value));
    }
    const counterSupported = this._signCount > 0 || presentedSignCount > 0;
    if (this._signCount > 0 && presentedSignCount <= this._signCount) {
      return err(new PasskeyCloneDetectedError(this.id, this._signCount, presentedSignCount));
    }
    this._signCount = presentedSignCount;
    this._lastUsedAt = now;
    if (backupState !== undefined) {
      this._backupState = backupState;
    }
    return ok({ counterSupported });
  }

  /** Disown the authenticator. Idempotent; keeps the first revocation time. */
  revoke(now: Date): void {
    if (this._revokedAt === null) {
      this._revokedAt = now;
    }
  }

  rename(label: string): void {
    this._label = label;
  }

  bindToDevice(deviceId: DeviceId): void {
    this._deviceId = deviceId;
  }

  snapshot(): PasskeyCredentialSnapshot {
    return {
      id: this.id,
      userId: this.userId,
      credentialId: this.credentialId.value,
      signCount: this._signCount,
      transports: this.transports,
      aaguid: this.aaguid,
      backupEligible: this.backupEligible,
      backupState: this._backupState,
      label: this._label,
      deviceId: this._deviceId,
      createdAt: this.createdAt,
      lastUsedAt: this._lastUsedAt,
      revokedAt: this._revokedAt,
    };
  }
}
