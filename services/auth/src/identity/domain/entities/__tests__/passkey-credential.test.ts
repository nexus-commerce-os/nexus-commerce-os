import { describe, it, expect } from 'vitest';
import { PasskeyCredential } from '../passkey-credential';
import { CredentialId } from '../../value-objects/credential-id';
import { toUserId } from '../../value-objects/user-id';
import { toPasskeyCredentialId } from '../../value-objects/passkey-credential-id';
import { toDeviceId } from '../../value-objects/device-id';

const ID = toPasskeyCredentialId('55555555-5555-4555-8555-555555555555');
const USER = toUserId('11111111-1111-4111-8111-111111111111');
const DEVICE = toDeviceId('66666666-6666-4666-8666-666666666666');
const START = new Date('2026-01-01T00:00:00.000Z');
const at = (ms: number) => new Date(START.getTime() + ms);

function register(signCount = 0) {
  return PasskeyCredential.register({
    id: ID,
    userId: USER,
    credentialId: CredentialId.fromBase64Url('cred-AAAA'),
    publicKey: 'cose-key',
    signCount,
    transports: ['internal', 'hybrid'],
    aaguid: '00000000-0000-0000-0000-000000000000',
    backupEligible: true,
    backupState: false,
    label: 'iPhone',
    deviceId: DEVICE,
    now: START,
  });
}

describe('PasskeyCredential', () => {
  it('registers active, unused, bound to its device', () => {
    const p = register();
    expect(p.isActive()).toBe(true);
    expect(p.lastUsedAt).toBeNull();
    expect(p.deviceId).toBe(DEVICE);
    expect(p.snapshot().credentialId).toBe('cred-AAAA');
  });

  // ── counter rules ─────────────────────────────────────────────────────────
  it('accepts a strictly increasing counter and records the use', () => {
    const p = register(5);
    const r = p.recordAuthentication(6, at(1000));
    expect(r.ok).toBe(true);
    if (r.ok) {
      expect(r.value.counterSupported).toBe(true);
    }
    expect(p.signCount).toBe(6);
    expect(p.lastUsedAt).toEqual(at(1000));
  });

  it('rejects a regressed counter as a suspected clone', () => {
    const p = register(10);
    const r = p.recordAuthentication(9, at(1000));
    expect(r.ok).toBe(false);
    if (!r.ok) {
      expect(r.error._tag).toBe('PasskeyCloneDetectedError');
    }
    expect(p.signCount).toBe(10);
    expect(p.lastUsedAt).toBeNull();
  });

  it('rejects an equal counter — it must strictly increase', () => {
    const p = register(10);
    const r = p.recordAuthentication(10, at(1000));
    expect(r.ok).toBe(false);
    if (!r.ok) {
      expect(r.error._tag).toBe('PasskeyCloneDetectedError');
    }
  });

  it('accepts a zero counter (authenticator keeps none) and reports it', () => {
    const p = register(0);
    const r = p.recordAuthentication(0, at(1000));
    expect(r.ok).toBe(true);
    if (r.ok) {
      expect(r.value.counterSupported).toBe(false);
    }
    // repeatable, because clone detection is simply unavailable here
    expect(p.recordAuthentication(0, at(2000)).ok).toBe(true);
  });

  it('starts tracking once an authenticator begins reporting a counter', () => {
    const p = register(0);
    const r = p.recordAuthentication(1, at(1000));
    expect(r.ok).toBe(true);
    if (r.ok) {
      expect(r.value.counterSupported).toBe(true);
    }
    expect(p.recordAuthentication(1, at(2000)).ok).toBe(false);
  });

  it('updates backup state when the verifier reports it', () => {
    const p = register(1);
    p.recordAuthentication(2, at(1000), true);
    expect(p.backupState).toBe(true);
  });

  // ── lifecycle ─────────────────────────────────────────────────────────────
  it('refuses authentication once revoked', () => {
    const p = register(1);
    p.revoke(at(500));
    const r = p.recordAuthentication(2, at(1000));
    expect(r.ok).toBe(false);
    if (!r.ok) {
      expect(r.error._tag).toBe('PasskeyNotFoundError');
    }
  });

  it('revoke is idempotent and keeps the first revocation time', () => {
    const p = register();
    p.revoke(at(500));
    p.revoke(at(900));
    expect(p.revokedAt).toEqual(at(500));
    expect(p.isActive()).toBe(false);
  });

  it('can be renamed and re-bound to another device', () => {
    const p = register();
    const other = toDeviceId('77777777-7777-4777-8777-777777777777');
    p.rename('Work key');
    p.bindToDevice(other);
    expect(p.label).toBe('Work key');
    expect(p.deviceId).toBe(other);
  });

  it('reconstitutes from persistence with its stored counter and status', () => {
    const p = PasskeyCredential.reconstitute({
      id: ID,
      userId: USER,
      credentialId: CredentialId.fromBase64Url('cred-AAAA'),
      publicKey: 'cose-key',
      signCount: 42,
      transports: ['usb'],
      aaguid: '00000000-0000-0000-0000-000000000000',
      backupEligible: false,
      backupState: false,
      label: 'YubiKey',
      deviceId: null,
      createdAt: START,
      lastUsedAt: at(1000),
      revokedAt: null,
    });
    expect(p.signCount).toBe(42);
    expect(p.recordAuthentication(42, at(2000)).ok).toBe(false);
    expect(p.recordAuthentication(43, at(2000)).ok).toBe(true);
  });
});

describe('CredentialId', () => {
  it('accepts base64url and compares by value', () => {
    expect(CredentialId.fromBase64Url('a-b_C9').equals(CredentialId.fromBase64Url('a-b_C9'))).toBe(
      true,
    );
  });

  it('rejects empty or non-base64url input', () => {
    expect(() => CredentialId.fromBase64Url('')).toThrow();
    expect(() => CredentialId.fromBase64Url('has spaces')).toThrow();
    expect(() => CredentialId.fromBase64Url('plus+slash/')).toThrow();
  });
});
