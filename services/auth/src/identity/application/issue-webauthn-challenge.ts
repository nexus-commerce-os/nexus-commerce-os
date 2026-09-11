import type { Clock } from '../../kernel/clock';
import type { IdGenerator } from '../../kernel/id-generator';
import { WebAuthnChallenge } from '../domain/entities/webauthn-challenge';
import { toWebAuthnChallengeId } from '../domain/value-objects/webauthn-challenge-id';
import type { WebAuthnCeremony } from '../domain/value-objects/webauthn-ceremony';
import type { WebAuthnPolicy } from '../domain/value-objects/webauthn-policy';
import type { UserId } from '../domain/value-objects/user-id';
import type { WebAuthnChallengeRepository } from '../domain/ports/webauthn-challenge-repository';
import type { TokenGenerator } from '../domain/ports/token-generator';
import type { TokenHasher } from '../domain/ports/token-hasher';

export interface IssueChallengeDeps {
  challenges: WebAuthnChallengeRepository;
  secrets: TokenGenerator;
  tokenHasher: TokenHasher;
  webauthnPolicy: WebAuthnPolicy;
  ids: IdGenerator;
  clock: Clock;
}

export interface IssuedChallenge {
  challenge: WebAuthnChallenge;
  /** The raw nonce sent to the client; only its hash is persisted. */
  rawChallenge: string;
}

/**
 * Supersede every still-pending challenge for `(user, ceremony)` and mint a
 * fresh one.
 *
 * Shared by both `Start…` use cases so the "only the newest ceremony is live"
 * rule exists in exactly one place. Not a use case itself — an internal
 * collaborator, hence not exported from the module barrel.
 *
 * A `null` user (discoverable-credential flow) has nothing to supersede: such
 * challenges are not attributable to an account until the response arrives.
 */
export async function issueWebAuthnChallenge(
  deps: IssueChallengeDeps,
  userId: UserId | null,
  ceremony: WebAuthnCeremony,
): Promise<IssuedChallenge> {
  if (userId !== null) {
    const superseded = await deps.challenges.listPending(userId, ceremony);
    for (const previous of superseded) {
      previous.invalidate();
      await deps.challenges.save(previous);
    }
  }

  const now = deps.clock.now();
  const rawChallenge = deps.secrets.generate();
  const challenge = WebAuthnChallenge.issue({
    id: toWebAuthnChallengeId(deps.ids.generate()),
    userId,
    ceremony,
    challengeHash: deps.tokenHasher.hash(rawChallenge),
    policy: deps.webauthnPolicy,
    now,
  });
  await deps.challenges.save(challenge);

  return { challenge, rawChallenge };
}
