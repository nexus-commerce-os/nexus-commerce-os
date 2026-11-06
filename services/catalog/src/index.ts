// services/catalog — Catalog & Offer (TypeScript)
//
// P0.3 increment 1: the canonical offer schema, the authorized-feed adapter,
// and the validation guard that stands between them. Still NO ingestion
// scheduler, no persistence, no API surface, and nothing wired into the web
// app — those are later increments.
//
// Legitimacy boundary unchanged (ADR-0001, ADR-0010): offers enter only through
// an authorized feed adapter, never by scraping, and this module holds no
// provider credentials. Money is integer minor-units throughout (NFR-CONS-01).
//
// The invariant worth knowing before using any of this: shipping that the
// provider did not state stays MISSING. It is never zero, and an offer whose
// delivered cost is unknown is never eligible for delivered-price ranking.

export {
  addMoney,
  minMoney,
  minorUnitExponent,
  parseBareAmount,
  parseFeedMoney,
  type Money,
  type MoneyParseFailure,
  type MoneyParseResult,
} from './money';

export {
  deliveredCost,
  deliveredPriceRankingEligibility,
  itemPrice,
  missingShipping,
  verifiedShipping,
  type Availability,
  type DeliveredCost,
  type DeliveredCostComponent,
  type ItemCondition,
  type MandatoryFees,
  type Offer,
  type RankingEligibility,
  type ShippingCost,
} from './offer';

export {
  parseShoppingFeed,
  SHOPPING_FEED_NO_FEE_COLUMN,
  type LogicalField,
  type MalformedReason,
  type MalformedRow,
  type ParseOptions,
  type RawShoppingRow,
  type ShoppingFeedParse,
} from './feed/cj-shopping-feed';

export {
  assessFeedFreshness,
  assessFeedWindow,
  describeFreshness,
  feedExportedAt,
  feedExportWindow,
  isReleasable,
  MAX_CLOCK_SKEW_MS,
  MAX_EXPORT_SPREAD_MS,
  MAX_FEED_AGE_MS,
  type FeedExportWindow,
  type FeedFreshness,
} from './freshness';

export {
  buildCatalog,
  isValidGtin,
  type CatalogBuild,
  type CatalogSource,
  type RejectedRow,
  type RejectionReason,
} from './catalog-guard';
