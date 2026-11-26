/*
 * Which URLs a scheduled job is allowed to fetch.
 *
 * WHY THIS EXISTS AND WHY IT IS FIRST. Feed retrieval takes a URL from
 * CONFIGURATION and fetches it on a schedule, unattended, from inside our own
 * network. That is the exact shape of a server-side request forgery: whoever
 * can write a feed source — a future admin dashboard, a database row, a
 * migration, a mistake — can point this at `http://169.254.169.254/` and have
 * the scheduler read a cloud metadata endpoint for them, or at
 * `http://localhost:5432` to probe the catalogue's own database.
 *
 * The defence cannot live at the call site, because the call site is a loop
 * over rows. It lives here, and nothing in this package fetches a URL without
 * passing it through `assertFetchableUrl` first.
 *
 * WHAT THIS DOES NOT DO, said plainly: it does not resolve DNS. A hostname
 * that resolves to a private address passes this check and is caught at
 * connect time by `assertPublicAddress`, which the fetcher applies to the
 * address it actually connected to. Checking the name alone would be
 * security theatre — DNS can return a different answer on the second lookup
 * (a DNS-rebinding attack), so the address, not the name, is what must be
 * judged, and it must be judged at the moment of connection.
 */

/** Only these. A feed is a document fetched over the public internet. */
const ALLOWED_PROTOCOLS = new Set(['https:']);

/**
 * `http:` is refused even for a "temporary" source. A provider feed carries an
 * affiliate tracking URL per row and often a credential in the query string;
 * over plain HTTP both are readable by anything on the path.
 */
export class UnsafeFeedUrlError extends Error {
  constructor(
    readonly url: string,
    readonly reason: string,
  ) {
    // The URL is included because this is an operator-facing configuration
    // error, not a user-facing one, and a refusal nobody can act on is noise.
    // Credentials are stripped first — see `redactUrl`.
    super(`refusing to fetch ${redactUrl(url)}: ${reason}`);
    this.name = 'UnsafeFeedUrlError';
  }
}

/** A URL safe to put in a log line: no userinfo, no query values. */
export function redactUrl(raw: string): string {
  try {
    const u = new URL(raw);
    u.username = '';
    u.password = '';
    // Query strings carry feed keys. Keep the parameter NAMES, drop the values:
    // "which parameters are set" is useful for debugging, the values are secret.
    for (const key of [...u.searchParams.keys()]) u.searchParams.set(key, 'REDACTED');
    return u.toString();
  } catch {
    return '<unparseable url>';
  }
}

/**
 * Refuses a URL that a scheduled job must not fetch.
 *
 * Throws rather than returning false: every caller must stop, and a boolean
 * invites `if (safe)` with no else.
 */
export function assertFetchableUrl(raw: string): URL {
  let url: URL;
  try {
    url = new URL(raw);
  } catch {
    throw new UnsafeFeedUrlError(raw, 'not a URL');
  }

  if (!ALLOWED_PROTOCOLS.has(url.protocol)) {
    throw new UnsafeFeedUrlError(
      raw,
      `protocol ${url.protocol} is not allowed (a feed carries credentials and tracking URLs, so it must be https)`,
    );
  }

  // Credentials belong in a secret store the config REFERENCES, never inline
  // in a URL that will be logged, copied into a ticket and pasted into chat.
  if (url.username !== '' || url.password !== '') {
    throw new UnsafeFeedUrlError(raw, 'credentials in the URL; use a credential reference instead');
  }

  if (url.hostname === '') {
    throw new UnsafeFeedUrlError(raw, 'no host');
  }

  // A literal private address needs no DNS round trip to reject.
  const literal = parseIpLiteral(url.hostname);
  if (literal && !isPublicAddress(literal)) {
    throw new UnsafeFeedUrlError(raw, `${url.hostname} is not a public address`);
  }

  // Names that cannot be public, so they cannot be a provider's feed host.
  const host = url.hostname.toLowerCase().replace(/\.$/, '');
  if (host === 'localhost' || host.endsWith('.localhost') || host.endsWith('.internal')) {
    throw new UnsafeFeedUrlError(raw, `${host} is not a public host`);
  }

  return url;
}

/** `{ family: 4 | 6, address }` for an IP literal, or null when it is a name. */
function parseIpLiteral(hostname: string): { family: 4 | 6; address: string } | null {
  // URL keeps IPv6 literals in brackets.
  if (hostname.startsWith('[') && hostname.endsWith(']')) {
    return { family: 6, address: hostname.slice(1, -1) };
  }
  if (/^\d{1,3}(\.\d{1,3}){3}$/.test(hostname)) {
    return { family: 4, address: hostname };
  }
  return null;
}

/**
 * Whether an address a connection actually reached is on the public internet.
 *
 * Applied by the fetcher to the resolved peer address, which is what makes a
 * DNS-rebinding attack fail: the name may be anything, the address is checked.
 */
export function isPublicAddress(addr: { family: 4 | 6; address: string }): boolean {
  if (addr.family === 4) return isPublicIpv4(addr.address);
  return isPublicIpv6(addr.address.toLowerCase());
}

function isPublicIpv4(address: string): boolean {
  const parts = address.split('.').map((p) => Number(p));
  if (parts.length !== 4 || parts.some((p) => !Number.isInteger(p) || p < 0 || p > 255)) {
    return false;
  }
  const [a, b] = parts as [number, number, number, number];

  if (a === 0) return false; // 0.0.0.0/8 "this network"
  if (a === 10) return false; // RFC1918
  if (a === 127) return false; // loopback
  if (a === 169 && b === 254) return false; // link-local, and the cloud metadata address
  if (a === 172 && b >= 16 && b <= 31) return false; // RFC1918
  if (a === 192 && b === 168) return false; // RFC1918
  if (a === 192 && b === 0) return false; // 192.0.0.0/24 IETF protocol assignments
  if (a === 100 && b >= 64 && b <= 127) return false; // RFC6598 carrier-grade NAT
  if (a >= 224) return false; // multicast, reserved, broadcast
  return true;
}

function isPublicIpv6(address: string): boolean {
  if (address === '::' || address === '::1') return false; // unspecified, loopback
  if (address.startsWith('fe80')) return false; // link-local
  if (/^f[cd]/.test(address)) return false; // fc00::/7 unique local
  if (address.startsWith('ff')) return false; // multicast

  // IPv4-mapped (::ffff:a.b.c.d) must be judged by the IPv4 rules, or every
  // private IPv4 address is reachable again through a v6 spelling.
  const mapped = address.match(/^::ffff:(\d{1,3}(?:\.\d{1,3}){3})$/);
  if (mapped) return isPublicIpv4(mapped[1]!);

  return true;
}
