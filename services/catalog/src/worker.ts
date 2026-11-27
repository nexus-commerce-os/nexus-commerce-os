/*
 * THE WORKER-SAFE SURFACE of this package.
 *
 * WHY A SECOND ENTRY POINT. `index.ts` exports `PostgresOfferStore`, which
 * imports `pg`, which needs Node sockets. Importing the barrel from a Worker
 * drags that into the bundle and the deploy fails — or worse, bundles a
 * database driver into an edge script that can never use it.
 *
 * So this is the explicit list of what runs on Workers: the D1 adapter, the
 * publisher, the product pipeline, automatic publication, and the public read
 * path. If something is missing from here, the honest reading is that nobody
 * has checked whether it is Worker-safe.
 *
 * THE POSTGRES ADAPTER IS DELIBERATELY ABSENT, and that is not a gap. Both
 * adapters satisfy the same `OfferStore` contract and the same suite runs
 * against each; which one a deployment uses is a property of the deployment.
 */

// Money and the offer domain. No I/O.
export {
  deliveredCost,
  deliveredPriceRankingEligibility,
  itemPrice,
  missingShipping,
  verifiedShipping,
  type Availability,
  type DeliveredCost,
  type ItemCondition,
  type MandatoryFees,
  type Offer,
  type RankingEligibility,
  type ShippingCost,
} from './offer';
export { addMoney, minMoney, minorUnitExponent, type Money } from './money';

// D1.
export { D1OfferStore } from './store/d1/d1-offer-store';
export {
  MAX_BOUND_PARAMS,
  chunkForBinding,
  exactInteger,
  rowsPerStatement,
  type D1Like,
  type D1PreparedStatement,
  type D1Result,
} from './store/d1/d1-client';
export {
  DuplicateApplyError,
  type ImportRun,
  type ImportStatus,
  type OfferStore,
  type PriceHistoryEntry,
  type QuarantineEntry,
  type StoredOffer,
} from './store/offer-store';

// Publication.
export { GenerationPublisher, type PruneOptions, type PruneOutcome } from './publication/publisher';
export {
  ConcurrentPublicationError,
  DEFAULT_PUBLICATION_LIMITS,
  GenerationRejectedError,
  PointerMovedError,
  validateGeneration,
  type Generation,
  type PublicationCandidate,
  type PublishOutcome,
  type ValidationLimits,
} from './publication/generation';

// Product intelligence.
export { ELIGIBLE, buildProducts, productSlug, type ProductDraft } from './product/build';
export { matchOffers, type MatchResult } from './product/match';
export { rankOffers, storedAsOffer, type OfferRanking } from './product/ranking';
export {
  classifyFromProductType,
  normaliseSpecification,
  slugifyCategory,
} from './product/classify';
export { normaliseBrand, normaliseMpn, productIdentity, toGtin14 } from './product/identity';

// Automatic publication.
export {
  PUBLICATION_RULES_VERSION,
  publishCatalogue,
  type PublishCatalogueOptions,
  type PublishCatalogueResult,
} from './automation/publish-catalogue';
export {
  CatalogD1,
  productIdOf,
  type AutomationConfig,
  type CatalogEnvironment,
} from './automation/catalog-store';
export { catalogueFingerprint } from './publication/fingerprint';

// Scheduled synchronisation: the cron handler's entry point.
export {
  QuotaD1,
  recentCycles,
  runSyncCycle,
  type CycleOutcome,
  type CycleTrigger,
  type SyncCycleResult,
} from './automation/sync-cycle';
export {
  D1FeedSourceStore,
  isFixtureSource,
  type FeedSourceRow,
} from './automation/feed-source-store';
export {
  CycleMeter,
  FREE_TIER,
  assessBudget,
  meteredD1,
  utcDay,
  type BudgetLimits,
  type BudgetUsage,
  type BudgetVerdict,
} from './automation/quota';

// The public read path.
export {
  PublicCatalogue,
  type ListQuery,
  type Page,
  type ProductDetail,
  type PublicOffer,
  type PublishedProduct,
} from './public/read';

export {
  CJ_QUERY_URL,
  CjConfigError,
  catalogQuery,
  feedSummaryQuery,
  parseCjFeedConfig,
  renderShoppingFeed,
  retrieveCjFeed,
  type CjFeedConfig,
  type CjProduct,
} from './retrieval/cj-feed';
export {
  CJ_ADVERTISER_LOOKUP_URL,
  verifyAdvertiserRelationship,
  type CjAdvertiser,
  type RelationshipVerdict,
} from './retrieval/cj-relationship';

export { cleanSecret } from './retrieval/feed-source';
