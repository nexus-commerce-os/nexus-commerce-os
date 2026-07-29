import { type Result, ok, err } from '../../kernel/result';
import type { Clock } from '../../kernel/clock';
import type { IdGenerator } from '../../kernel/id-generator';
import { Email } from '../domain/value-objects/email';
import { toUserId } from '../domain/value-objects/user-id';
import { Profile } from '../domain/entities/profile';
import { PasswordCredential } from '../domain/entities/password-credential';
import { User, type UserSnapshot } from '../domain/entities/user';
import type { UserRepository } from '../domain/ports/user-repository';
import type { PasswordHasher } from '../domain/ports/password-hasher';
import type { PasswordPolicy } from '../domain/value-objects/password-policy';
import type { EventPublisher } from '../domain/ports/event-publisher';
import {
  type InvalidEmailError,
  type WeakPasswordError,
  type InvalidProfileError,
  EmailAlreadyInUseError,
} from '../domain/errors';

export interface RegisterUserCommand {
  email: string;
  password: string;
  displayName: string;
  /** BCP-47 tag; defaults to `en-US`. */
  locale?: string;
  /** Data-residency region; defaults to `us-east-1` (Phase 1, ADR-0007). */
  residencyRegion?: string;
}

export type RegisterUserError =
  InvalidEmailError | WeakPasswordError | InvalidProfileError | EmailAlreadyInUseError;

export interface RegisterUserDeps {
  users: UserRepository;
  hasher: PasswordHasher;
  policy: PasswordPolicy;
  ids: IdGenerator;
  clock: Clock;
  events: EventPublisher;
}

const DEFAULT_LOCALE = 'en-US';
const DEFAULT_RESIDENCY = 'us-east-1';

/**
 * Register a new user: validate email + password policy + profile, enforce email
 * uniqueness, hash the password, persist, and publish `UserRegistered`.
 */
export class RegisterUser {
  constructor(private readonly deps: RegisterUserDeps) {}

  async execute(command: RegisterUserCommand): Promise<Result<UserSnapshot, RegisterUserError>> {
    const emailResult = Email.create(command.email);
    if (!emailResult.ok) {
      return emailResult;
    }
    const email = emailResult.value;

    const policyResult = this.deps.policy.validate(command.password);
    if (!policyResult.ok) {
      return policyResult;
    }

    const profileResult = Profile.create({
      displayName: command.displayName,
      locale: command.locale ?? DEFAULT_LOCALE,
    });
    if (!profileResult.ok) {
      return profileResult;
    }

    if (await this.deps.users.existsByEmail(email)) {
      return err(new EmailAlreadyInUseError(email.value));
    }

    const now = this.deps.clock.now();
    const hash = await this.deps.hasher.hash(command.password);
    const user = User.register({
      id: toUserId(this.deps.ids.generate()),
      email,
      credential: PasswordCredential.fromHash(hash, now),
      profile: profileResult.value,
      residencyRegion: command.residencyRegion ?? DEFAULT_RESIDENCY,
      now,
    });

    await this.deps.users.save(user);
    await this.deps.events.publishAll(user.pullEvents());

    return ok(user.snapshot());
  }
}
