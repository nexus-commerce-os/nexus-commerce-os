import type { Clock } from '../../kernel/clock';
import type { IdGenerator } from '../../kernel/id-generator';
import type { User } from '../domain/entities/user';
import { VerificationToken } from '../domain/entities/verification-token';
import { toVerificationTokenId } from '../domain/value-objects/verification-token-id';
import type { VerificationPurpose } from '../domain/value-objects/verification-purpose';
import type { VerificationPolicy } from '../domain/value-objects/verification-policy';
import type { VerificationTokenRepository } from '../domain/ports/verification-token-repository';
import type { TokenGenerator } from '../domain/ports/token-generator';
import type { TokenHasher } from '../domain/ports/token-hasher';

export interface IssueVerificationTokenDeps {
  tokens: VerificationTokenRepository;
  secrets: TokenGenerator;
  tokenHasher: TokenHasher;
  policy: VerificationPolicy;
  ids: IdGenerator;
  clock: Clock;
}

export interface IssuedToken {
  token: VerificationToken;
  /** The raw secret — returned once, never persisted and never put on an event. */
  rawToken: string;
}

/**
 * Supersede every still-pending token for `(user, purpose)` and mint a fresh one.
 *
 * Shared by both request flows so the "only the newest link works" rule exists in
 * exactly one place. Not a use case itself — an internal collaborator, which is
 * why it is not exported from the module barrel.
 */
export async function issueVerificationToken(
  deps: IssueVerificationTokenDeps,
  user: User,
  purpose: VerificationPurpose,
): Promise<IssuedToken> {
  const superseded = await deps.tokens.listPending(user.id, purpose);
  for (const previous of superseded) {
    previous.invalidate();
    await deps.tokens.save(previous);
  }

  const now = deps.clock.now();
  const rawToken = deps.secrets.generate();
  const token = VerificationToken.issue({
    id: toVerificationTokenId(deps.ids.generate()),
    userId: user.id,
    purpose,
    email: user.email,
    tokenHash: deps.tokenHasher.hash(rawToken),
    policy: deps.policy,
    now,
  });
  await deps.tokens.save(token);

  return { token, rawToken };
}
