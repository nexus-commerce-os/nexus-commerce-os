/*
 * What a feed source IS: enough to fetch it on a schedule, and nothing secret.
 *
 * THE CREDENTIAL RULE, which is the whole reason this is a type and not a bag
 * of strings: a feed source holds a credential REFERENCE, never a credential.
 * `credentialRef` names a secret that lives somewhere else — an environment
 * variable, a secret store — and is resolved at fetch time by a resolver the
 * caller supplies. A configuration row is copied into tickets, dumped in
 * backups, printed in logs and shown in an admin dashboard; a secret that
 * lives in one is a secret that has leaked, and nobody will know when.
 */

/** How the bytes are obtained. */
export type FeedTransport =
  /** A plain HTTPS GET of a feed document. */
  | 'https'
  /** A merchant or affiliate-network HTTP API that returns the feed. */
  | 'api'
  /**
   * Authorized FTP/SFTP. DECLARED, NOT IMPLEMENTED — see `isImplemented`.
   * It is in the type because feed sources must be able to describe it, and
   * refusing a known-unsupported transport loudly is better than a config
   * that silently never runs.
   */
  | 'ftp'
  | 'sftp'
  /*
   * A LOCAL FILE, FOR DEMONSTRATION AND TESTS ONLY.
   *
   * It exists because proving the scheduled pipeline end to end needs a source
   * the runner can actually read, and the SSRF guard correctly refuses
   * localhost — serving a fixture over http://127.0.0.1 to get around that
   * guard would be defeating the control to demonstrate the feature.
   *
   * `retrieveFeed` refuses it unless the caller passes `allowFixtures: true`,
   * so it cannot be reached by writing a config row alone.
   */
  | 'fixture';

/** What the bytes are, once any container is removed. */
export type FeedFormat = 'csv' | 'tsv' | 'xml' | 'json';

/** How often to go and look. */
export interface FeedSchedule {
  /** Minimum gap between retrievals. */
  readonly everyMinutes: number;
  /**
   * Skip a run if the last success is newer than this. Defaults to
   * `everyMinutes`; a separate knob so a job can be scheduled often and still
   * refuse to hammer a provider.
   */
  readonly minIntervalMinutes?: number;
}

export interface FeedSource {
  readonly id: string;
  readonly merchantId: string;
  readonly transport: FeedTransport;
  /** Absolute https URL. Validated by `assertFetchableUrl`, never trusted raw. */
  readonly url: string;
  readonly format: FeedFormat;
  readonly schedule: FeedSchedule;
  /**
   * The NAME of a secret, not the secret. Resolved at fetch time.
   * `null` for a feed that needs no credential.
   */
  readonly credentialRef: string | null;
  /** Where a resolved credential goes. */
  readonly auth?: FeedAuth;
  /*
   * PROVIDER CONFIGURATION, NOT A CREDENTIAL.
   *
   * Some APIs need identifiers in the request that are neither the URL nor
   * the secret — CJ's needs the publisher's company id and the feed's ad id
   * in the query body. They live in the `auth_detail` column, which already
   * exists and already carries this kind of value for `basic` and `query`
   * auth, and they are deliberately NOT secrets: a value that must be kept
   * secret belongs behind `credentialRef`, where it is resolved at fetch time
   * and never written into a config row.
   */
  readonly providerDetail?: string;
  /** Off by default: a source is configured before it is trusted to run. */
  readonly enabled: boolean;
}

/** How a resolved credential is presented to the provider. */
export type FeedAuth =
  | { readonly kind: 'none' }
  | { readonly kind: 'bearer' }
  | { readonly kind: 'basic'; readonly username: string }
  /** A query parameter, which several affiliate networks still require. */
  | { readonly kind: 'query'; readonly parameter: string };

/** Resolves a `credentialRef` to its secret. Supplied by the caller. */
export type CredentialResolver = (ref: string) => Promise<string | undefined>;

/*
 * A SECRET IS WHAT WAS COPIED, NOT WHAT THE SHELL ADDED TO IT.
 *
 * `Get-Clipboard | wrangler secret put` wrote a UTF-8 BOM in front of a CJ
 * personal access token. The stored value was correct to the eye and wrong by
 * three bytes, and what came back was a 403 — "Could not authenticate given
 * token" — from a token that worked from a laptop minutes earlier. The
 * Workers runtime had to be the one to say so: "A header value for
 * 'authorization' contains non-ASCII characters … ï»¿".
 *
 * So every resolved credential is cleaned here, once, where every transport
 * goes through. A BOM and surrounding whitespace are never part of a secret —
 * no provider issues one with either — so removing them cannot destroy a
 * valid credential, and leaving them in produces a failure that looks like
 * somebody else's fault.
 *
 * It does NOT touch the interior: a secret with a space in the middle is a
 * secret with a space in the middle.
 */
export function cleanSecret(value: string | undefined): string | undefined {
  if (value === undefined) return undefined;
  const cleaned = value.replace(/^﻿/, '').trim();
  return cleaned === '' ? undefined : cleaned;
}

/**
 * Reads secrets from the environment.
 *
 * Deliberately the only resolver in this package: anything richer is a
 * deployment concern, and a package that reaches into a specific secret store
 * is a package that cannot be deployed anywhere else.
 */
export function envCredentialResolver(env: NodeJS.ProcessEnv = process.env): CredentialResolver {
  return async (ref) => cleanSecret(env[ref]);
}

/** Transports that actually work today. */
export function isImplemented(transport: FeedTransport): boolean {
  return transport === 'https' || transport === 'api' || transport === 'fixture';
}

/** Transports that must never run against production data. */
export function isFixtureTransport(transport: FeedTransport): boolean {
  return transport === 'fixture';
}

export class UnsupportedTransportError extends Error {
  constructor(readonly transport: FeedTransport) {
    super(
      `transport "${transport}" is declared but not implemented. ` +
        `It is refused rather than skipped, because a feed source that silently never runs ` +
        `looks exactly like one that runs and finds nothing.`,
    );
    this.name = 'UnsupportedTransportError';
  }
}

/** Validation errors, collected rather than thrown one at a time. */
export function validateFeedSource(source: FeedSource): readonly string[] {
  const problems: string[] = [];
  if (isFixtureTransport(source.transport) && source.enabled && !source.id.startsWith('fixture-')) {
    // A fixture must announce itself in its own id, so it is obvious in a log
    // line, a dashboard row and a database dump which rows are not real.
    problems.push('a fixture source id must start with "fixture-"');
  }
  if (!source.id.trim()) problems.push('id is empty');
  if (!source.merchantId.trim()) problems.push('merchantId is empty');
  if (!Number.isFinite(source.schedule.everyMinutes) || source.schedule.everyMinutes < 1) {
    problems.push('schedule.everyMinutes must be at least 1');
  }
  if (source.auth && source.auth.kind !== 'none' && !source.credentialRef) {
    problems.push(`auth kind "${source.auth.kind}" needs a credentialRef`);
  }
  // A secret pasted into the reference field instead of a name for one.
  if (source.credentialRef && /[^A-Za-z0-9_.-]/.test(source.credentialRef)) {
    problems.push(
      'credentialRef must be the NAME of a secret (letters, digits, _ . -), not the secret itself',
    );
  }
  return problems;
}

/**
 * Whether a source is due, given when it last SUCCEEDED.
 *
 * Based on last success rather than last attempt on purpose: a source that
 * fails every time must keep being retried on its schedule, not fall silent
 * because something touched it recently.
 */
export function isDue(source: FeedSource, lastSuccessAt: Date | null, now: Date): boolean {
  if (!source.enabled) return false;
  if (!lastSuccessAt) return true;
  const minutes = source.schedule.minIntervalMinutes ?? source.schedule.everyMinutes;
  return now.getTime() - lastSuccessAt.getTime() >= minutes * 60_000;
}
