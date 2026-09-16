import { type Result, ok, err } from '../../kernel/result';
import type { Clock } from '../../kernel/clock';
import type { ConsumeTokenError } from '../domain/entities/verification-token';
import type { UserRepository } from '../domain/ports/user-repository';
import type { VerificationTokenRepository } from '../domain/ports/verification-token-repository';
import type { TokenHasher } from '../domain/ports/token-hasher';
import type { EventPublisher } from '../domain/ports/event-publisher';
import { InvalidVerificationTokenError } from '../domain/errors';

export interface VerifyEmailCommand {
  token: string;
}

export type VerifyEmailError = InvalidVerificationTokenError | ConsumeTokenError;

export interface VerifyEmailDeps {
  users: UserRepository;
  tokens: VerificationTokenRepository;
  tokenHasher: TokenHasher;
  clock: Clock;
  events: EventPublisher;
}

/**
 * Redeem an email-verification link.
 *
 * The token is resolved by hash, then the aggregate enforces purpose, email
 * binding, replay and expiry. The consumed token is persisted **before** the
 * user is saved so a crash mid-flight can never leave a spent link redeemable.
 */
export class VerifyEmail {
  constructor(private readonly deps: VerifyEmailDeps) {}

  async execute(command: VerifyEmailCommand): Promise<Result<void, VerifyEmailError>> {
    const token = await this.deps.tokens.findByTokenHash(this.deps.tokenHasher.hash(command.token));
    if (token === null) {
      return err(new InvalidVerificationTokenError());
    }

    const user = await this.deps.users.findById(token.userId);
    if (user === null) {
      return err(new InvalidVerificationTokenError());
    }

    const now = this.deps.clock.now();
    const consumed = token.consume('email_verification', user.email, now);
    if (!consumed.ok) {
      return consumed;
    }
    await this.deps.tokens.save(token);

    user.verifyEmail(now);
    await this.deps.users.save(user);
    await this.deps.events.publishAll(user.pullEvents());

    return ok(undefined);
  }
}
