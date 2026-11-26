/*
 * CLOUDFLARE ACCESS — verifying the assertion, properly.
 *
 * Access puts a signed JWT in `Cf-Access-Jwt-Assertion` (and in the
 * `CF_Authorization` cookie) after it has authenticated somebody. That header
 * is the whole authentication story, which is exactly why it has to be
 * verified rather than read.
 *
 * THE FAILURE THIS FILE EXISTS TO PREVENT. An application that trusts the
 * header without checking the signature is not protected by Access at all: the
 * header is attacker-controlled on any request that reaches the origin by some
 * other route — a workers.dev URL, a preview deployment, a Worker route that
 * Access does not cover, a direct IP. "It is behind Access" is a statement
 * about one hostname, never about the code.
 *
 * So every check below is mandatory and none of them is skippable by
 * configuration:
 *
 *   1. the signature, against the team's published keys;
 *   2. `kid` must name one of those keys — a token whose header picks the key
 *      is only safe if the key set is the server's, not the token's;
 *   3. `alg` must be RS256, from an ALLOW-LIST. `none` and a symmetric `HS256`
 *      signed with the public key are the two classic forgeries;
 *   4. `iss` must be the team domain this deployment expects;
 *   5. `aud` must contain this application's AUD tag — an Access token for a
 *      DIFFERENT application in the same team is a valid token, and accepting
 *      it is privilege escalation between applications;
 *   6. `exp` and `nbf`, with a small clock allowance.
 *
 * WHAT IT DELIBERATELY DOES NOT DO. It does not decide what the identity may
 * do. Access answers "who is this?"; roles stay in the application, because an
 * identity provider's group list is not an authorisation model and because
 * revoking a role must not require an Access policy change.
 */

export interface AccessIdentity {
  /** The `sub` claim — Access's stable user id. */
  readonly subject: string;
  /** The email Access authenticated. Lower-cased. */
  readonly email: string;
  /** Seconds since the epoch. */
  readonly issuedAt: number;
  readonly expiresAt: number;
  /** The application audience tag this token was issued for. */
  readonly audience: string;
  /** Present for service tokens rather than humans. */
  readonly commonName: string | null;
  /** The identity-provider id, when Access states one. */
  readonly identityProvider: string | null;
}

export type AccessFailure =
  | 'missing_token'
  | 'malformed_token'
  | 'unsupported_algorithm'
  | 'unknown_key'
  | 'bad_signature'
  | 'wrong_issuer'
  | 'wrong_audience'
  | 'expired'
  | 'not_yet_valid'
  | 'missing_identity'
  | 'keys_unavailable';

export class AccessVerificationError extends Error {
  readonly _tag = 'AccessVerificationError';
  constructor(
    readonly code: AccessFailure,
    detail: string,
  ) {
    super(`${code}: ${detail}`);
    this.name = 'AccessVerificationError';
  }
}

export interface AccessConfig {
  /**
   * The team domain, e.g. `https://example.cloudflareaccess.com`. Without a
   * scheme it is assumed https.
   */
  readonly teamDomain: string;
  /**
   * The Application Audience (AUD) tag from the Access application.
   *
   * REQUIRED, with no default. A deployment that does not know which
   * application it is accepts tokens for every application in the team.
   */
  readonly audience: string;
  /** Seconds of clock skew tolerated on `exp`/`nbf`. Small on purpose. */
  readonly clockToleranceSeconds?: number;
}

const DEFAULT_CLOCK_TOLERANCE = 30;

/** Only RS256. An allow-list, because the alternative is an attacker's choice. */
const PERMITTED_ALGORITHMS = new Set(['RS256']);

/*
 * Strips trailing slashes WITHOUT a regular expression.
 *
 * The obvious `value.replace(/\/+$/, '')` reads better and is
 * quadratic: the engine retries the pattern from every position, so a
 * string of N slashes costs O(N^2). CodeQL flagged all three uses as
 * js/polynomial-redos, and it was right about the one that matters —
 * `payload.iss` comes from the token.
 *
 * The signature is verified before that line runs, so only Cloudflare can
 * reach it today. "Only a trusted party can trigger it" is a reason to fix
 * it calmly rather than a reason not to: a trust boundary can move, and a
 * backwards scan is both faster and simpler than the pattern it replaces.
 */
function stripTrailingSlashes(value: string): string {
  let end = value.length;
  while (end > 0 && value.charCodeAt(end - 1) === 47 /* '/' */) end -= 1;
  return value.slice(0, end);
}

export function certsUrl(teamDomain: string): string {
  const base = teamDomain.startsWith('http') ? teamDomain : `https://${teamDomain}`;
  return `${stripTrailingSlashes(base)}/cdn-cgi/access/certs`;
}

export function expectedIssuer(teamDomain: string): string {
  const base = teamDomain.startsWith('http') ? teamDomain : `https://${teamDomain}`;
  return stripTrailingSlashes(base);
}

/* ─────────────────────────── the key set ─────────────────────────── */

interface Jwk {
  readonly kid: string;
  readonly kty: string;
  readonly alg?: string;
  readonly n: string;
  readonly e: string;
}

/**
 * Caches the team's public keys, and re-fetches when a `kid` is unknown.
 *
 * KEY ROTATION IS THE POINT. Cloudflare rotates Access signing keys, so a
 * cache with a fixed lifetime either serves stale keys after a rotation — every
 * request fails until it expires — or is refreshed so often it becomes a
 * dependency on an outbound fetch per request. Re-fetching on an unknown `kid`
 * handles rotation at the moment it matters and at no other time.
 *
 * The refetch is RATE-LIMITED. Without that, a flood of tokens carrying random
 * `kid`s turns this into an outbound request amplifier pointed at Cloudflare.
 */
export class AccessKeyStore {
  private keys = new Map<string, CryptoKey>();
  private fetchedAt = 0;
  private inFlight: Promise<void> | null = null;

  constructor(
    private readonly teamDomain: string,
    private readonly options: {
      /** Re-fetch at most this often when a kid is unknown. */
      readonly minRefetchIntervalMs?: number;
      /** Re-fetch at least this often regardless. */
      readonly maxAgeMs?: number;
      readonly fetchImpl?: typeof fetch;
      readonly now?: () => number;
    } = {},
  ) {}

  private get now(): number {
    return (this.options.now ?? Date.now)();
  }

  async get(kid: string): Promise<CryptoKey | null> {
    const maxAge = this.options.maxAgeMs ?? 60 * 60 * 1000;
    if (this.keys.size === 0 || this.now - this.fetchedAt > maxAge) {
      await this.refresh();
    }
    const found = this.keys.get(kid);
    if (found) return found;

    // Unknown kid: this is what a rotation looks like from here.
    const minInterval = this.options.minRefetchIntervalMs ?? 60 * 1000;
    if (this.now - this.fetchedAt >= minInterval) {
      await this.refresh();
      return this.keys.get(kid) ?? null;
    }
    return null;
  }

  /** Coalesced, so a burst of first requests makes one fetch and not many. */
  private async refresh(): Promise<void> {
    if (this.inFlight) return this.inFlight;
    this.inFlight = this.doRefresh().finally(() => {
      this.inFlight = null;
    });
    return this.inFlight;
  }

  private async doRefresh(): Promise<void> {
    const doFetch = this.options.fetchImpl ?? fetch;
    let response: Response;
    try {
      response = await doFetch(certsUrl(this.teamDomain), {
        headers: { accept: 'application/json' },
      });
    } catch (error) {
      throw new AccessVerificationError(
        'keys_unavailable',
        `could not reach the Access certificate endpoint: ${(error as Error).message}`,
      );
    }
    if (!response.ok) {
      throw new AccessVerificationError(
        'keys_unavailable',
        `the Access certificate endpoint answered ${response.status}`,
      );
    }

    const body = (await response.json()) as { keys?: Jwk[] };
    const keys = Array.isArray(body.keys) ? body.keys : [];
    const imported = new Map<string, CryptoKey>();
    for (const jwk of keys) {
      // Only RSA keys usable for RS256 verification. Anything else in the set
      // is ignored rather than coerced.
      if (jwk.kty !== 'RSA' || typeof jwk.kid !== 'string') continue;
      if (jwk.alg !== undefined && !PERMITTED_ALGORITHMS.has(jwk.alg)) continue;
      try {
        imported.set(
          jwk.kid,
          await crypto.subtle.importKey(
            'jwk',
            { kty: 'RSA', n: jwk.n, e: jwk.e, alg: 'RS256', ext: true },
            { name: 'RSASSA-PKCS1-v1_5', hash: 'SHA-256' },
            false,
            ['verify'],
          ),
        );
      } catch {
        // A key that will not import is a key that cannot verify anything.
        // Skipping it is strictly safer than failing the whole set, because
        // the usable keys still work.
      }
    }

    if (imported.size === 0) {
      throw new AccessVerificationError(
        'keys_unavailable',
        'the Access certificate endpoint returned no usable RS256 keys',
      );
    }
    this.keys = imported;
    this.fetchedAt = this.now;
  }
}

/* ────────────────────────── verification ────────────────────────── */

export interface VerifyOptions {
  readonly config: AccessConfig;
  readonly keys: AccessKeyStore;
  /** Seconds since the epoch. Injected so the clock is testable. */
  readonly now?: () => number;
}

/**
 * Pulls the assertion out of a request.
 *
 * The header first, then the cookie. Both are what Access sets; a request
 * carrying neither has not been through Access, whatever else it carries.
 */
export function readAccessToken(request: {
  headers: { get(name: string): string | null };
}): string | null {
  const header = request.headers.get('cf-access-jwt-assertion');
  if (header !== null && header.trim() !== '') return header.trim();

  const cookie = request.headers.get('cookie');
  if (cookie === null) return null;
  for (const part of cookie.split(';')) {
    const [name, ...rest] = part.trim().split('=');
    if (name === 'CF_Authorization' && rest.length > 0) {
      const value = rest.join('=').trim();
      if (value !== '') return value;
    }
  }
  return null;
}

export async function verifyAccessToken(
  token: string | null,
  options: VerifyOptions,
): Promise<AccessIdentity> {
  if (token === null || token.trim() === '') {
    throw new AccessVerificationError('missing_token', 'no Cf-Access-Jwt-Assertion and no cookie');
  }

  const parts = token.split('.');
  if (parts.length !== 3) {
    throw new AccessVerificationError('malformed_token', 'a JWT has three dot-separated parts');
  }
  const [headerPart, payloadPart, signaturePart] = parts;

  const header = decodeJson(headerPart, 'header');
  const payload = decodeJson(payloadPart, 'payload');

  /*
   * ALGORITHM FIRST, from an allow-list.
   *
   * `alg: none` strips the signature entirely, and `alg: HS256` invites the
   * verifier to use the RSA PUBLIC key as an HMAC secret — a secret the
   * attacker can read from the certs endpoint. Both are defeated by refusing
   * anything that is not RS256 BEFORE a key is chosen.
   */
  const alg = typeof header.alg === 'string' ? header.alg : '';
  if (!PERMITTED_ALGORITHMS.has(alg)) {
    throw new AccessVerificationError(
      'unsupported_algorithm',
      `alg was '${alg}'; only RS256 is accepted`,
    );
  }

  const kid = typeof header.kid === 'string' ? header.kid : '';
  if (kid === '') {
    throw new AccessVerificationError('malformed_token', 'the header names no key');
  }

  const key = await options.keys.get(kid);
  if (key === null) {
    // The token chose a key the team does not publish. That is the signal a
    // forged token gives, and also the signal a very old token gives.
    throw new AccessVerificationError('unknown_key', `no published key with kid '${kid}'`);
  }

  const signature = base64UrlToBytes(signaturePart);
  const signed = new TextEncoder().encode(`${headerPart}.${payloadPart}`);
  const valid = await crypto.subtle.verify(
    { name: 'RSASSA-PKCS1-v1_5' },
    key,
    signature as unknown as ArrayBuffer,
    signed as unknown as ArrayBuffer,
  );
  if (!valid) {
    throw new AccessVerificationError('bad_signature', 'the signature does not match');
  }

  // ── claims, only after the signature ──

  const issuer = typeof payload.iss === 'string' ? stripTrailingSlashes(payload.iss) : '';
  if (issuer !== expectedIssuer(options.config.teamDomain)) {
    throw new AccessVerificationError(
      'wrong_issuer',
      `iss was '${issuer}', expected '${expectedIssuer(options.config.teamDomain)}'`,
    );
  }

  /*
   * AUD, and this one is easy to get wrong in a way nothing notices.
   *
   * Every application in a team is signed by the same keys. A token minted for
   * a low-privilege application is a perfectly valid signature here, so
   * skipping this check turns "can open the status page" into "can open the
   * admin console".
   */
  const audiences = Array.isArray(payload.aud)
    ? payload.aud.map(String)
    : typeof payload.aud === 'string'
      ? [payload.aud]
      : [];
  if (options.config.audience.trim() === '') {
    throw new AccessVerificationError(
      'wrong_audience',
      'this deployment declares no AUD tag, so it would accept tokens for every application in the team',
    );
  }
  if (!audiences.includes(options.config.audience)) {
    throw new AccessVerificationError(
      'wrong_audience',
      'the token was issued for a different Access application',
    );
  }

  const now = (options.now ?? (() => Math.floor(Date.now() / 1000)))();
  const tolerance = options.config.clockToleranceSeconds ?? DEFAULT_CLOCK_TOLERANCE;

  const exp = numeric(payload.exp);
  if (exp === null) {
    throw new AccessVerificationError('malformed_token', 'no exp claim');
  }
  if (now > exp + tolerance) {
    throw new AccessVerificationError('expired', `exp was ${exp}, now ${now}`);
  }

  const nbf = numeric(payload.nbf);
  if (nbf !== null && now + tolerance < nbf) {
    throw new AccessVerificationError('not_yet_valid', `nbf is ${nbf}, now ${now}`);
  }

  const subject = typeof payload.sub === 'string' ? payload.sub : '';
  const email = typeof payload.email === 'string' ? payload.email.toLowerCase() : '';
  const commonName = typeof payload.common_name === 'string' ? payload.common_name : null;

  /*
   * A token with neither an email nor a service-token common name identifies
   * nobody, and an authorisation decision about nobody is not one.
   */
  if (email === '' && commonName === null) {
    throw new AccessVerificationError(
      'missing_identity',
      'the token carries neither an email nor a service-token common name',
    );
  }
  if (subject === '' && commonName === null) {
    throw new AccessVerificationError('missing_identity', 'no sub claim');
  }

  return {
    subject: subject === '' ? `service:${commonName}` : subject,
    email,
    issuedAt: numeric(payload.iat) ?? 0,
    expiresAt: exp,
    audience: options.config.audience,
    commonName,
    identityProvider: typeof payload.idp === 'string' ? payload.idp : null,
  };
}

/* ──────────────────────────── helpers ──────────────────────────── */

function numeric(value: unknown): number | null {
  return typeof value === 'number' && Number.isFinite(value) ? value : null;
}

function decodeJson(part: string, what: string): Record<string, unknown> {
  try {
    const text = new TextDecoder().decode(base64UrlToBytes(part));
    const parsed: unknown = JSON.parse(text);
    if (parsed === null || typeof parsed !== 'object' || Array.isArray(parsed)) {
      throw new Error('not an object');
    }
    return parsed as Record<string, unknown>;
  } catch (error) {
    throw new AccessVerificationError(
      'malformed_token',
      `the ${what} is not base64url JSON: ${(error as Error).message}`,
    );
  }
}

export function base64UrlToBytes(value: string): Uint8Array {
  const padded = value.replace(/-/g, '+').replace(/_/g, '/');
  const binary = atob(padded + '='.repeat((4 - (padded.length % 4)) % 4));
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i += 1) bytes[i] = binary.charCodeAt(i);
  return bytes;
}
