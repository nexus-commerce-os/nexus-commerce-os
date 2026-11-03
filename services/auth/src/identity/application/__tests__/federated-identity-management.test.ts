import { describe, it, expect, beforeEach } from 'vitest';
import { StartOidcLogin } from '../start-oidc-login';
import { CompleteOidcLogin } from '../complete-oidc-login';
import { UnlinkFederatedIdentity } from '../unlink-federated-identity';
import { ListFederatedIdentities } from '../list-federated-identities';
import { PasskeyCredential } from '../../domain/entities/passkey-credential';
import { CredentialId } from '../../domain/value-objects/credential-id';
import { toUserId } from '../../domain/value-objects/user-id';
import { toPasskeyCredentialId } from '../../domain/value-objects/passkey-credential-id';
import { buildOidcFixture, type OidcFixture } from '../../__tests__/support';
import { verifiedIdToken } from '../../__tests__/oidc-doubles';

const REDIRECT = 'https://nexus.example/callback';

describe('federated identity management', () => {
  let fx: OidcFixture;
  let unlink: UnlinkFederatedIdentity;
  let list: ListFederatedIdentities;

  beforeEach(async () => {
    fx = await buildOidcFixture();
    unlink = new UnlinkFederatedIdentity(fx);
    list = new ListFederatedIdentities(fx);
  });

  /** Sign in through `provider` with `subject`, returning the resulting ids. */
  async function link(
    provider: string,
    subject: string,
    email: string,
  ): Promise<{ userId: string; federatedIdentityId: string }> {
    const started = await new StartOidcLogin(fx).execute({ provider, redirectUri: REDIRECT });
    if (!started.ok) {
      throw new Error('fixture invariant broken');
    }
    fx.verifier.setClaims(verifiedIdToken({ nonce: started.value.nonce, subject, email }));
    const done = await new CompleteOidcLogin(fx).execute({
      provider,
      state: started.value.state,
      code: 'auth-code',
    });
    if (!done.ok) {
      throw new Error(`fixture invariant broken: ${done.error._tag}`);
    }
    fx.events.drain();
    return done.value;
  }

  /** Give the account a passkey so it has a second factor. */
  async function addPasskey(userId: string, credentialId: string): Promise<void> {
    await fx.passkeys.save(
      PasskeyCredential.register({
        id: toPasskeyCredentialId('14141414-1414-4414-8414-141414141414'),
        userId: toUserId(userId),
        credentialId: CredentialId.fromBase64Url(credentialId),
        publicKey: 'cose-key',
        signCount: 0,
        transports: ['internal'],
        aaguid: '00000000-0000-0000-0000-000000000000',
        backupEligible: true,
        backupState: true,
        label: 'Phone',
        deviceId: null,
        now: fx.clock.now(),
      }),
    );
  }

  // ── listing ───────────────────────────────────────────────────────────────
  it('lists active links and hides unlinked ones by default', async () => {
    const google = await link('google', 'sub-1', 'jane@example.com');
    const started = await new StartOidcLogin(fx).execute({
      provider: 'apple',
      redirectUri: REDIRECT,
      userId: google.userId,
    });
    if (!started.ok) {
      throw new Error('fixture invariant broken');
    }
    fx.verifier.setClaims(
      verifiedIdToken({ nonce: started.value.nonce, subject: 'sub-2', email: 'jane@example.com' }),
    );
    await new CompleteOidcLogin(fx).execute({
      provider: 'apple',
      state: started.value.state,
      code: 'c',
    });

    const before = await list.execute({ userId: google.userId });
    expect(before.ok).toBe(true);
    if (before.ok) {
      expect(before.value.map((i) => i.provider).sort()).toEqual(['apple', 'google']);
    }

    expect(
      (
        await unlink.execute({
          userId: google.userId,
          federatedIdentityId: google.federatedIdentityId,
        })
      ).ok,
    ).toBe(true);

    const active = await list.execute({ userId: google.userId });
    const all = await list.execute({ userId: google.userId, includeRevoked: true });
    if (active.ok && all.ok) {
      expect(active.value.map((i) => i.provider)).toEqual(['apple']);
      expect(all.value).toHaveLength(2);
    }
  });

  it('never exposes the provider subject as an email lookup key', async () => {
    const { userId } = await link('google', 'sub-1', 'jane@example.com');
    const result = await list.execute({ userId });
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.value[0].subject).toBe('sub-1');
      expect(result.value[0].emailAtLink).toBe('jane@example.com');
    }
  });

  it('rejects a malformed user id when listing', async () => {
    const result = await list.execute({ userId: 'not-a-uuid' });
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.error._tag).toBe('UserNotFoundError');
    }
  });

  // ── last-factor rule (now genuinely reachable) ───────────────────────────
  it('refuses to unlink the only provider of a federated-only account', async () => {
    const { userId, federatedIdentityId } = await link('google', 'sub-1', 'jane@example.com');
    const user = await fx.users.findById(toUserId(userId));
    expect(user?.hasPasswordFactor()).toBe(false);

    const result = await unlink.execute({ userId, federatedIdentityId });

    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.error._tag).toBe('LastFactorRemovalError');
    }
    const still = await list.execute({ userId });
    if (still.ok) {
      expect(still.value).toHaveLength(1);
    }
  });

  it('allows unlinking once a passkey provides another way in', async () => {
    const { userId, federatedIdentityId } = await link('google', 'sub-1', 'jane@example.com');
    await addPasskey(userId, 'cred-AAAA');

    const result = await unlink.execute({ userId, federatedIdentityId });
    expect(result.ok).toBe(true);
    expect(fx.events.published.map((e) => e.type)).toEqual([
      'identity.federated_identity.unlinked',
    ]);
  });

  it('allows unlinking when a second provider remains', async () => {
    const google = await link('google', 'sub-1', 'jane@example.com');
    const started = await new StartOidcLogin(fx).execute({
      provider: 'apple',
      redirectUri: REDIRECT,
      userId: google.userId,
    });
    if (!started.ok) {
      throw new Error('fixture invariant broken');
    }
    fx.verifier.setClaims(
      verifiedIdToken({ nonce: started.value.nonce, subject: 'sub-2', email: 'jane@example.com' }),
    );
    await new CompleteOidcLogin(fx).execute({
      provider: 'apple',
      state: started.value.state,
      code: 'c',
    });
    fx.events.drain();

    const result = await unlink.execute({
      userId: google.userId,
      federatedIdentityId: google.federatedIdentityId,
    });
    expect(result.ok).toBe(true);
  });

  it('allows unlinking on a password account (the password remains)', async () => {
    fx = await buildOidcFixture({ withLocalUser: true, localEmailVerified: true });
    unlink = new UnlinkFederatedIdentity(fx);
    const linked = await link('google', 'sub-1', 'jane@example.com');
    expect(linked.userId).toBe(fx.userId);

    const result = await unlink.execute({
      userId: linked.userId,
      federatedIdentityId: linked.federatedIdentityId,
    });
    expect(result.ok).toBe(true);
  });

  // ── ownership & idempotence ───────────────────────────────────────────────
  it('rejects unlinking twice — the link is no longer active', async () => {
    const { userId, federatedIdentityId } = await link('google', 'sub-1', 'jane@example.com');
    await addPasskey(userId, 'cred-AAAA');
    await unlink.execute({ userId, federatedIdentityId });

    const again = await unlink.execute({ userId, federatedIdentityId });
    expect(again.ok).toBe(false);
    if (!again.ok) {
      expect(again.error._tag).toBe('FederatedIdentityNotFoundError');
    }
  });

  it("reports another user's link as not found (no cross-account probing)", async () => {
    const first = await link('google', 'sub-1', 'jane@example.com');
    const second = await link('google', 'sub-2', 'other@example.com');

    const result = await unlink.execute({
      userId: second.userId,
      federatedIdentityId: first.federatedIdentityId,
    });
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.error._tag).toBe('FederatedIdentityNotFoundError');
    }
  });

  it('rejects malformed ids', async () => {
    expect((await unlink.execute({ userId: 'nope', federatedIdentityId: 'nope' })).ok).toBe(false);
    const { userId } = await link('google', 'sub-1', 'jane@example.com');
    const bad = await unlink.execute({ userId, federatedIdentityId: 'not-a-uuid' });
    expect(bad.ok).toBe(false);
    if (!bad.ok) {
      expect(bad.error._tag).toBe('FederatedIdentityNotFoundError');
    }
  });

  it('records last-used on every sign-in through the link', async () => {
    const { userId } = await link('google', 'sub-1', 'jane@example.com');
    const before = await list.execute({ userId });
    const firstUse = before.ok ? before.value[0].lastUsedAt : null;
    expect(firstUse).not.toBeNull();

    fx.clock.advance(60_000);
    await link('google', 'sub-1', 'jane@example.com');

    const after = await list.execute({ userId });
    if (after.ok && firstUse !== null) {
      expect(after.value[0].lastUsedAt?.getTime()).toBeGreaterThan(firstUse.getTime());
    }
  });
});
