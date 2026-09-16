import { type Result, ok, err } from '../../kernel/result';
import type { Clock } from '../../kernel/clock';
import type { IdGenerator } from '../../kernel/id-generator';
import { Email } from '../domain/value-objects/email';
import { toUserId } from '../domain/value-objects/user-id';
import { toFederatedIdentityId } from '../domain/value-objects/federated-identity-id';
import { OidcProvider } from '../domain/value-objects/oidc-provider';
import type { OidcPolicy } from '../domain/value-objects/oidc-policy';
import { Profile } from '../domain/entities/profile';
import { User } from '../domain/entities/user';
import { FederatedIdentity } from '../domain/entities/federated-identity';
import type { ConsumeOAuthRequestError } from '../domain/entities/oauth-authorization-request';
import type { UserRepository } from '../domain/ports/user-repository';
import type { OAuthAuthorizationRequestRepository } from '../domain/ports/oauth-authorization-request-repository';
import type { FederatedIdentityRepository } from '../domain/ports/federated-identity-repository';
import type { OidcTokenExchanger } from '../domain/ports/oidc-token-exchanger';
import type { OidcTokenVerifier, VerifiedIdToken } from '../domain/ports/oidc-token-verifier';
import type { TokenHasher } from '../domain/ports/token-hasher';
import type { EventPublisher } from '../domain/ports/event-publisher';
import { FederatedIdentityLinked } from '../domain/events/federated-identity-linked';
import { FederatedLoginSucceeded } from '../domain/events/federated-login-succeeded';
import {
  InvalidOidcStateError,
  InvalidOidcTokenError,
  FederatedIdentityAlreadyLinkedError,
  AccountLinkRequiresAuthenticationError,
  UserDeactivatedError,
  type OidcTokenExchangeFailedError,
} from '../domain/errors';

export interface CompleteOidcLoginCommand {
  provider: string;
  /** Raw `state` returned on the callback. */
  state: string;
  /** Authorization code returned on the callback. */
  code: string;
}

export type OidcOutcome = 'signed_in' | 'linked' | 'account_created';

export interface CompleteOidcLoginResult {
  userId: string;
  federatedIdentityId: string;
  outcome: OidcOutcome;
}

export type CompleteOidcLoginError =
  | InvalidOidcStateError
  | ConsumeOAuthRequestError
  | OidcTokenExchangeFailedError
  | InvalidOidcTokenError
  | FederatedIdentityAlreadyLinkedError
  | AccountLinkRequiresAuthenticationError
  | UserDeactivatedError;

export interface CompleteOidcLoginDeps {
  users: UserRepository;
  oauthRequests: OAuthAuthorizationRequestRepository;
  federatedIdentities: FederatedIdentityRepository;
  exchanger: OidcTokenExchanger;
  verifier: OidcTokenVerifier;
  tokenHasher: TokenHasher;
  oidcPolicy: OidcPolicy;
  ids: IdGenerator;
  clock: Clock;
  events: EventPublisher;
}

const DEFAULT_LOCALE = 'en-US';
const DEFAULT_RESIDENCY = 'us-east-1';

/**
 * Finish an OIDC callback: sign in, link, or bootstrap an account.
 *
 * Ordering is deliberate — the request is consumed and persisted **before** the
 * code is exchanged, so a failed or slow provider round-trip can never leave a
 * replayable `state` behind.
 *
 * The account is resolved by the provider's **`sub`**, never by email. Only when
 * no link exists does the address come into play, and then under the policy's
 * auto-link rule: attaching to an existing account without the user proving they
 * hold it is an account-takeover vector, so it is allowed only when the provider
 * *and* NEXUS have both verified the address. Otherwise the user is told to sign
 * in first and link explicitly.
 */
export class CompleteOidcLogin {
  constructor(private readonly deps: CompleteOidcLoginDeps) {}

  async execute(
    command: CompleteOidcLoginCommand,
  ): Promise<Result<CompleteOidcLoginResult, CompleteOidcLoginError>> {
    let provider: OidcProvider;
    try {
      provider = OidcProvider.fromSlug(command.provider);
    } catch {
      return err(new InvalidOidcStateError());
    }

    const request = await this.deps.oauthRequests.findByStateHash(
      this.deps.tokenHasher.hash(command.state),
    );
    if (request === null) {
      return err(new InvalidOidcStateError());
    }

    const now = this.deps.clock.now();
    const consumed = request.consume(provider, now);
    await this.deps.oauthRequests.save(request);
    if (!consumed.ok) {
      return consumed;
    }

    const tokens = await this.deps.exchanger.exchange({
      provider,
      code: command.code,
      codeVerifier: request.codeVerifier,
      redirectUri: request.redirectUri,
    });
    if (!tokens.ok) {
      return tokens;
    }

    const verified = await this.deps.verifier.verifyIdToken({
      provider,
      idToken: tokens.value.idToken,
    });
    if (!verified.ok) {
      return verified;
    }
    const claims = verified.value;

    // the nonce binds this token to *this* request — a domain rule, not the
    // verifier's, because only the pending request knows what was issued
    if (claims.nonce === null || !request.matchesNonce(claims.nonce)) {
      return err(new InvalidOidcTokenError('nonce mismatch'));
    }
    if (claims.subject.length === 0) {
      return err(new InvalidOidcTokenError('missing subject'));
    }

    const existing = await this.deps.federatedIdentities.findByProviderSubject(
      provider,
      claims.subject,
    );
    if (existing !== null && existing.isActive()) {
      return this.signInExisting(existing, request.userId, now);
    }

    return request.isLinkFlow()
      ? this.linkToSignedInUser(provider, claims, request.userId, now)
      : this.linkOrCreateAccount(provider, claims, now);
  }

  /** The provider account is already known: sign that user in. */
  private async signInExisting(
    identity: FederatedIdentity,
    requestUserId: ReturnType<typeof toUserId> | null,
    now: Date,
  ): Promise<Result<CompleteOidcLoginResult, CompleteOidcLoginError>> {
    // a link ceremony must not silently sign in as somebody else
    if (requestUserId !== null && requestUserId !== identity.userId) {
      return err(
        new FederatedIdentityAlreadyLinkedError(identity.provider.value, identity.subject),
      );
    }

    const user = await this.deps.users.findById(identity.userId);
    if (user === null) {
      return err(new InvalidOidcStateError());
    }
    if (!user.isActive()) {
      return err(new UserDeactivatedError(user.id));
    }

    identity.recordUse(now);
    await this.deps.federatedIdentities.save(identity);
    await this.deps.events.publishAll([
      new FederatedLoginSucceeded(identity.id, user.id, identity.provider.value, now),
    ]);

    return ok({
      userId: user.id,
      federatedIdentityId: identity.id,
      outcome: 'signed_in',
    });
  }

  /** Explicit link: the user was already signed in when the ceremony started. */
  private async linkToSignedInUser(
    provider: OidcProvider,
    claims: VerifiedIdToken,
    userId: ReturnType<typeof toUserId> | null,
    now: Date,
  ): Promise<Result<CompleteOidcLoginResult, CompleteOidcLoginError>> {
    if (userId === null) {
      return err(new InvalidOidcStateError());
    }
    const user = await this.deps.users.findById(userId);
    if (user === null) {
      return err(new InvalidOidcStateError());
    }
    if (!user.isActive()) {
      return err(new UserDeactivatedError(user.id));
    }
    return this.createLink(provider, claims, user.id, now, 'linked');
  }

  /** Plain login with an unknown provider account: attach or bootstrap. */
  private async linkOrCreateAccount(
    provider: OidcProvider,
    claims: VerifiedIdToken,
    now: Date,
  ): Promise<Result<CompleteOidcLoginResult, CompleteOidcLoginError>> {
    const email = claims.email === null ? null : Email.create(claims.email);
    const parsedEmail = email !== null && email.ok ? email.value : null;

    if (parsedEmail !== null) {
      const owner = await this.deps.users.findByEmail(parsedEmail);
      if (owner !== null) {
        if (!this.deps.oidcPolicy.allowsAutoLink(claims.emailVerified, owner.emailVerified)) {
          return err(new AccountLinkRequiresAuthenticationError(parsedEmail.value));
        }
        if (!owner.isActive()) {
          return err(new UserDeactivatedError(owner.id));
        }
        return this.createLink(provider, claims, owner.id, now, 'linked');
      }
    }

    if (parsedEmail === null) {
      return err(new InvalidOidcTokenError('provider returned no usable email'));
    }

    const profile = Profile.create({
      displayName: parsedEmail.value.split('@')[0],
      locale: DEFAULT_LOCALE,
    });
    if (!profile.ok) {
      return err(new InvalidOidcTokenError('provider returned no usable profile'));
    }

    const user = User.registerFederated({
      id: toUserId(this.deps.ids.generate()),
      email: parsedEmail,
      profile: profile.value,
      residencyRegion: DEFAULT_RESIDENCY,
      provider: provider.value,
      emailVerified: claims.emailVerified,
      now,
    });
    await this.deps.users.save(user);
    await this.deps.events.publishAll(user.pullEvents());

    return this.createLink(provider, claims, user.id, now, 'account_created');
  }

  /** Attach the provider account, enforcing one-NEXUS-account-per-provider-account. */
  private async createLink(
    provider: OidcProvider,
    claims: VerifiedIdToken,
    userId: ReturnType<typeof toUserId>,
    now: Date,
    outcome: OidcOutcome,
  ): Promise<Result<CompleteOidcLoginResult, CompleteOidcLoginError>> {
    const clash = await this.deps.federatedIdentities.findByProviderSubject(
      provider,
      claims.subject,
    );
    if (clash !== null && clash.isActive()) {
      return err(new FederatedIdentityAlreadyLinkedError(provider.value, claims.subject));
    }

    const identity = FederatedIdentity.link({
      id: toFederatedIdentityId(this.deps.ids.generate()),
      userId,
      provider,
      subject: claims.subject,
      emailAtLink: claims.email,
      now,
    });
    identity.recordUse(now);
    await this.deps.federatedIdentities.save(identity);
    await this.deps.events.publishAll([
      new FederatedIdentityLinked(identity.id, userId, provider.value, now),
    ]);

    return ok({ userId, federatedIdentityId: identity.id, outcome });
  }
}
