import { Body, Controller, HttpCode, Inject, Post } from '@nestjs/common';
import type { Result } from '../kernel/result';
import type { IdentityContainer } from '../composition/identity-container';
import type { SessionSnapshot } from '../identity/domain/entities/session';
import type { UserSnapshot } from '../identity/domain/entities/user';
import { IDENTITY_CONTAINER } from './tokens';
import { Contract } from './openapi/contract';
import { DomainFailure } from './problem-details.filter';

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
  deviceBinding?: string;
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
      await this.container.useCases.startSession.execute({
        userId: user.id,
        ...(command.deviceBinding === undefined ? {} : { deviceBinding: command.deviceBinding }),
      }),
    );
    return sessionIssued(started.session, started.refreshToken);
  }

  @Post('session/refresh')
  @HttpCode(200)
  async refresh(@Body() body: unknown): Promise<SessionIssuedView> {
    const command = this.contract.validateRequest<RefreshBody>('refreshSession', body);
    const refreshed = unwrap(await this.container.useCases.refreshSession.execute(command));
    return sessionIssued(refreshed.session, refreshed.refreshToken);
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
  deviceBinding: string | null;
  createdAt: string;
  lastUsedAt: string;
  idleExpiresAt: string;
  absoluteExpiresAt: string;
}

export interface SessionIssuedView {
  session: SessionView;
  refreshToken: string;
}

/** Dates cross the wire as RFC 3339 strings, as the contract declares. */
function sessionIssued(session: SessionSnapshot, refreshToken: string): SessionIssuedView {
  return {
    session: {
      id: session.id,
      userId: session.userId,
      status: session.status,
      deviceBinding: session.deviceBinding,
      createdAt: session.createdAt.toISOString(),
      lastUsedAt: session.lastUsedAt.toISOString(),
      idleExpiresAt: session.idleExpiresAt.toISOString(),
      absoluteExpiresAt: session.absoluteExpiresAt.toISOString(),
    },
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
