import type { DomainEvent } from '../../../kernel/domain-event';
import { type Result, ok, err } from '../../../kernel/result';
import type { SessionId } from '../value-objects/session-id';
import type { UserId } from '../value-objects/user-id';
import type { TokenHash } from '../value-objects/token-hash';
import type { DeviceId } from '../value-objects/device-id';
import type { SessionPolicy } from '../value-objects/session-policy';
import type { SessionRevocationReason } from '../value-objects/session-revocation-reason';
import { RefreshToken, type RefreshTokenStatus } from './refresh-token';
import { SessionStarted } from '../events/session-started';
import { SessionRefreshed } from '../events/session-refreshed';
import { SessionRevoked } from '../events/session-revoked';
import { SessionReuseDetected } from '../events/session-reuse-detected';
import {
  type SessionExpiredError as SessionExpiredErrorType,
  SessionExpiredError,
  SessionRevokedError,
  RefreshTokenReusedError,
  InvalidRefreshTokenError,
} from '../errors';

export type SessionStatus = 'active' | 'revoked';

/** Failure modes of {@link Session.rotate}. */
export type RotateSessionError =
  | SessionRevokedError
  | SessionExpiredErrorType
  | RefreshTokenReusedError
  | InvalidRefreshTokenError;

/** Immutable read model of a session (concurrent-session visibility, doc 08 §3.4). */
export interface SessionSnapshot {
  readonly id: SessionId;
  readonly userId: UserId;
  readonly deviceId: DeviceId | null;
  readonly status: SessionStatus;
  readonly revocationReason: SessionRevocationReason | null;
  readonly createdAt: Date;
  readonly lastUsedAt: Date;
  readonly idleExpiresAt: Date;
  readonly absoluteExpiresAt: Date;
}

export interface StartSessionParams {
  id: SessionId;
  userId: UserId;
  /**
   * The device this session is bound to, or null when it is unbound.
   *
   * A real {@link DeviceId} (I-7f), never a client-supplied string: ownership is
   * verified before binding, which is what lets device revocation revoke exactly
   * the sessions belonging to it and nothing else.
   */
  deviceId: DeviceId | null;
  initialTokenHash: TokenHash;
  policy: SessionPolicy;
  now: Date;
}

export interface ReconstituteSessionParams {
  id: SessionId;
  userId: UserId;
  deviceId: DeviceId | null;
  status: SessionStatus;
  revocationReason: SessionRevocationReason | null;
  tokens: readonly { hash: TokenHash; status: RefreshTokenStatus; issuedAt: Date }[];
  createdAt: Date;
  lastUsedAt: Date;
  idleExpiresAt: Date;
  absoluteExpiresAt: Date;
}

/**
 * Session aggregate root — owns a **refresh-token family** and enforces the
 * lifetime rules of doc 08 §3.4:
 *
 *  - rotation on every use (the presented token is consumed, a new one issued);
 *  - **reuse detection**: presenting an already-consumed token revokes the
 *    entire family, because it means the token was stolen;
 *  - a sliding **idle** window inside a hard **absolute** ceiling;
 *  - explicit revocation (user logout, admin, password change).
 *
 * Time is always supplied by the caller (Clock port); the aggregate never reads
 * a clock itself.
 */
export class Session {
  private readonly _events: DomainEvent[] = [];

  private constructor(
    public readonly id: SessionId,
    public readonly userId: UserId,
    public readonly deviceId: DeviceId | null,
    private _status: SessionStatus,
    private _revocationReason: SessionRevocationReason | null,
    private readonly _tokens: RefreshToken[],
    public readonly createdAt: Date,
    private _lastUsedAt: Date,
    private _idleExpiresAt: Date,
    public readonly absoluteExpiresAt: Date,
  ) {}

  /** Open a new session with generation 1 of its token family. */
  static start(params: StartSessionParams): Session {
    const absoluteExpiresAt = new Date(params.now.getTime() + params.policy.absoluteTtlMs);
    const idleExpiresAt = Session.cap(
      new Date(params.now.getTime() + params.policy.idleTtlMs),
      absoluteExpiresAt,
    );
    const session = new Session(
      params.id,
      params.userId,
      params.deviceId,
      'active',
      null,
      [RefreshToken.issue(params.initialTokenHash, params.now)],
      params.now,
      params.now,
      idleExpiresAt,
      absoluteExpiresAt,
    );
    session._events.push(new SessionStarted(params.id, params.userId, params.now));
    return session;
  }

  /** Rehydrate an existing session from persistence (records no events). */
  static reconstitute(params: ReconstituteSessionParams): Session {
    return new Session(
      params.id,
      params.userId,
      params.deviceId,
      params.status,
      params.revocationReason,
      params.tokens.map((t) => RefreshToken.reconstitute(t.hash, t.status, t.issuedAt)),
      params.createdAt,
      params.lastUsedAt,
      params.idleExpiresAt,
      params.absoluteExpiresAt,
    );
  }

  get status(): SessionStatus {
    return this._status;
  }

  get revocationReason(): SessionRevocationReason | null {
    return this._revocationReason;
  }

  get lastUsedAt(): Date {
    return this._lastUsedAt;
  }

  get idleExpiresAt(): Date {
    return this._idleExpiresAt;
  }

  /** Tokens in the family, oldest generation first. */
  get tokens(): readonly RefreshToken[] {
    return this._tokens;
  }

  isActive(now: Date): boolean {
    return (
      this._status === 'active' &&
      now.getTime() < this._idleExpiresAt.getTime() &&
      now.getTime() < this.absoluteExpiresAt.getTime()
    );
  }

  /**
   * Rotate the family: consume `presented` and issue `nextHash`.
   *
   * Expiry is evaluated before the token itself so an expired session is
   * reported as expired rather than as a token problem; a consumed or revoked
   * token short-circuits to reuse handling and burns the family.
   */
  rotate(
    presented: TokenHash,
    nextHash: TokenHash,
    policy: SessionPolicy,
    now: Date,
  ): Result<void, RotateSessionError> {
    if (this._status === 'revoked') {
      return err(new SessionRevokedError(this.id));
    }
    if (now.getTime() >= this.absoluteExpiresAt.getTime()) {
      this.revoke('absolute_expired', now);
      return err(new SessionExpiredError(this.id, 'absolute'));
    }
    if (now.getTime() >= this._idleExpiresAt.getTime()) {
      this.revoke('idle_expired', now);
      return err(new SessionExpiredError(this.id, 'idle'));
    }

    const token = this._tokens.find((candidate) => candidate.hash.equals(presented));
    if (token === undefined) {
      return err(new InvalidRefreshTokenError());
    }
    if (!token.isActive()) {
      this._events.push(new SessionReuseDetected(this.id, this.userId, now));
      this.revoke('reuse_detected', now);
      return err(new RefreshTokenReusedError(this.id));
    }

    token.consume();
    this._tokens.push(RefreshToken.issue(nextHash, now));
    this._lastUsedAt = now;
    this._idleExpiresAt = Session.cap(
      new Date(now.getTime() + policy.idleTtlMs),
      this.absoluteExpiresAt,
    );
    this._events.push(new SessionRefreshed(this.id, this.userId, now));
    return ok(undefined);
  }

  /** Invalidate the session and every token in its family. Idempotent. */
  revoke(reason: SessionRevocationReason, now: Date): void {
    if (this._status === 'revoked') {
      return;
    }
    this._status = 'revoked';
    this._revocationReason = reason;
    for (const token of this._tokens) {
      if (token.status !== 'consumed') {
        token.revoke();
      }
    }
    this._events.push(new SessionRevoked(this.id, this.userId, reason, now));
  }

  /** Drain recorded events (the caller publishes them after a successful save). */
  pullEvents(): readonly DomainEvent[] {
    const drained = [...this._events];
    this._events.length = 0;
    return drained;
  }

  snapshot(): SessionSnapshot {
    return {
      id: this.id,
      userId: this.userId,
      deviceId: this.deviceId,
      status: this._status,
      revocationReason: this._revocationReason,
      createdAt: this.createdAt,
      lastUsedAt: this._lastUsedAt,
      idleExpiresAt: this._idleExpiresAt,
      absoluteExpiresAt: this.absoluteExpiresAt,
    };
  }

  /** The idle window may never outlive the absolute ceiling. */
  private static cap(candidate: Date, ceiling: Date): Date {
    return candidate.getTime() > ceiling.getTime() ? new Date(ceiling.getTime()) : candidate;
  }
}
