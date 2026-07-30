import { Pool } from 'pg';
import type { IdentityConfig } from '../config/identity-config';
import type { DomainEvent } from '../kernel/domain-event';
import { SystemClock } from '../identity/infrastructure/system-clock';
import { UuidIdGenerator } from '../identity/infrastructure/uuid-id-generator';
import { ScryptPasswordHasher } from '../identity/infrastructure/scrypt-password-hasher';
import { HmacTokenHasher } from '../identity/infrastructure/hmac-token-hasher';
import { RandomTokenGenerator } from '../identity/infrastructure/random-token-generator';
import { InProcessEventBus } from '../identity/infrastructure/in-process-event-bus';
import { PostgresUserRepository } from '../identity/infrastructure/postgres/postgres-user-repository';
import { PostgresSessionRepository } from '../identity/infrastructure/postgres/postgres-session-repository';
import { PostgresVerificationTokenRepository } from '../identity/infrastructure/postgres/postgres-verification-token-repository';
import { PostgresPasskeyCredentialRepository } from '../identity/infrastructure/postgres/postgres-passkey-credential-repository';
import { PostgresWebAuthnChallengeRepository } from '../identity/infrastructure/postgres/postgres-webauthn-challenge-repository';
import { SimpleWebAuthnVerifier } from '../identity/infrastructure/webauthn/simplewebauthn-verifier';
import { PostgresOAuthAuthorizationRequestRepository } from '../identity/infrastructure/postgres/postgres-oauth-authorization-request-repository';
import { JoseOidcTokenVerifier } from '../identity/infrastructure/oidc/jose-oidc-token-verifier';
import { HttpOidcTokenExchanger } from '../identity/infrastructure/oidc/http-oidc-token-exchanger';
import { PostgresDeviceRepository } from '../identity/infrastructure/postgres/postgres-device-repository';
import { PostgresFederatedIdentityRepository } from '../identity/infrastructure/postgres/postgres-federated-identity-repository';
import { DefaultPasswordPolicy } from '../identity/domain/value-objects/password-policy';
import { DefaultSessionPolicy } from '../identity/domain/value-objects/session-policy';
import { DefaultVerificationPolicy } from '../identity/domain/value-objects/verification-policy';
import { DefaultWebAuthnPolicy } from '../identity/domain/value-objects/webauthn-policy';
import { DefaultOidcPolicy } from '../identity/domain/value-objects/oidc-policy';
import { RegisterUser } from '../identity/application/register-user';
import { AuthenticateUser } from '../identity/application/authenticate-user';
import { ChangePassword } from '../identity/application/change-password';
import { StartSession } from '../identity/application/start-session';
import { RefreshSession } from '../identity/application/refresh-session';
import { RevokeSession } from '../identity/application/revoke-session';
import { RevokeAllUserSessions } from '../identity/application/revoke-all-user-sessions';
import { RequestEmailVerification } from '../identity/application/request-email-verification';
import { VerifyEmail } from '../identity/application/verify-email';
import { RequestPasswordReset } from '../identity/application/request-password-reset';
import { ResetPassword } from '../identity/application/reset-password';
import { StartPasskeyRegistration } from '../identity/application/start-passkey-registration';
import { CompletePasskeyRegistration } from '../identity/application/complete-passkey-registration';
import { StartPasskeyAuthentication } from '../identity/application/start-passkey-authentication';
import { CompletePasskeyAuthentication } from '../identity/application/complete-passkey-authentication';
import { RevokePasskey } from '../identity/application/revoke-passkey';
import { ListUserPasskeys } from '../identity/application/list-user-passkeys';
import { RevokeDevice } from '../identity/application/revoke-device';
import { StartOidcLogin } from '../identity/application/start-oidc-login';
import { CompleteOidcLogin } from '../identity/application/complete-oidc-login';
import { UnlinkFederatedIdentity } from '../identity/application/unlink-federated-identity';
import { ListFederatedIdentities } from '../identity/application/list-federated-identities';

/** Everything the HTTP layer is allowed to reach for. */
export interface IdentityContainer {
  readonly pool: Pool;
  readonly events: InProcessEventBus;
  readonly useCases: {
    readonly registerUser: RegisterUser;
    readonly authenticateUser: AuthenticateUser;
    readonly changePassword: ChangePassword;
    readonly startSession: StartSession;
    readonly refreshSession: RefreshSession;
    readonly revokeSession: RevokeSession;
    readonly revokeAllUserSessions: RevokeAllUserSessions;
    readonly requestEmailVerification: RequestEmailVerification;
    readonly verifyEmail: VerifyEmail;
    readonly requestPasswordReset: RequestPasswordReset;
    readonly resetPassword: ResetPassword;
    readonly startPasskeyRegistration: StartPasskeyRegistration;
    readonly completePasskeyRegistration: CompletePasskeyRegistration;
    readonly startPasskeyAuthentication: StartPasskeyAuthentication;
    readonly completePasskeyAuthentication: CompletePasskeyAuthentication;
    readonly revokePasskey: RevokePasskey;
    readonly listUserPasskeys: ListUserPasskeys;
    readonly revokeDevice: RevokeDevice;
    readonly startOidcLogin: StartOidcLogin;
    readonly completeOidcLogin: CompleteOidcLogin;
    readonly unlinkFederatedIdentity: UnlinkFederatedIdentity;
    readonly listFederatedIdentities: ListFederatedIdentities;
  };
  close(): Promise<void>;
}

export interface ContainerOptions {
  /** Reported when a subscriber throws; the publishing write is already committed. */
  onHandlerError?: (event: DomainEvent, error: unknown) => void;
}

/**
 * Composition root: the single place that knows which concrete adapter backs
 * each port. Everything above it — aggregates, use cases — sees only interfaces,
 * which is what has kept the domain unchanged from I-1 through I-6.
 *
 * As of I-7d every use case is wired against a real adapter — the last two
 * verifier ports deferred by Path A (WebAuthn in I-7c, OIDC here) now have
 * genuine implementations, so nothing in this graph is a stand-in.
 *
 * With no providers configured, federated sign-in refuses cleanly as an unknown
 * provider rather than half-attempting a ceremony it cannot finish.
 */
export function createIdentityContainer(
  config: IdentityConfig,
  options: ContainerOptions = {},
): IdentityContainer {
  const pool = new Pool({ connectionString: config.databaseUrl });
  const clock = new SystemClock();
  const ids = new UuidIdGenerator();
  const hasher = new ScryptPasswordHasher();
  const tokenHasher = new HmacTokenHasher(config.tokenPepper);
  const secrets = new RandomTokenGenerator();
  const events = new InProcessEventBus(
    options.onHandlerError ??
      ((event, error) => {
        console.error(`[identity] handler failed for ${event.type}:`, error);
      }),
  );

  const users = new PostgresUserRepository(pool);
  const sessions = new PostgresSessionRepository(pool);
  const tokens = new PostgresVerificationTokenRepository(pool);
  const passkeys = new PostgresPasskeyCredentialRepository(pool);
  const challenges = new PostgresWebAuthnChallengeRepository(pool);
  const oauthRequests = new PostgresOAuthAuthorizationRequestRepository(pool);
  const devices = new PostgresDeviceRepository(pool);
  const federatedIdentities = new PostgresFederatedIdentityRepository(pool);

  const passwordPolicy = new DefaultPasswordPolicy();
  const sessionPolicy = new DefaultSessionPolicy();
  const verificationPolicy = new DefaultVerificationPolicy();
  const webauthnPolicy = new DefaultWebAuthnPolicy();
  const verifier = new SimpleWebAuthnVerifier({ rpId: config.rpId, origin: config.rpOrigin });
  const oidcPolicy = new DefaultOidcPolicy();
  const oidcVerifier = new JoseOidcTokenVerifier(config.oidcProviders);
  const exchanger = new HttpOidcTokenExchanger(config.oidcProviders);

  const revokeAllUserSessions = new RevokeAllUserSessions({ sessions, clock, events });

  const useCases = {
    registerUser: new RegisterUser({ users, hasher, policy: passwordPolicy, ids, clock, events }),
    authenticateUser: new AuthenticateUser({ users, hasher }),
    changePassword: new ChangePassword({ users, hasher, policy: passwordPolicy, clock, events }),
    startSession: new StartSession({
      sessions,
      users,
      tokens: secrets,
      tokenHasher,
      policy: sessionPolicy,
      ids,
      clock,
      events,
    }),
    refreshSession: new RefreshSession({
      sessions,
      tokens: secrets,
      tokenHasher,
      policy: sessionPolicy,
      clock,
      events,
    }),
    revokeSession: new RevokeSession({ sessions, clock, events }),
    revokeAllUserSessions,
    requestEmailVerification: new RequestEmailVerification({
      users,
      tokens,
      secrets,
      tokenHasher,
      policy: verificationPolicy,
      ids,
      clock,
      events,
    }),
    verifyEmail: new VerifyEmail({ users, tokens, tokenHasher, clock, events }),
    requestPasswordReset: new RequestPasswordReset({
      users,
      tokens,
      secrets,
      tokenHasher,
      policy: verificationPolicy,
      ids,
      clock,
      events,
    }),
    resetPassword: new ResetPassword({
      users,
      tokens,
      hasher,
      tokenHasher,
      policy: passwordPolicy,
      clock,
      events,
    }),
    startPasskeyRegistration: new StartPasskeyRegistration({
      users,
      challenges,
      secrets,
      tokenHasher,
      webauthnPolicy,
      ids,
      clock,
    }),
    completePasskeyRegistration: new CompletePasskeyRegistration({
      users,
      challenges,
      passkeys,
      devices,
      verifier,
      tokenHasher,
      ids,
      clock,
      events,
    }),
    startPasskeyAuthentication: new StartPasskeyAuthentication({
      users,
      challenges,
      secrets,
      tokenHasher,
      webauthnPolicy,
      ids,
      clock,
    }),
    completePasskeyAuthentication: new CompletePasskeyAuthentication({
      users,
      challenges,
      passkeys,
      devices,
      verifier,
      tokenHasher,
      clock,
      events,
    }),
    revokePasskey: new RevokePasskey({ users, passkeys, federatedIdentities, clock, events }),
    listUserPasskeys: new ListUserPasskeys({ passkeys }),
    revokeDevice: new RevokeDevice({ devices, clock, events }),
    startOidcLogin: new StartOidcLogin({
      users,
      oauthRequests,
      secrets,
      tokenHasher,
      oidcPolicy,
      ids,
      clock,
    }),
    completeOidcLogin: new CompleteOidcLogin({
      users,
      oauthRequests,
      federatedIdentities,
      exchanger,
      verifier: oidcVerifier,
      tokenHasher,
      oidcPolicy,
      ids,
      clock,
      events,
    }),
    unlinkFederatedIdentity: new UnlinkFederatedIdentity({
      users,
      federatedIdentities,
      passkeys,
      clock,
      events,
    }),
    listFederatedIdentities: new ListFederatedIdentities({ federatedIdentities }),
  } as const;

  registerIdentitySubscribers(events, revokeAllUserSessions);

  return {
    pool,
    events,
    useCases,
    close: async (): Promise<void> => {
      await pool.end();
    },
  };
}

/**
 * The reactions that make separate use cases cooperate without depending on
 * each other.
 *
 * `PasswordChanged` → revoke every session. Both `ChangePassword` and
 * `ResetPassword` emit it, so a stolen session cannot outlive the credential it
 * was opened with (docs/08 threat X7) — and neither use case had to learn what
 * a session is.
 */
export function registerIdentitySubscribers(
  events: InProcessEventBus,
  revokeAllUserSessions: RevokeAllUserSessions,
): void {
  events.subscribe('identity.user.password_changed', async (event) => {
    await revokeAllUserSessions.execute({
      userId: event.aggregateId,
      reason: 'password_changed',
    });
  });
}
