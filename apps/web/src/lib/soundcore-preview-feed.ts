/*
 * Build-time loader for the authorized Soundcore product feed.
 *
 * SERVER ONLY. It imports `node:fs`, so a client component that pulled it in
 * would fail the build rather than ship a feed to a browser — the strongest
 * guarantee available here, and cheaper than remembering not to.
 *
 * THE FEED DOES NOT LIVE IN THIS REPOSITORY. It is CJ's content under the
 * network's terms and this repository is public, so the path comes from an
 * environment variable and is refused outright if it resolves inside the repo.
 * Nothing is written back: the records exist only in the rendered HTML of a
 * noindex preview route, and `out/` is git-ignored.
 *
 * TWO MODES, AND THE DIFFERENCE IS THE POINT.
 *
 *   local (default) — a missing, unreadable or stale feed renders a page that
 *     says so. A developer wants to see the layout, not a stack trace, and a
 *     preview that explains why it is empty beats a build that dies.
 *
 *   release (HONESTTOTAL_RELEASE_BUILD=1) — the same conditions THROW, which
 *     fails `next build`. Nothing published may rest on a feed we cannot date
 *     or on one older than the limit in @nexus/catalog. There is no fallback
 *     path to an older file: this module reads the one path it was given and
 *     has nowhere else to look.
 */
import { readFileSync } from 'node:fs';
import { isAbsolute, relative, resolve } from 'node:path';

import {
  assessFeedWindow,
  buildCatalog,
  describeFreshness,
  feedExportWindow,
  isReleasable,
  parseShoppingFeed,
  type FeedFreshness,
  type Offer,
} from '@nexus/catalog';

/** Where the operator points this at an extracted CJ Shopping export. */
export const FEED_ENV_VAR = 'HONESTTOTAL_SOUNDCORE_FEED';

/** Set to `1` for a build whose output is intended to be published. */
export const RELEASE_ENV_VAR = 'HONESTTOTAL_RELEASE_BUILD';

/** CJ advertiser 7382109 (Fantasia Trading LLC). A label, not a credential. */
export const SOURCE_FEED = 'cj:shopping:7382109';

/** Thrown only in release mode. Carries no feed content. */
export class FeedReleaseError extends Error {
  constructor(reason: string) {
    super(`release build refused: ${reason}`);
    this.name = 'FeedReleaseError';
  }
}

export function isReleaseBuild(env: NodeJS.ProcessEnv = process.env): boolean {
  return env[RELEASE_ENV_VAR] === '1';
}

export type FeedLoad =
  | {
      readonly ok: true;
      readonly offers: readonly Offer[];
      /** How many rows the guard refused. A count, never the rows. */
      readonly rejectedCount: number;
      readonly malformedCount: number;
      /** File name only — never the full path, which may name a person's home. */
      readonly sourceName: string;
      /** The provider's own generation time, from the feed, not the file. */
      readonly exportedAt: string | null;
      readonly freshness: FeedFreshness;
    }
  | { readonly ok: false; readonly reason: string };

function repoRoot(): string {
  // apps/web is the cwd during `next build`; the repo root is two levels up.
  return resolve(process.cwd(), '..', '..');
}

/**
 * Refuse in release mode, report in local mode. One place, so the two modes
 * cannot drift apart.
 */
function refuse(reason: string, release: boolean): { readonly ok: false; readonly reason: string } {
  if (release) throw new FeedReleaseError(reason);
  return { ok: false, reason };
}

/**
 * Load and validate the feed. Returns offers in feed order — this applies no
 * ranking, because ranking requires a delivered cost nobody has verified.
 */
export function loadSoundcoreFeed(
  env: NodeJS.ProcessEnv = process.env,
  now: Date = new Date(),
): FeedLoad {
  const release = isReleaseBuild(env);
  const configured = env[FEED_ENV_VAR];

  if (configured === undefined || configured.trim() === '') {
    return refuse(
      `No feed configured. Set ${FEED_ENV_VAR} to an extracted CJ Shopping export outside this repository.`,
      release,
    );
  }

  const path = resolve(configured.trim());
  if (!isAbsolute(path)) {
    return refuse(`${FEED_ENV_VAR} must be an absolute path.`, release);
  }

  /*
   * Refuse a path inside the working tree. This is the rule that keeps provider
   * content out of a public repository, and a rule enforced by a comment is not
   * enforced at all.
   */
  const inside = relative(repoRoot(), path);
  if (inside !== '' && !inside.startsWith('..') && !isAbsolute(inside)) {
    return refuse(
      'Refusing to read the feed from inside the repository: provider records must stay out of version control.',
      release,
    );
  }

  let text: string;
  try {
    text = readFileSync(path, 'utf8');
  } catch {
    // The error object can carry the full path; the reason deliberately does not.
    return refuse(`Could not read the feed named by ${FEED_ENV_VAR}.`, release);
  }

  const parse = parseShoppingFeed(text);
  if (parse.rows.length === 0) {
    return refuse('The feed contained no readable product rows.', release);
  }
  if (parse.missingColumns.length > 0) {
    return refuse(
      `The feed is missing expected columns: ${parse.missingColumns.join(', ')}.`,
      release,
    );
  }

  /*
   * The provider's own generation window, taken from the row timestamps in the
   * file. Deliberately not the file's mtime: copying a file refreshes its mtime
   * without refreshing a single price, which is exactly the mistake this guard
   * exists to catch.
   *
   * The verdict is anchored on the OLDEST row, so "this feed is fresh" means
   * every price in it is — one item updated this morning cannot vouch for the
   * rest. What is DISPLAYED is the newest, because that is when the provider
   * finished writing the file; with a real export the two are a quarter of a
   * second apart.
   */
  const window = feedExportWindow(parse.rows);
  const exportedAt = window.newestAt;
  const freshness = assessFeedWindow(window, now);
  if (!isReleasable(freshness)) {
    // Local builds still render, so a developer can see the layout — but the
    // page says how old the data is, and release refuses outright.
    if (release) throw new FeedReleaseError(describeFreshness(freshness));
  }

  const { offers, rejected } = buildCatalog(parse, {
    merchantId: 'soundcore',
    sourceFeed: SOURCE_FEED,
    // Rows carry their own timestamps; this is only the fallback for a row
    // that does not, and it is the feed's own time, never the wall clock.
    feedSnapshotAt: exportedAt ?? now.toISOString(),
    now,
  });

  if (offers.length === 0) {
    return refuse('Every row in the feed failed validation.', release);
  }

  const name = path.split(/[\\/]/).pop() ?? 'feed';
  return {
    ok: true,
    offers,
    rejectedCount: rejected.length,
    malformedCount: parse.malformed.length,
    sourceName: name,
    exportedAt,
    freshness,
  };
}
