import { type Result, ok, err } from '../kernel/result';
import {
  DEFAULT_ALLOWED_ALGORITHMS,
  type OidcProviderRegistry,
} from '../identity/infrastructure/oidc/oidc-provider-registry';

/**
 * Everything the Identity module needs from its environment. Validated once at
 * boot so a misconfigured deployment fails immediately and loudly, rather than
 * at the first request that happens to need the missing value.
 */
export interface IdentityConfig {
  readonly databaseUrl: string;
  /**
   * Server-held pepper for {@link HmacTokenHasher}. Never stored beside the
   * hashes it protects — a database leak alone must not permit offline
   * verification of guesses. Supplied from the secret manager (docs/08 §4.6).
   */
  readonly tokenPepper: string;
  readonly port: number;
  readonly nodeEnv: 'development' | 'test' | 'production';
  /**
   * WebAuthn relying party. `rpId` must be the site's registrable domain (a
   * credential is scoped to it and cannot be used elsewhere), and `origin` is
   * matched verbatim against the one the browser signed — the two together are
   * what make a passkey phishing-resistant, so neither may be guessed at
   * runtime.
   */
  readonly rpId: string;
  readonly rpOrigin: string;
  /**
   * Identity providers, keyed by slug, from `OIDC_PROVIDERS` (JSON).
   *
   * Empty by default: with nothing configured, a federated sign-in is refused
   * as an unknown provider rather than half-attempted. Endpoints are supplied
   * explicitly instead of discovered at request time, so an unreachable or
   * tampered discovery document cannot silently repoint us at another issuer.
   */
  readonly oidcProviders: OidcProviderRegistry;
  /**
   * Outbound mail. Required, not optional: a deployment that cannot send is one
   * where nobody can verify an address or recover an account, and that should
   * fail at boot rather than at the first person who needs a reset link.
   */
  readonly mail: MailSettings;
  /**
   * The short-lived credential presented on every authenticated request
   * (ruling of 2026-07-31). Derived from the Session aggregate, which stays
   * authoritative for revocation.
   */
  readonly accessToken: AccessTokenSettings;
  /** Abuse protection (I-7g). */
  readonly rateLimit: RateLimitSettings;
}

export interface RateLimitSettings {
  readonly enabled: boolean;
  readonly redisUrl: string;
  /**
   * How many proxies in front of this service append to `X-Forwarded-For`.
   * Required when enabled: a wrong or absent value silently disables the
   * network layer, and a silently-disabled limiter is worse than none.
   */
  readonly trustedProxyHops: number;
  readonly keySecret: string;
}

export interface AccessTokenSettings {
  readonly secret: string;
  readonly issuer: string;
  readonly audience: string;
  readonly ttlSeconds: number;
}

export interface MailSettings {
  readonly host: string;
  readonly port: number;
  /** Implicit TLS (465). When false the connection must upgrade via STARTTLS. */
  readonly secure: boolean;
  readonly username: string;
  readonly password: string;
  readonly fromAddress: string;
  /** Also the product name used in the message body. */
  readonly fromName: string;
  /** Origin the action links point at. */
  readonly appBaseUrl: string;
}

export class ConfigError extends Error {
  readonly _tag = 'ConfigError';
  constructor(public readonly problems: readonly string[]) {
    super(`Invalid configuration:\n  - ${problems.join('\n  - ')}`);
    this.name = 'ConfigError';
  }
}

const MIN_PEPPER_LENGTH = 32;
const DEFAULT_PORT = 3001;
const ENVIRONMENTS = ['development', 'test', 'production'] as const;

type Env = Readonly<Record<string, string | undefined>>;

/**
 * Reads and validates the configuration, collecting **every** problem rather
 * than failing on the first — an operator fixing a deployment should see the
 * whole list at once.
 */
export function loadIdentityConfig(env: Env): Result<IdentityConfig, ConfigError> {
  const problems: string[] = [];

  const databaseUrl = (env['DATABASE_URL'] ?? '').trim();
  if (databaseUrl.length === 0) {
    problems.push('DATABASE_URL is required');
  } else if (!/^postgres(ql)?:\/\//.test(databaseUrl)) {
    problems.push('DATABASE_URL must be a postgres:// connection string');
  }

  const tokenPepper = env['TOKEN_PEPPER'] ?? '';
  if (tokenPepper.length === 0) {
    problems.push('TOKEN_PEPPER is required');
  } else if (tokenPepper.length < MIN_PEPPER_LENGTH) {
    problems.push(`TOKEN_PEPPER must be at least ${MIN_PEPPER_LENGTH} characters`);
  }

  const rawPort = env['PORT'];
  let port = DEFAULT_PORT;
  if (rawPort !== undefined && rawPort.trim().length > 0) {
    const parsed = Number(rawPort);
    if (!Number.isInteger(parsed) || parsed < 1 || parsed > 65535) {
      problems.push('PORT must be an integer between 1 and 65535');
    } else {
      port = parsed;
    }
  }

  const rpId = (env['WEBAUTHN_RP_ID'] ?? '').trim();
  if (rpId.length === 0) {
    problems.push('WEBAUTHN_RP_ID is required');
  } else if (!/^[a-z0-9.-]+$/i.test(rpId) || rpId.includes('/')) {
    problems.push('WEBAUTHN_RP_ID must be a bare domain, not a URL');
  }

  const rpOrigin = (env['WEBAUTHN_RP_ORIGIN'] ?? '').trim();
  if (rpOrigin.length === 0) {
    problems.push('WEBAUTHN_RP_ORIGIN is required');
  } else if (!/^https:\/\//.test(rpOrigin) && !rpOrigin.startsWith('http://localhost')) {
    problems.push('WEBAUTHN_RP_ORIGIN must be https:// (http:// allowed only for localhost)');
  }

  const providersResult = parseOidcProviders(env['OIDC_PROVIDERS']);
  if (!providersResult.ok) {
    problems.push(...providersResult.error);
  }

  const mailResult = parseMailSettings(env);
  if (!mailResult.ok) {
    problems.push(...mailResult.error);
  }

  const accessTokenResult = parseAccessTokenSettings(env);
  if (!accessTokenResult.ok) {
    problems.push(...accessTokenResult.error);
  }

  const rateLimitResult = parseRateLimitSettings(env);
  if (!rateLimitResult.ok) {
    problems.push(...rateLimitResult.error);
  }

  const rawEnv = env['NODE_ENV'] ?? 'development';
  if (!(ENVIRONMENTS as readonly string[]).includes(rawEnv)) {
    problems.push(`NODE_ENV must be one of ${ENVIRONMENTS.join(', ')}`);
  }

  // `!mailResult.ok` is redundant with `problems` — it only ever fails having
  // pushed one — but it is what narrows `mailResult` for the return below,
  // which beats inventing a fallback that could never be used.
  if (problems.length > 0 || !mailResult.ok || !accessTokenResult.ok || !rateLimitResult.ok) {
    return err(new ConfigError(problems));
  }
  return ok({
    databaseUrl,
    tokenPepper,
    port,
    nodeEnv: rawEnv as IdentityConfig['nodeEnv'],
    rpId,
    rpOrigin,
    oidcProviders: providersResult.ok ? providersResult.value : {},
    mail: mailResult.value,
    accessToken: accessTokenResult.value,
    rateLimit: rateLimitResult.value,
  });
}

const DEFAULT_SMTP_PORT = 587;
const DEFAULT_FROM_NAME = 'NEXUS';

/** Reads `MAIL_*` and `APP_BASE_URL`, collecting every problem it finds. */
function parseMailSettings(env: Env): Result<MailSettings, string[]> {
  const problems: string[] = [];

  const host = (env['MAIL_SMTP_HOST'] ?? '').trim();
  if (host.length === 0) {
    problems.push('MAIL_SMTP_HOST is required');
  } else if (host.includes('/')) {
    problems.push('MAIL_SMTP_HOST must be a bare hostname, not a URL');
  }

  let port = DEFAULT_SMTP_PORT;
  const rawPort = env['MAIL_SMTP_PORT'];
  if (rawPort !== undefined && rawPort.trim().length > 0) {
    const parsed = Number(rawPort);
    if (!Number.isInteger(parsed) || parsed < 1 || parsed > 65535) {
      problems.push('MAIL_SMTP_PORT must be an integer between 1 and 65535');
    } else {
      port = parsed;
    }
  }

  let secure = false;
  const rawSecure = env['MAIL_SMTP_SECURE'];
  if (rawSecure !== undefined && rawSecure.trim().length > 0) {
    const normalized = rawSecure.trim().toLowerCase();
    if (normalized !== 'true' && normalized !== 'false') {
      problems.push("MAIL_SMTP_SECURE must be 'true' or 'false'");
    } else {
      secure = normalized === 'true';
    }
  }

  const username = env['MAIL_SMTP_USERNAME'] ?? '';
  if (username.length === 0) {
    problems.push('MAIL_SMTP_USERNAME is required');
  }

  const password = env['MAIL_SMTP_PASSWORD'] ?? '';
  if (password.length === 0) {
    problems.push('MAIL_SMTP_PASSWORD is required');
  }

  const fromAddress = (env['MAIL_FROM_ADDRESS'] ?? '').trim();
  if (fromAddress.length === 0) {
    problems.push('MAIL_FROM_ADDRESS is required');
  } else if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(fromAddress)) {
    problems.push('MAIL_FROM_ADDRESS must be an email address');
  }

  const fromName = (env['MAIL_FROM_NAME'] ?? '').trim() || DEFAULT_FROM_NAME;

  const appBaseUrl = (env['APP_BASE_URL'] ?? '').trim().replace(/\/+$/, '');
  if (appBaseUrl.length === 0) {
    problems.push('APP_BASE_URL is required');
  } else if (!/^https:\/\//.test(appBaseUrl) && !appBaseUrl.startsWith('http://localhost')) {
    problems.push('APP_BASE_URL must be https:// (http:// allowed only for localhost)');
  }

  if (problems.length > 0) {
    return err(problems);
  }
  return ok({ host, port, secure, username, password, fromAddress, fromName, appBaseUrl });
}

const REQUIRED_PROVIDER_FIELDS = [
  'issuer',
  'jwksUri',
  'tokenEndpoint',
  'clientId',
  'clientSecret',
] as const;

/** Parses and validates `OIDC_PROVIDERS`; absent means "no providers", not an error. */
function parseOidcProviders(raw: string | undefined): Result<OidcProviderRegistry, string[]> {
  if (raw === undefined || raw.trim().length === 0) {
    return ok({});
  }

  let parsed: unknown;
  try {
    parsed = JSON.parse(raw);
  } catch {
    return err(['OIDC_PROVIDERS must be valid JSON']);
  }
  if (typeof parsed !== 'object' || parsed === null || Array.isArray(parsed)) {
    return err(['OIDC_PROVIDERS must be a JSON object keyed by provider slug']);
  }

  const problems: string[] = [];
  const registry: Record<string, OidcProviderRegistry[string]> = {};

  for (const [slug, value] of Object.entries(parsed as Record<string, unknown>)) {
    if (typeof value !== 'object' || value === null) {
      problems.push(`OIDC_PROVIDERS.${slug} must be an object`);
      continue;
    }
    const entry = value as Record<string, unknown>;
    const missing = REQUIRED_PROVIDER_FIELDS.filter(
      (field) => typeof entry[field] !== 'string' || (entry[field] as string).length === 0,
    );
    if (missing.length > 0) {
      problems.push(`OIDC_PROVIDERS.${slug} is missing ${missing.join(', ')}`);
      continue;
    }
    const algorithms = entry['allowedAlgorithms'];
    registry[slug.toLowerCase()] = {
      issuer: entry['issuer'] as string,
      jwksUri: entry['jwksUri'] as string,
      tokenEndpoint: entry['tokenEndpoint'] as string,
      clientId: entry['clientId'] as string,
      clientSecret: entry['clientSecret'] as string,
      allowedAlgorithms:
        Array.isArray(algorithms) && algorithms.every((a) => typeof a === 'string')
          ? (algorithms as string[])
          : DEFAULT_ALLOWED_ALGORITHMS,
    };
  }

  return problems.length > 0 ? err(problems) : ok(registry);
}

const MIN_ACCESS_SECRET_LENGTH = 32;
const DEFAULT_ACCESS_TTL_SECONDS = 600;
const MAX_ACCESS_TTL_SECONDS = 3600;

/**
 * Reads `ACCESS_TOKEN_*`. The TTL is capped: an access token cannot be
 * revoked directly, so the window between a session being revoked and every
 * derived token lapsing is exactly this value. A long-lived one would quietly
 * undo logout.
 */
function parseAccessTokenSettings(env: Env): Result<AccessTokenSettings, string[]> {
  const problems: string[] = [];

  const secret = env['ACCESS_TOKEN_SECRET'] ?? '';
  if (secret.length === 0) {
    problems.push('ACCESS_TOKEN_SECRET is required');
  } else if (secret.length < MIN_ACCESS_SECRET_LENGTH) {
    problems.push(`ACCESS_TOKEN_SECRET must be at least ${MIN_ACCESS_SECRET_LENGTH} characters`);
  } else if (secret === (env['TOKEN_PEPPER'] ?? '')) {
    // Distinct duties, distinct keys: one signs bearer credentials, the other
    // protects stored hashes. Sharing them means one leak costs both.
    problems.push('ACCESS_TOKEN_SECRET must not be the same value as TOKEN_PEPPER');
  }

  const issuer = (env['ACCESS_TOKEN_ISSUER'] ?? '').trim();
  if (issuer.length === 0) {
    problems.push('ACCESS_TOKEN_ISSUER is required');
  }

  const audience = (env['ACCESS_TOKEN_AUDIENCE'] ?? '').trim();
  if (audience.length === 0) {
    problems.push('ACCESS_TOKEN_AUDIENCE is required');
  }

  let ttlSeconds = DEFAULT_ACCESS_TTL_SECONDS;
  const rawTtl = env['ACCESS_TOKEN_TTL_SECONDS'];
  if (rawTtl !== undefined && rawTtl.trim().length > 0) {
    const parsed = Number(rawTtl);
    if (!Number.isInteger(parsed) || parsed < 60 || parsed > MAX_ACCESS_TTL_SECONDS) {
      problems.push(
        `ACCESS_TOKEN_TTL_SECONDS must be an integer between 60 and ${MAX_ACCESS_TTL_SECONDS}`,
      );
    } else {
      ttlSeconds = parsed;
    }
  }

  if (problems.length > 0) {
    return err(problems);
  }
  return ok({ secret, issuer, audience, ttlSeconds });
}

const MIN_RATE_LIMIT_SECRET_LENGTH = 32;

/**
 * Reads `RATE_LIMIT_*` and `REDIS_URL`.
 *
 * Fails closed on configuration while the limiter itself fails open at runtime.
 * The distinction matters: an unreachable Redis is transient and observable, a
 * misconfiguration is silent and permanent.
 */
function parseRateLimitSettings(env: Env): Result<RateLimitSettings, string[]> {
  const problems: string[] = [];

  let enabled = true;
  const rawEnabled = env['RATE_LIMIT_ENABLED'];
  if (rawEnabled !== undefined && rawEnabled.trim().length > 0) {
    const normalized = rawEnabled.trim().toLowerCase();
    if (normalized !== 'true' && normalized !== 'false') {
      problems.push("RATE_LIMIT_ENABLED must be 'true' or 'false'");
    } else {
      enabled = normalized === 'true';
    }
  }

  const redisUrl = (env['REDIS_URL'] ?? '').trim();
  const keySecret = env['RATE_LIMIT_KEY_SECRET'] ?? '';
  const rawHops = env['TRUSTED_PROXY_HOPS'];
  let trustedProxyHops = 0;

  if (enabled) {
    if (redisUrl.length === 0) {
      problems.push('REDIS_URL is required when RATE_LIMIT_ENABLED is true');
    } else if (!/^rediss?:\/\//.test(redisUrl)) {
      problems.push('REDIS_URL must be a redis:// or rediss:// connection string');
    }

    if (keySecret.length === 0) {
      problems.push('RATE_LIMIT_KEY_SECRET is required when RATE_LIMIT_ENABLED is true');
    } else if (keySecret.length < MIN_RATE_LIMIT_SECRET_LENGTH) {
      problems.push(
        `RATE_LIMIT_KEY_SECRET must be at least ${MIN_RATE_LIMIT_SECRET_LENGTH} characters`,
      );
    } else if (
      keySecret === (env['TOKEN_PEPPER'] ?? '') ||
      keySecret === (env['ACCESS_TOKEN_SECRET'] ?? '')
    ) {
      problems.push('RATE_LIMIT_KEY_SECRET must not reuse another secret');
    }

    if (rawHops === undefined || rawHops.trim().length === 0) {
      problems.push(
        'TRUSTED_PROXY_HOPS is required when RATE_LIMIT_ENABLED is true (use 0 for no proxy)',
      );
    } else {
      const parsed = Number(rawHops);
      if (!Number.isInteger(parsed) || parsed < 0 || parsed > 10) {
        problems.push('TRUSTED_PROXY_HOPS must be an integer between 0 and 10');
      } else {
        trustedProxyHops = parsed;
      }
    }
  }

  if (problems.length > 0) {
    return err(problems);
  }
  return ok({ enabled, redisUrl, trustedProxyHops, keySecret });
}
