import { Body, Controller, Get, HttpCode, Inject, Post, Req, UseGuards } from '@nestjs/common';
import type { Result } from '../kernel/result';
import type { IdentityContainer } from '../composition/identity-container';
import type { SessionSnapshot } from '../identity/domain/entities/session';
import type { UserSnapshot } from '../identity/domain/entities/user';
import { IDENTITY_CONTAINER } from './tokens';
import { Contract } from './openapi/contract';
import { DomainFailure } from './problem-details.filter';
import { SessionAuthGuard, principalOf, type AuthenticatedRequest } from './session-auth.guard';

interface RegisterBody {
  email: string;
  password: string;
  displayName: string;
  locale?: string;
  residencyRegion?: string;
}
interface LoginBody {
  email: string;
  password: string;
}
interface RefreshBody {
  refreshToken: string;
}
interface TokenBody {
  token: string;
}
interface ResetRequestBody {
  email: string;
}
interface ResetConfirmBody {
  token: string;
  newPassword: string;
}
interface LogoutAllBody {
  exceptCurrent?: boolean;
}
interface ChangePasswordBody {
  currentPassword: string;
  newPassword: string;
}
interface CompletePasskeyRegistrationBody {
  challenge: string;
  response: Readonly<Record<string, unknown>>;
  label: string;
  deviceId?: string;
  deviceLabel?: string;
  platform?: string;
}
interface StartPasskeyAuthenticationBody {
  email?: string;
}
interface CompletePasskeyAuthenticationBody {
  challenge: string;
  response: Readonly<Record<string, unknown>>;
}
interface RevokePasskeyBody {
  passkeyId: string;
}
interface StartOidcBody {
  provider: string;
  redirectUri: string;
}
interface CompleteOidcBody {
  provider: string;
  state: string;
  code: string;
}
interface UnlinkFederatedIdentityBody {
  federatedIdentityId: string;
}

/**
 * The HTTP edge of Identity.
 *
 * Controllers do exactly three things — validate against the contract, call one
 * use case, shape the reply. There is no business rule here: every decision,
 * including which failures are indistinguishable, was already made in the
 * application layer and is merely transported.
 *
 * Sessions are ours (ruling of 2026-07-31). `login` authenticates and then
 * starts a session on the NEXUS Session aggregate; the passkey and federated
 * routes will converge on the same call, so there is one session lifecycle
 * regardless of how the person proved who they are.
 */
@Controller('auth')
export class AuthController {
  private readonly contract = Contract.load();

  constructor(@Inject(IDENTITY_CONTAINER) private readonly container: IdentityContainer) {}

  @Post('register')
  @HttpCode(201)
  async register(@Body() body: unknown): Promise<RegisteredUserView> {
    const command = this.contract.validateRequest<RegisterBody>('registerUser', body);
    const user = unwrap(await this.container.useCases.registerUser.execute(command));
    return { id: user.id, email: user.email, emailVerified: user.emailVerified };
  }

  @Post('login')
  @HttpCode(200)
  async login(@Body() body: unknown): Promise<SessionIssuedView> {
    const command = this.contract.validateRequest<LoginBody>('login', body);
    const user = unwrap(await this.container.useCases.authenticateUser.execute(command));
    const started = unwrap(
      // No device binding from a password login: the client cannot be trusted to
      // nominate one, and there is nothing else here that establishes device
      // identity (I-7f).
      await this.container.useCases.startSession.execute({ userId: user.id }),
    );
    return this.issue(started.session, started.refreshToken);
  }

  @Post('session/refresh')
  @HttpCode(200)
  async refresh(@Body() body: unknown): Promise<SessionIssuedView> {
    const command = this.contract.validateRequest<RefreshBody>('refreshSession', body);
    const refreshed = unwrap(await this.container.useCases.refreshSession.execute(command));
    return this.issue(refreshed.session, refreshed.refreshToken);
  }

  @Post('email/verify')
  @HttpCode(204)
  async verifyEmail(@Body() body: unknown): Promise<void> {
    const command = this.contract.validateRequest<TokenBody>('verifyEmail', body);
    unwrap(await this.container.useCases.verifyEmail.execute(command));
  }

  /**
   * Always 202. The use case cannot fail and never reveals whether the address
   * exists; answering anything conditional here would reintroduce exactly the
   * enumeration oracle it was built to deny.
   */
  @Post('password/reset-requests')
  @HttpCode(202)
  async requestPasswordReset(@Body() body: unknown): Promise<void> {
    const command = this.contract.validateRequest<ResetRequestBody>('requestPasswordReset', body);
    await this.container.useCases.sendPasswordReset.execute(command);
  }

  @Post('password/reset')
  @HttpCode(204)
  async resetPassword(@Body() body: unknown): Promise<void> {
    const command = this.contract.validateRequest<ResetConfirmBody>('resetPassword', body);
    unwrap(await this.container.useCases.resetPassword.execute(command));
  }

  @Post('logout')
  @UseGuards(SessionAuthGuard)
  @HttpCode(204)
  async logout(@Req() request: AuthenticatedRequest, @Body() body: unknown): Promise<void> {
    this.contract.validateRequest('logout', body);
    const principal = principalOf(request);
    unwrap(
      await this.container.useCases.revokeSession.execute({
        sessionId: principal.sessionId,
        userId: principal.userId,
      }),
    );
  }

  @Post('logout-all')
  @UseGuards(SessionAuthGuard)
  @HttpCode(204)
  async logoutAll(@Req() request: AuthenticatedRequest, @Body() body: unknown): Promise<void> {
    const command = this.contract.validateRequest<LogoutAllBody>('logoutAll', body);
    const principal = principalOf(request);
    unwrap(
      await this.container.useCases.revokeAllUserSessions.execute({
        userId: principal.userId,
        reason: 'user_revoked',
        ...(command.exceptCurrent === true ? { exceptSessionId: principal.sessionId } : {}),
      }),
    );
  }

  @Post('password/change')
  @UseGuards(SessionAuthGuard)
  @HttpCode(204)
  async changePassword(@Req() request: AuthenticatedRequest, @Body() body: unknown): Promise<void> {
    const command = this.contract.validateRequest<ChangePasswordBody>('changePassword', body);
    unwrap(
      await this.container.useCases.changePassword.execute({
        userId: principalOf(request).userId,
        ...command,
      }),
    );
  }

  @Post('email/verification-requests')
  @UseGuards(SessionAuthGuard)
  @HttpCode(202)
  async requestEmailVerification(
    @Req() request: AuthenticatedRequest,
    @Body() body: unknown,
  ): Promise<void> {
    this.contract.validateRequest('requestEmailVerification', body);
    unwrap(
      await this.container.useCases.sendEmailVerification.execute({
        userId: principalOf(request).userId,
      }),
    );
  }

  // --- passkeys -------------------------------------------------------------

  @Post('passkeys/registration/start')
  @UseGuards(SessionAuthGuard)
  @HttpCode(200)
  async startPasskeyRegistration(
    @Req() request: AuthenticatedRequest,
    @Body() body: unknown,
  ): Promise<ChallengeView> {
    this.contract.validateRequest('startPasskeyRegistration', body);
    const started = unwrap(
      await this.container.useCases.startPasskeyRegistration.execute({
        userId: principalOf(request).userId,
      }),
    );
    return { challenge: started.challenge, expiresAt: started.expiresAt.toISOString() };
  }

  @Post('passkeys/registration/complete')
  @UseGuards(SessionAuthGuard)
  @HttpCode(201)
  async completePasskeyRegistration(
    @Req() request: AuthenticatedRequest,
    @Body() body: unknown,
  ): Promise<RegisteredPasskeyView> {
    const command = this.contract.validateRequest<CompletePasskeyRegistrationBody>(
      'completePasskeyRegistration',
      body,
    );
    const registered = unwrap(
      await this.container.useCases.completePasskeyRegistration.execute({
        userId: principalOf(request).userId,
        ...command,
      }),
    );
    return { passkeyId: registered.passkeyId, deviceId: registered.deviceId };
  }

  @Post('passkeys/authentication/start')
  @HttpCode(200)
  async startPasskeyAuthentication(@Body() body: unknown): Promise<ChallengeView> {
    const command = this.contract.validateRequest<StartPasskeyAuthenticationBody>(
      'startPasskeyAuthentication',
      body,
    );
    const started = unwrap(
      await this.container.useCases.startPasskeyAuthentication.execute(command),
    );
    return { challenge: started.challenge, expiresAt: started.expiresAt.toISOString() };
  }

  /**
   * Convergence point. A passkey proves who someone is; it does not create a
   * credential of its own. The assertion is exchanged here for exactly the
   * session model password login produces, and the device the credential is
   * bound to becomes the session's binding.
   */
  @Post('passkeys/authentication/complete')
  @HttpCode(200)
  async completePasskeyAuthentication(@Body() body: unknown): Promise<SessionIssuedView> {
    const command = this.contract.validateRequest<CompletePasskeyAuthenticationBody>(
      'completePasskeyAuthentication',
      body,
    );
    const authenticated = unwrap(
      await this.container.useCases.completePasskeyAuthentication.execute(command),
    );
    const started = unwrap(
      await this.container.useCases.startSession.execute({
        userId: authenticated.userId,
        ...(authenticated.deviceId === null ? {} : { deviceId: authenticated.deviceId }),
      }),
    );
    return this.issue(started.session, started.refreshToken);
  }

  @Get('passkeys')
  @UseGuards(SessionAuthGuard)
  @HttpCode(200)
  async listPasskeys(@Req() request: AuthenticatedRequest): Promise<PasskeyListView> {
    const passkeys = unwrap(
      await this.container.useCases.listUserPasskeys.execute({
        userId: principalOf(request).userId,
      }),
    );
    return {
      passkeys: passkeys.map((p) => ({
        id: p.id,
        credentialId: p.credentialId,
        label: p.label,
        transports: [...p.transports],
        deviceId: p.deviceId,
        createdAt: p.createdAt.toISOString(),
        lastUsedAt: p.lastUsedAt?.toISOString() ?? null,
        revokedAt: p.revokedAt?.toISOString() ?? null,
      })),
    };
  }

  @Post('passkeys/revoke')
  @UseGuards(SessionAuthGuard)
  @HttpCode(204)
  async revokePasskey(@Req() request: AuthenticatedRequest, @Body() body: unknown): Promise<void> {
    const command = this.contract.validateRequest<RevokePasskeyBody>('revokePasskey', body);
    unwrap(
      await this.container.useCases.revokePasskey.execute({
        userId: principalOf(request).userId,
        passkeyId: command.passkeyId,
      }),
    );
  }

  // --- federated identity ---------------------------------------------------

  /**
   * Deliberately not `@UseGuards`. Without a token this starts a sign-in; with
   * one it starts a *link* against the signed-in account. A blanket guard would
   * make the sign-in impossible, and no guard at all would let a caller name
   * any `userId` they liked — so the principal is resolved here and only ever
   * taken from a verified token.
   */
  @Post('oidc/start')
  @HttpCode(200)
  async startOidcLogin(
    @Req() request: AuthenticatedRequest,
    @Body() body: unknown,
  ): Promise<OidcStartedView> {
    const command = this.contract.validateRequest<StartOidcBody>('startOidcLogin', body);
    const linkingUserId = await this.optionalPrincipal(request);
    const started = unwrap(
      await this.container.useCases.startOidcLogin.execute({
        ...command,
        ...(linkingUserId === null ? {} : { userId: linkingUserId }),
      }),
    );
    return {
      state: started.state,
      nonce: started.nonce,
      codeVerifier: started.codeVerifier,
      expiresAt: started.expiresAt.toISOString(),
    };
  }

  /**
   * The second convergence point. The provider's tokens are consumed inside the
   * use case and stop there; what comes back to the caller is a NEXUS session,
   * identical in shape to the other two ways in.
   */
  @Post('oidc/complete')
  @HttpCode(200)
  async completeOidcLogin(@Body() body: unknown): Promise<OidcSessionIssuedView> {
    const command = this.contract.validateRequest<CompleteOidcBody>('completeOidcLogin', body);
    const completed = unwrap(await this.container.useCases.completeOidcLogin.execute(command));
    const started = unwrap(
      await this.container.useCases.startSession.execute({ userId: completed.userId }),
    );
    const issued = await this.issue(started.session, started.refreshToken);
    return { ...issued, outcome: completed.outcome };
  }

  @Get('federated-identities')
  @UseGuards(SessionAuthGuard)
  @HttpCode(200)
  async listFederatedIdentities(
    @Req() request: AuthenticatedRequest,
  ): Promise<FederatedIdentityListView> {
    const identities = unwrap(
      await this.container.useCases.listFederatedIdentities.execute({
        userId: principalOf(request).userId,
      }),
    );
    return {
      identities: identities.map((i) => ({
        id: i.id,
        provider: i.provider,
        emailAtLink: i.emailAtLink,
        linkedAt: i.linkedAt.toISOString(),
        lastUsedAt: i.lastUsedAt?.toISOString() ?? null,
        revokedAt: i.revokedAt?.toISOString() ?? null,
      })),
    };
  }

  @Post('federated-identities/unlink')
  @UseGuards(SessionAuthGuard)
  @HttpCode(204)
  async unlinkFederatedIdentity(
    @Req() request: AuthenticatedRequest,
    @Body() body: unknown,
  ): Promise<void> {
    const command = this.contract.validateRequest<UnlinkFederatedIdentityBody>(
      'unlinkFederatedIdentity',
      body,
    );
    unwrap(
      await this.container.useCases.unlinkFederatedIdentity.execute({
        userId: principalOf(request).userId,
        federatedIdentityId: command.federatedIdentityId,
      }),
    );
  }

  /**
   * The principal when a bearer token is present, null when it is absent.
   * A *present but invalid* token is still rejected — an expired session must
   * not silently downgrade a link into a fresh sign-in.
   */
  private async optionalPrincipal(request: AuthenticatedRequest): Promise<string | null> {
    const header = request.headers.authorization;
    if (header === undefined || !/^Bearer /i.test(header.trim())) {
      return null;
    }
    const authorized = await this.container.useCases.authorizeRequest.execute({
      accessToken: header.trim().slice('Bearer '.length).trim(),
    });
    if (!authorized.ok) {
      throw new DomainFailure(authorized.error);
    }
    return authorized.value.userId;
  }

  /** Derive the request credential from the session that was just established. */
  private async issue(session: SessionSnapshot, refreshToken: string): Promise<SessionIssuedView> {
    const access = await this.container.accessTokens.issue({
      userId: session.userId,
      sessionId: session.id,
    });
    return sessionIssued(session, refreshToken, access.token, access.expiresAt);
  }
}

export interface RegisteredUserView {
  id: string;
  email: string;
  emailVerified: boolean;
}

export interface SessionView {
  id: string;
  userId: string;
  status: string;
  deviceId: string | null;
  createdAt: string;
  lastUsedAt: string;
  idleExpiresAt: string;
  absoluteExpiresAt: string;
}

export interface SessionIssuedView {
  session: SessionView;
  accessToken: string;
  expiresAt: string;
  refreshToken: string;
}

/** Federation adds only what it did; the credential model is unchanged. */
export interface OidcSessionIssuedView extends SessionIssuedView {
  outcome: 'signed_in' | 'linked' | 'account_created';
}

export interface ChallengeView {
  challenge: string;
  expiresAt: string;
}

export interface RegisteredPasskeyView {
  passkeyId: string;
  deviceId: string;
}

export interface PasskeyView {
  id: string;
  credentialId: string;
  label: string;
  transports: string[];
  deviceId: string | null;
  createdAt: string;
  lastUsedAt: string | null;
  revokedAt: string | null;
}

export interface PasskeyListView {
  passkeys: PasskeyView[];
}

export interface OidcStartedView {
  state: string;
  nonce: string;
  codeVerifier: string;
  expiresAt: string;
}

export interface FederatedIdentityView {
  id: string;
  provider: string;
  emailAtLink: string | null;
  linkedAt: string;
  lastUsedAt: string | null;
  revokedAt: string | null;
}

export interface FederatedIdentityListView {
  identities: FederatedIdentityView[];
}

/** Dates cross the wire as RFC 3339 strings, as the contract declares. */
function sessionIssued(
  session: SessionSnapshot,
  refreshToken: string,
  accessToken: string,
  accessTokenExpiresAt: Date,
): SessionIssuedView {
  return {
    session: {
      id: session.id,
      userId: session.userId,
      status: session.status,
      deviceId: session.deviceId,
      createdAt: session.createdAt.toISOString(),
      lastUsedAt: session.lastUsedAt.toISOString(),
      idleExpiresAt: session.idleExpiresAt.toISOString(),
      absoluteExpiresAt: session.absoluteExpiresAt.toISOString(),
    },
    accessToken,
    expiresAt: accessTokenExpiresAt.toISOString(),
    refreshToken,
  };
}

/** A failed Result becomes a thrown DomainFailure the filter can render. */
function unwrap<T>(result: Result<T, unknown>): T {
  if (!result.ok) {
    throw new DomainFailure(result.error);
  }
  return result.value;
}

export type { UserSnapshot };
