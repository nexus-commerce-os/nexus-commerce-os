import type { UserId } from '../value-objects/user-id';
import type { DeviceId } from '../value-objects/device-id';
import type { DeviceTrustState } from '../value-objects/device-trust-state';

export interface RegisterDeviceParams {
  id: DeviceId;
  userId: UserId;
  label: string;
  /** Coarse platform family the user chose/reported, e.g. "iOS", "Windows". */
  platform: string;
  now: Date;
}

export interface ReconstituteDeviceParams {
  id: DeviceId;
  userId: UserId;
  label: string;
  platform: string;
  trustState: DeviceTrustState;
  firstSeenAt: Date;
  lastSeenAt: Date;
  revokedAt: Date | null;
}

export interface DeviceSnapshot {
  readonly id: DeviceId;
  readonly userId: UserId;
  readonly label: string;
  readonly platform: string;
  readonly trustState: DeviceTrustState;
  readonly firstSeenAt: Date;
  readonly lastSeenAt: Date;
  readonly revokedAt: Date | null;
}

/**
 * Device aggregate — a thing the user signs in from, so sessions and passkeys can
 * be attributed to it and disowned as a unit.
 *
 * Deliberately carries **no IP, no user-agent string, no geolocation and no
 * audit metadata**: those are the Audit context's to own. This aggregate holds
 * only the identity-relevant facts (who it belongs to, how much it is trusted,
 * when it was first and last seen).
 */
export class Device {
  private constructor(
    public readonly id: DeviceId,
    public readonly userId: UserId,
    private _label: string,
    public readonly platform: string,
    private _trustState: DeviceTrustState,
    public readonly firstSeenAt: Date,
    private _lastSeenAt: Date,
    private _revokedAt: Date | null,
  ) {}

  static register(params: RegisterDeviceParams): Device {
    return new Device(
      params.id,
      params.userId,
      params.label,
      params.platform,
      'UNKNOWN',
      params.now,
      params.now,
      null,
    );
  }

  /** Rehydrate from persistence (no transition checks). */
  static reconstitute(params: ReconstituteDeviceParams): Device {
    return new Device(
      params.id,
      params.userId,
      params.label,
      params.platform,
      params.trustState,
      params.firstSeenAt,
      params.lastSeenAt,
      params.revokedAt,
    );
  }

  get label(): string {
    return this._label;
  }

  get trustState(): DeviceTrustState {
    return this._trustState;
  }

  get lastSeenAt(): Date {
    return this._lastSeenAt;
  }

  get revokedAt(): Date | null {
    return this._revokedAt;
  }

  isRevoked(): boolean {
    return this._trustState === 'REVOKED';
  }

  /**
   * Promote to `TRUSTED`. Completing a passkey ceremony on a device proves
   * possession of it, which is the signal we accept. A revoked device is never
   * silently promoted — it must be re-registered.
   */
  trust(now: Date): void {
    if (this.isRevoked()) {
      return;
    }
    this._trustState = 'TRUSTED';
    this.touch(now);
  }

  /** Terminal. Idempotent; keeps the first revocation time. */
  revoke(now: Date): void {
    if (this.isRevoked()) {
      return;
    }
    this._trustState = 'REVOKED';
    this._revokedAt = now;
    this._lastSeenAt = now;
  }

  /** Record activity. A revoked device does not come back to life by being used. */
  touch(now: Date): void {
    if (this.isRevoked()) {
      return;
    }
    if (now.getTime() > this._lastSeenAt.getTime()) {
      this._lastSeenAt = now;
    }
  }

  rename(label: string): void {
    this._label = label;
  }

  snapshot(): DeviceSnapshot {
    return {
      id: this.id,
      userId: this.userId,
      label: this._label,
      platform: this.platform,
      trustState: this._trustState,
      firstSeenAt: this.firstSeenAt,
      lastSeenAt: this._lastSeenAt,
      revokedAt: this._revokedAt,
    };
  }
}
