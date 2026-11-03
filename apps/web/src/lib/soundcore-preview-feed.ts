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
 * It never throws and never logs a record. A missing or malformed feed returns
 * a reason the page can render, because a preview that explains why it is empty
 * is more useful than a build that dies — and a reason string that quoted feed
 * content would put product data into CI logs.
 */
import { readFileSync, statSync } from 'node:fs';
import { isAbsolute, relative, resolve } from 'node:path';

import { buildCatalog, parseShoppingFeed, type Offer } from '@nexus/catalog';

/** Where the operator points this at an extracted CJ Shopping export. */
export const FEED_ENV_VAR = 'HONESTTOTAL_SOUNDCORE_FEED';

/** CJ advertiser 7382109 (Fantasia Trading LLC). A label, not a credential. */
export const SOURCE_FEED = 'cj:shopping:7382109';

export type FeedLoad =
  | {
      readonly ok: true;
      readonly offers: readonly Offer[];
      /** How many rows the guard refused. A count, never the rows. */
      readonly rejectedCount: number;
      readonly malformedCount: number;
      /** File name only — never the full path, which may name a person's home. */
      readonly sourceName: string;
      readonly exportedAt: string;
    }
  | { readonly ok: false; readonly reason: string };

function repoRoot(): string {
  // apps/web is the cwd during `next build`; the repo root is two levels up.
  return resolve(process.cwd(), '..', '..');
}

/**
 * Load and validate the feed. Returns offers in feed order — this applies no
 * ranking, because ranking requires a delivered cost nobody has verified.
 */
export function loadSoundcoreFeed(): FeedLoad {
  const configured = process.env[FEED_ENV_VAR];
  if (configured === undefined || configured.trim() === '') {
    return {
      ok: false,
      reason: `No feed configured. Set ${FEED_ENV_VAR} to an extracted CJ Shopping export outside this repository.`,
    };
  }

  const path = resolve(configured.trim());
  if (!isAbsolute(path)) {
    return { ok: false, reason: `${FEED_ENV_VAR} must be an absolute path.` };
  }

  /*
   * Refuse a path inside the working tree. This is the rule that keeps provider
   * content out of a public repository, and a rule enforced by a comment is not
   * enforced at all.
   */
  const inside = relative(repoRoot(), path);
  if (inside !== '' && !inside.startsWith('..') && !isAbsolute(inside)) {
    return {
      ok: false,
      reason:
        'Refusing to read the feed from inside the repository: provider records must stay out of version control.',
    };
  }

  let text: string;
  let exportedAt: string;
  try {
    text = readFileSync(path, 'utf8');
    exportedAt = statSync(path).mtime.toISOString();
  } catch {
    // The error object can carry the full path; the reason deliberately does not.
    return { ok: false, reason: `Could not read the feed named by ${FEED_ENV_VAR}.` };
  }

  const parse = parseShoppingFeed(text);
  if (parse.rows.length === 0) {
    return { ok: false, reason: 'The feed contained no readable product rows.' };
  }
  if (parse.missingColumns.length > 0) {
    return {
      ok: false,
      reason: `The feed is missing expected columns: ${parse.missingColumns.join(', ')}.`,
    };
  }

  const { offers, rejected } = buildCatalog(parse, {
    merchantId: 'soundcore',
    sourceFeed: SOURCE_FEED,
    feedSnapshotAt: exportedAt,
  });

  if (offers.length === 0) {
    return { ok: false, reason: 'Every row in the feed failed validation.' };
  }

  const name = path.split(/[\\/]/).pop() ?? 'feed';
  return {
    ok: true,
    offers,
    rejectedCount: rejected.length,
    malformedCount: parse.malformed.length,
    sourceName: name,
    exportedAt,
  };
}
