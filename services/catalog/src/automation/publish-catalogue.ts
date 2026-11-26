/*
 * AUTOMATIC PUBLICATION — offers already in the database become a public
 * catalogue, with no per-product human approval.
 *
 * That is the point, and it is also the risk, so the whole function is built
 * around what it REFUSES to do rather than what it does:
 *
 *   · a global pause stops it, and the pause lives in the database so stopping
 *     automation never requires a deploy;
 *   · `auto_publish = 0` still computes everything and still records the
 *     decisions — it simply does not move the pointer, so an operator can see
 *     exactly what would have been published before allowing it;
 *   · nothing unapproved, stale, inactive or ambiguous reaches a candidate;
 *   · the generation validator gets the last word, so a feed that retrieved
 *     nothing cannot empty the site even if every step above succeeded.
 *
 * It is also idempotent end to end. Products are upserted on ids derived from
 * identity, decisions are written only when they change, candidates are
 * replaced per generation, and the pointer move is guarded. A run that dies
 * halfway can simply be run again.
 */
import { buildProducts, type ProductDraft } from '../product/build';
import {
  ConcurrentPublicationError,
  GenerationRejectedError,
  type PublicationCandidate,
  type PublishOutcome,
  type ValidationLimits,
} from '../publication/generation';
import { GenerationPublisher } from '../publication/publisher';
import type { D1Like } from '../store/d1/d1-client';
import { CatalogD1, productIdOf } from './catalog-store';

/**
 * Bumped when a rule that decides publication changes.
 *
 * Stored on every decision row, so "why was this published in November?" is
 * answerable after the rules have moved on. It is not the package version: a
 * dependency bump is not a change of policy.
 */
export const PUBLICATION_RULES_VERSION = '2026-11-26.1';

export type PublishSkipReason =
  'automation_paused' | 'auto_publish_disabled' | 'generation_in_progress';

export interface PublishCatalogueOptions {
  readonly now: Date;
  readonly limits?: ValidationLimits;
  /** Who to record as having published. Defaults to `automatic`. */
  readonly decidedBy?: string;
  /**
   * Run everything and record every decision, but do not move the pointer.
   * Separate from the stored `auto_publish` flag so a caller can preview
   * without changing configuration.
   */
  readonly dryRun?: boolean;
}

export interface PublishCatalogueResult {
  readonly ran: boolean;
  readonly skipped: PublishSkipReason | null;
  readonly skippedDetail: string | null;
  readonly counts: {
    readonly offers: number;
    readonly products: number;
    readonly eligible: number;
    readonly withheld: number;
    readonly unmatched: number;
    readonly decisionsRecorded: number;
  };
  readonly generation: number | null;
  readonly outcome: PublishOutcome | null;
  /** Set when the generation was built but the validator refused it. */
  readonly rejected: { readonly code: string; readonly detail: string } | null;
  readonly products: readonly ProductDraft[];
}

export async function publishCatalogue(
  db: D1Like,
  options: PublishCatalogueOptions,
): Promise<PublishCatalogueResult> {
  const at = options.now.toISOString();
  const store = new CatalogD1(db);
  const publisher = new GenerationPublisher(db);

  const empty = {
    offers: 0,
    products: 0,
    eligible: 0,
    withheld: 0,
    unmatched: 0,
    decisionsRecorded: 0,
  };

  const config = await store.automationConfig();
  if (config.paused) {
    // The one-line stop. Checked before anything is read, so a paused system
    // does no work and spends no quota.
    return {
      ran: false,
      skipped: 'automation_paused',
      skippedDetail: config.pausedReason,
      counts: empty,
      generation: null,
      outcome: null,
      rejected: null,
      products: [],
    };
  }

  /*
   * A generation already under construction means a previous run did not
   * finish. It is NOT taken over: `publication_one_building` would refuse the
   * second one anyway, and silently adopting somebody else's half-built
   * generation is how two runs produce one wrong catalogue. An operator
   * abandons or publishes it.
   */
  const inProgress = await publisher.buildingGeneration();
  if (inProgress !== null) {
    return {
      ran: false,
      skipped: 'generation_in_progress',
      skippedDetail:
        `generation ${inProgress.generation} has been building since ${inProgress.startedAt}; ` +
        'publish or abandon it before starting another',
      counts: empty,
      generation: inProgress.generation,
      outcome: null,
      rejected: null,
      products: [],
    };
  }

  const [offers, approvedMerchants] = await Promise.all([
    store.allOffers(),
    store.approvedMerchants(),
  ]);

  const built = buildProducts({
    offers,
    approvedMerchants,
    now: options.now,
  });

  // Products and links first. They are the catalogue's own record of what it
  // believes, and they are written whether or not publication proceeds —
  // withholding a product is a decision ABOUT a product that must exist.
  await store.upsertProducts(built.products, at);
  const decisionsRecorded = await store.recordDecisions(
    built.products,
    at,
    PUBLICATION_RULES_VERSION,
  );

  const counts = { ...built.counts, decisionsRecorded };

  if (!config.autoPublish || options.dryRun === true) {
    return {
      ran: true,
      skipped: config.autoPublish ? null : 'auto_publish_disabled',
      skippedDetail:
        options.dryRun === true
          ? 'dry run: everything computed and recorded, pointer not moved'
          : 'auto_publish is off; decisions were recorded but nothing was published',
      counts,
      generation: null,
      outcome: null,
      rejected: null,
      products: built.products,
    };
  }

  let generation: number;
  try {
    generation = await publisher.beginGeneration({ at, decidedBy: options.decidedBy });
  } catch (error) {
    if (error instanceof ConcurrentPublicationError) {
      return {
        ran: true,
        skipped: 'generation_in_progress',
        skippedDetail: error.message,
        counts,
        generation: error.existingGeneration,
        outcome: null,
        rejected: null,
        products: built.products,
      };
    }
    throw error;
  }

  const candidates: PublicationCandidate[] = built.products.map((product) => ({
    productId: productIdOf(product),
    slug: product.slug,
    title: product.title,
    brand: product.brand,
    categorySlug: product.categorySlug,
    dataVerifiedAt: product.dataVerifiedAt,
    searchText: product.searchText,
    fromPrice: product.fromPrice,
    offerCount: product.offerIds.length,
    eligible: product.eligible,
    reasonCode: product.reasonCode,
  }));

  await publisher.stageCandidates(generation, candidates);

  try {
    const outcome = await publisher.publish(generation, {
      at,
      limits: options.limits,
      decidedBy: options.decidedBy,
    });
    return {
      ran: true,
      skipped: null,
      skippedDetail: null,
      counts,
      generation,
      outcome,
      rejected: null,
      products: built.products,
    };
  } catch (error) {
    if (error instanceof GenerationRejectedError) {
      /*
       * The validator said no — an empty catalogue, or a cliff. The generation
       * is ABANDONED rather than left building, because leaving it would block
       * the next cycle, and a rejection that silently stops all future
       * publication is worse than the rejection it was protecting against.
       *
       * The published catalogue is untouched: the pointer never moved.
       */
      await publisher.abandon(generation, { at, detail: `${error.code}: ${error.message}` });
      return {
        ran: true,
        skipped: null,
        skippedDetail: null,
        counts,
        generation,
        outcome: null,
        rejected: { code: error.code, detail: error.message },
        products: built.products,
      };
    }
    throw error;
  }
}
