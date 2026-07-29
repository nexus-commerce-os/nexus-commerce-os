import { describe, it, expect } from 'vitest';
import { Device } from '../device';
import { toUserId } from '../../value-objects/user-id';
import { toDeviceId } from '../../value-objects/device-id';
import { canRemovePasskey } from '../../value-objects/authentication-factor-policy';

const ID = toDeviceId('66666666-6666-4666-8666-666666666666');
const USER = toUserId('11111111-1111-4111-8111-111111111111');
const START = new Date('2026-01-01T00:00:00.000Z');
const at = (ms: number) => new Date(START.getTime() + ms);

const register = () =>
  Device.register({ id: ID, userId: USER, label: 'Jane iPhone', platform: 'iOS', now: START });

describe('Device', () => {
  it('registers as UNKNOWN, first- and last-seen at creation', () => {
    const d = register();
    expect(d.trustState).toBe('UNKNOWN');
    expect(d.firstSeenAt).toEqual(START);
    expect(d.lastSeenAt).toEqual(START);
    expect(d.revokedAt).toBeNull();
  });

  it('holds no network, geo or audit metadata', () => {
    const keys = Object.keys(register().snapshot());
    for (const forbidden of ['ip', 'ipAddress', 'userAgent', 'geo', 'location', 'audit']) {
      expect(keys).not.toContain(forbidden);
    }
    expect(keys.sort()).toEqual(
      [
        'firstSeenAt',
        'id',
        'label',
        'lastSeenAt',
        'platform',
        'revokedAt',
        'trustState',
        'userId',
      ].sort(),
    );
  });

  it('is promoted to TRUSTED when a ceremony proves possession', () => {
    const d = register();
    d.trust(at(1000));
    expect(d.trustState).toBe('TRUSTED');
    expect(d.lastSeenAt).toEqual(at(1000));
  });

  it('advances lastSeenAt only forwards (clock drift is ignored)', () => {
    const d = register();
    d.touch(at(5000));
    d.touch(at(1000));
    expect(d.lastSeenAt).toEqual(at(5000));
  });

  it('revoke is terminal and idempotent', () => {
    const d = register();
    d.revoke(at(2000));
    d.revoke(at(9000));
    expect(d.trustState).toBe('REVOKED');
    expect(d.revokedAt).toEqual(at(2000));
    expect(d.isRevoked()).toBe(true);
  });

  it('never revives a revoked device by using or trusting it', () => {
    const d = register();
    d.revoke(at(2000));
    d.touch(at(3000));
    d.trust(at(4000));
    expect(d.trustState).toBe('REVOKED');
    expect(d.lastSeenAt).toEqual(at(2000));
  });

  it('reconstitutes from persistence', () => {
    const d = Device.reconstitute({
      id: ID,
      userId: USER,
      label: 'Old laptop',
      platform: 'Windows',
      trustState: 'TRUSTED',
      firstSeenAt: START,
      lastSeenAt: at(1000),
      revokedAt: null,
    });
    expect(d.trustState).toBe('TRUSTED');
    expect(d.label).toBe('Old laptop');
  });
});

describe('canRemovePasskey (last-factor rule)', () => {
  it('allows removal while a password remains', () => {
    expect(canRemovePasskey({ activePasskeys: 1, hasPasswordFactor: true })).toBe(true);
  });

  it('allows removal while another passkey remains', () => {
    expect(canRemovePasskey({ activePasskeys: 2, hasPasswordFactor: false })).toBe(true);
  });

  it('refuses removal of the only factor on a passwordless account', () => {
    expect(canRemovePasskey({ activePasskeys: 1, hasPasswordFactor: false })).toBe(false);
  });

  it('refuses when there is nothing to remove and no password', () => {
    expect(canRemovePasskey({ activePasskeys: 0, hasPasswordFactor: false })).toBe(false);
  });
});
