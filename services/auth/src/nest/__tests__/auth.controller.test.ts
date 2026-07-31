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
  InMemoryEventPublisher,
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
  const events = new InMemoryEventPublisher();
  const hasher = new ScryptPasswordHasher();
  const tokenHasher = new Sha256TokenHasher();
  const secrets = new RandomTokenGenerator();
  const ids = new UuidIdGenerator();
  const clock = new SystemClock();
  const passwordPolicy = new DefaultPasswordPolicy();
  const sessionPolicy = new DefaultSessionPolicy();
  const verificationPolicy = new DefaultVerificationPolicy();
  notifications = new InMemoryNotificationSender();

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
    },
  } as unknown as IdentityContainer;
}

let app: INestApplication;

beforeEach(async () => {
  const moduleRef = await Test.createTestingModule({
    controllers: [AuthController],
    providers: [{ provide: IDENTITY_CONTAINER, useValue: buildContainer() }],
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
