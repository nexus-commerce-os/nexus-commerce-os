/*
 * WHO MAY USE THE DASHBOARD.
 *
 * Cloudflare Access is the intended production mechanism and the verification
 * for it is already written and tested (packages/shared/src/access-jwt.ts, 22
 * tests). What is missing is the ACCOUNT: Zero Trust onboarding is a founder
 * action, and it is not done.
 *
 * So this file does two things and is explicit about which is which:
 *
 *   1. when Access IS configured (ACCESS_TEAM_DOMAIN + ACCESS_AUD), it
 *      verifies the assertion properly — signature, kid, RS256 allow-list,
 *      issuer, AUDIENCE, exp and nbf;
 *
 *   2. when it is NOT, it falls back to a shared secret — and ONLY when the
 *      database says this is not production. A development identity must not
 *      be able to become a production login because somebody forgot to set a
 *      variable.
 *
 * THE FALLBACK IS REFUSED, NOT RELAXED, WHEN THE SECRET IS ABSENT. An
 * unauthenticated administrative surface is worse than none, and "the secret
 * was unset so we let everyone in" is how that happens.
 */
import {
  AccessKeyStore,
  AccessVerificationError,
  readAccessToken,
  verifyAccessToken,
  type AccessIdentity,
} from '../../../packages/shared/dist/index.js';

export type AdminRole = 'owner' | 'operator' | 'viewer';

export interface AdminPrincipal {
  readonly subject: string;
  readonly email: string;
  readonly role: AdminRole;
  /** How this principal was established. Shown in the UI and in the audit log. */
  readonly via: 'cloudflare-access' | 'development-token';
}

export type DenialReason =
  | 'no_credential'
  | 'invalid_credential'
  | 'not_allowlisted'
  | 'fallback_refused_in_production'
  | 'fallback_secret_unset'
  | 'insufficient_role';

export class AdminDenied extends Error {
  readonly _tag = 'AdminDenied';
  constructor(
    readonly reason: DenialReason,
    detail: string,
    /** 401 when a credential would help, 403 when it would not. */
    readonly status: 401 | 403 = 403,
  ) {
    super(detail);
    this.name = 'AdminDenied';
  }
}

export interface AdminEnv {
  readonly ACCESS_TEAM_DOMAIN?: string;
  readonly ACCESS_AUD?: string;
  /** Comma-separated emails. Empty means nobody, never everybody. */
  readonly ADMIN_ALLOWLIST?: string;
  /** Only honoured outside production. Absent means the fallback is refused. */
  readonly DEV_ADMIN_TOKEN?: string;
}

/** Role per email. Everything unlisted that is allowlisted gets `viewer`. */
function roleFor(email: string, env: AdminEnv): AdminRole {
  const entries = (env.ADMIN_ALLOWLIST ?? '')
    .split(',')
    .map((part) => part.trim())
    .filter((part) => part !== '');

  for (const entry of entries) {
    const [address, role] = entry.split(':').map((part) => part.trim().toLowerCase());
    if (address === email.toLowerCase()) {
      return role === 'owner' || role === 'operator' ? role : 'viewer';
    }
  }
  // Unreachable through authorise(), which checks the allowlist first. Kept
  // as the least-privilege answer rather than throwing, so a future caller
  // that forgets the check gets `viewer` instead of `owner`.
  return 'viewer';
}

function allowlisted(email: string, env: AdminEnv): boolean {
  const entries = (env.ADMIN_ALLOWLIST ?? '')
    .split(',')
    .map((part) => part.split(':')[0].trim().toLowerCase())
    .filter((part) => part !== '');
  return entries.includes(email.toLowerCase());
}

let keyStore: AccessKeyStore | null = null;

/**
 * Establishes who is asking, or throws.
 *
 * `environment` comes from the DATABASE, not from a variable, so a staging
 * fallback cannot be turned on in production by editing a deploy setting.
 */
export async function authenticate(
  request: Request,
  env: AdminEnv,
  environment: 'development' | 'staging' | 'production',
): Promise<AdminPrincipal> {
  const teamDomain = env.ACCESS_TEAM_DOMAIN?.trim() ?? '';
  const audience = env.ACCESS_AUD?.trim() ?? '';

  if (teamDomain !== '' && audience !== '') {
    const token = readAccessToken(request);
    if (keyStore === null) keyStore = new AccessKeyStore(teamDomain);

    let identity: AccessIdentity;
    try {
      identity = await verifyAccessToken(token, {
        config: { teamDomain, audience },
        keys: keyStore,
      });
    } catch (error) {
      if (error instanceof AccessVerificationError) {
        throw new AdminDenied(
          error.code === 'missing_token' ? 'no_credential' : 'invalid_credential',
          error.message,
          error.code === 'missing_token' ? 401 : 403,
        );
      }
      throw error;
    }

    /*
     * ALLOWLISTED SEPARATELY FROM AUTHENTICATED.
     *
     * Access says who somebody is. It does not say they may use this. Keeping
     * the list here means revoking somebody is a deploy variable rather than
     * an Access policy change, and means a misconfigured Access application
     * cannot by itself grant the dashboard.
     */
    if (!allowlisted(identity.email, env)) {
      throw new AdminDenied('not_allowlisted', `${identity.email} is not on the admin allowlist`);
    }

    return {
      subject: identity.subject,
      email: identity.email,
      role: roleFor(identity.email, env),
      via: 'cloudflare-access',
    };
  }

  // ── the development fallback ──

  if (environment === 'production') {
    throw new AdminDenied(
      'fallback_refused_in_production',
      'Cloudflare Access is not configured and the development fallback is refused in production',
    );
  }

  const secret = env.DEV_ADMIN_TOKEN ?? '';
  if (secret.length < 24) {
    throw new AdminDenied(
      'fallback_secret_unset',
      'no Access configuration and no usable development token; the dashboard is closed',
    );
  }

  const presented = readDevToken(request);
  if (presented === null) {
    throw new AdminDenied('no_credential', 'no development token presented', 401);
  }
  if (!timingSafeEqual(presented, secret)) {
    throw new AdminDenied('invalid_credential', 'the development token does not match');
  }

  return {
    subject: 'development',
    email: 'development@localhost',
    role: 'owner',
    via: 'development-token',
  };
}

/** `owner` ⊃ `operator` ⊃ `viewer`. */
const RANK: Record<AdminRole, number> = { viewer: 0, operator: 1, owner: 2 };

export function requireRole(principal: AdminPrincipal, minimum: AdminRole): void {
  if (RANK[principal.role] < RANK[minimum]) {
    throw new AdminDenied(
      'insufficient_role',
      `${principal.email} is ${principal.role}; this needs ${minimum}`,
    );
  }
}

export function readDevToken(request: Request): string | null {
  const header = request.headers.get('x-admin-token');
  if (header !== null && header.trim() !== '') return header.trim();

  const cookie = request.headers.get('cookie');
  if (cookie === null) return null;
  for (const part of cookie.split(';')) {
    const [name, ...rest] = part.trim().split('=');
    if (name === '__Host-admin_dev') {
      const value = rest.join('=').trim();
      if (value !== '') return value;
    }
  }
  return null;
}

export function timingSafeEqual(a: string, b: string): boolean {
  if (a.length !== b.length) return false;
  let diff = 0;
  for (let i = 0; i < a.length; i += 1) diff |= a.charCodeAt(i) ^ b.charCodeAt(i);
  return diff === 0;
}

/* ──────────────────────────────── CSRF ──────────────────────────────── */

/*
 * A dashboard whose controls are real is a dashboard whose controls can be
 * triggered by someone else's page. Access protects the ORIGIN; it does not
 * stop a form on another site posting here with the visitor's cookie.
 *
 * Two independent checks, because each misses something:
 *   · Origin/Referer, which a browser sets and a page cannot forge;
 *   · a token tied to the session, which survives a missing Origin header.
 */
export function assertSameOrigin(request: Request): void {
  const url = new URL(request.url);
  const rawOrigin = request.headers.get('origin');
  /*
   * `Origin: null` IS NOT A MISSING ORIGIN.
   *
   * It is the literal four-character string, and `??` does not treat it as
   * absent — so the Referer fallback never ran and a legitimate same-origin
   * form POST was refused with "the stated origin is not a URL". Found by
   * pressing the pause button on the deployed dashboard.
   *
   * An opaque origin is still not a pass: it means the request came from a
   * sandboxed or redirected context, which is exactly what this check is for.
   * It falls through to Referer, and if that is absent too the request is
   * refused.
   */
  const origin = rawOrigin === null || rawOrigin === 'null' ? null : rawOrigin;
  const referer = request.headers.get('referer');
  const stated = origin ?? referer;

  if (stated === null) {
    throw new AdminDenied('invalid_credential', 'a state-changing request must state its origin');
  }
  let statedOrigin: string;
  try {
    statedOrigin = new URL(stated).origin;
  } catch {
    throw new AdminDenied('invalid_credential', 'the stated origin is not a URL');
  }
  if (statedOrigin !== url.origin) {
    throw new AdminDenied('invalid_credential', 'cross-origin state change refused');
  }
}

/** A CSRF token bound to the principal, so one user's token is not another's. */
export async function csrfToken(principal: AdminPrincipal, secret: string): Promise<string> {
  const key = await crypto.subtle.importKey(
    'raw',
    new TextEncoder().encode(secret),
    { name: 'HMAC', hash: 'SHA-256' },
    false,
    ['sign'],
  );
  const mac = await crypto.subtle.sign(
    'HMAC',
    key,
    new TextEncoder().encode(`csrf:${principal.subject}:${principal.email}`),
  );
  return [...new Uint8Array(mac)].map((byte) => byte.toString(16).padStart(2, '0')).join('');
}

export async function assertCsrf(
  presented: string | null,
  principal: AdminPrincipal,
  secret: string,
): Promise<void> {
  if (presented === null || presented === '') {
    throw new AdminDenied('invalid_credential', 'no CSRF token');
  }
  if (!timingSafeEqual(presented, await csrfToken(principal, secret))) {
    throw new AdminDenied('invalid_credential', 'the CSRF token does not match this session');
  }
}
