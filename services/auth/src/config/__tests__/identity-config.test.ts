import { describe, it, expect } from 'vitest';
import { loadIdentityConfig } from '../identity-config';

const VALID = {
  DATABASE_URL: 'postgres://user:pw@localhost:5432/identity',
  TOKEN_PEPPER: 'test-only-pepper-not-a-real-secret-000000',
  NODE_ENV: 'test',
  WEBAUTHN_RP_ID: 'nexus.example',
  WEBAUTHN_RP_ORIGIN: 'https://nexus.example',
  MAIL_SMTP_HOST: 'smtp.example.com',
  MAIL_SMTP_USERNAME: 'mailer',
  MAIL_SMTP_PASSWORD: 'test-only-smtp-password',
  MAIL_FROM_ADDRESS: 'no-reply@nexus.example',
  APP_BASE_URL: 'https://app.nexus.example',
  ACCESS_TOKEN_SECRET: 'test-only-access-secret-not-real-00000000',
  ACCESS_TOKEN_ISSUER: 'https://identity.nexus.example',
  ACCESS_TOKEN_AUDIENCE: 'nexus-api',
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
      // database url, pepper, port, rp id, rp origin,
      // + smtp host/username/password, from address, app base url,
      // + access-token secret, issuer, audience
      expect(result.error.problems).toHaveLength(13);
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
  it('defaults to no OIDC providers, so federated sign-in refuses cleanly', () => {
    const result = loadIdentityConfig(VALID);
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.value.oidcProviders).toEqual({});
    }
  });

  it('parses a configured provider and lower-cases its slug', () => {
    const result = loadIdentityConfig({
      ...VALID,
      OIDC_PROVIDERS: JSON.stringify({
        Google: {
          issuer: 'https://accounts.google.com',
          jwksUri: 'https://www.googleapis.com/oauth2/v3/certs',
          tokenEndpoint: 'https://oauth2.googleapis.com/token',
          clientId: 'client',
          clientSecret: 'secret',
        },
      }),
    });
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(Object.keys(result.value.oidcProviders)).toEqual(['google']);
      expect(result.value.oidcProviders['google']?.allowedAlgorithms).toEqual(['RS256', 'ES256']);
    }
  });

  it('rejects a provider that is missing credentials or endpoints', () => {
    const result = loadIdentityConfig({
      ...VALID,
      OIDC_PROVIDERS: JSON.stringify({ google: { issuer: 'https://x' } }),
    });
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.error.message).toContain('jwksUri');
      expect(result.error.message).toContain('clientSecret');
    }
  });

  it('rejects malformed OIDC_PROVIDERS json', () => {
    expect(loadIdentityConfig({ ...VALID, OIDC_PROVIDERS: 'not json' }).ok).toBe(false);
    expect(loadIdentityConfig({ ...VALID, OIDC_PROVIDERS: '[]' }).ok).toBe(false);
  });
});

describe('loadIdentityConfig — mail', () => {
  it('defaults the port to STARTTLS-on-587 and the sender name', () => {
    const result = loadIdentityConfig(VALID);
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.value.mail.port).toBe(587);
      expect(result.value.mail.secure).toBe(false);
      expect(result.value.mail.fromName).toBe('NEXUS');
      expect(result.value.mail.host).toBe('smtp.example.com');
    }
  });

  it('reports every missing mail variable at once, not just the first', () => {
    const withoutMail = Object.fromEntries(
      Object.entries(VALID).filter(([key]) => !key.startsWith('MAIL_') && key !== 'APP_BASE_URL'),
    );

    const result = loadIdentityConfig(withoutMail);
    expect(result.ok).toBe(false);
    if (!result.ok) {
      for (const name of [
        'MAIL_SMTP_HOST',
        'MAIL_SMTP_USERNAME',
        'MAIL_SMTP_PASSWORD',
        'MAIL_FROM_ADDRESS',
        'APP_BASE_URL',
      ]) {
        expect(result.error.message).toContain(name);
      }
    }
  });

  it('accepts an explicit implicit-TLS configuration', () => {
    const result = loadIdentityConfig({
      ...VALID,
      MAIL_SMTP_PORT: '465',
      MAIL_SMTP_SECURE: 'TRUE',
      MAIL_FROM_NAME: 'NEXUS Security',
    });
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.value.mail.port).toBe(465);
      expect(result.value.mail.secure).toBe(true);
      expect(result.value.mail.fromName).toBe('NEXUS Security');
    }
  });

  it('rejects a non-boolean MAIL_SMTP_SECURE rather than guessing', () => {
    expect(loadIdentityConfig({ ...VALID, MAIL_SMTP_SECURE: 'yes' }).ok).toBe(false);
  });

  it('rejects an out-of-range mail port', () => {
    for (const port of ['0', '70000', 'smtp']) {
      expect(loadIdentityConfig({ ...VALID, MAIL_SMTP_PORT: port }).ok).toBe(false);
    }
  });

  it('rejects a host given as a URL', () => {
    expect(loadIdentityConfig({ ...VALID, MAIL_SMTP_HOST: 'smtp://smtp.example.com' }).ok).toBe(
      false,
    );
  });

  it('rejects a sender that is not an email address', () => {
    expect(loadIdentityConfig({ ...VALID, MAIL_FROM_ADDRESS: 'no-reply' }).ok).toBe(false);
  });

  it('requires APP_BASE_URL to be https outside localhost, and trims trailing slashes', () => {
    expect(loadIdentityConfig({ ...VALID, APP_BASE_URL: 'http://app.nexus.example' }).ok).toBe(
      false,
    );
    expect(loadIdentityConfig({ ...VALID, APP_BASE_URL: 'http://localhost:3000' }).ok).toBe(true);

    const trailing = loadIdentityConfig({ ...VALID, APP_BASE_URL: 'https://app.nexus.example/' });
    expect(trailing.ok).toBe(true);
    if (trailing.ok) {
      expect(trailing.value.mail.appBaseUrl).toBe('https://app.nexus.example');
    }
  });
});
