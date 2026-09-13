import { describe, it, expect } from 'vitest';
import { fingerprintKey, networkKey, resolveClientAddress, subjectKey } from '../client-address';

const SECRET = 'test-only-rate-limit-secret-0000000000';

describe('resolveClientAddress', () => {
  it('ignores the forwarded header when no proxy is trusted', () => {
    expect(resolveClientAddress('10.0.0.1', '1.2.3.4', 0)).toBe('10.0.0.1');
  });

  it('takes the address our own proxy observed, counting from the right', () => {
    // Each proxy appends the peer it received from, so the rightmost entry was
    // written by the proxy nearest us. With one trusted hop that entry is the
    // client; with two, the trustworthy pair is the last two and the client is
    // the earlier of them. Everything further left is whatever the caller typed.
    expect(resolveClientAddress('10.0.0.1', '9.9.9.9, 8.8.8.8, 7.7.7.7', 1)).toBe('7.7.7.7');
    expect(resolveClientAddress('10.0.0.1', '9.9.9.9, 8.8.8.8, 7.7.7.7', 2)).toBe('8.8.8.8');
  });

  /**
   * The whole point of counting hops. A client that writes its own chain must
   * not be able to mint a fresh bucket per request, or the network layer gives
   * an attacker unlimited quota.
   */
  it('cannot be given a fresh bucket by a forged chain', () => {
    const forged = ['1.1.1.1', '2.2.2.2', '3.3.3.3'].map((spoof) =>
      resolveClientAddress('10.0.0.1', `${spoof}, 8.8.8.8`, 1),
    );
    expect(new Set(forged).size).toBe(1);
    expect(forged[0]).toBe('8.8.8.8');
  });

  it('falls back to the socket when the chain is shorter than the trusted hops', () => {
    expect(resolveClientAddress('10.0.0.1', '8.8.8.8', 3)).toBe('8.8.8.8');
    expect(resolveClientAddress('10.0.0.1', '', 1)).toBe('10.0.0.1');
  });

  /** Dual-stack sockets report IPv4 in mapped form; both must bucket alike. */
  it('normalizes IPv4-mapped IPv6 to the same key as plain IPv4', () => {
    expect(resolveClientAddress('::ffff:203.0.113.7', undefined, 0)).toBe('203.0.113.7');
  });
});

describe('networkKey', () => {
  it('keeps IPv4 addresses individual', () => {
    expect(networkKey('203.0.113.7')).toBe('203.0.113.7');
  });

  /** One subscriber is routinely handed a whole /64. */
  it('collapses IPv6 to its /64 so a single host cannot rotate for free', () => {
    const a = networkKey('2001:db8:1234:5678:aaaa:bbbb:cccc:dddd');
    const b = networkKey('2001:db8:1234:5678:1111:2222:3333:4444');
    expect(a).toBe(b);
    expect(networkKey('2001:db8:1234:9999::1')).not.toBe(a);
  });
});

describe('fingerprintKey', () => {
  it('separates two clients behind one address', () => {
    const chrome = fingerprintKey('203.0.113.7', 'Chrome/1', SECRET);
    const safari = fingerprintKey('203.0.113.7', 'Safari/1', SECRET);
    expect(chrome).not.toBe(safari);
    expect(chrome).toBe(fingerprintKey('203.0.113.7', 'Chrome/1', SECRET));
  });

  it('is stable when the user agent is absent', () => {
    expect(fingerprintKey('203.0.113.7', undefined, SECRET)).toBe(
      fingerprintKey('203.0.113.7', undefined, SECRET),
    );
  });
});

describe('subjectKey', () => {
  /**
   * The store must never become a list of every address anyone tried to sign in
   * as — an enumeration corpus sitting outside the database.
   */
  it('never contains the address it is derived from', () => {
    const key = subjectKey('jane@example.com', SECRET);
    expect(key).not.toContain('jane');
    expect(key).not.toContain('example.com');
  });

  it('is case- and whitespace-insensitive, so one account is one bucket', () => {
    expect(subjectKey('  Jane@Example.COM ', SECRET)).toBe(subjectKey('jane@example.com', SECRET));
  });

  it('changes entirely with the secret, so keys are not guessable offline', () => {
    expect(subjectKey('jane@example.com', SECRET)).not.toBe(
      subjectKey('jane@example.com', 'another-secret-entirely-0000000000000'),
    );
  });
});
