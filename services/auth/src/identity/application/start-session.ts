import { type Result, ok, err } from '../../kernel/result';
import type { Clock } from '../../kernel/clock';
import type { IdGenerator } from '../../kernel/id-generator';
import { Session, type SessionSnapshot } from '../domain/entities/session';
import { toSessionId } from '../domain/value-objects/session-id';
import { isUserId, toUserId, type UserId } from '../domain/value-objects/user-id';
import type { SessionPolicy } from '../domain/value-objects/session-policy';
import type { SessionRepository } from '../domain/ports/session-repository';
import type { UserRepository } from '../domain/ports/user-repository';
import type { TokenGenerator } from '../domain/ports/token-generator';
import type { TokenHasher } from '../domain/ports/token-hasher';
import type { EventPublisher } from '../domain/ports/event-publisher';
import type { DeviceRepository } from '../domain/ports/device-repository';
import { isDeviceId, toDeviceId, type DeviceId } from '../domain/value-objects/device-id';
import { UserNotFoundError, UserDeactivatedError, DeviceNotFoundError } from '../domain/errors';

export interface StartSessionCommand {
  userId: string;
  /**
   * Device to bind this session to. Omit for an unbound session.
   *
   * Never accepted from a client: the server establishes device identity, and
   * ownership is verified below before anything is bound (I-7f).
   */
  deviceId?: string;
}

export interface StartSessionResult {
  session: SessionSnapshot;
  /** The raw refresh-token secret — returned **once**; only its hash is stored. */
  refreshToken: string;
}

export type StartSessionError = UserNotFoundError | UserDeactivatedError | DeviceNotFoundError;

export interface StartSessionDeps {
  sessions: SessionRepository;
  users: UserRepository;
  devices: DeviceRepository;
  tokens: TokenGenerator;
  tokenHasher: TokenHasher;
  policy: SessionPolicy;
  ids: IdGenerator;
  clock: Clock;
  events: EventPublisher;
}

/**
 * Open a session for an already-authenticated user (the caller performs
 * authentication; this use case never sees a password). Issues generation 1 of
 * the refresh-token family and publishes `SessionStarted`.
 */
export class StartSession {
  constructor(private readonly deps: StartSessionDeps) {}

  async execute(
    command: StartSessionCommand,
  ): Promise<Result<StartSessionResult, StartSessionError>> {
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

    const deviceId = await this.resolveDevice(command.deviceId, user.id);
    if (deviceId !== null && !deviceId.ok) {
      return err(deviceId.error);
    }

    const now = this.deps.clock.now();
    const rawToken = this.deps.tokens.generate();
    const session = Session.start({
      id: toSessionId(this.deps.ids.generate()),
      userId: user.id,
      deviceId: deviceId === null ? null : deviceId.value,
      initialTokenHash: this.deps.tokenHasher.hash(rawToken),
      policy: this.deps.policy,
      now,
    });

    await this.deps.sessions.save(session);
    await this.deps.events.publishAll(session.pullEvents());

    return ok({ session: session.snapshot(), refreshToken: rawToken });
  }

  /**
   * Verify the device before binding, or return null for an unbound session.
   *
   * A device that does not exist, belongs to someone else, or has been revoked
   * all answer the same `DeviceNotFoundError` — otherwise the difference would
   * tell a caller which device ids are real and whose they are. This check is
   * what stops a session being bound to a device its owner does not control,
   * which would turn device revocation into a way of ending someone else's
   * sessions.
   */
  private async resolveDevice(
    candidate: string | undefined,
    owner: UserId,
  ): Promise<Result<DeviceId, DeviceNotFoundError> | null> {
    if (candidate === undefined) {
      return null;
    }
    if (!isDeviceId(candidate)) {
      return err(new DeviceNotFoundError(candidate));
    }
    const device = await this.deps.devices.findById(toDeviceId(candidate));
    if (device === null || device.userId !== owner || device.isRevoked()) {
      return err(new DeviceNotFoundError(candidate));
    }
    return ok(device.id);
  }
}
