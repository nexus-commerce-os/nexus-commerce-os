import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { Test } from '@nestjs/testing';
import type { INestApplication } from '@nestjs/common';
import request from 'supertest';
import { AuthController } from '../auth.controller';
import { ProblemDetailsFilter } from '../problem-details.filter';
import { Contract } from '../openapi/contract';
import { IDENTITY_CONTAINER } from '../tokens';
import type { IdentityContainer } from '../../composition/identity-container';
import {
  InMemoryUserRepository,
  InMemorySessionRepository,
  InMemoryVerificationTokenRepository,
  InMemoryNotificationSender,
  ScryptPasswordHasher,
  Sha256TokenHasher,
  RandomTokenGenerator,
  UuidIdGenerator,
  SystemClock,
} from '../../identity/infrastructure';
import { DefaultPasswordPolicy } from '../../identity/domain/value-objects/password-policy';
import { DefaultSessionPolicy } from '../../identity/domain/value-objects/session-policy';
import { DefaultVerificationPolicy } from '../../identity/domain/value-objects/verification-policy';
import { RegisterUser } from '../../identity/application/register-user';
import { AuthenticateUser } from '../../identity/application/authenticate-user';
import { StartSession } from '../../identity/application/start-session';
import { RefreshSession } from '../../identity/application/refresh-session';
import { VerifyEmail } from '../../identity/application/verify-email';
import { ResetPassword } from '../../identity/application/reset-password';
import { RequestPasswordReset } from '../../identity/application/request-password-reset';
import { SendPasswordReset } from '../../identity/application/send-password-reset';
import { RequestEmailVerification } from '../../identity/application/request-email-verification';
import { SendEmailVerification } from '../../identity/application/send-email-verification';
import { RevokeSession } from '../../identity/application/revoke-session';
import { RevokeAllUserSessions } from '../../identity/application/revoke-all-user-sessions';
import { ChangePassword } from '../../identity/application/change-password';
import { AuthorizeRequest } from '../../identity/application/authorize-request';
import { JoseAccessTokenService } from '../../identity/infrastructure/tokens/jose-access-token-service';
import { SessionAuthGuard } from '../session-auth.guard';
import { InProcessEventBus } from '../../identity/infrastructure/in-process-event-bus';
import { registerIdentitySubscribers } from '../../composition/identity-container';

const ACCESS_TOKEN_SETTINGS = {
  secret: 'test-only-access-secret-not-real-00000000',
  issuer: 'https://identity.test',
  audience: 'nexus-api',
  ttlSeconds: 900,
};

const PASSWORD = 'Correct-Horse-9!';
const EMAIL = 'jane@example.com';

const contract = Contract.load();
let notifications: InMemoryNotificationSender;

/**
 * The real use cases over in-memory adapters.
 *
 * Nothing about the behaviour under test is stubbed — only the database and the
 * mail socket are replaced, so these exercise the genuine chain
 * HTTP → contract → use case → domain and back.
 */
function buildContainer(): IdentityContainer {
  const users = new InMemoryUserRepository();
  const sessions = new InMemorySessionRepository();
  const tokens = new InMemoryVerificationTokenRepository();
  // The real bus, with the real subscribers: PasswordChanged -> revoke every
  // session is a production behaviour, and a harness that omitted it would
  // quietly assert the wrong thing.
  const events = new InProcessEventBus((_event, error) => {
    throw error;
  });
  const hasher = new ScryptPasswordHasher();
  const tokenHasher = new Sha256TokenHasher();
  const secrets = new RandomTokenGenerator();
  const ids = new UuidIdGenerator();
  const clock = new SystemClock();
  const passwordPolicy = new DefaultPasswordPolicy();
  const sessionPolicy = new DefaultSessionPolicy();
  const verificationPolicy = new DefaultVerificationPolicy();
  notifications = new InMemoryNotificationSender();

  const accessTokens = new JoseAccessTokenService(ACCESS_TOKEN_SETTINGS, clock);
  const revokeAllUserSessions = new RevokeAllUserSessions({ sessions, clock, events });
  registerIdentitySubscribers(events, revokeAllUserSessions);

  const requestPasswordReset = new RequestPasswordReset({
    users,
    tokens,
    secrets,
    tokenHasher,
    policy: verificationPolicy,
    ids,
    clock,
    events,
  });

  return {
    useCases: {
      registerUser: new RegisterUser({
        users,
        hasher,
        policy: passwordPolicy,
        ids,
        clock,
        events,
      }),
      authenticateUser: new AuthenticateUser({ users, hasher }),
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
      verifyEmail: new VerifyEmail({ users, tokens, tokenHasher, clock, events }),
      resetPassword: new ResetPassword({
        users,
        tokens,
        hasher,
        tokenHasher,
        policy: passwordPolicy,
        clock,
        events,
      }),
      sendPasswordReset: new SendPasswordReset({
        requestPasswordReset,
        notifications,
        onDeliveryFailure: () => undefined,
      }),
      sendEmailVerification: new SendEmailVerification({
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
        notifications,
      }),
      revokeSession: new RevokeSession({ sessions, clock, events }),
      revokeAllUserSessions,
      changePassword: new ChangePassword({
        users,
        hasher,
        policy: passwordPolicy,
        clock,
        events,
      }),
      authorizeRequest: new AuthorizeRequest({ accessTokens, sessions, clock }),
    },
    accessTokens,
  } as unknown as IdentityContainer;
}

let app: INestApplication;

beforeEach(async () => {
  const moduleRef = await Test.createTestingModule({
    controllers: [AuthController],
    providers: [{ provide: IDENTITY_CONTAINER, useValue: buildContainer() }, SessionAuthGuard],
  }).compile();
  app = moduleRef.createNestApplication();
  app.useGlobalFilters(new ProblemDetailsFilter());
  await app.init();
});

afterEach(async () => {
  await app.close();
});

function http(): request.Agent {
  return request(app.getHttpServer());
}

async function register(overrides: Record<string, unknown> = {}): Promise<request.Response> {
  return http()
    .post('/auth/register')
    .send({ email: EMAIL, password: PASSWORD, displayName: 'Jane', ...overrides });
}

/** Every success body must match what the contract publishes. */
function expectConforms(operationId: string, status: number, body: unknown): void {
  expect(contract.validateResponse(operationId, status, body)).toEqual([]);
}

describe('AuthController — registration', () => {
  it('creates an account and returns the published shape', async () => {
    const response = await register();
    expect(response.status).toBe(201);
    expectConforms('registerUser', 201, response.body);
    expect(response.body.email).toBe(EMAIL);
    expect(response.body.emailVerified).toBe(false);
  });

  it('never returns the password or its hash', async () => {
    const response = await register();
    expect(JSON.stringify(response.body)).not.toContain(PASSWORD);
    expect(Object.keys(response.body)).toEqual(['id', 'email', 'emailVerified']);
  });

  it('rejects a duplicate address as 409, in problem+json', async () => {
    await register();
    const response = await register();
    expect(response.status).toBe(409);
    expect(response.headers['content-type']).toContain('application/problem+json');
    expect(response.body.code).toBe('EmailAlreadyInUseError');
  });

  it('rejects a body the contract forbids before any use case runs', async () => {
    const short = await register({ password: 'short' });
    expect(short.status).toBe(400);
    expect(short.body.code).toBe('ContractViolation');

    const unknownField = await register({ isAdmin: true });
    expect(unknownField.status).toBe(400);
    expect(unknownField.body.code).toBe('ContractViolation');

    const missing = await http().post('/auth/register').send({ email: EMAIL });
    expect(missing.status).toBe(400);
  });
});

describe('AuthController — session lifecycle', () => {
  it('issues a NEXUS session on login and conforms to the contract', async () => {
    await register();
    const response = await http().post('/auth/login').send({ email: EMAIL, password: PASSWORD });

    expect(response.status).toBe(200);
    expectConforms('login', 200, response.body);
    expect(response.body.session.status).toBe('active');
    expect(response.body.refreshToken.length).toBeGreaterThan(20);
  });

  it('binds the session to a device when one is supplied', async () => {
    await register();
    const response = await http()
      .post('/auth/login')
      .send({ email: EMAIL, password: PASSWORD, deviceBinding: 'device-1' });
    expect(response.body.session.deviceBinding).toBe('device-1');
  });

  /** A wrong password and an unknown account must be indistinguishable. */
  it('answers 401 identically for a bad password and an unknown account', async () => {
    await register();
    const wrong = await http()
      .post('/auth/login')
      .send({ email: EMAIL, password: 'Wrong-Pass9!x' });
    const unknown = await http()
      .post('/auth/login')
      .send({ email: 'nobody@example.com', password: PASSWORD });

    expect(wrong.status).toBe(401);
    expect(unknown.status).toBe(401);
    expect(wrong.body).toEqual(unknown.body);
  });

  it('rotates the refresh token, invalidating the presented one', async () => {
    await register();
    const login = await http().post('/auth/login').send({ email: EMAIL, password: PASSWORD });
    const first = login.body.refreshToken;

    const refreshed = await http().post('/auth/session/refresh').send({ refreshToken: first });
    expect(refreshed.status).toBe(200);
    expectConforms('refreshSession', 200, refreshed.body);
    expect(refreshed.body.refreshToken).not.toBe(first);

    // replaying the consumed token is treated as theft, not as a retry
    const replay = await http().post('/auth/session/refresh').send({ refreshToken: first });
    expect(replay.status).toBeGreaterThanOrEqual(400);
  });
});

describe('AuthController — password reset', () => {
  it('answers 202 with no body whether or not the address exists', async () => {
    await register();
    const known = await http().post('/auth/password/reset-requests').send({ email: EMAIL });
    const unknown = await http()
      .post('/auth/password/reset-requests')
      .send({ email: 'nobody@example.com' });

    expect(known.status).toBe(202);
    expect(unknown.status).toBe(202);
    expect(known.body).toEqual(unknown.body);
    expect(notifications.sent).toHaveLength(1);
  });

  it('completes a reset with the emailed token and lets the new password log in', async () => {
    await register();
    await http().post('/auth/password/reset-requests').send({ email: EMAIL });
    const token = notifications.sent[0]!.rawToken;

    const reset = await http()
      .post('/auth/password/reset')
      .send({ token, newPassword: 'Brand-New-Pass9!' });
    expect(reset.status).toBe(204);
    expect(reset.body).toEqual({});

    const relogin = await http()
      .post('/auth/login')
      .send({ email: EMAIL, password: 'Brand-New-Pass9!' });
    expect(relogin.status).toBe(200);
  });

  it('rejects an unknown reset token without saying why', async () => {
    const response = await http()
      .post('/auth/password/reset')
      .send({ token: 'not-a-real-token', newPassword: 'Brand-New-Pass9!' });
    expect(response.status).toBeGreaterThanOrEqual(400);
    expect(response.headers['content-type']).toContain('application/problem+json');
  });
});

describe('AuthController — email verification', () => {
  it('rejects an unknown verification token as problem+json', async () => {
    const response = await http().post('/auth/email/verify').send({ token: 'nope' });
    expect(response.status).toBeGreaterThanOrEqual(400);
    expect(response.body.code).toBeDefined();
  });
});

describe('AuthController — access token and authenticated routes', () => {
  async function signIn(): Promise<{ accessToken: string; refreshToken: string }> {
    await register();
    const login = await http().post('/auth/login').send({ email: EMAIL, password: PASSWORD });
    expect(login.status).toBe(200);
    expectConforms('login', 200, login.body);
    return { accessToken: login.body.accessToken, refreshToken: login.body.refreshToken };
  }

  it('returns an access token derived from the session', async () => {
    const { accessToken } = await signIn();
    expect(accessToken.split('.')).toHaveLength(3);
  });

  it('accepts the access token on an authenticated route', async () => {
    const { accessToken } = await signIn();
    const response = await http()
      .post('/auth/email/verification-requests')
      .set('Authorization', `Bearer ${accessToken}`)
      .send({});

    expect(response.status).toBe(202);
    expect(notifications.sent.some((n) => n.kind === 'email_verification')).toBe(true);
  });

  it.each([
    ['no header', undefined],
    ['a malformed header', 'Token abc'],
    ['a forged token', 'Bearer not.a.jwt'],
  ])('answers 401 for %s', async (_label, header) => {
    const call = http().post('/auth/logout');
    if (header !== undefined) {
      call.set('Authorization', header);
    }
    const response = await call.send({});
    expect(response.status).toBe(401);
    expect(response.body.code).toBe('InvalidAccessTokenError');
  });

  /** The refresh token buys access tokens; it is never itself a credential. */
  it('refuses the refresh token as a bearer credential', async () => {
    const { refreshToken } = await signIn();
    const response = await http()
      .post('/auth/logout')
      .set('Authorization', `Bearer ${refreshToken}`)
      .send({});
    expect(response.status).toBe(401);
  });

  /**
   * The point of the whole model: the session is authoritative. After logout
   * the access token is still cryptographically valid and unexpired, and must
   * stop working anyway.
   */
  it('stops honouring a still-valid access token once its session is revoked', async () => {
    const { accessToken } = await signIn();
    const bearer = `Bearer ${accessToken}`;

    expect((await http().post('/auth/logout').set('Authorization', bearer).send({})).status).toBe(
      204,
    );

    const after = await http().post('/auth/logout').set('Authorization', bearer).send({});
    expect(after.status).toBe(401);
    expect(after.body.code).toBe('InvalidAccessTokenError');
  });

  it('signs out every session with logout-all', async () => {
    const { accessToken } = await signIn();
    const second = await http().post('/auth/login').send({ email: EMAIL, password: PASSWORD });

    const response = await http()
      .post('/auth/logout-all')
      .set('Authorization', `Bearer ${accessToken}`)
      .send({});
    expect(response.status).toBe(204);

    const stillValid = await http()
      .post('/auth/logout')
      .set('Authorization', `Bearer ${second.body.accessToken}`)
      .send({});
    expect(stillValid.status).toBe(401);
  });

  it('changes the password and revokes the sessions it was opened with', async () => {
    const { accessToken } = await signIn();
    const bearer = `Bearer ${accessToken}`;

    const changed = await http()
      .post('/auth/password/change')
      .set('Authorization', bearer)
      .send({ currentPassword: PASSWORD, newPassword: 'Rotated-Passw0rd!' });
    expect(changed.status).toBe(204);

    expect((await http().post('/auth/logout').set('Authorization', bearer).send({})).status).toBe(
      401,
    );
    const relogin = await http()
      .post('/auth/login')
      .send({ email: EMAIL, password: 'Rotated-Passw0rd!' });
    expect(relogin.status).toBe(200);
  });

  it('rejects a wrong current password without changing anything', async () => {
    const { accessToken } = await signIn();
    const response = await http()
      .post('/auth/password/change')
      .set('Authorization', `Bearer ${accessToken}`)
      .send({ currentPassword: 'Not-The-Passw0rd!', newPassword: 'Rotated-Passw0rd!' });

    expect(response.status).toBe(401);
    const login = await http().post('/auth/login').send({ email: EMAIL, password: PASSWORD });
    expect(login.status).toBe(200);
  });
});
