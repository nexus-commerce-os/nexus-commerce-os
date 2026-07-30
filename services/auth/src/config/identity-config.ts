import { type Result, ok, err } from '../kernel/result';

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
  });
}
