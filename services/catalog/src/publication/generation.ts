/*
 * GENERATION-BASED PUBLICATION — the types, the errors, and the rules that
 * decide whether a generation is allowed to go live.
 *
 * The schema reasoning lives in migrations-d1/0003_publication_generations.sql
 * and is not repeated here. What matters at this layer is the question
 * publication actually has to answer: a catalogue was computed, it disagrees
 * with the one the public can see, and SOME of those disagreements are
 * progress while others are a feed that failed.
 */
import type { Money } from '../money';

export type GenerationStatus = 'building' | 'live' | 'superseded' | 'abandoned' | 'rolled_back';

export interface Generation {
  readonly generation: number;
  readonly status: GenerationStatus;
  readonly startedAt: string;
  readonly completedAt: string | null;
  readonly sourceRunId: string | null;
  readonly productCount: number | null;
  readonly decidedBy: string;
  readonly detail: string | null;
}

/**
 * One product as a generation would publish it. `eligible: false` is a
 * DECISION, not an omission — it carries the reason so an absence can be
 * explained later without re-running the rules.
 */
export interface PublicationCandidate {
  readonly productId: string;
  readonly slug: string;
  readonly title: string;
  readonly brand: string | null;
  readonly categorySlug: string | null;
  readonly dataVerifiedAt: string;
  readonly searchText: string;
  /** NULL where no offer carries a comparable price. Never zero. */
  readonly fromPrice: Money | null;
  readonly offerCount: number;
  readonly eligible: boolean;
  readonly reasonCode: string;
}

export interface PublishOutcome {
  readonly generation: number;
  /** How many products the public catalogue holds after the move. */
  readonly publishedCount: number;
  readonly opened: number;
  readonly closed: number;
  /**
   * Live rows whose freshness moved but whose content did not.
   *
   * One narrow UPDATE each, instead of the close-and-reopen pair a content
   * change costs. `data_verified_at` changes every cycle by definition, so
   * counting it as content would rewrite the entire catalogue every time.
   */
  readonly refreshed: number;
  /** Written nothing, because nothing about them changed. */
  readonly unchanged: number;
  readonly previousGeneration: number | null;
  /** True when the generation was ALREADY live and this call did nothing. */
  readonly alreadyLive: boolean;
}

/* ───────────────────────────── refusals ───────────────────────────── */

/**
 * Another generation is already under construction. Enforced by a partial
 * unique index, so this cannot be defeated by a process that died holding a
 * lock.
 */
export class ConcurrentPublicationError extends Error {
  readonly _tag = 'ConcurrentPublicationError';
  constructor(readonly existingGeneration: number | null) {
    super(
      existingGeneration === null
        ? 'another publication generation is already being built'
        : `generation ${existingGeneration} is already being built`,
    );
    this.name = 'ConcurrentPublicationError';
  }
}

/**
 * The pointer was not where the publisher expected it. Someone else moved it
 * between validation and the commit, and finishing would silently discard
 * their publication.
 */
export class PointerMovedError extends Error {
  readonly _tag = 'PointerMovedError';
  constructor(
    readonly expected: number | null,
    readonly generation: number,
  ) {
    super(
      `refusing to publish generation ${generation}: the live pointer was no longer ${
        expected === null ? 'unset' : String(expected)
      }`,
    );
    this.name = 'PointerMovedError';
  }
}

/** A generation that failed validation. The reason is machine-readable. */
export class GenerationRejectedError extends Error {
  readonly _tag = 'GenerationRejectedError';
  constructor(
    readonly generation: number,
    readonly code: GenerationRejectionCode,
    detail: string,
  ) {
    super(`generation ${generation} rejected (${code}): ${detail}`);
    this.name = 'GenerationRejectedError';
  }
}

export type GenerationRejectionCode =
  'not_building' | 'unknown_generation' | 'empty_catalogue' | 'catalogue_cliff';

/* ─────────────────────────── validation ─────────────────────────── */

export interface ValidationLimits {
  /**
   * The largest fraction of the live catalogue a single generation may remove.
   *
   * THIS IS THE GUARD THAT MATTERS. An import that retrieved nothing produces
   * a perfectly well-formed generation containing nothing, and publishing it
   * would empty the website. "Never retire existing products merely because
   * feed retrieval failed" is this number.
   */
  readonly maxShrinkFraction: number;
  /**
   * Whether a generation with no eligible products may go live. False by
   * default: the first publication of an empty catalogue is indistinguishable
   * from a broken one, and the caller has to say which it means.
   */
  readonly allowEmpty: boolean;
}

export const DEFAULT_PUBLICATION_LIMITS: ValidationLimits = {
  // 20%. Chosen rather than measured — there is no history to measure against
  // yet — and deliberately not 100%: a number that permits anything is not a
  // guard. Operators can widen it per call for a known large retirement.
  maxShrinkFraction: 0.2,
  allowEmpty: false,
};

export interface GenerationShape {
  readonly generation: number;
  readonly status: GenerationStatus;
  /** Candidates marked eligible in this generation. */
  readonly eligibleCount: number;
  /** Products the public catalogue holds right now. */
  readonly liveCount: number;
}

/**
 * Decides whether a generation may be published, with no database access, so
 * the rule is testable on its own and the same rule can be reported by the
 * dashboard before anyone presses anything.
 */
export function validateGeneration(
  shape: GenerationShape,
  limits: ValidationLimits = DEFAULT_PUBLICATION_LIMITS,
): { ok: true } | { ok: false; code: GenerationRejectionCode; detail: string } {
  if (shape.status !== 'building') {
    return {
      ok: false,
      code: 'not_building',
      detail: `status is '${shape.status}'; only a generation under construction can be published`,
    };
  }

  if (shape.eligibleCount === 0 && !limits.allowEmpty) {
    return {
      ok: false,
      code: 'empty_catalogue',
      detail:
        'no eligible products. An import that retrieved nothing produces exactly this, so it is ' +
        'refused unless the caller states that an empty catalogue is intended',
    };
  }

  if (shape.liveCount > 0) {
    const removed = shape.liveCount - shape.eligibleCount;
    const fraction = removed / shape.liveCount;
    if (fraction > limits.maxShrinkFraction) {
      const pct = (n: number) => `${(n * 100).toFixed(1)}%`;
      return {
        ok: false,
        code: 'catalogue_cliff',
        detail:
          `would remove ${removed} of ${shape.liveCount} published products (${pct(fraction)}), ` +
          `over the ${pct(limits.maxShrinkFraction)} limit. A feed that failed looks like this`,
      };
    }
  }

  return { ok: true };
}
