import { type Result, ok, err } from '../../kernel/result';
import type { Clock } from '../../kernel/clock';
import type { ConsumeTokenError } from '../domain/entities/verification-token';
import { PasswordCredential } from '../domain/entities/password-credential';
import type { PasswordPolicy } from '../domain/value-objects/password-policy';
import type { UserRepository } from '../domain/ports/user-repository';
import type { VerificationTokenRepository } from '../domain/ports/verification-token-repository';
import type { PasswordHasher } from '../domain/ports/password-hasher';
import type { TokenHasher } from '../domain/ports/token-hasher';
import type { EventPublisher } from '../domain/ports/event-publisher';
import { PasswordResetCompleted } from '../domain/events/password-reset-completed';
import { InvalidVerificationTokenError, type WeakPasswordError } from '../domain/errors';

export interface ResetPasswordCommand {
  token: string;
  newPassword: string;
}

export type ResetPasswordError =
  InvalidVerificationTokenError | ConsumeTokenError | WeakPasswordError;

export interface ResetPasswordDeps {
  users: UserRepository;
  tokens: VerificationTokenRepository;
  hasher: PasswordHasher;
  tokenHasher: TokenHasher;
  policy: PasswordPolicy;
  clock: Clock;
  events: EventPublisher;
}

/**
 * Redeem a password-reset link and set a new password.
 *
 * Policy is checked **before** the token is spent, so a user who fumbles the
 * strength rules does not burn their only link. Publishes `PasswordChanged`
 * (from the User aggregate) plus `PasswordResetCompleted`; session revocation is
 * the I-7 subscriber's reaction to `PasswordChanged` — this use case never calls
 * the session module, keeping the dependency one-way.
 */
export class ResetPassword {
  constructor(private readonly deps: ResetPasswordDeps) {}

  async execute(command: ResetPasswordCommand): Promise<Result<void, ResetPasswordError>> {
    const token = await this.deps.tokens.findByTokenHash(this.deps.tokenHasher.hash(command.token));
    if (token === null) {
      return err(new InvalidVerificationTokenError());
    }

    const user = await this.deps.users.findById(token.userId);
    if (user === null) {
      return err(new InvalidVerificationTokenError());
    }

    const policyResult = this.deps.policy.validate(command.newPassword);
    if (!policyResult.ok) {
      return policyResult;
    }

    const now = this.deps.clock.now();
    const consumed = token.consume('password_reset', user.email, now);
    if (!consumed.ok) {
      return consumed;
    }
    await this.deps.tokens.save(token);

    const hash = await this.deps.hasher.hash(command.newPassword);
    user.changePassword(PasswordCredential.fromHash(hash, now), now);
    await this.deps.users.save(user);

    await this.deps.events.publishAll([
      ...user.pullEvents(),
      new PasswordResetCompleted(user.id, now),
    ]);

    return ok(undefined);
  }
}
