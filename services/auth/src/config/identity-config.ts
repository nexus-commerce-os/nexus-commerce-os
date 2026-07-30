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

  const rawEnv = env['NODE_ENV'] ?? 'development';
  if (!(ENVIRONMENTS as readonly string[]).includes(rawEnv)) {
    problems.push(`NODE_ENV must be one of ${ENVIRONMENTS.join(', ')}`);
  }

  if (problems.length > 0) {
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
  });
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
