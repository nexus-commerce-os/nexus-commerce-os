import type { DomainEvent } from '../../../kernel/domain-event';
import type { UserId } from '../value-objects/user-id';
import { Email } from '../value-objects/email';
import { Profile } from './profile';
import { PasswordCredential } from './password-credential';
import { UserRegistered } from '../events/user-registered';
import { EmailChanged } from '../events/email-changed';
import { PasswordChanged } from '../events/password-changed';
import { UserDeactivated } from '../events/user-deactivated';

export type UserStatus = 'active' | 'deactivated';

/** Immutable read model of a User, safe to return across the module boundary. */
export interface UserSnapshot {
  readonly id: UserId;
  readonly email: string;
  readonly emailVerified: boolean;
  readonly status: UserStatus;
  readonly residencyRegion: string;
  readonly displayName: string;
  readonly locale: string;
  readonly createdAt: Date;
  readonly updatedAt: Date;
}

export interface RegisterUserParams {
  id: UserId;
  email: Email;
  credential: PasswordCredential;
  profile: Profile;
  residencyRegion: string;
  now: Date;
}

export interface ReconstituteUserParams {
  id: UserId;
  email: Email;
  emailVerified: boolean;
  status: UserStatus;
  residencyRegion: string;
  profile: Profile;
  credential: PasswordCredential;
  createdAt: Date;
  updatedAt: Date;
}

/**
 * User aggregate root (doc 06 §3.1). Owns Profile and the password credential,
 * enforces its own invariants, and records domain events for state changes. All
 * time is supplied by the caller (Clock port) — the aggregate never reads a clock.
 */
export class User {
  private readonly _events: DomainEvent[] = [];

  private constructor(
    public readonly id: UserId,
    private _email: Email,
    private _emailVerified: boolean,
    private _status: UserStatus,
    public readonly residencyRegion: string,
    private _profile: Profile,
    private _credential: PasswordCredential,
    public readonly createdAt: Date,
    private _updatedAt: Date,
  ) {}

  /** Create a brand-new, unverified, active user and record `UserRegistered`. */
  static register(params: RegisterUserParams): User {
    const user = new User(
      params.id,
      params.email,
      false,
      'active',
      params.residencyRegion,
      params.profile,
      params.credential,
      params.now,
      params.now,
    );
    user._events.push(new UserRegistered(params.id, params.email.value, params.now));
    return user;
  }

  /** Rehydrate an existing user from persistence (records no events). */
  static reconstitute(params: ReconstituteUserParams): User {
    return new User(
      params.id,
      params.email,
      params.emailVerified,
      params.status,
      params.residencyRegion,
      params.profile,
      params.credential,
      params.createdAt,
      params.updatedAt,
    );
  }

  get email(): Email {
    return this._email;
  }

  get emailVerified(): boolean {
    return this._emailVerified;
  }

  get status(): UserStatus {
    return this._status;
  }

  get profile(): Profile {
    return this._profile;
  }

  get credential(): PasswordCredential {
    return this._credential;
  }

  get updatedAt(): Date {
    return this._updatedAt;
  }

  isActive(): boolean {
    return this._status === 'active';
  }

  /** Change email; resets verification and records `EmailChanged`. No-op if equal. */
  changeEmail(newEmail: Email, now: Date): void {
    if (this._email.equals(newEmail)) {
      return;
    }
    this._email = newEmail;
    this._emailVerified = false;
    this._touch(now);
    this._events.push(new EmailChanged(this.id, newEmail.value, now));
  }

  /** Replace the password credential and record `PasswordChanged`. */
  changePassword(credential: PasswordCredential, now: Date): void {
    this._credential = credential;
    this._touch(now);
    this._events.push(new PasswordChanged(this.id, now));
  }

  /** Deactivate the account; records `UserDeactivated`. No-op if already deactivated. */
  deactivate(now: Date): void {
    if (this._status === 'deactivated') {
      return;
    }
    this._status = 'deactivated';
    this._touch(now);
    this._events.push(new UserDeactivated(this.id, now));
  }

  /** Drain recorded events (the caller publishes them after a successful save). */
  pullEvents(): readonly DomainEvent[] {
    const drained = [...this._events];
    this._events.length = 0;
    return drained;
  }

  snapshot(): UserSnapshot {
    return {
      id: this.id,
      email: this._email.value,
      emailVerified: this._emailVerified,
      status: this._status,
      residencyRegion: this.residencyRegion,
      displayName: this._profile.displayName,
      locale: this._profile.locale,
      createdAt: this.createdAt,
      updatedAt: this._updatedAt,
    };
  }

  private _touch(now: Date): void {
    this._updatedAt = now;
  }
}
