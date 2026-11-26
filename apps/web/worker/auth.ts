/*
 * Authentication and authorisation for the administration surface.
 *
 * NOTHING HERE IS ROUTED YET, deliberately. An administrative endpoint that
 * exists before its authorisation is verified is a worse outcome than no
 * dashboard at all, so this lands as a tested module with no URL attached.
 * Wiring comes after, in its own change, and the routes are refused unless
 * `ADMIN_ENABLED` is explicitly set.
 *
 * WHY THIS RUNS IN THE WORKER. The site is a static export; there is no server
 * to hold a session. The Worker is the only place on this lineage that sees a
 * request before a page is served, so it is the only place an admin check can
 * actually be enforced rather than drawn.
 *
 * THE ITERATION COUNT IS A HARD LIMIT — AND IT IS NOT ENOUGH ON ITS OWN.
 *
 * Cloudflare Workers cap PBKDF2 at 100,000 iterations; asking for more makes
 * `deriveBits` throw at sign-in, in production, for every user at once (that
 * exact mistake, at 210,000, took a different production login down).
 *
 * But a platform ceiling does not make a weak hash strong. OWASP's current
 * recommendation for PBKDF2-HMAC-SHA256 is **600,000 iterations**. 100,000 is
 * one sixth of that, so PBKDF2 ON WORKERS CANNOT MEET CURRENT GUIDANCE, and
 * saying "it is the maximum the platform allows" would be answering a
 * different question than the one that matters.
 *
 * Argon2id and scrypt — the two OWASP prefers — are not in WebCrypto and would
 * need WASM in the request path. So the gap is closed the way OWASP itself
 * describes: with a PEPPER.
 *
 *   stored = PBKDF2( HMAC-SHA256(password, PEPPER), salt, 100_000 )
 *
 * The pepper is a secret held OUTSIDE the database — a Worker secret, never in
 * D1, never in a backup, never in this repository. Iteration count exists to
 * slow an OFFLINE attack on a stolen hash; a pepper removes that attack
 * entirely, because a stolen database contains nothing crackable without a key
 * the database never held. OWASP: a pepper "prevents an attacker from being
 * able to crack any of the hashes if they only have access to the database."
 *
 * WHAT A PEPPER DOES NOT DO, so this is not oversold: it does not help if the
 * attacker also has the Worker's secrets, and it cannot be rotated without
 * every user setting a new password. Both are written down in
 * `docs/engineering/admin-auth.md` rather than discovered later.
 *
 * The long-term answer is to stop storing passwords at all — managed identity
 * or passkeys. Cloudflare Access would be the natural fit, but whether it is
 * on the free plan could NOT be verified from Cloudflare's own documentation,
 * and an authentication decision is not something to make on an assumption.
 * That evaluation is recorded, unresolved, in the same document.
 */

/** Everything an actor may be allowed to do. Deliberately fine-grained. */
export type Permission =
  | 'catalog:read'
  | 'catalog:write'
  | 'feeds:read'
  | 'feeds:run'
  | 'feeds:write'
  | 'publication:control'
  | 'users:manage'
  | 'audit:read';

export type Role = 'owner' | 'operator' | 'viewer';

/**
 * Role → permissions.
 *
 * A VIEWER CANNOT RUN A FEED, and that is the point of having roles at all: a
 * dashboard whose every reader can trigger an import against a live provider
 * has authentication but no authorisation.
 */
const ROLE_PERMISSIONS: Readonly<Record<Role, readonly Permission[]>> = {
  owner: [
    'catalog:read',
    'catalog:write',
    'feeds:read',
    'feeds:run',
    'feeds:write',
    'publication:control',
    'users:manage',
    'audit:read',
  ],
  operator: ['catalog:read', 'catalog:write', 'feeds:read', 'feeds:run', 'audit:read'],
  viewer: ['catalog:read', 'feeds:read', 'audit:read'],
};

export function permissionsFor(role: Role): readonly Permission[] {
  return ROLE_PERMISSIONS[role] ?? [];
}

export function can(role: Role, permission: Permission): boolean {
  return permissionsFor(role).includes(permission);
}

/* ------------------------------------------------------------------ hashing */

/**
 * Cloudflare's PBKDF2 ceiling. Going above this throws at runtime.
 * See the file header — this is the constraint, not a tuning knob.
 */
export const MAX_PBKDF2_ITERATIONS = 100_000;
export const PBKDF2_ITERATIONS = 100_000;

const SALT_BYTES = 16;
const KEY_BITS = 256;

const toB64 = (bytes: Uint8Array): string => {
  let binary = '';
  for (const b of bytes) binary += String.fromCharCode(b);
  return btoa(binary);
};

const fromB64 = (value: string): Uint8Array => {
  const binary = atob(value);
  const out = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i += 1) out[i] = binary.charCodeAt(i);
  return out;
};

/**
 * HMAC-SHA256 the password under the pepper before it ever reaches PBKDF2.
 *
 * This is the step that makes a stolen database useless on its own: without
 * the key, no candidate password can be tested against a stored hash.
 */
async function applyPepper(password: string, secret: string): Promise<string> {
  const key = await crypto.subtle.importKey(
    'raw',
    new TextEncoder().encode(secret),
    { name: 'HMAC', hash: 'SHA-256' },
    false,
    ['sign'],
  );
  const mac = await crypto.subtle.sign('HMAC', key, new TextEncoder().encode(password));
  return toB64(new Uint8Array(mac));
}

/**
 * Refuses a pepper that is not actually a secret.
 *
 * An absent or short value would let everything keep working while providing
 * none of the protection the design depends on — the worst kind of failure,
 * because nothing looks wrong.
 */
export function assertUsablePepper(secret: string | undefined): string {
  if (!secret || secret.length < 32) {
    throw new Error(
      'ADMIN_PASSWORD_PEPPER is missing or shorter than 32 characters. It is the ' +
        'control that makes a stolen password database uncrackable, so running ' +
        'without it is not a degraded mode — it is a different threat model.',
    );
  }
  return secret;
}

async function deriveKey(
  password: string,
  salt: Uint8Array,
  iterations: number,
): Promise<Uint8Array> {
  if (iterations > MAX_PBKDF2_ITERATIONS) {
    throw new RangeError(
      `PBKDF2 iterations ${iterations} exceed the Workers limit of ${MAX_PBKDF2_ITERATIONS}. ` +
        `Raising this does not strengthen the hash, it throws at sign-in for every user.`,
    );
  }
  const key = await crypto.subtle.importKey(
    'raw',
    new TextEncoder().encode(password),
    'PBKDF2',
    false,
    ['deriveBits'],
  );
  const bits = await crypto.subtle.deriveBits(
    { name: 'PBKDF2', salt: salt as BufferSource, iterations, hash: 'SHA-256' },
    key,
    KEY_BITS,
  );
  return new Uint8Array(bits);
}

/** `pbkdf2$sha256$<iterations>$<salt>$<hash>` — self-describing, so the cost can change later. */
/**
 * The scheme id says `pbkdf2-hmac`, not `pbkdf2`, deliberately.
 *
 * A hash made WITHOUT a pepper must never be mistaken for one made with it. A
 * verifier that silently accepted both would let a single legacy row reinstate
 * the offline attack the pepper exists to remove.
 */
export const SCHEME = 'pbkdf2-hmac';

export async function hashPassword(password: string, secret: string): Promise<string> {
  if (password.length < 12) {
    // Enforced here rather than in a form, because the form is not the control.
    throw new Error('an administrative password must be at least 12 characters');
  }
  assertUsablePepper(secret);
  const salt = crypto.getRandomValues(new Uint8Array(SALT_BYTES));
  const hash = await deriveKey(await applyPepper(password, secret), salt, PBKDF2_ITERATIONS);
  return `${SCHEME}$sha256$${PBKDF2_ITERATIONS}$${toB64(salt)}$${toB64(hash)}`;
}

/** Compares without leaking, through timing, how much of the value matched. */
export function timingSafeEqual(a: Uint8Array, b: Uint8Array): boolean {
  // Compare the LENGTHS into the result rather than returning early: an early
  // return on length is itself a timing signal.
  let diff = a.length ^ b.length;
  const n = Math.max(a.length, b.length);
  for (let i = 0; i < n; i += 1) diff |= (a[i] ?? 0) ^ (b[i] ?? 0);
  return diff === 0;
}

export async function verifyPassword(
  password: string,
  stored: string,
  secret: string,
): Promise<boolean> {
  assertUsablePepper(secret);
  const parts = stored.split('$');
  // Only the peppered scheme is accepted. An un-peppered `pbkdf2$...` row is
  // refused rather than verified — see the note on SCHEME.
  if (parts.length !== 5 || parts[0] !== SCHEME || parts[1] !== 'sha256') return false;
  const iterations = Number(parts[2]);
  if (!Number.isInteger(iterations) || iterations < 1 || iterations > MAX_PBKDF2_ITERATIONS) {
    return false;
  }
  let salt: Uint8Array;
  let expected: Uint8Array;
  try {
    salt = fromB64(parts[3]!);
    expected = fromB64(parts[4]!);
  } catch {
    return false;
  }
  const actual = await deriveKey(await applyPepper(password, secret), salt, iterations);
  return timingSafeEqual(actual, expected);
}

/* ----------------------------------------------------------------- sessions */

export interface AdminUser {
  readonly id: string;
  readonly email: string;
  readonly role: Role;
  readonly passwordHash: string;
  readonly disabled?: boolean;
}

export interface Session {
  readonly userId: string;
  readonly role: Role;
  readonly createdAt: string;
  readonly expiresAt: string;
}

/**
 * Sessions are stored by the HASH of their token, never the token.
 *
 * The same reasoning as a password: a leaked session store should not hand
 * over usable credentials. The token exists only in the cookie.
 */
export interface SessionStore {
  get(tokenHash: string): Promise<Session | null>;
  put(tokenHash: string, session: Session, ttlSeconds: number): Promise<void>;
  delete(tokenHash: string): Promise<void>;
}

export const SESSION_TTL_SECONDS = 8 * 60 * 60;
export const SESSION_COOKIE = '__Host-admin_session';

export async function sha256Hex(value: string): Promise<string> {
  const digest = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(value));
  return [...new Uint8Array(digest)].map((b) => b.toString(16).padStart(2, '0')).join('');
}

/** 256 bits from the CSPRNG. Not a UUID: a session token is not an identifier. */
export function newSessionToken(): string {
  return toB64(crypto.getRandomValues(new Uint8Array(32)))
    .replace(/\+/g, '-')
    .replace(/\//g, '_')
    .replace(/=+$/, '');
}

export async function createSession(
  store: SessionStore,
  user: AdminUser,
  now: Date = new Date(),
): Promise<{ token: string; session: Session }> {
  const token = newSessionToken();
  const session: Session = {
    userId: user.id,
    role: user.role,
    createdAt: now.toISOString(),
    expiresAt: new Date(now.getTime() + SESSION_TTL_SECONDS * 1000).toISOString(),
  };
  await store.put(await sha256Hex(token), session, SESSION_TTL_SECONDS);
  return { token, session };
}

/** Resolves a cookie token to a live session, or null. Expiry is re-checked here. */
export async function readSession(
  store: SessionStore,
  token: string | null,
  now: Date = new Date(),
): Promise<Session | null> {
  if (!token) return null;
  const session = await store.get(await sha256Hex(token));
  if (!session) return null;
  // KV expiry is best-effort; the timestamp is the control.
  if (Date.parse(session.expiresAt) <= now.getTime()) return null;
  return session;
}

export async function destroySession(store: SessionStore, token: string | null): Promise<void> {
  if (!token) return;
  await store.delete(await sha256Hex(token));
}

/**
 * `__Host-` prefix, so the browser enforces Secure + Path=/ + no Domain. That
 * makes a subdomain unable to set a cookie this Worker would then trust.
 */
export function sessionCookie(token: string, maxAgeSeconds = SESSION_TTL_SECONDS): string {
  return (
    `${SESSION_COOKIE}=${token}; Max-Age=${maxAgeSeconds}; Path=/; Secure; HttpOnly; ` +
    // Strict, not Lax: no cross-site navigation should arrive already signed in.
    `SameSite=Strict`
  );
}

export function clearedCookie(): string {
  return `${SESSION_COOKIE}=; Max-Age=0; Path=/; Secure; HttpOnly; SameSite=Strict`;
}

export function readCookie(header: string | null, name: string): string | null {
  if (!header) return null;
  for (const part of header.split(';')) {
    const [key, ...rest] = part.trim().split('=');
    if (key === name) return rest.join('=') || null;
  }
  return null;
}

/* -------------------------------------------------------------------- audit */

export interface AuditEntry {
  readonly at: string;
  readonly actorId: string | null;
  readonly action: string;
  readonly target: string | null;
  readonly outcome: 'allowed' | 'denied' | 'failed';
  readonly detail?: string;
}

export interface AuditSink {
  record(entry: AuditEntry): Promise<void>;
}

/**
 * The single gate every administrative action passes.
 *
 * It returns a decision AND records it, because an authorisation check whose
 * denials are invisible cannot be reviewed. Denials are the interesting half
 * of an audit log.
 */
export async function authorise(
  session: Session | null,
  permission: Permission,
  audit: AuditSink,
  context: { action: string; target?: string; now?: Date },
): Promise<{ allowed: boolean; reason?: string }> {
  const at = (context.now ?? new Date()).toISOString();
  const base = {
    at,
    actorId: session?.userId ?? null,
    action: context.action,
    target: context.target ?? null,
  };

  if (!session) {
    await audit.record({ ...base, outcome: 'denied', detail: 'no session' });
    return { allowed: false, reason: 'not signed in' };
  }
  if (!can(session.role, permission)) {
    await audit.record({
      ...base,
      outcome: 'denied',
      detail: `role ${session.role} lacks ${permission}`,
    });
    return { allowed: false, reason: `role ${session.role} may not ${permission}` };
  }
  await audit.record({ ...base, outcome: 'allowed', detail: permission });
  return { allowed: true };
}
