/*
 * Going and getting the feed — the half the importer never had.
 *
 * `importFeedArchive` takes a Buffer. Everything here exists to produce that
 * Buffer safely and politely, on a schedule, from a source we do not control.
 *
 * THE THREE THINGS THIS IS CAREFUL ABOUT:
 *
 * 1. NOT BEING USED AS A WEAPON. Every URL goes through `assertFetchableUrl`,
 *    and every redirect is re-checked, because a 302 to 169.254.169.254 turns
 *    a feed job into a metadata-service reader. Redirects are followed
 *    manually for exactly that reason.
 *
 * 2. NOT BEING RUDE. Conditional requests mean an unchanged feed costs a 304
 *    and no body. `Retry-After` is obeyed. Backoff is exponential with jitter,
 *    so a provider having a bad minute does not get a synchronised stampede.
 *
 * 3. NOT LYING ABOUT WHAT HAPPENED. Every outcome is a named, structured
 *    result. "Unchanged" and "failed" and "fetched" are different facts, and
 *    an operator who cannot tell them apart will eventually read a broken feed
 *    as an empty catalogue — which is the mistake that deletes a product line.
 */

import { lookup } from 'node:dns/promises';

import {
  DEFAULT_LIMITS,
  FeedTooLargeError,
  expandIfCompressed,
  readWithLimit,
  type SizeLimits,
} from './limits';
import {
  UnsupportedTransportError,
  isImplemented,
  type CredentialResolver,
  type FeedSource,
} from './feed-source';
import { assertFetchableUrl, isPublicAddress, redactUrl } from './url-guard';

/** What the caller remembers between runs so the next one can be conditional. */
export interface FeedValidators {
  readonly etag?: string;
  readonly lastModified?: string;
  /** sha256 of the EXPANDED payload, so an unchanged body is cheap to spot. */
  readonly sha256?: string;
}

export type RetrievalOutcome =
  /** New bytes. `body` is expanded and ready for `importFeedArchive`. */
  | {
      readonly status: 'fetched';
      readonly body: Buffer;
      readonly validators: FeedValidators;
      readonly fetchedAt: string;
      readonly attempts: number;
    }
  /** The provider says nothing changed, or the bytes hash the same. */
  | {
      readonly status: 'unchanged';
      readonly validators: FeedValidators;
      readonly fetchedAt: string;
      readonly attempts: number;
    }
  /**
   * Retrieval failed. THIS IS NOT AN EMPTY CATALOGUE. Nothing downstream may
   * treat it as evidence that products disappeared.
   */
  | {
      readonly status: 'failed';
      readonly reason: string;
      readonly retryable: boolean;
      readonly fetchedAt: string;
      readonly attempts: number;
    };

export interface RetrieveOptions {
  readonly resolveCredential?: CredentialResolver;
  readonly previous?: FeedValidators;
  readonly limits?: SizeLimits;
  /** Per-attempt, not for the whole operation. */
  readonly timeoutMs?: number;
  readonly maxAttempts?: number;
  readonly now?: () => Date;
  /** Injected in tests. Defaults to global fetch. */
  readonly fetchImpl?: typeof fetch;
  /** Injected in tests. Resolves a hostname to addresses. */
  readonly lookupImpl?: typeof lookup;
  /** Injected in tests so backoff does not actually sleep. */
  readonly sleepImpl?: (ms: number) => Promise<void>;
  readonly maxRedirects?: number;
}

const DEFAULTS = {
  timeoutMs: 60_000,
  maxAttempts: 4,
  maxRedirects: 3,
} as const;

const sleep = (ms: number) => new Promise<void>((r) => setTimeout(r, ms));

/** The statuses that actually mean "go and look somewhere else". */
const REDIRECT_STATUSES = new Set([301, 302, 303, 307, 308]);

/** 408/429 and 5xx are worth retrying; 4xx otherwise is a configuration fault. */
function isRetryableStatus(status: number): boolean {
  return status === 408 || status === 429 || (status >= 500 && status <= 599);
}

/**
 * Exponential backoff with full jitter.
 *
 * Jitter is not decoration: without it every source that failed in the same
 * minute retries in the same later minute, which is how a provider's brief
 * outage becomes a self-inflicted thundering herd.
 */
export function backoffMs(attempt: number, random: () => number = Math.random): number {
  const base = Math.min(30_000, 1000 * 2 ** (attempt - 1));
  return Math.floor(base * random());
}

/** `Retry-After` is seconds, or an HTTP date. Returns ms, or null. */
export function parseRetryAfter(value: string | null, now: Date): number | null {
  if (!value) return null;
  const seconds = Number(value.trim());
  if (Number.isFinite(seconds) && seconds >= 0) return Math.min(seconds, 3600) * 1000;
  const when = Date.parse(value);
  if (Number.isNaN(when)) return null;
  return Math.max(0, Math.min(when - now.getTime(), 3600_000));
}

/**
 * Refuses a host whose ADDRESS is private, at the moment we are about to
 * connect to it.
 *
 * This, not the name check, is what stops DNS rebinding: the name may be
 * `feeds.example.com` and resolve to 127.0.0.1 on the second lookup.
 */
async function assertPublicHost(hostname: string, lookupImpl: typeof lookup): Promise<void> {
  // An IP literal was already judged by `assertFetchableUrl`.
  if (/^\d{1,3}(\.\d{1,3}){3}$/.test(hostname) || hostname.includes(':')) return;

  const addresses = await lookupImpl(hostname, { all: true });
  if (addresses.length === 0) {
    throw new Error(`${hostname} resolved to no addresses`);
  }
  for (const a of addresses) {
    const family = a.family === 6 ? 6 : 4;
    if (!isPublicAddress({ family, address: a.address })) {
      throw new Error(
        `${hostname} resolves to ${a.address}, which is not a public address — refusing (this is what an SSRF attempt looks like)`,
      );
    }
  }
}

/** Builds the request headers, including conditional validators and auth. */
async function buildRequest(
  source: FeedSource,
  url: URL,
  previous: FeedValidators | undefined,
  resolveCredential: CredentialResolver | undefined,
): Promise<{ url: URL; headers: Headers }> {
  const headers = new Headers({
    // A generic client name. The provider gets a way to identify the software,
    // not the operator: nothing here identifies a person or a project.
    'user-agent': 'feed-retriever/1.0',
    accept: '*/*',
    'accept-encoding': 'gzip',
  });

  if (previous?.etag) headers.set('if-none-match', previous.etag);
  if (previous?.lastModified) headers.set('if-modified-since', previous.lastModified);

  const target = new URL(url.toString());
  const auth = source.auth ?? { kind: 'none' as const };

  if (auth.kind !== 'none') {
    if (!source.credentialRef) throw new Error(`${source.id}: auth configured with no credentialRef`);
    if (!resolveCredential) throw new Error(`${source.id}: no credential resolver supplied`);
    const secret = await resolveCredential(source.credentialRef);
    if (!secret) {
      throw new Error(
        `${source.id}: credential "${source.credentialRef}" is not set. ` +
          `The reference is configuration; the secret is deployment.`,
      );
    }
    if (auth.kind === 'bearer') headers.set('authorization', `Bearer ${secret}`);
    else if (auth.kind === 'basic') {
      headers.set(
        'authorization',
        `Basic ${Buffer.from(`${auth.username}:${secret}`).toString('base64')}`,
      );
    } else if (auth.kind === 'query') {
      target.searchParams.set(auth.parameter, secret);
    }
  }

  return { url: target, headers };
}

/** One attempt, redirects followed by hand so each hop is re-validated. */
async function attemptOnce(
  source: FeedSource,
  options: RetrieveOptions,
  previous: FeedValidators | undefined,
): Promise<Response> {
  const fetchImpl = options.fetchImpl ?? fetch;
  const lookupImpl = options.lookupImpl ?? lookup;
  const maxRedirects = options.maxRedirects ?? DEFAULTS.maxRedirects;

  let current = assertFetchableUrl(source.url);

  for (let hop = 0; hop <= maxRedirects; hop += 1) {
    await assertPublicHost(current.hostname, lookupImpl);
    const { url, headers } = await buildRequest(source, current, previous, options.resolveCredential);

    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), options.timeoutMs ?? DEFAULTS.timeoutMs);
    let response: Response;
    try {
      response = await fetchImpl(url, {
        method: 'GET',
        headers,
        redirect: 'manual',
        signal: controller.signal,
      });
    } finally {
      clearTimeout(timer);
    }

    /*
     * REDIRECT STATUSES ONLY — not "anything in the 300s".
     *
     * 304 Not Modified lives in that range and is not a redirect: it is the
     * successful answer to a conditional request, and it carries no Location.
     * Treating the whole 3xx block as redirects meant every conditional
     * request — the entire point of sending If-None-Match — failed with
     * "redirect with no location". Caught by the test that sends validators.
     */
    if (REDIRECT_STATUSES.has(response.status)) {
      const location = response.headers.get('location');
      if (!location) throw new Error(`redirect with no location from ${redactUrl(current.toString())}`);
      // Re-validated on the next loop. A redirect is an instruction from a
      // party we do not control, so it gets the same scrutiny as the original.
      current = assertFetchableUrl(new URL(location, current).toString());
      continue;
    }

    return response;
  }

  throw new Error(`too many redirects from ${redactUrl(source.url)}`);
}

/**
 * Fetches a feed, with conditional requests, retries and every guard applied.
 *
 * Never throws for an expected failure: it returns `status: 'failed'` with a
 * reason, because a scheduler iterating sources must not stop because one
 * provider is down.
 */
export async function retrieveFeed(
  source: FeedSource,
  options: RetrieveOptions = {},
): Promise<RetrievalOutcome> {
  const now = options.now ?? (() => new Date());
  const limits = options.limits ?? DEFAULT_LIMITS;
  const maxAttempts = options.maxAttempts ?? DEFAULTS.maxAttempts;
  const doSleep = options.sleepImpl ?? sleep;
  const previous = options.previous;

  if (!isImplemented(source.transport)) {
    const error = new UnsupportedTransportError(source.transport);
    return {
      status: 'failed',
      reason: error.message,
      retryable: false,
      fetchedAt: now().toISOString(),
      attempts: 0,
    };
  }

  let attempts = 0;
  let lastReason = 'no attempt was made';
  let lastRetryable = false;

  while (attempts < maxAttempts) {
    attempts += 1;
    try {
      const response = await attemptOnce(source, options, previous);

      if (response.status === 304) {
        return {
          status: 'unchanged',
          validators: previous ?? {},
          fetchedAt: now().toISOString(),
          attempts,
        };
      }

      if (!response.ok) {
        lastRetryable = isRetryableStatus(response.status);
        lastReason = `provider answered ${response.status} ${response.statusText}`.trim();
        if (!lastRetryable) break;

        const after = parseRetryAfter(response.headers.get('retry-after'), now());
        if (attempts < maxAttempts) await doSleep(after ?? backoffMs(attempts));
        continue;
      }

      if (!response.body) {
        lastReason = 'provider answered 200 with no body';
        lastRetryable = true;
        if (attempts < maxAttempts) await doSleep(backoffMs(attempts));
        continue;
      }

      const raw = await readWithLimit(response.body, limits.maxDownloadBytes);
      const body = await expandIfCompressed(raw, limits);

      // An unchanged body with no validators: providers that send neither an
      // ETag nor Last-Modified are common, and re-importing an identical feed
      // is work the importer would refuse anyway.
      const { createHash } = await import('node:crypto');
      const sha256 = createHash('sha256').update(body).digest('hex');
      const validators: FeedValidators = {
        etag: response.headers.get('etag') ?? undefined,
        lastModified: response.headers.get('last-modified') ?? undefined,
        sha256,
      };

      if (previous?.sha256 && previous.sha256 === sha256) {
        return { status: 'unchanged', validators, fetchedAt: now().toISOString(), attempts };
      }

      return { status: 'fetched', body, validators, fetchedAt: now().toISOString(), attempts };
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      // A size refusal and an SSRF refusal are configuration or attack
      // conditions. Retrying either is pointless and, for the first, expensive.
      lastRetryable =
        !(error instanceof FeedTooLargeError) &&
        !message.includes('refusing to fetch') &&
        !message.includes('not a public address');
      lastReason = message;
      if (!lastRetryable) break;
      if (attempts < maxAttempts) await doSleep(backoffMs(attempts));
    }
  }

  return {
    status: 'failed',
    reason: lastReason,
    retryable: lastRetryable,
    fetchedAt: now().toISOString(),
    attempts,
  };
}
