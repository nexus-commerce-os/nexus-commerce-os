import { type Result, ok, err } from '../../kernel/result';
import type { Clock } from '../../kernel/clock';
import type { IdGenerator } from '../../kernel/id-generator';
import { isUserId, toUserId } from '../domain/value-objects/user-id';
import { toOAuthRequestId } from '../domain/value-objects/oauth-request-id';
import { OidcProvider } from '../domain/value-objects/oidc-provider';
import type { OidcPolicy } from '../domain/value-objects/oidc-policy';
import { OAuthAuthorizationRequest } from '../domain/entities/oauth-authorization-request';
import type { UserRepository } from '../domain/ports/user-repository';
import type { OAuthAuthorizationRequestRepository } from '../domain/ports/oauth-authorization-request-repository';
import type { TokenGenerator } from '../domain/ports/token-generator';
import type { TokenHasher } from '../domain/ports/token-hasher';
import { UserNotFoundError, UserDeactivatedError, InvalidOidcStateError } from '../domain/errors';

export interface StartOidcLoginCommand {
  provider: string;
  redirectUri: string;
  /** Present for a *link* flow: an already-signed-in user attaching a provider. */
  userId?: string;
}

export interface StartOidcLoginResult {
  /** CSRF token for the authorization URL; only its hash is stored. */
  state: string;
  /** Replay guard the provider must echo inside the `id_token`. */
  nonce: string;
  /** PKCE challenge input; the verifier stays server-side until the callback. */
  codeVerifier: string;
  expiresAt: Date;
}

export type StartOidcLoginError = InvalidOidcStateError | UserNotFoundError | UserDeactivatedError;

export interface StartOidcLoginDeps {
  users: UserRepository;
  oauthRequests: OAuthAuthorizationRequestRepository;
  secrets: TokenGenerator;
  tokenHasher: TokenHasher;
  oidcPolicy: OidcPolicy;
  ids: IdGenerator;
  clock: Clock;
}

/**
 * Begin an OIDC sign-in, or a link if `userId` is supplied.
 *
 * Mints the three anti-forgery values of the ceremony — `state`, `nonce` and a
 * PKCE `codeVerifier` — each from the same 256-bit CSPRNG the rest of the module
 * uses. Only the state **hash** is persisted; the caller passes `state` and a
 * challenge derived from `codeVerifier` to the provider.
 *
 * A link flow supersedes that user's other pending requests for the same
 * provider, so only the newest ceremony can complete. A plain login has no user
 * yet, so there is nothing to supersede.
 */
export class StartOidcLogin {
  constructor(private readonly deps: StartOidcLoginDeps) {}

  async execute(
    command: StartOidcLoginCommand,
  ): Promise<Result<StartOidcLoginResult, StartOidcLoginError>> {
    let provider: OidcProvider;
    try {
      provider = OidcProvider.fromSlug(command.provider);
    } catch {
      return err(new InvalidOidcStateError());
    }
    if (command.redirectUri.length === 0) {
      return err(new InvalidOidcStateError());
    }

    let userId = null as ReturnType<typeof toUserId> | null;
    if (command.userId !== undefined) {
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
      userId = user.id;

      for (const previous of await this.deps.oauthRequests.listPending(user.id, provider)) {
        previous.invalidate();
        await this.deps.oauthRequests.save(previous);
      }
    }

    const now = this.deps.clock.now();
    const state = this.deps.secrets.generate();
    const request = OAuthAuthorizationRequest.start({
      id: toOAuthRequestId(this.deps.ids.generate()),
      provider,
      stateHash: this.deps.tokenHasher.hash(state),
      nonce: this.deps.secrets.generate(),
      codeVerifier: this.deps.secrets.generate(),
      redirectUri: command.redirectUri,
      userId,
      policy: this.deps.oidcPolicy,
      now,
    });
    await this.deps.oauthRequests.save(request);

    return ok({
      state,
      nonce: request.nonce,
      codeVerifier: request.codeVerifier,
      expiresAt: request.expiresAt,
    });
  }
}
