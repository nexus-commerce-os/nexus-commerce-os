import { describe, it, expect, beforeEach } from 'vitest';
import { StartOidcLogin } from '../start-oidc-login';
import { CompleteOidcLogin } from '../complete-oidc-login';
import { AuthenticateUser } from '../authenticate-user';
import { toUserId } from '../../domain/value-objects/user-id';
import { OidcProvider } from '../../domain/value-objects/oidc-provider';
import { ScryptPasswordHasher } from '../../infrastructure/scrypt-password-hasher';
import { buildOidcFixture, STRONG_PASSWORD, type OidcFixture } from '../../__tests__/support';
import { verifiedIdToken } from '../../__tests__/oidc-doubles';

const REDIRECT = 'https://nexus.example/callback';

describe('OIDC login', () => {
  let fx: OidcFixture;
  let start: StartOidcLogin;
  let complete: CompleteOidcLogin;

  beforeEach(async () => {
    fx = await buildOidcFixture();
    start = new StartOidcLogin(fx);
    complete = new CompleteOidcLogin(fx);
  });

  /** Start a ceremony and arm the verifier to echo its nonce back. */
  async function ceremony(
    options: { userId?: string; claims?: Partial<ReturnType<typeof verifiedIdToken>> } = {},
  ): Promise<string> {
    const started = await start.execute({
      provider: 'google',
      redirectUri: REDIRECT,
      ...(options.userId === undefined ? {} : { userId: options.userId }),
    });
    if (!started.ok) {
      throw new Error('fixture invariant broken');
    }
    fx.verifier.setClaims(verifiedIdToken({ nonce: started.value.nonce, ...options.claims }));
    fx.events.drain();
    return started.value.state;
  }

  // ── start ─────────────────────────────────────────────────────────────────
  it('mints state, nonce and a PKCE verifier, storing only the state hash', async () => {
    const r = await start.execute({ provider: 'google', redirectUri: REDIRECT });
    expect(r.ok).toBe(true);
    if (!r.ok) {
      return;
    }
    expect(r.value.state.length).toBeGreaterThan(20);
    expect(r.value.nonce.length).toBeGreaterThan(20);
    expect(r.value.codeVerifier.length).toBeGreaterThan(20);
    expect(new Set([r.value.state, r.value.nonce, r.value.codeVerifier]).size).toBe(3);

    const stored = await fx.oauthRequests.findByStateHash(fx.tokenHasher.hash(r.value.state));
    expect(stored).not.toBeNull();
    expect(JSON.stringify(stored?.snapshot())).not.toContain(r.value.state);
  });

  it('rejects a malformed provider or empty redirect', async () => {
    expect((await start.execute({ provider: 'not a provider', redirectUri: REDIRECT })).ok).toBe(
      false,
    );
    expect((await start.execute({ provider: 'google', redirectUri: '' })).ok).toBe(false);
  });

  // ── new account ───────────────────────────────────────────────────────────
  it('bootstraps a passwordless account for an unknown provider subject', async () => {
    const state = await ceremony();
    const result = await complete.execute({ provider: 'google', state, code: 'auth-code' });

    expect(result.ok).toBe(true);
    if (!result.ok) {
      return;
    }
    expect(result.value.outcome).toBe('account_created');

    const user = await fx.users.findById(toUserId(result.value.userId));
    expect(user?.hasPasswordFactor()).toBe(false);
    expect(user?.emailVerified).toBe(true);
    expect(fx.events.published.map((e) => e.type)).toEqual([
      'identity.user.registered',
      'identity.user.federated_account_created',
      'identity.federated_identity.linked',
    ]);
  });

  it('leaves a bootstrapped account unverified when the provider says so', async () => {
    const state = await ceremony({ claims: { emailVerified: false } });
    const result = await complete.execute({ provider: 'google', state, code: 'auth-code' });
    expect(result.ok).toBe(true);
    if (!result.ok) {
      return;
    }
    expect((await fx.users.findById(toUserId(result.value.userId)))?.emailVerified).toBe(false);
  });

  it('a bootstrapped account cannot be signed into with a password', async () => {
    const state = await ceremony();
    await complete.execute({ provider: 'google', state, code: 'auth-code' });

    const auth = new AuthenticateUser({ users: fx.users, hasher: new ScryptPasswordHasher() });
    const result = await auth.execute({ email: fx.email, password: STRONG_PASSWORD });
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.error._tag).toBe('InvalidCredentialsError');
    }
  });

  // ── returning user ────────────────────────────────────────────────────────
  it('signs the same subject back in without creating a second account', async () => {
    const first = await complete.execute({
      provider: 'google',
      state: await ceremony(),
      code: 'auth-code',
    });
    expect(first.ok).toBe(true);
    fx.events.drain();

    const second = await complete.execute({
      provider: 'google',
      state: await ceremony(),
      code: 'auth-code',
    });
    expect(second.ok).toBe(true);
    if (first.ok && second.ok) {
      expect(second.value.userId).toBe(first.value.userId);
      expect(second.value.outcome).toBe('signed_in');
    }
    expect(fx.users.size).toBe(1);
    expect(fx.federatedIdentities.size).toBe(1);
    expect(fx.events.published.map((e) => e.type)).toEqual([
      'identity.federated_identity.login_succeeded',
    ]);
  });

  it('treats a different subject at the same provider as a different person', async () => {
    await complete.execute({ provider: 'google', state: await ceremony(), code: 'c1' });
    const state = await ceremony({
      claims: { subject: 'provider-subject-0002', email: 'other@example.com' },
    });
    const second = await complete.execute({ provider: 'google', state, code: 'c2' });

    expect(second.ok).toBe(true);
    if (second.ok) {
      expect(second.value.outcome).toBe('account_created');
    }
    expect(fx.users.size).toBe(2);
  });

  // ── auto-link policy (the takeover guard) ────────────────────────────────
  it('auto-links when both the provider and NEXUS have verified the address', async () => {
    fx = await buildOidcFixture({ withLocalUser: true, localEmailVerified: true });
    start = new StartOidcLogin(fx);
    complete = new CompleteOidcLogin(fx);

    const state = await ceremony();
    const result = await complete.execute({ provider: 'google', state, code: 'auth-code' });

    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.value.outcome).toBe('linked');
      expect(result.value.userId).toBe(fx.userId);
    }
    expect(fx.users.size).toBe(1);
  });

  it('refuses to auto-link when the provider has not verified the address', async () => {
    fx = await buildOidcFixture({ withLocalUser: true, localEmailVerified: true });
    start = new StartOidcLogin(fx);
    complete = new CompleteOidcLogin(fx);

    const state = await ceremony({ claims: { emailVerified: false } });
    const result = await complete.execute({ provider: 'google', state, code: 'auth-code' });

    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.error._tag).toBe('AccountLinkRequiresAuthenticationError');
    }
    expect(fx.federatedIdentities.size).toBe(0);
  });

  it('refuses to auto-link when NEXUS has not verified the local address', async () => {
    fx = await buildOidcFixture({ withLocalUser: true, localEmailVerified: false });
    start = new StartOidcLogin(fx);
    complete = new CompleteOidcLogin(fx);

    const state = await ceremony();
    const result = await complete.execute({ provider: 'google', state, code: 'auth-code' });

    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.error._tag).toBe('AccountLinkRequiresAuthenticationError');
    }
  });

  // ── explicit link flow ────────────────────────────────────────────────────
  it('links to the signed-in user regardless of email verification', async () => {
    fx = await buildOidcFixture({ withLocalUser: true, localEmailVerified: false });
    start = new StartOidcLogin(fx);
    complete = new CompleteOidcLogin(fx);

    const state = await ceremony({
      userId: fx.userId ?? undefined,
      claims: { emailVerified: false, email: 'different@example.com' },
    });
    const result = await complete.execute({ provider: 'google', state, code: 'auth-code' });

    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.value.outcome).toBe('linked');
      expect(result.value.userId).toBe(fx.userId);
    }
  });

  it('refuses to link a provider account that already belongs to someone else', async () => {
    fx = await buildOidcFixture({ withLocalUser: true, localEmailVerified: true });
    start = new StartOidcLogin(fx);
    complete = new CompleteOidcLogin(fx);

    // the subject first bootstraps its own account under a different address
    const bootstrap = await ceremony({ claims: { email: 'someone-else@example.com' } });
    expect((await complete.execute({ provider: 'google', state: bootstrap, code: 'c1' })).ok).toBe(
      true,
    );

    const state = await ceremony({
      userId: fx.userId ?? undefined,
      claims: { email: 'someone-else@example.com' },
    });
    const result = await complete.execute({ provider: 'google', state, code: 'c2' });

    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.error._tag).toBe('FederatedIdentityAlreadyLinkedError');
    }
  });

  // ── ceremony integrity ────────────────────────────────────────────────────
  it('passes the PKCE verifier and redirect through to the exchange', async () => {
    const started = await start.execute({ provider: 'google', redirectUri: REDIRECT });
    expect(started.ok).toBe(true);
    if (!started.ok) {
      return;
    }
    fx.verifier.setClaims(verifiedIdToken({ nonce: started.value.nonce }));
    await complete.execute({ provider: 'google', state: started.value.state, code: 'auth-code' });

    expect(fx.exchanger.lastRequest?.codeVerifier).toBe(started.value.codeVerifier);
    expect(fx.exchanger.lastRequest?.redirectUri).toBe(REDIRECT);
    expect(fx.exchanger.lastRequest?.code).toBe('auth-code');
  });

  it('rejects a token whose nonce does not match the request', async () => {
    const state = await ceremony();
    fx.verifier.setClaims(verifiedIdToken({ nonce: 'someone-elses-nonce' }));
    const result = await complete.execute({ provider: 'google', state, code: 'auth-code' });

    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.error._tag).toBe('InvalidOidcTokenError');
    }
    expect(fx.users.size).toBe(0);
  });

  it('rejects a token carrying no nonce at all', async () => {
    const state = await ceremony();
    fx.verifier.setClaims(verifiedIdToken({ nonce: null }));
    const result = await complete.execute({ provider: 'google', state, code: 'auth-code' });
    expect(result.ok).toBe(false);
  });

  it('rejects an unknown state', async () => {
    const result = await complete.execute({
      provider: 'google',
      state: 'never-issued',
      code: 'c',
    });
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.error._tag).toBe('InvalidOidcStateError');
    }
  });

  it('rejects a replayed state', async () => {
    const state = await ceremony();
    expect((await complete.execute({ provider: 'google', state, code: 'c' })).ok).toBe(true);
    const replay = await complete.execute({ provider: 'google', state, code: 'c' });
    expect(replay.ok).toBe(false);
    if (!replay.ok) {
      expect(replay.error._tag).toBe('InvalidOidcStateError');
    }
  });

  it('rejects a callback delivered to the wrong provider', async () => {
    const state = await ceremony();
    const result = await complete.execute({ provider: 'apple', state, code: 'c' });
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.error._tag).toBe('InvalidOidcStateError');
    }
  });

  it('rejects an expired state at the TTL boundary', async () => {
    const state = await ceremony();
    fx.clock.advance(fx.oidcPolicy.authorizationRequestTtlMs());
    const result = await complete.execute({ provider: 'google', state, code: 'c' });
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.error._tag).toBe('OidcStateExpiredError');
    }
  });

  it('burns the state even when the code exchange fails', async () => {
    const state = await ceremony();
    fx.exchanger.fail('invalid_grant');
    const failed = await complete.execute({ provider: 'google', state, code: 'c' });
    expect(failed.ok).toBe(false);
    if (!failed.ok) {
      expect(failed.error._tag).toBe('OidcTokenExchangeFailedError');
    }

    fx.exchanger.succeedWith({ idToken: 'stub-id-token' });
    const retry = await complete.execute({ provider: 'google', state, code: 'c' });
    expect(retry.ok).toBe(false);
    expect(fx.users.size).toBe(0);
  });

  it('propagates a verifier failure without creating anything', async () => {
    const state = await ceremony();
    fx.verifier.fail('signature invalid');
    const result = await complete.execute({ provider: 'google', state, code: 'c' });
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.error._tag).toBe('InvalidOidcTokenError');
    }
    expect(fx.users.size).toBe(0);
    expect(fx.federatedIdentities.size).toBe(0);
  });

  it('rejects a token with an empty subject', async () => {
    const state = await ceremony({ claims: { subject: '' } });
    const result = await complete.execute({ provider: 'google', state, code: 'c' });
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.error._tag).toBe('InvalidOidcTokenError');
    }
  });

  it('rejects a bootstrap when the provider returns no usable email', async () => {
    const state = await ceremony({ claims: { email: null } });
    const result = await complete.execute({ provider: 'google', state, code: 'c' });
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.error._tag).toBe('InvalidOidcTokenError');
    }
  });

  it('supersedes an earlier pending link ceremony for the same provider', async () => {
    fx = await buildOidcFixture({ withLocalUser: true, localEmailVerified: true });
    start = new StartOidcLogin(fx);
    complete = new CompleteOidcLogin(fx);

    const first = await ceremony({ userId: fx.userId ?? undefined });
    await ceremony({ userId: fx.userId ?? undefined });

    const result = await complete.execute({ provider: 'google', state: first, code: 'c' });
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.error._tag).toBe('InvalidOidcStateError');
    }
  });

  it('refuses to sign in a deactivated account', async () => {
    const created = await complete.execute({
      provider: 'google',
      state: await ceremony(),
      code: 'c',
    });
    expect(created.ok).toBe(true);
    if (!created.ok) {
      return;
    }
    const user = await fx.users.findById(toUserId(created.value.userId));
    user?.deactivate(fx.clock.now());
    if (user) {
      await fx.users.save(user);
    }

    const result = await complete.execute({
      provider: 'google',
      state: await ceremony(),
      code: 'c',
    });
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.error._tag).toBe('UserDeactivatedError');
    }
  });

  it('only one of two concurrent callbacks succeeds', async () => {
    const state = await ceremony();
    const [a, b] = await Promise.all([
      complete.execute({ provider: 'google', state, code: 'c' }),
      complete.execute({ provider: 'google', state, code: 'c' }),
    ]);
    expect([a.ok, b.ok].filter(Boolean)).toHaveLength(1);
    expect(fx.users.size).toBe(1);
  });

  it('normalises the provider slug across start and callback', async () => {
    const started = await start.execute({ provider: 'GOOGLE', redirectUri: REDIRECT });
    expect(started.ok).toBe(true);
    if (!started.ok) {
      return;
    }
    fx.verifier.setClaims(verifiedIdToken({ nonce: started.value.nonce }));
    const result = await complete.execute({
      provider: 'Google',
      state: started.value.state,
      code: 'c',
    });
    expect(result.ok).toBe(true);
    expect(OidcProvider.fromSlug('GOOGLE').value).toBe('google');
  });
});
