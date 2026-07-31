import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { Test } from '@nestjs/testing';
import type { INestApplication } from '@nestjs/common';
import request from 'supertest';
import { AuthController } from '../auth.controller';
import { ProblemDetailsFilter } from '../problem-details.filter';
import { SessionAuthGuard } from '../session-auth.guard';
import { Contract } from '../openapi/contract';
import { IDENTITY_CONTAINER } from '../tokens';
import type { IdentityContainer } from '../../composition/identity-container';
import { InMemorySessionRepository } from '../../identity/infrastructure/in-memory-session-repository';
import { JoseAccessTokenService } from '../../identity/infrastructure/tokens/jose-access-token-service';
import { DefaultSessionPolicy } from '../../identity/domain/value-objects/session-policy';
import { StartSession } from '../../identity/application/start-session';
import { AuthorizeRequest } from '../../identity/application/authorize-request';
import { StartPasskeyRegistration } from '../../identity/application/start-passkey-registration';
import { CompletePasskeyRegistration } from '../../identity/application/complete-passkey-registration';
import { StartPasskeyAuthentication } from '../../identity/application/start-passkey-authentication';
import { CompletePasskeyAuthentication } from '../../identity/application/complete-passkey-authentication';
import { ListUserPasskeys } from '../../identity/application/list-user-passkeys';
import { RevokePasskey } from '../../identity/application/revoke-passkey';
import { StartOidcLogin } from '../../identity/application/start-oidc-login';
import { CompleteOidcLogin } from '../../identity/application/complete-oidc-login';
import { ListFederatedIdentities } from '../../identity/application/list-federated-identities';
import { UnlinkFederatedIdentity } from '../../identity/application/unlink-federated-identity';
import {
  buildPasskeyFixture,
  buildOidcFixture,
  type PasskeyFixture,
  type OidcFixture,
} from '../../identity/__tests__/support';
import { verifiedIdToken } from '../../identity/__tests__/oidc-doubles';

const ACCESS = {
  secret: 'test-only-access-secret-not-real-00000000',
  issuer: 'https://identity.test',
  audience: 'nexus-api',
  ttlSeconds: 900,
};
const REDIRECT = 'https://nexus.example/callback';

const contract = Contract.load();

/**
 * Convergence (ruling of 2026-07-31).
 *
 * Password, passkey and federated sign-in are three ways of proving who someone
 * is. None of them may invent a credential of its own: each must hand back the
 * one NEXUS session model. These tests drive the real use cases over the
 * existing in-memory graph — only the WebAuthn and OIDC verifiers are doubles,
 * because their cryptography is proven in I-7c/I-7d and what is under test here
 * is what happens *after* a successful proof.
 */
async function appFor(container: IdentityContainer): Promise<INestApplication> {
  const moduleRef = await Test.createTestingModule({
    controllers: [AuthController],
    providers: [{ provide: IDENTITY_CONTAINER, useValue: container }, SessionAuthGuard],
  }).compile();
  const app = moduleRef.createNestApplication();
  app.useGlobalFilters(new ProblemDetailsFilter());
  await app.init();
  return app;
}

/** The credential model every path must produce. */
function expectSessionModel(body: unknown, userId: string): void {
  expect(contract.validateResponse('login', 200, body)).toEqual([]);
  const issued = body as { session: { userId: string; status: string }; refreshToken: string };
  expect(issued.session.userId).toBe(userId);
  expect(issued.session.status).toBe('active');
  expect(issued.refreshToken.length).toBeGreaterThan(20);
}

describe('convergence — passkey authentication', () => {
  let fx: PasskeyFixture;
  let app: INestApplication;
  let sessions: InMemorySessionRepository;

  beforeEach(async () => {
    fx = await buildPasskeyFixture();
    sessions = new InMemorySessionRepository();
    const accessTokens = new JoseAccessTokenService(ACCESS, fx.clock);

    // Register a credential up front: this suite is about what authentication
    // yields, and registration has its own coverage.
    const startReg = await new StartPasskeyRegistration(fx).execute({ userId: fx.userId });
    if (!startReg.ok) {
      throw new Error('fixture invariant broken');
    }
    const registered = await new CompletePasskeyRegistration(fx).execute({
      userId: fx.userId,
      challenge: startReg.value.challenge,
      response: {},
      label: 'Test key',
    });
    if (!registered.ok) {
      throw new Error(`fixture invariant broken: ${registered.error._tag}`);
    }
    fx.events.drain();

    const startSession = new StartSession({
      sessions,
      users: fx.users,
      devices: fx.devices,
      tokens: fx.secrets,
      tokenHasher: fx.tokenHasher,
      policy: new DefaultSessionPolicy(),
      ids: fx.ids,
      clock: fx.clock,
      events: fx.events,
    });

    app = await appFor({
      accessTokens,
      useCases: {
        startSession,
        startPasskeyAuthentication: new StartPasskeyAuthentication(fx),
        completePasskeyAuthentication: new CompletePasskeyAuthentication(fx),
        startPasskeyRegistration: new StartPasskeyRegistration(fx),
        completePasskeyRegistration: new CompletePasskeyRegistration(fx),
        listUserPasskeys: new ListUserPasskeys(fx),
        revokePasskey: new RevokePasskey({ ...fx, clock: fx.clock }),
        authorizeRequest: new AuthorizeRequest({ accessTokens, sessions, clock: fx.clock }),
      },
    } as unknown as IdentityContainer);
  });

  afterEach(async () => {
    await app.close();
  });

  async function signIn(): Promise<request.Response> {
    const started = await request(app.getHttpServer())
      .post('/auth/passkeys/authentication/start')
      .send({ email: fx.email });
    expect(started.status).toBe(200);
    expect(contract.validateResponse('startPasskeyAuthentication', 200, started.body)).toEqual([]);

    return request(app.getHttpServer())
      .post('/auth/passkeys/authentication/complete')
      .send({ challenge: started.body.challenge, response: { id: 'cred-AAAA' } });
  }

  it('yields the same session credential model as password login', async () => {
    const response = await signIn();
    expect(response.status, JSON.stringify(response.body)).toBe(200);
    expectSessionModel(response.body, fx.userId);
  });

  it('binds the session to the device the credential belongs to', async () => {
    const response = await signIn();
    // Asserted as a uuid rather than merely "not null": a renamed or absent
    // field would read as `undefined`, and `undefined` is not null, so a
    // weaker assertion would pass while testing nothing.
    expect(response.body.session.deviceId).toMatch(
      /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i,
    );
  });

  it('issues an access token that works on an authenticated route', async () => {
    const response = await signIn();
    const listed = await request(app.getHttpServer())
      .get('/auth/passkeys')
      .set('Authorization', `Bearer ${response.body.accessToken}`);

    expect(listed.status).toBe(200);
    expect(contract.validateResponse('listPasskeys', 200, listed.body)).toEqual([]);
    expect(listed.body.passkeys).toHaveLength(1);
  });

  /** The WebAuthn artefact proves identity once; it is not a bearer credential. */
  it('refuses the ceremony challenge as a request credential', async () => {
    const started = await request(app.getHttpServer())
      .post('/auth/passkeys/authentication/start')
      .send({ email: fx.email });

    const listed = await request(app.getHttpServer())
      .get('/auth/passkeys')
      .set('Authorization', `Bearer ${started.body.challenge}`);
    expect(listed.status).toBe(401);
  });

  it('consumes the challenge, so the same ceremony cannot be replayed', async () => {
    const started = await request(app.getHttpServer())
      .post('/auth/passkeys/authentication/start')
      .send({ email: fx.email });

    const first = await request(app.getHttpServer())
      .post('/auth/passkeys/authentication/complete')
      .send({ challenge: started.body.challenge, response: { id: 'cred-AAAA' } });
    expect(first.status).toBe(200);

    const replay = await request(app.getHttpServer())
      .post('/auth/passkeys/authentication/complete')
      .send({ challenge: started.body.challenge, response: { id: 'cred-AAAA' } });
    expect(replay.status).toBeGreaterThanOrEqual(400);
  });

  it('never exposes internal credential telemetry in the list view', async () => {
    const response = await signIn();
    const listed = await request(app.getHttpServer())
      .get('/auth/passkeys')
      .set('Authorization', `Bearer ${response.body.accessToken}`);

    const keys = Object.keys(listed.body.passkeys[0]);
    for (const internal of ['signCount', 'aaguid', 'backupEligible', 'backupState', 'userId']) {
      expect(keys).not.toContain(internal);
    }
  });
});

describe('convergence — federated (OIDC) authentication', () => {
  let fx: OidcFixture;
  let app: INestApplication;
  let sessions: InMemorySessionRepository;

  beforeEach(async () => {
    fx = await buildOidcFixture();
    sessions = new InMemorySessionRepository();
    const accessTokens = new JoseAccessTokenService(ACCESS, fx.clock);

    const startSession = new StartSession({
      sessions,
      users: fx.users,
      devices: fx.devices,
      tokens: fx.secrets,
      tokenHasher: fx.tokenHasher,
      policy: new DefaultSessionPolicy(),
      ids: fx.ids,
      clock: fx.clock,
      events: fx.events,
    });

    app = await appFor({
      accessTokens,
      useCases: {
        startSession,
        startOidcLogin: new StartOidcLogin(fx),
        completeOidcLogin: new CompleteOidcLogin(fx),
        listFederatedIdentities: new ListFederatedIdentities(fx),
        unlinkFederatedIdentity: new UnlinkFederatedIdentity({ ...fx, clock: fx.clock }),
        authorizeRequest: new AuthorizeRequest({ accessTokens, sessions, clock: fx.clock }),
      },
    } as unknown as IdentityContainer);
  });

  afterEach(async () => {
    await app.close();
  });

  async function federate(): Promise<request.Response> {
    const started = await request(app.getHttpServer())
      .post('/auth/oidc/start')
      .send({ provider: 'google', redirectUri: REDIRECT });
    expect(started.status).toBe(200);
    expect(contract.validateResponse('startOidcLogin', 200, started.body)).toEqual([]);

    fx.verifier.setClaims(verifiedIdToken({ nonce: started.body.nonce }));
    fx.events.drain();

    return request(app.getHttpServer())
      .post('/auth/oidc/complete')
      .send({ provider: 'google', state: started.body.state, code: 'an-authorization-code' });
  }

  it('creates a NEXUS session and reports what the federation did', async () => {
    const response = await federate();
    expect(response.status).toBe(200);
    expect(contract.validateResponse('completeOidcLogin', 200, response.body)).toEqual([]);
    expect(['signed_in', 'linked', 'account_created']).toContain(response.body.outcome);
  });

  /**
   * The convergence proof: strip the one federation-specific field and what
   * remains must validate as the very schema password login returns.
   */
  it('returns the password-login credential model once outcome is removed', async () => {
    const response = await federate();
    const credential = Object.fromEntries(
      Object.entries(response.body).filter(([key]) => key !== 'outcome'),
    );
    expectSessionModel(credential, response.body.session.userId);
  });

  it('issues an access token that works on an authenticated route', async () => {
    const response = await federate();
    const listed = await request(app.getHttpServer())
      .get('/auth/federated-identities')
      .set('Authorization', `Bearer ${response.body.accessToken}`);

    expect(listed.status).toBe(200);
    expect(contract.validateResponse('listFederatedIdentities', 200, listed.body)).toEqual([]);
    expect(listed.body.identities).toHaveLength(1);
  });

  /** A provider artefact must never be accepted as a NEXUS request credential. */
  it('refuses the OIDC state as a request credential', async () => {
    const started = await request(app.getHttpServer())
      .post('/auth/oidc/start')
      .send({ provider: 'google', redirectUri: REDIRECT });

    const listed = await request(app.getHttpServer())
      .get('/auth/federated-identities')
      .set('Authorization', `Bearer ${started.body.state}`);
    expect(listed.status).toBe(401);
  });

  it('rejects a replayed state, so a callback cannot be reused', async () => {
    const started = await request(app.getHttpServer())
      .post('/auth/oidc/start')
      .send({ provider: 'google', redirectUri: REDIRECT });
    fx.verifier.setClaims(verifiedIdToken({ nonce: started.body.nonce }));

    const first = await request(app.getHttpServer())
      .post('/auth/oidc/complete')
      .send({ provider: 'google', state: started.body.state, code: 'code-1' });
    expect(first.status).toBe(200);

    const replay = await request(app.getHttpServer())
      .post('/auth/oidc/complete')
      .send({ provider: 'google', state: started.body.state, code: 'code-1' });
    expect(replay.status).toBeGreaterThanOrEqual(400);
  });

  it('rejects an unknown provider without disclosing which are configured', async () => {
    const response = await request(app.getHttpServer())
      .post('/auth/oidc/start')
      .send({ provider: 'not a provider', redirectUri: REDIRECT });
    expect(response.status).toBeGreaterThanOrEqual(400);
    expect(JSON.stringify(response.body)).not.toContain('google');
  });

  /**
   * A bearer token turns `start` into a link flow. A *bad* one must still be
   * rejected — an expired session may not silently become a fresh sign-in.
   */
  it('rejects an invalid bearer on start rather than downgrading to a sign-in', async () => {
    const response = await request(app.getHttpServer())
      .post('/auth/oidc/start')
      .set('Authorization', 'Bearer not.a.jwt')
      .send({ provider: 'google', redirectUri: REDIRECT });
    expect(response.status).toBe(401);
  });
});
