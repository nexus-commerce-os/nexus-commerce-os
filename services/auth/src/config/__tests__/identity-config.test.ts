import { describe, it, expect } from 'vitest';
import { loadIdentityConfig } from '../identity-config';

const VALID = {
  DATABASE_URL: 'postgres://user:pw@localhost:5432/identity',
  TOKEN_PEPPER: 'test-only-pepper-not-a-real-secret-000000',
  NODE_ENV: 'test',
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
      expect(result.error.problems).toHaveLength(3);
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
    const defaulted = loadIdentityConfig({
      DATABASE_URL: VALID.DATABASE_URL,
      TOKEN_PEPPER: VALID.TOKEN_PEPPER,
    });
    expect(defaulted.ok).toBe(true);
    if (defaulted.ok) {
      expect(defaulted.value.nodeEnv).toBe('development');
    }
    expect(loadIdentityConfig({ ...VALID, NODE_ENV: 'staging' }).ok).toBe(false);
  });
});
