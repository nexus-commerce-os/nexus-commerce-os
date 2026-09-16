import { describe, it, expect } from 'vitest';
import { toDeviceId, type DeviceId } from '../../value-objects/device-id';
import { Session } from '../session';
import { TokenHash } from '../../value-objects/token-hash';
import { DefaultSessionPolicy, type SessionPolicy } from '../../value-objects/session-policy';
import { toSessionId } from '../../value-objects/session-id';
import { toUserId } from '../../value-objects/user-id';

const SESSION_ID = toSessionId('22222222-2222-4222-8222-222222222222');
const USER_ID = toUserId('11111111-1111-4111-8111-111111111111');
const START = new Date('2026-01-01T00:00:00.000Z');
const policy: SessionPolicy = new DefaultSessionPolicy();

const hash = (value: string): TokenHash => TokenHash.fromHex(value);

const DEVICE = toDeviceId('11111111-1111-4111-8111-111111111111');

function startSession(deviceId: DeviceId | null = DEVICE): Session {
  return Session.start({
    id: SESSION_ID,
    userId: USER_ID,
    deviceId,
    initialTokenHash: hash('gen1'),
    policy,
    now: START,
  });
}

function at(offsetMs: number): Date {
  return new Date(START.getTime() + offsetMs);
}

describe('Session aggregate', () => {
  it('starts active with generation 1 and records SessionStarted', () => {
    const session = startSession();
    expect(session.status).toBe('active');
    expect(session.isActive(START)).toBe(true);
    expect(session.tokens).toHaveLength(1);
    expect(session.tokens[0].status).toBe('active');
    expect(session.pullEvents().map((e) => e.type)).toEqual(['identity.session.started']);
  });

  it('bounds the idle window by the absolute ceiling', () => {
    const shortAbsolute: SessionPolicy = { idleTtlMs: 60_000, absoluteTtlMs: 10_000 };
    const session = Session.start({
      id: SESSION_ID,
      userId: USER_ID,
      deviceId: null,
      initialTokenHash: hash('gen1'),
      policy: shortAbsolute,
      now: START,
    });
    expect(session.idleExpiresAt).toEqual(session.absoluteExpiresAt);
  });

  it('rotates: consumes the presented token, issues the next, slides idle expiry', () => {
    const session = startSession();
    session.pullEvents();

    const result = session.rotate(hash('gen1'), hash('gen2'), policy, at(60_000));

    expect(result.ok).toBe(true);
    expect(session.tokens.map((t) => t.status)).toEqual(['consumed', 'active']);
    expect(session.lastUsedAt).toEqual(at(60_000));
    expect(session.idleExpiresAt).toEqual(new Date(at(60_000).getTime() + policy.idleTtlMs));
    expect(session.pullEvents().map((e) => e.type)).toEqual(['identity.session.refreshed']);
  });

  it('detects reuse of a consumed token and revokes the whole family', () => {
    const session = startSession();
    session.rotate(hash('gen1'), hash('gen2'), policy, at(60_000));
    session.pullEvents();

    const replay = session.rotate(hash('gen1'), hash('gen3'), policy, at(120_000));

    expect(replay.ok).toBe(false);
    if (!replay.ok) {
      expect(replay.error._tag).toBe('RefreshTokenReusedError');
    }
    expect(session.status).toBe('revoked');
    expect(session.revocationReason).toBe('reuse_detected');
    expect(session.tokens.every((t) => t.status !== 'active')).toBe(true);
    expect(session.pullEvents().map((e) => e.type)).toEqual([
      'identity.session.reuse_detected',
      'identity.session.revoked',
    ]);
  });

  it('rejects rotation on an already-revoked session', () => {
    const session = startSession();
    session.revoke('user_revoked', at(1_000));
    session.pullEvents();

    const result = session.rotate(hash('gen1'), hash('gen2'), policy, at(2_000));

    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.error._tag).toBe('SessionRevokedError');
    }
    expect(session.pullEvents()).toHaveLength(0);
  });

  it('expires on the idle window and revokes with idle_expired', () => {
    const session = startSession();
    session.pullEvents();

    const result = session.rotate(hash('gen1'), hash('gen2'), policy, at(policy.idleTtlMs));

    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.error._tag).toBe('SessionExpiredError');
    }
    expect(session.revocationReason).toBe('idle_expired');
  });

  it('expires on the absolute ceiling even while continuously used', () => {
    const shortAbsolute: SessionPolicy = { idleTtlMs: 60_000, absoluteTtlMs: 90_000 };
    const session = Session.start({
      id: SESSION_ID,
      userId: USER_ID,
      deviceId: null,
      initialTokenHash: hash('gen1'),
      policy: shortAbsolute,
      now: START,
    });
    // keep it warm inside the idle window …
    expect(session.rotate(hash('gen1'), hash('gen2'), shortAbsolute, at(50_000)).ok).toBe(true);
    // … but the hard ceiling still ends it
    const result = session.rotate(hash('gen2'), hash('gen3'), shortAbsolute, at(90_000));

    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.error._tag).toBe('SessionExpiredError');
    }
    expect(session.revocationReason).toBe('absolute_expired');
  });

  it('rejects a token that belongs to no generation of the family', () => {
    const session = startSession();
    session.pullEvents();

    const result = session.rotate(hash('foreign'), hash('gen2'), policy, at(1_000));

    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.error._tag).toBe('InvalidRefreshTokenError');
    }
    expect(session.status).toBe('active');
  });

  it('revoke is idempotent and keeps the first reason', () => {
    const session = startSession();
    session.pullEvents();

    session.revoke('user_revoked', at(1_000));
    session.revoke('admin_revoked', at(2_000));

    expect(session.revocationReason).toBe('user_revoked');
    expect(session.pullEvents().map((e) => e.type)).toEqual(['identity.session.revoked']);
  });

  it('is not active once revoked or past either lifetime', () => {
    const revoked = startSession();
    revoked.revoke('user_revoked', at(1_000));
    expect(revoked.isActive(at(2_000))).toBe(false);

    const live = startSession();
    expect(live.isActive(at(policy.idleTtlMs))).toBe(false);
    expect(live.isActive(at(policy.absoluteTtlMs))).toBe(false);
  });

  it('snapshot reflects current state', () => {
    const session = startSession(DEVICE);
    expect(session.snapshot()).toMatchObject({
      id: SESSION_ID,
      userId: USER_ID,
      deviceId: DEVICE,
      status: 'active',
      revocationReason: null,
      createdAt: START,
    });
  });

  it('reconstitutes from persistence without recording events', () => {
    const session = Session.reconstitute({
      id: SESSION_ID,
      userId: USER_ID,
      deviceId: null,
      status: 'active',
      revocationReason: null,
      tokens: [{ hash: hash('gen1'), status: 'active', issuedAt: START }],
      createdAt: START,
      lastUsedAt: START,
      idleExpiresAt: at(policy.idleTtlMs),
      absoluteExpiresAt: at(policy.absoluteTtlMs),
    });
    expect(session.pullEvents()).toHaveLength(0);
    expect(session.rotate(hash('gen1'), hash('gen2'), policy, at(1_000)).ok).toBe(true);
  });
});
