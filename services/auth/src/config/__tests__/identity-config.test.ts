import { describe, it, expect } from 'vitest';
import { loadIdentityConfig } from '../identity-config';

const VALID = {
  DATABASE_URL: 'postgres://user:pw@localhost:5432/identity',
  TOKEN_PEPPER: 'test-only-pepper-not-a-real-secret-000000',
  NODE_ENV: 'test',
  WEBAUTHN_RP_ID: 'nexus.example',
  WEBAUTHN_RP_ORIGIN: 'https://nexus.example',
};

describe('loadIdentityConfig', () => {
  it('accepts a complete environment and defaults the port', () => {
    const result = loadIdentityConfig(VALID);
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.value.databaseUrl).toBe(VALID.DATABASE_URL);
      expect(result.value.nodeEnv).toBe('test');
      expect(result.value.port).toBe(3001);
    }
  });

  it('accepts postgresql:// as well as postgres://', () => {
    expect(loadIdentityConfig({ ...VALID, DATABASE_URL: 'postgresql://u@h/db' }).ok).toBe(true);
  });

  it('reports every problem at once rather than the first', () => {
    const result = loadIdentityConfig({ DATABASE_URL: '', TOKEN_PEPPER: 'short', PORT: 'abc' });
    expect(result.ok).toBe(false);
    if (!result.ok) {
      // database url, pepper, port, rp id, rp origin
      expect(result.error.problems).toHaveLength(5);
      expect(result.error.message).toContain('DATABASE_URL');
      expect(result.error.message).toContain('TOKEN_PEPPER');
      expect(result.error.message).toContain('PORT');
    }
  });

  it('rejects a pepper too short to be a real secret', () => {
    const result = loadIdentityConfig({ ...VALID, TOKEN_PEPPER: 'a'.repeat(31) });
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.error.problems[0]).toContain('at least 32');
    }
  });

  it('rejects a non-postgres database url', () => {
    const result = loadIdentityConfig({ ...VALID, DATABASE_URL: 'mysql://localhost/db' });
    expect(result.ok).toBe(false);
  });

  it.each(['0', '65536', '1.5', 'nope'])('rejects the invalid port %s', (port) => {
    expect(loadIdentityConfig({ ...VALID, PORT: port }).ok).toBe(false);
  });

  it('accepts a valid explicit port', () => {
    const result = loadIdentityConfig({ ...VALID, PORT: '8080' });
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.value.port).toBe(8080);
    }
  });

  it('defaults NODE_ENV to development and rejects an unknown one', () => {
    const { NODE_ENV: _omitted, ...withoutNodeEnv } = VALID;
    const defaulted = loadIdentityConfig(withoutNodeEnv);
    expect(defaulted.ok).toBe(true);
    if (defaulted.ok) {
      expect(defaulted.value.nodeEnv).toBe('development');
    }
    expect(loadIdentityConfig({ ...VALID, NODE_ENV: 'staging' }).ok).toBe(false);
  });
  it('requires the WebAuthn relying party to be configured', () => {
    const missing = loadIdentityConfig({
      DATABASE_URL: VALID.DATABASE_URL,
      TOKEN_PEPPER: VALID.TOKEN_PEPPER,
    });
    expect(missing.ok).toBe(false);
    if (!missing.ok) {
      expect(missing.error.message).toContain('WEBAUTHN_RP_ID');
      expect(missing.error.message).toContain('WEBAUTHN_RP_ORIGIN');
    }
  });

  it('rejects an RP id that is a URL rather than a bare domain', () => {
    expect(loadIdentityConfig({ ...VALID, WEBAUTHN_RP_ID: 'https://nexus.example' }).ok).toBe(
      false,
    );
  });

  it('requires https for the RP origin, allowing http only on localhost', () => {
    expect(loadIdentityConfig({ ...VALID, WEBAUTHN_RP_ORIGIN: 'http://nexus.example' }).ok).toBe(
      false,
    );
    expect(loadIdentityConfig({ ...VALID, WEBAUTHN_RP_ORIGIN: 'http://localhost:3000' }).ok).toBe(
      true,
    );
  });
});
